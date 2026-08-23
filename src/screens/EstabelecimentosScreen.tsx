import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppStackParamList } from "../navigation/types";
import {
  criarEstabelecimento,
  Estabelecimento,
  ouvirEstabelecimentos,
} from "../services/estabelecimentos";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<AppStackParamList, "Estabelecimentos">;

export default function EstabelecimentosScreen({ navigation }: Props) {
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => ouvirEstabelecimentos(setEstabelecimentos), []);

  async function handleAdicionar() {
    setErro("");
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro("Informe o nome do estabelecimento.");
      return;
    }
    if (estabelecimentos.some((e) => e.nome.toLowerCase() === nomeLimpo.toLowerCase())) {
      setErro("Esse estabelecimento já existe.");
      return;
    }
    setSalvando(true);
    try {
      await criarEstabelecimento(nomeLimpo);
      setNome("");
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nome do novo estabelecimento"
          value={nome}
          onChangeText={setNome}
        />
        <Pressable style={styles.botao} onPress={handleAdicionar} disabled={salvando}>
          {salvando ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoTexto}>Adicionar</Text>
          )}
        </Pressable>
      </View>
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <FlatList
        data={estabelecimentos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhum estabelecimento cadastrado ainda.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() =>
              navigation.navigate("Produtos", {
                estabelecimentoId: item.id,
                estabelecimentoNome: item.nome,
              })
            }
          >
            <Text style={styles.itemTexto}>{item.nome}</Text>
            <Text style={styles.itemSeta}>Produtos ›</Text>
          </Pressable>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: 20 },
  form: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  botao: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  botaoTexto: { color: colors.surface, fontFamily: "Prompt_600SemiBold", fontSize: 14 },
  erro: { color: colors.danger, fontFamily: "Prompt_400Regular", marginTop: 10 },
  lista: { paddingTop: 20 },
  vazio: { color: colors.textMuted, fontFamily: "Prompt_400Regular", textAlign: "center", marginTop: 20 },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemTexto: { fontFamily: "Prompt_500Medium", color: colors.text, fontSize: 15 },
  itemSeta: { fontFamily: "Prompt_400Regular", color: colors.accent, fontSize: 13 },
});
