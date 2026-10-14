import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type Papel = "vendedor" | "gestor";

export type PerfilVendedor = {
  nome: string;
  email: string;
  papel: Papel;
  consentimentoLGPD: boolean;
  // Ausente = ativo. `false` quando o gestor excluiu o vendedor: o app
  // desloga a pessoa e as regras do Firestore negam o acesso aos dados.
  ativo?: boolean;
};

export type Vendedor = {
  id: string;
  nome: string;
  email?: string;
  papel?: Papel;
  ativo: boolean;
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

// `doCache` indica que o dado veio do cache local e ainda não foi confirmado
// pelo servidor — includeMetadataChanges garante receber também a confirmação,
// mesmo quando o conteúdo é igual ao do cache.
export function ouvirPerfilVendedor(
  uid: string,
  callback: (perfil: PerfilVendedor | null, doCache: boolean) => void
) {
  return onSnapshot(doc(db, "vendedores", uid), { includeMetadataChanges: true }, (snapshot) => {
    callback(
      snapshot.exists() ? (snapshot.data() as PerfilVendedor) : null,
      snapshot.metadata.fromCache
    );
  });
}

export function ouvirVendedores(callback: (vendedores: Vendedor[]) => void) {
  const q = query(collection(db, "vendedores"), orderBy("nome", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((doc) => {
        const dados = doc.data();
        return {
          id: doc.id,
          nome: dados.nome as string,
          email: dados.email as string | undefined,
          papel: dados.papel as Papel | undefined,
          ativo: dados.ativo !== false,
        };
      })
    );
  });
}

// "Excluir" um vendedor é desativar o perfil, não apagar o documento: o login
// (email/senha) vive no Firebase Auth e só dá pra remover pelo Console, e manter
// o perfil preserva o nome nos clientes que ele cadastrou e permite reativar.
export async function excluirVendedor(id: string, porId: string, porNome: string) {
  await updateDoc(doc(db, "vendedores", id), {
    ativo: false,
    excluidoEm: Date.now(),
    excluidoPorId: porId,
    excluidoPor: porNome,
  });
}

export async function reativarVendedor(id: string) {
  await updateDoc(doc(db, "vendedores", id), {
    ativo: true,
    excluidoEm: deleteField(),
    excluidoPorId: deleteField(),
    excluidoPor: deleteField(),
  });
}

// Promover a gestor (ou voltar a vendedor). As regras só deixam um gestor
// alterar o papel de OUTRA pessoa — ninguém muda o próprio papel.
export async function alterarPapelVendedor(id: string, papel: Papel) {
  await updateDoc(doc(db, "vendedores", id), { papel });
}
