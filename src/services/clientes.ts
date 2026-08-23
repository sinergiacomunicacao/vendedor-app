import {
  collection,
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
import { Cliente, Estagio, ProdutoInteresse, normalizarProdutoInteresse } from "../types";

const LIMITE_CLIENTES = 200;
const LIMITE_RELATORIO = 1000;

function clientesRef() {
  return collection(db, "clientes");
}

export type DadosCliente = {
  vendedorId: string;
  cnpj: string;
  razaoSocial: string;
  telefone: string;
  email: string;
  estabelecimento: string;
  estabelecimentoId: string;
  produtosSelecionados: ProdutoInteresse[];
};

export async function criarCliente(dados: DadosCliente) {
  await runTransaction(db, async (tx) => {
    const refs = dados.produtosSelecionados.map((p) =>
      doc(db, "estabelecimentos", dados.estabelecimentoId, "produtos", p.id)
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
    tx.set(clienteRef, {
      vendedorId: dados.vendedorId,
      cnpj: dados.cnpj,
      razaoSocial: dados.razaoSocial,
      telefone: dados.telefone,
      email: dados.email,
      estabelecimento: dados.estabelecimento,
      estabelecimentoId: dados.estabelecimentoId,
      produtosInteresse: dados.produtosSelecionados,
      estagio: "contato",
      criadoEm: Date.now(),
    });
  });
}

export async function atualizarCliente(
  clienteId: string,
  dados: DadosCliente,
  produtosOriginais: ProdutoInteresse[],
  estabelecimentoIdOriginal: string
) {
  await runTransaction(db, async (tx) => {
    const mesmoEstabelecimento = estabelecimentoIdOriginal === dados.estabelecimentoId;

    if (mesmoEstabelecimento) {
      const qtdOriginal = new Map(produtosOriginais.map((p) => [p.id, p.quantidade]));
      const qtdNova = new Map(dados.produtosSelecionados.map((p) => [p.id, p.quantidade]));
      const nomes = new Map(dados.produtosSelecionados.map((p) => [p.id, p.nome]));
      produtosOriginais.forEach((p) => nomes.set(p.id, nomes.get(p.id) ?? p.nome));
      const idsEnvolvidos = new Set([...qtdOriginal.keys(), ...qtdNova.keys()]);

      const ajustes = Array.from(idsEnvolvidos)
        .map((id) => ({
          id,
          nome: nomes.get(id) ?? id,
          delta: (qtdNova.get(id) ?? 0) - (qtdOriginal.get(id) ?? 0),
        }))
        .filter((a) => a.delta !== 0);

      const refs = ajustes.map((a) =>
        doc(db, "estabelecimentos", dados.estabelecimentoId, "produtos", a.id)
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
    } else {
      const produtosParaRestaurar = produtosOriginais.filter((p) => p.quantidade > 0);
      const refsRestaurar = produtosParaRestaurar.map((p) =>
        doc(db, "estabelecimentos", estabelecimentoIdOriginal, "produtos", p.id)
      );
      const snapsRestaurar = await Promise.all(refsRestaurar.map((ref) => tx.get(ref)));

      const produtosParaDebitar = dados.produtosSelecionados.filter((p) => p.quantidade > 0);
      const refsDebitar = produtosParaDebitar.map((p) =>
        doc(db, "estabelecimentos", dados.estabelecimentoId, "produtos", p.id)
      );
      const snapsDebitar = await Promise.all(refsDebitar.map((ref) => tx.get(ref)));

      snapsDebitar.forEach((snap, i) => {
        const estoque = (snap.data()?.estoque as number) ?? 0;
        if (estoque < produtosParaDebitar[i].quantidade) {
          throw new Error(`ESGOTADO:${produtosParaDebitar[i].nome}`);
        }
      });

      snapsRestaurar.forEach((snap, i) => {
        if (!snap.exists()) return;
        const estoque = (snap.data()?.estoque as number) ?? 0;
        tx.update(refsRestaurar[i], { estoque: estoque + produtosParaRestaurar[i].quantidade });
      });
      snapsDebitar.forEach((snap, i) => {
        const estoque = (snap.data()?.estoque as number) ?? 0;
        tx.update(refsDebitar[i], { estoque: estoque - produtosParaDebitar[i].quantidade });
      });
    }

    tx.update(doc(db, "clientes", clienteId), {
      cnpj: dados.cnpj,
      razaoSocial: dados.razaoSocial,
      telefone: dados.telefone,
      email: dados.email,
      estabelecimento: dados.estabelecimento,
      estabelecimentoId: dados.estabelecimentoId,
      produtosInteresse: dados.produtosSelecionados,
    });
  });
}

export async function excluirCliente(cliente: Cliente) {
  await runTransaction(db, async (tx) => {
    const produtos = cliente.estabelecimentoId
      ? cliente.produtosInteresse.map(normalizarProdutoInteresse).filter((p) => p.quantidade > 0)
      : [];
    const refs = produtos.map((p) =>
      doc(db, "estabelecimentos", cliente.estabelecimentoId, "produtos", p.id)
    );
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    snaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const estoque = (snap.data()?.estoque as number) ?? 0;
      tx.update(refs[i], { estoque: estoque + produtos[i].quantidade });
    });

    tx.delete(doc(db, "clientes", cliente.id));
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
    const clientes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Cliente, "id">),
    }));
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

export async function buscarCliente(id: string): Promise<Cliente | null> {
  const snapshot = await getDoc(doc(db, "clientes", id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<Cliente, "id">) };
}
