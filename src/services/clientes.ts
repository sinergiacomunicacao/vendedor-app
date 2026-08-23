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
      if (estoque <= 0) {
        throw new Error(`ESGOTADO:${dados.produtosSelecionados[i].nome}`);
      }
    });

    snaps.forEach((snap, i) => {
      const estoque = (snap.data()?.estoque as number) ?? 0;
      tx.update(refs[i], { estoque: estoque - 1 });
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
    const removidos = produtosOriginais.filter(
      (orig) => !dados.produtosSelecionados.some((p) => p.id === orig.id)
    );
    const adicionados = dados.produtosSelecionados.filter(
      (p) => !produtosOriginais.some((orig) => orig.id === p.id)
    );

    const refsRemovidos = removidos.map((p) =>
      doc(db, "estabelecimentos", estabelecimentoIdOriginal, "produtos", p.id)
    );
    const refsAdicionados = adicionados.map((p) =>
      doc(db, "estabelecimentos", dados.estabelecimentoId, "produtos", p.id)
    );

    const snapsRemovidos = await Promise.all(refsRemovidos.map((ref) => tx.get(ref)));
    const snapsAdicionados = await Promise.all(refsAdicionados.map((ref) => tx.get(ref)));

    snapsAdicionados.forEach((snap, i) => {
      const estoque = (snap.data()?.estoque as number) ?? 0;
      if (estoque <= 0) {
        throw new Error(`ESGOTADO:${adicionados[i].nome}`);
      }
    });

    snapsRemovidos.forEach((snap, i) => {
      if (!snap.exists()) return;
      const estoque = (snap.data()?.estoque as number) ?? 0;
      tx.update(refsRemovidos[i], { estoque: estoque + 1 });
    });
    snapsAdicionados.forEach((snap, i) => {
      const estoque = (snap.data()?.estoque as number) ?? 0;
      tx.update(refsAdicionados[i], { estoque: estoque - 1 });
    });

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
    const refs = cliente.estabelecimentoId
      ? cliente.produtosInteresse
          .map(normalizarProdutoInteresse)
          .map((p) => doc(db, "estabelecimentos", cliente.estabelecimentoId, "produtos", p.id))
      : [];
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    snaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const estoque = (snap.data()?.estoque as number) ?? 0;
      tx.update(refs[i], { estoque: estoque + 1 });
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
