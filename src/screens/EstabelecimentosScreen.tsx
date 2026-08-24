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
  atualizarEstabelecimento,
  criarEstabelecimento,
  Estabelecimento,
  excluirEstabelecimento,
  ouvirEstabelecimentos,
} from "../services/estabelecimentos";
import { colors } from "../theme/colors";
import { showAlert } from "../utils/alert";

type Props = NativeStackScreenProps<AppStackParamList, "Estabelecimentos">;

export default function EstabelecimentosScreen({ navigation }: Props) {
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

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

  function iniciarEdicao(estabelecimento: Estabelecimento) {
    setEditandoId(estabelecimento.id);
    setNomeEdicao(estabelecimento.nome);
  }

  async function salvarEdicao(id: string) {
    const nomeLimpo = nomeEdicao.trim();
    if (!nomeLimpo) return;
    if (
      estabelecimentos.some(
        (e) => e.id !== id && e.nome.toLowerCase() === nomeLimpo.toLowerCase()
      )
    ) {
      showAlert("Erro", "Já existe um estabelecimento com esse nome.");
      return;
    }
    try {
      await atualizarEstabelecimento(id, nomeLimpo);
      setEditandoId(null);
    } catch {
      showAlert("Erro", "Não foi possível salvar a alteração. Tente novamente.");
    }
  }

  function handleExcluir(estabelecimento: Estabelecimento) {
    showAlert(
      "Excluir estabelecimento",
      `Remover "${estabelecimento.nome}"? Todos os produtos cadastrados nele também serão excluídos. Clientes já cadastrados não são afetados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setExcluindoId(estabelecimento.id);
            try {
              await excluirEstabelecimento(estabelecimento.id);
            } catch {
              showAlert("Erro", "Não foi possível excluir o estabelecimento. Tente novamente.");
            } finally {
              setExcluindoId(null);
            }
          },
        },
      ]
    );
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
        renderItem={({ item }) =>
          editandoId === item.id ? (
            <View style={styles.item}>
              <TextInput
                style={styles.inputEdicao}
                value={nomeEdicao}
                onChangeText={setNomeEdicao}
                autoFocus
              />
              <Pressable onPress={() => salvarEdicao(item.id)}>
                <Text style={styles.acaoSalvar}>Salvar</Text>
              </Pressable>
              <Pressable onPress={() => setEditandoId(null)}>
                <Text style={styles.acaoCancelar}>Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.item}>
              <Pressable
                style={styles.itemNavegavel}
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
              <View style={styles.acoes}>
                <Pressable onPress={() => iniciarEdicao(item)} disabled={excluindoId === item.id}>
                  <Text style={styles.acaoEditar}>Editar</Text>
                </Pressable>
                {excluindoId === item.id ? (
                  <ActivityIndicator color={colors.danger} size="small" />
                ) : (
                  <Pressable onPress={() => handleExcluir(item)}>
                    <Text style={styles.acaoExcluir}>Excluir</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: 20 },
  form: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputEdicao: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 8,
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
    gap: 10,
  },
  itemNavegavel: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTexto: { fontFamily: "Prompt_500Medium", color: colors.text, fontSize: 15 },
  itemSeta: { fontFamily: "Prompt_400Regular", color: colors.accent, fontSize: 13, marginRight: 12 },
  acoes: { flexDirection: "row", alignItems: "center", gap: 16 },
  acaoEditar: { color: colors.accent, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoExcluir: { color: colors.danger, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoSalvar: { color: colors.success, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoCancelar: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
});
