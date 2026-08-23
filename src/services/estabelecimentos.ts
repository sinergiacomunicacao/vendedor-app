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
      snapshot.docs.map((doc) => ({ id: doc.id, nome: doc.data().nome as string }))
    );
  });
}

export async function criarProduto(estabelecimentoId: string, nome: string) {
  await addDoc(produtosRef(estabelecimentoId), { nome, criadoEm: serverTimestamp() });
}

export async function atualizarProduto(
  estabelecimentoId: string,
  produtoId: string,
  nome: string
) {
  await updateDoc(doc(db, "estabelecimentos", estabelecimentoId, "produtos", produtoId), {
    nome,
  });
}

export async function excluirProduto(estabelecimentoId: string, produtoId: string) {
  await deleteDoc(doc(db, "estabelecimentos", estabelecimentoId, "produtos", produtoId));
}
