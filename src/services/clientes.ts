import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Cliente } from "../types";

const LIMITE_CLIENTES = 200;

function clientesRef() {
  return collection(db, "clientes");
}

export type NovoCliente = Omit<Cliente, "id" | "criadoEm">;

export async function criarCliente(cliente: NovoCliente) {
  await addDoc(clientesRef(), { ...cliente, criadoEm: Date.now() });
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

export async function buscarCliente(id: string): Promise<Cliente | null> {
  const snapshot = await getDoc(doc(db, "clientes", id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<Cliente, "id">) };
}

export async function atualizarCliente(id: string, dados: NovoCliente) {
  await updateDoc(doc(db, "clientes", id), { ...dados });
}

export async function excluirCliente(id: string) {
  await deleteDoc(doc(db, "clientes", id));
}
