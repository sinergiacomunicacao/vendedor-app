import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { AuthStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleEntrar() {
    setErro("");
    if (!email || !senha) {
      setErro("Preencha email e senha.");
      return;
    }
    setCarregando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (e: any) {
      setErro(mensagemDeErro(e?.code));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Image
        source={require("../../assets/logo-full.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.titulo}>Sinergia Comercial</Text>
      <Text style={styles.subtitulo}>Entre com sua conta de vendedor</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <Pressable style={styles.botao} onPress={handleEntrar} disabled={carregando}>
        {carregando ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.botaoTexto}>Entrar</Text>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Cadastro")}>
        <Text style={styles.link}>Ainda não tem conta? Cadastre-se</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function mensagemDeErro(code?: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Email inválido.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email ou senha incorretos.";
    default:
      return "Não foi possível entrar. Tente novamente.";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background },
  logo: {
    width: "100%",
    height: 140,
    marginBottom: 8,
  },
  titulo: {
    fontSize: 26,
    fontFamily: "Prompt_700Bold",
    textAlign: "center",
    color: colors.primary,
  },
  subtitulo: {
    fontSize: 14,
    fontFamily: "Prompt_400Regular",
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    fontFamily: "Prompt_400Regular",
    backgroundColor: colors.surface,
    color: colors.text,
  },
  erro: {
    color: colors.danger,
    fontFamily: "Prompt_400Regular",
    marginBottom: 12,
    textAlign: "center",
  },
  botao: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  botaoTexto: { color: colors.surface, fontSize: 16, fontFamily: "Prompt_600SemiBold" },
  link: { color: colors.accent, fontFamily: "Prompt_500Medium", textAlign: "center", marginTop: 20 },
});
