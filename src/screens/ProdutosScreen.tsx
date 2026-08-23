import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  atualizarProduto,
  criarProduto,
  excluirProduto,
  ouvirProdutos,
  Produto,
} from "../services/estabelecimentos";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<AppStackParamList, "Produtos">;

export default function ProdutosScreen({ route }: Props) {
  const { estabelecimentoId } = route.params;
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nome, setNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => ouvirProdutos(estabelecimentoId, setProdutos), [estabelecimentoId]);

  async function handleAdicionar() {
    setErro("");
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro("Informe o nome do produto.");
      return;
    }
    if (produtos.some((p) => p.nome.toLowerCase() === nomeLimpo.toLowerCase())) {
      setErro("Esse produto já existe nesse estabelecimento.");
      return;
    }
    setSalvando(true);
    try {
      await criarProduto(estabelecimentoId, nomeLimpo);
      setNome("");
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(produto: Produto) {
    setEditandoId(produto.id);
    setNomeEdicao(produto.nome);
  }

  async function salvarEdicao(produtoId: string) {
    const nomeLimpo = nomeEdicao.trim();
    if (!nomeLimpo) return;
    try {
      await atualizarProduto(estabelecimentoId, produtoId, nomeLimpo);
      setEditandoId(null);
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a alteração. Tente novamente.");
    }
  }

  function handleExcluir(produto: Produto) {
    Alert.alert("Excluir produto", `Remover "${produto.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await excluirProduto(estabelecimentoId, produto.id);
          } catch {
            Alert.alert("Erro", "Não foi possível excluir o produto. Tente novamente.");
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nome do novo produto"
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
        data={produtos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhum produto cadastrado ainda.</Text>
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
              <Text style={styles.itemTexto}>{item.nome}</Text>
              <View style={styles.acoes}>
                <Pressable onPress={() => iniciarEdicao(item)}>
                  <Text style={styles.acaoEditar}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => handleExcluir(item)}>
                  <Text style={styles.acaoExcluir}>Excluir</Text>
                </Pressable>
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
  itemTexto: { fontFamily: "Prompt_500Medium", color: colors.text, fontSize: 15 },
  acoes: { flexDirection: "row", gap: 16 },
  acaoEditar: { color: colors.accent, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoExcluir: { color: colors.danger, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoSalvar: { color: colors.success, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoCancelar: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
});
