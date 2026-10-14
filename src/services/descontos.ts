import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { DescontoPadrao } from "../types";

// A coleção continua com o nome antigo (`prazosContrato`) para não precisar
// migrar os descontos já cadastrados nem mexer nas regras do Firestore.
function descontosRef() {
  return collection(db, "prazosContrato");
}

type DadosDesconto = { descricao: string; descontoPercentual: number; meses?: number };

export function ouvirDescontos(callback: (descontos: DescontoPadrao[]) => void) {
  // Sem orderBy: o Firestore deixaria de fora os documentos sem `meses`.
  return onSnapshot(descontosRef(), (snapshot) => {
    const lista = snapshot.docs.map((doc) => {
      const dados = doc.data();
      const meses = (dados.meses as number | undefined) ?? 0;
      return {
        id: doc.id,
        descricao: ((dados.descricao as string | undefined) ?? "").trim(),
        descontoPercentual: (dados.descontoPercentual as number) ?? 0,
        ...(meses > 0 ? { meses } : {}),
      };
    });
    lista.sort(
      (a, b) =>
        a.descontoPercentual - b.descontoPercentual ||
        (a.meses ?? 0) - (b.meses ?? 0) ||
        a.descricao.localeCompare(b.descricao, "pt-BR")
    );
    callback(lista);
  });
}

export async function criarDesconto(dados: DadosDesconto) {
  await addDoc(descontosRef(), {
    descricao: dados.descricao,
    descontoPercentual: dados.descontoPercentual,
    ...(dados.meses ? { meses: dados.meses } : {}),
    criadoEm: serverTimestamp(),
  });
}

export async function atualizarDesconto(id: string, dados: DadosDesconto) {
  await updateDoc(doc(db, "prazosContrato", id), {
    descricao: dados.descricao,
    descontoPercentual: dados.descontoPercentual,
    meses: dados.meses ? dados.meses : deleteField(),
  });
}

export async function excluirDesconto(id: string) {
  await deleteDoc(doc(db, "prazosContrato", id));
}
