import {
  collection,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Cliente, EmpresaAtendida, Estagio, ProdutoInteresse, produtoComEstabelecimento } from "../types";

const LIMITE_CLIENTES = 200;
const LIMITE_RELATORIO = 1000;
const LIMITE_EMPRESAS_ATENDIDAS = 2000;

function clientesRef() {
  return collection(db, "clientes");
}

function empresaAtendidaRef(clienteId: string) {
  return doc(db, "empresasAtendidas", clienteId);
}

// Chave composta (estabelecimento + produto) — um mesmo produtoId só existe
// dentro da subcoleção de UM estabelecimento, mas usar a chave composta deixa
// o código explícito sobre qual documento de estoque está em jogo.
function chaveProduto(estabelecimentoId: string, produtoId: string) {
  return `${estabelecimentoId}::${produtoId}`;
}

export type DadosCliente = {
  vendedorId: string;
  vendedorNome: string;
  cnpj: string;
  razaoSocial: string;
  responsavel?: string;
  telefone: string;
  email: string;
  produtosSelecionados: ProdutoInteresse[];
  observacoes?: string;
};

export async function criarCliente(dados: DadosCliente) {
  await runTransaction(db, async (tx) => {
    const refs = dados.produtosSelecionados.map((p) =>
      doc(db, "estabelecimentos", p.estabelecimentoId || "", "produtos", p.id)
    );
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    snaps.forEach((snap, i) => {
      const estoque = (snap.data()?.estoque as number) ?? 0;
      const quantidade = dados.produtosSelecionados[i].quantidade;
      if (estoque < quantidade) {
        throw new Error(`ESGOTADO:${dados.produtosSelecionados[i].nome}`);
      }
    });

    snaps.forEach((snap, i) => {
      const estoque = (snap.data()?.estoque as number) ?? 0;
      tx.update(refs[i], { estoque: estoque - dados.produtosSelecionados[i].quantidade });
    });

    const clienteRef = doc(clientesRef());
    const criadoEm = Date.now();
    tx.set(clienteRef, {
      vendedorId: dados.vendedorId,
      cnpj: dados.cnpj,
      razaoSocial: dados.razaoSocial,
      responsavel: dados.responsavel?.trim() ?? "",
      telefone: dados.telefone,
      email: dados.email,
      produtosInteresse: dados.produtosSelecionados,
      estagio: "contato",
      observacoes: dados.observacoes?.trim() ?? "",
      criadoEm,
    });
    // Espelho minimalista (razão social, CNPJ, vendedor) para a lista
    // "Empresas atendidas", legível por qualquer vendedor. O nome do
    // vendedor é gravado aqui (não resolvido via join) porque a coleção
    // vendedores só é listável por gestor.
    tx.set(empresaAtendidaRef(clienteRef.id), {
      razaoSocial: dados.razaoSocial,
      cnpj: dados.cnpj,
      vendedorId: dados.vendedorId,
      vendedorNome: dados.vendedorNome,
      criadoEm,
    });
  });
}

export async function atualizarCliente(
  clienteId: string,
  dados: DadosCliente,
  produtosOriginais: ProdutoInteresse[]
) {
  await runTransaction(db, async (tx) => {
    // Lido antes de qualquer escrita (exigência de transação do Firestore) —
    // usado para manter o espelho em empresasAtendidas com o vendedor e a
    // data originais do cliente, mesmo quando quem edita é um gestor.
    const empresaSnapAntes = await tx.get(empresaAtendidaRef(clienteId));

    const qtdOriginal = new Map(
      produtosOriginais.map((p) => [chaveProduto(p.estabelecimentoId || "", p.id), p.quantidade])
    );
    const qtdNova = new Map(
      dados.produtosSelecionados.map((p) => [chaveProduto(p.estabelecimentoId || "", p.id), p.quantidade])
    );
    const infoPorChave = new Map<string, { estabelecimentoId: string; produtoId: string; nome: string }>();
    [...produtosOriginais, ...dados.produtosSelecionados].forEach((p) => {
      const estabelecimentoId = p.estabelecimentoId || "";
      infoPorChave.set(chaveProduto(estabelecimentoId, p.id), {
        estabelecimentoId,
        produtoId: p.id,
        nome: p.nome,
      });
    });

    const ajustes = Array.from(infoPorChave.entries())
      .map(([chave, info]) => ({
        ...info,
        delta: (qtdNova.get(chave) ?? 0) - (qtdOriginal.get(chave) ?? 0),
      }))
      .filter((a) => a.delta !== 0);

    const refs = ajustes.map((a) =>
      doc(db, "estabelecimentos", a.estabelecimentoId, "produtos", a.produtoId)
    );
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    snaps.forEach((snap, i) => {
      const estoque = (snap.data()?.estoque as number) ?? 0;
      if (ajustes[i].delta > 0 && estoque < ajustes[i].delta) {
        throw new Error(`ESGOTADO:${ajustes[i].nome}`);
      }
    });

    snaps.forEach((snap, i) => {
      const estoque = (snap.data()?.estoque as number) ?? 0;
      tx.update(refs[i], { estoque: estoque - ajustes[i].delta });
    });

    tx.update(doc(db, "clientes", clienteId), {
      cnpj: dados.cnpj,
      razaoSocial: dados.razaoSocial,
      responsavel: dados.responsavel?.trim() ?? "",
      telefone: dados.telefone,
      email: dados.email,
      produtosInteresse: dados.produtosSelecionados,
      observacoes: dados.observacoes?.trim() ?? "",
    });

    const empresaAntes = empresaSnapAntes.data();
    tx.set(empresaAtendidaRef(clienteId), {
      razaoSocial: dados.razaoSocial,
      cnpj: dados.cnpj,
      vendedorId: (empresaAntes?.vendedorId as string) ?? dados.vendedorId,
      vendedorNome: (empresaAntes?.vendedorNome as string) ?? dados.vendedorNome,
      criadoEm: (empresaAntes?.criadoEm as number) ?? Date.now(),
    });
  });
}

export async function atualizarObservacoesCliente(id: string, observacoes: string) {
  await updateDoc(doc(db, "clientes", id), { observacoes: observacoes.trim() });
}

export async function atualizarDataFechamentoCliente(id: string, dataFechamento: number | null) {
  await updateDoc(doc(db, "clientes", id), {
    dataFechamento: dataFechamento === null ? deleteField() : dataFechamento,
  });
}

// Remove um único produto da lista de interesse do cliente e devolve a
// quantidade reservada ao estoque — usado quando o contrato daquele produto
// específico vence (ou é encerrado) mas o cliente em si continua ativo,
// diferente de cancelarCliente() que encerra o cadastro inteiro.
export async function liberarProdutoCliente(
  cliente: Cliente,
  produtoId: string,
  estabelecimentoId: string
) {
  await runTransaction(db, async (tx) => {
    const produtos = cliente.produtosInteresse.map((item) => produtoComEstabelecimento(item, cliente));
    const alvo = produtos.find((p) => p.id === produtoId && p.estabelecimentoId === estabelecimentoId);
    if (!alvo) return;

    if (alvo.estabelecimentoId) {
      const ref = doc(db, "estabelecimentos", alvo.estabelecimentoId, "produtos", alvo.id);
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const estoque = (snap.data()?.estoque as number) ?? 0;
        tx.update(ref, { estoque: estoque + alvo.quantidade });
      }
    }

    const restantes = produtos.filter((p) => !(p.id === produtoId && p.estabelecimentoId === estabelecimentoId));
    tx.update(doc(db, "clientes", cliente.id), { produtosInteresse: restantes });
  });
}

export async function cancelarCliente(cliente: Cliente, motivo: string) {
  await runTransaction(db, async (tx) => {
    const produtos = cliente.produtosInteresse
      .map((item) => produtoComEstabelecimento(item, cliente))
      .filter((p) => p.quantidade > 0 && p.estabelecimentoId);
    const refs = produtos.map((p) =>
      doc(db, "estabelecimentos", p.estabelecimentoId || "", "produtos", p.id)
    );
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    snaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const estoque = (snap.data()?.estoque as number) ?? 0;
      tx.update(refs[i], { estoque: estoque + produtos[i].quantidade });
    });

    tx.update(doc(db, "clientes", cliente.id), {
      cancelado: true,
      motivoCancelamento: motivo.trim(),
      canceladoEm: Date.now(),
    });
  });
}

export async function atualizarEstagioCliente(id: string, estagio: Estagio) {
  await updateDoc(doc(db, "clientes", id), { estagio });
}

export function ouvirClientesDoVendedor(
  vendedorId: string,
  callback: (clientes: Cliente[]) => void
) {
  const q = query(
    clientesRef(),
    where("vendedorId", "==", vendedorId),
    orderBy("criadoEm", "desc"),
    limit(LIMITE_CLIENTES)
  );
  return onSnapshot(q, (snapshot) => {
    const clientes = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Cliente, "id">) }))
      .filter((cliente) => !cliente.cancelado);
    callback(clientes);
  });
}

export function ouvirTodosClientes(callback: (clientes: Cliente[]) => void) {
  const q = query(clientesRef(), orderBy("criadoEm", "desc"), limit(LIMITE_RELATORIO));
  return onSnapshot(q, (snapshot) => {
    const clientes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Cliente, "id">),
    }));
    callback(clientes);
  });
}

export function ouvirEmpresasAtendidas(callback: (empresas: EmpresaAtendida[]) => void) {
  const q = query(
    collection(db, "empresasAtendidas"),
    orderBy("razaoSocial", "asc"),
    limit(LIMITE_EMPRESAS_ATENDIDAS)
  );
  return onSnapshot(q, (snapshot) => {
    const empresas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<EmpresaAtendida, "id">),
    }));
    callback(empresas);
  });
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  const snapshot = await getDoc(doc(db, "clientes", id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<Cliente, "id">) };
}
