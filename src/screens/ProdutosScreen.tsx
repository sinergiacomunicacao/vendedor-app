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
import { formatarMoeda, maskMoeda, parseMoeda } from "../utils/format";

type Props = NativeStackScreenProps<AppStackParamList, "Produtos">;

export default function ProdutosScreen({ route }: Props) {
  const { estabelecimentoId } = route.params;
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nome, setNome] = useState("");
  const [estoque, setEstoque] = useState("");
  const [valorTabela, setValorTabela] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [estoqueEdicao, setEstoqueEdicao] = useState("");
  const [valorEdicao, setValorEdicao] = useState("");
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
    const estoqueNumero = Number(estoque);
    if (!estoque.trim() || Number.isNaN(estoqueNumero) || estoqueNumero < 0) {
      setErro("Informe uma quantidade em estoque válida.");
      return;
    }
    setSalvando(true);
    try {
      await criarProduto(estabelecimentoId, {
        nome: nomeLimpo,
        estoque: Math.floor(estoqueNumero),
        valorTabela: parseMoeda(valorTabela),
      });
      setNome("");
      setEstoque("");
      setValorTabela("");
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(produto: Produto) {
    setEditandoId(produto.id);
    setNomeEdicao(produto.nome);
    setEstoqueEdicao(String(produto.estoque));
    setValorEdicao(produto.valorTabela ? maskMoeda(String(Math.round(produto.valorTabela * 100))) : "");
  }

  async function salvarEdicao(produtoId: string) {
    const nomeLimpo = nomeEdicao.trim();
    const estoqueNumero = Number(estoqueEdicao);
    if (!nomeLimpo || Number.isNaN(estoqueNumero) || estoqueNumero < 0) return;
    try {
      await atualizarProduto(estabelecimentoId, produtoId, {
        nome: nomeLimpo,
        estoque: Math.floor(estoqueNumero),
        valorTabela: parseMoeda(valorEdicao),
      });
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
        <View style={styles.formLinha}>
          <TextInput
            style={styles.inputEstoque}
            placeholder="Estoque"
            keyboardType="number-pad"
            value={estoque}
            onChangeText={setEstoque}
          />
          <TextInput
            style={styles.inputValor}
            placeholder="Valor de tabela"
            keyboardType="number-pad"
            value={valorTabela}
            onChangeText={(v) => setValorTabela(maskMoeda(v))}
          />
          <Pressable style={styles.botao} onPress={handleAdicionar} disabled={salvando}>
            {salvando ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.botaoTexto}>Adicionar</Text>
            )}
          </Pressable>
        </View>
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
              <TextInput
                style={styles.inputEdicaoEstoque}
                value={estoqueEdicao}
                onChangeText={setEstoqueEdicao}
                keyboardType="number-pad"
              />
              <TextInput
                style={styles.inputEdicaoValor}
                value={valorEdicao}
                onChangeText={(v) => setValorEdicao(maskMoeda(v))}
                keyboardType="number-pad"
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
              <View style={styles.itemInfo}>
                <Text style={styles.itemTexto}>{item.nome}</Text>
                <Text style={item.estoque > 0 ? styles.itemEstoque : styles.itemEsgotado}>
                  {item.estoque > 0 ? `Estoque: ${item.estoque}` : "Esgotado"}
                  {"  ·  "}
                  {formatarMoeda(item.valorTabela)}
                </Text>
              </View>
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
  form: { gap: 8 },
  formLinha: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputEstoque: {
    width: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputValor: {
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
  inputEdicaoEstoque: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputEdicaoValor: {
    width: 100,
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
  itemInfo: { flex: 1 },
  itemTexto: { fontFamily: "Prompt_500Medium", color: colors.text, fontSize: 15 },
  itemEstoque: { fontFamily: "Prompt_400Regular", color: colors.textMuted, fontSize: 12, marginTop: 2 },
  itemEsgotado: { fontFamily: "Prompt_600SemiBold", color: colors.danger, fontSize: 12, marginTop: 2 },
  acoes: { flexDirection: "row", gap: 16 },
  acaoEditar: { color: colors.accent, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoExcluir: { color: colors.danger, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoSalvar: { color: colors.success, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoCancelar: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
});
