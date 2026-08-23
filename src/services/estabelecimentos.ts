import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type Estabelecimento = {
  id: string;
  nome: string;
};

export type Produto = {
  id: string;
  nome: string;
  estoque: number;
  valorTabela: number;
};

function estabelecimentosRef() {
  return collection(db, "estabelecimentos");
}

function produtosRef(estabelecimentoId: string) {
  return collection(db, "estabelecimentos", estabelecimentoId, "produtos");
}

export function ouvirEstabelecimentos(callback: (estabelecimentos: Estabelecimento[]) => void) {
  const q = query(estabelecimentosRef(), orderBy("nome", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((doc) => ({ id: doc.id, nome: doc.data().nome as string }))
    );
  });
}

export async function criarEstabelecimento(nome: string) {
  await addDoc(estabelecimentosRef(), { nome, criadoEm: serverTimestamp() });
}

export function ouvirProdutos(
  estabelecimentoId: string,
  callback: (produtos: Produto[]) => void
) {
  const q = query(produtosRef(estabelecimentoId), orderBy("nome", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        nome: doc.data().nome as string,
        estoque: (doc.data().estoque as number) ?? 0,
        valorTabela: (doc.data().valorTabela as number) ?? 0,
      }))
    );
  });
}

export async function criarProduto(
  estabelecimentoId: string,
  dados: { nome: string; estoque: number; valorTabela: number }
) {
  await addDoc(produtosRef(estabelecimentoId), { ...dados, criadoEm: serverTimestamp() });
}

export async function atualizarProduto(
  estabelecimentoId: string,
  produtoId: string,
  dados: { nome: string; estoque: number; valorTabela: number }
) {
  await updateDoc(doc(db, "estabelecimentos", estabelecimentoId, "produtos", produtoId), dados);
}

export async function excluirProduto(estabelecimentoId: string, produtoId: string) {
  await deleteDoc(doc(db, "estabelecimentos", estabelecimentoId, "produtos", produtoId));
}
