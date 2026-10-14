import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { auth } from "../services/firebase";
import { criarPerfilVendedor, ouvirPerfilVendedor, Papel } from "../services/vendedores";
import { showAlert } from "../utils/alert";

type AuthContextValue = {
  user: User | null;
  papel: Papel | null;
  gestor: boolean;
  loading: boolean;
  cadastrar: (nome: string, email: string, senha: string) => Promise<void>;
  entrar: (email: string, senha: string) => Promise<void>;
  recuperarSenha: (email: string) => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [papel, setPapel] = useState<Papel | null>(null);
  const [loading, setLoading] = useState(true);
  const cadastrandoRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Durante o cadastro o perfil ainda não existe. O usuário só é exposto
      // quando cadastrar() termina; antes disso as telas consultariam o
      // Firestore sem perfil e as regras negariam a consulta.
      if (cadastrandoRef.current && firebaseUser) return;
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setPapel(null);
      return;
    }
    let avisou = false;
    return ouvirPerfilVendedor(user.uid, (perfil, doCache) => {
      if (perfil?.ativo === false) {
        // O cache local pode guardar um "excluído" que o gestor já reativou:
        // só vale o que o servidor confirma.
        if (doCache) return;
        setPapel(null);
        if (!avisou) {
          avisou = true;
          showAlert(
            "Acesso removido",
            "Seu acesso foi removido pelo gestor. Se for engano, fale com ele para reativar."
          );
        }
        signOut(auth);
        return;
      }
      setPapel(perfil?.papel ?? "vendedor");
    });
  }, [user]);

  async function cadastrar(nome: string, email: string, senha: string) {
    cadastrandoRef.current = true;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(credential.user, { displayName: nome });
      await criarPerfilVendedor(credential.user.uid, nome, email.trim());
      setUser({ ...credential.user, displayName: nome });
    } finally {
      cadastrandoRef.current = false;
    }
  }

  async function entrar(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha);
  }

  async function recuperarSenha(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function sair() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        papel,
        gestor: papel === "gestor",
        loading,
        cadastrar,
        entrar,
        recuperarSenha,
        sair,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
