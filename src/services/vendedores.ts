import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type Papel = "vendedor" | "gestor";

export type PerfilVendedor = {
  nome: string;
  email: string;
  papel: Papel;
  consentimentoLGPD: boolean;
};

export async function criarPerfilVendedor(uid: string, nome: string, email: string) {
  await setDoc(doc(db, "vendedores", uid), {
    nome,
    email,
    papel: "vendedor",
    consentimentoLGPD: true,
    consentimentoLGPDEm: serverTimestamp(),
    criadoEm: serverTimestamp(),
  });
}

export function ouvirPerfilVendedor(
  uid: string,
  callback: (perfil: PerfilVendedor | null) => void
) {
  return onSnapshot(doc(db, "vendedores", uid), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as PerfilVendedor) : null);
  });
}
