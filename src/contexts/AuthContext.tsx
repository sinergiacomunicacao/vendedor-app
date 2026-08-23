import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { auth } from "../services/firebase";
import { criarPerfilVendedor, ouvirPerfilVendedor, Papel } from "../services/vendedores";

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
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
    return ouvirPerfilVendedor(user.uid, (perfil) => {
      setPapel(perfil?.papel ?? "vendedor");
    });
  }, [user]);

  async function cadastrar(nome: string, email: string, senha: string) {
    const credential = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(credential.user, { displayName: nome });
    await criarPerfilVendedor(credential.user.uid, nome, email.trim());
    setUser({ ...credential.user, displayName: nome });
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
