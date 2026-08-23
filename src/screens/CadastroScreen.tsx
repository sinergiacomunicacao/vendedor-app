import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { AuthStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { isValidEmail } from "../utils/format";

type Props = NativeStackScreenProps<AuthStackParamList, "Cadastro">;

export default function CadastroScreen({ navigation }: Props) {
  const { cadastrar } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aceitouLGPD, setAceitouLGPD] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleCadastrar() {
    setErro("");
    if (!nome.trim()) {
      setErro("Informe seu nome.");
      return;
    }
    if (!isValidEmail(email)) {
      setErro("Informe um email válido.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (!aceitouLGPD) {
      setErro("É necessário autorizar o tratamento dos seus dados para continuar.");
      return;
    }
    setCarregando(true);
    try {
      await cadastrar(nome.trim(), email.trim(), senha);
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titulo}>Criar conta de vendedor</Text>

        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          value={nome}
          onChangeText={setNome}
        />
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
          placeholder="Senha (mín. 6 caracteres)"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        <Pressable style={styles.consentimento} onPress={() => setAceitouLGPD((v) => !v)}>
          <View style={[styles.checkbox, aceitouLGPD && styles.checkboxMarcado]}>
            {aceitouLGPD && <Text style={styles.checkboxMarca}>✓</Text>}
          </View>
          <Text style={styles.consentimentoTexto}>
            Autorizo o tratamento dos meus dados pessoais (nome, email) para uso deste
            aplicativo, conforme a LGPD.
          </Text>
        </Pressable>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <Pressable style={styles.botao} onPress={handleCadastrar} disabled={carregando}>
          {carregando ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoTexto}>Cadastrar</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Login")}>
          <Text style={styles.link}>Já tem conta? Entrar</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function mensagemDeErro(code?: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Este email já está cadastrado.";
    case "auth/invalid-email":
      return "Email inválido.";
    case "auth/weak-password":
      return "Senha muito fraca.";
    default:
      return "Não foi possível cadastrar. Tente novamente.";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  titulo: {
    fontSize: 24,
    fontFamily: "Prompt_700Bold",
    textAlign: "center",
    marginBottom: 32,
    color: colors.primary,
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
  consentimento: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
    paddingRight: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxMarcado: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMarca: { color: colors.surface, fontSize: 14, fontFamily: "Prompt_700Bold" },
  consentimentoTexto: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    lineHeight: 18,
  },
  erro: {
    color: colors.danger,
    fontFamily: "Prompt_400Regular",
    marginTop: 12,
    textAlign: "center",
  },
  botao: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  botaoTexto: { color: colors.surface, fontSize: 16, fontFamily: "Prompt_600SemiBold" },
  link: { color: colors.accent, fontFamily: "Prompt_500Medium", textAlign: "center", marginTop: 20 },
});
