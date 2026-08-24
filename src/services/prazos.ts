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
import { PrazoContrato } from "../types";

function prazosRef() {
  return collection(db, "prazosContrato");
}

export function ouvirPrazos(callback: (prazos: PrazoContrato[]) => void) {
  const q = query(prazosRef(), orderBy("meses", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        meses: (doc.data().meses as number) ?? 0,
        descontoPercentual: (doc.data().descontoPercentual as number) ?? 0,
      }))
    );
  });
}

export async function criarPrazo(dados: { meses: number; descontoPercentual: number }) {
  await addDoc(prazosRef(), { ...dados, criadoEm: serverTimestamp() });
}

export async function atualizarPrazo(
  id: string,
  dados: { meses: number; descontoPercentual: number }
) {
  await updateDoc(doc(db, "prazosContrato", id), dados);
}

export async function excluirPrazo(id: string) {
  await deleteDoc(doc(db, "prazosContrato", id));
}
