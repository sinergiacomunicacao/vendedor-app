import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { AppStackParamList } from "../navigation/types";
import { db } from "../services/firebase";
import { atualizarEstagioCliente, atualizarObservacoesCliente, excluirCliente } from "../services/clientes";
import { colors } from "../theme/colors";
import { Cliente, ESTAGIOS, Estagio, normalizarProdutoInteresse, valorTotalCliente } from "../types";
import { showAlert } from "../utils/alert";
import { formatarMoeda } from "../utils/format";

const CORES_ESTAGIO: Record<Estagio, string> = {
  contato: colors.accent,
  reuniao: colors.warning,
  fechado: colors.success,
  perdido: colors.danger,
};

type Props = NativeStackScreenProps<AppStackParamList, "ClienteDetalhe">;

export default function ClienteDetalheScreen({ navigation, route }: Props) {
  const { clienteId } = route.params;
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);
  const [mudandoEstagio, setMudandoEstagio] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [salvandoObservacoes, setSalvandoObservacoes] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, "clientes", clienteId), (snapshot) => {
      setCliente(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Cliente) : null);
      setCarregando(false);
    });
  }, [clienteId]);

  useEffect(() => {
    if (cliente) setObservacoes(cliente.observacoes ?? "");
  }, [cliente?.id]);

  async function handleSalvarObservacoes() {
    if (!cliente) return;
    setSalvandoObservacoes(true);
    try {
      await atualizarObservacoesCliente(cliente.id, observacoes);
    } catch {
      showAlert("Erro", "Não foi possível salvar as observações. Tente novamente.");
    } finally {
      setSalvandoObservacoes(false);
    }
  }

  async function handleMudarEstagio(estagio: Estagio) {
    if (!cliente || estagio === (cliente.estagio ?? "contato")) return;
    setMudandoEstagio(true);
    try {
      await atualizarEstagioCliente(cliente.id, estagio);
    } catch {
      showAlert("Erro", "Não foi possível atualizar o estágio. Tente novamente.");
    } finally {
      setMudandoEstagio(false);
    }
  }

  function handleCancelar() {
    showAlert(
      "Cancelar cliente",
      `Remover a ficha de "${cliente?.razaoSocial}"? Essa ação não pode ser desfeita.`,
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Cancelar cliente",
          style: "destructive",
          onPress: async () => {
            if (!cliente) return;
            setExcluindo(true);
            try {
              await excluirCliente(cliente);
              navigation.goBack();
            } catch {
              setExcluindo(false);
              showAlert("Erro", "Não foi possível cancelar o cliente. Tente novamente.");
            }
          },
        },
      ]
    );
  }

  if (carregando) {
    return (
      <View style={styles.carregando}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!cliente) {
    return (
      <View style={styles.carregando}>
        <Text style={styles.vazio}>Esse cliente não existe mais.</Text>
      </View>
    );
  }

  const estagioAtual = cliente.estagio ?? "contato";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <Text style={styles.razaoSocial}>{cliente.razaoSocial}</Text>

      <Text style={styles.rotulo}>Estágio</Text>
      <View style={styles.tagsLinha}>
        {ESTAGIOS.map((estagio) => {
          const ativo = estagio.id === estagioAtual;
          const cor = CORES_ESTAGIO[estagio.id];
          return (
            <Pressable
              key={estagio.id}
              style={[
                styles.pillEstagio,
                { borderColor: cor },
                ativo && { backgroundColor: cor },
              ]}
              onPress={() => handleMudarEstagio(estagio.id)}
              disabled={mudandoEstagio}
            >
              <Text style={[styles.pillEstagioTexto, { color: ativo ? colors.surface : cor }]}>
                {estagio.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.campo}>
        <Text style={styles.rotulo}>CNPJ</Text>
        <Text style={styles.valor}>{cliente.cnpj}</Text>
      </View>
      <View style={styles.campo}>
        <Text style={styles.rotulo}>Telefone</Text>
        <Text style={styles.valor}>{cliente.telefone}</Text>
      </View>
      <View style={styles.campo}>
        <Text style={styles.rotulo}>Email</Text>
        <Text style={styles.valor}>{cliente.email}</Text>
      </View>

      <Text style={styles.rotulo}>Estabelecimento</Text>
      <View style={styles.tagsLinha}>
        <View style={[styles.tag, styles.tagEstabelecimento]}>
          <Text style={[styles.tagTexto, styles.tagTextoEstabelecimento]}>
            {cliente.estabelecimento}
          </Text>
        </View>
      </View>

      <Text style={styles.rotulo}>Produtos de interesse</Text>
      <View style={styles.listaProdutos}>
        {cliente.produtosInteresse.map(normalizarProdutoInteresse).map((produto) => (
          <View key={produto.id} style={styles.produtoLinha}>
            <Text style={styles.produtoNome}>
              {produto.nome}
              {produto.quantidade > 1 ? `  ×${produto.quantidade}` : ""}
            </Text>
            <Text style={styles.produtoValor}>
              {formatarMoeda(produto.valorUnitario * produto.quantidade)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.totalLinha}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValor}>
          {formatarMoeda(valorTotalCliente(cliente.produtosInteresse))}
        </Text>
      </View>

      <Text style={styles.rotulo}>Observações</Text>
      <TextInput
        style={styles.inputObservacoes}
        placeholder="Anotações sobre o cliente, histórico de contato, etc."
        multiline
        numberOfLines={4}
        value={observacoes}
        onChangeText={setObservacoes}
      />
      {observacoes !== (cliente.observacoes ?? "") && (
        <Pressable
          style={styles.botaoSalvarObservacoes}
          onPress={handleSalvarObservacoes}
          disabled={salvandoObservacoes}
        >
          {salvandoObservacoes ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoSalvarObservacoesTexto}>Salvar observações</Text>
          )}
        </Pressable>
      )}

      <Pressable
        style={styles.botaoEditar}
        onPress={() => navigation.navigate("NovoCliente", { clienteId })}
      >
        <Text style={styles.botaoEditarTexto}>Editar cliente</Text>
      </Pressable>

      <Pressable style={styles.botaoCancelar} onPress={handleCancelar} disabled={excluindo}>
        {excluindo ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <Text style={styles.botaoCancelarTexto}>Cancelar cliente</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  carregando: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  vazio: { color: colors.textMuted, fontFamily: "Prompt_400Regular" },
  conteudo: { padding: 20 },
  razaoSocial: {
    fontSize: 22,
    fontFamily: "Prompt_700Bold",
    color: colors.primary,
    marginBottom: 12,
  },
  pillEstagio: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillEstagioTexto: { fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  campo: { marginBottom: 14 },
  rotulo: {
    fontSize: 12,
    fontFamily: "Prompt_600SemiBold",
    color: colors.textMuted,
    marginBottom: 4,
    marginTop: 8,
  },
  valor: { fontSize: 16, fontFamily: "Prompt_400Regular", color: colors.text },
  tagsLinha: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tag: {
    backgroundColor: colors.accent + "22",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagTexto: { color: colors.accent, fontSize: 13, fontFamily: "Prompt_600SemiBold" },
  tagEstabelecimento: { backgroundColor: colors.warning + "33" },
  tagTextoEstabelecimento: { color: colors.primary },
  listaProdutos: { gap: 6, marginBottom: 8 },
  produtoLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.accent + "11",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  produtoNome: { color: colors.text, fontSize: 14, fontFamily: "Prompt_500Medium" },
  produtoValor: { color: colors.textMuted, fontSize: 13, fontFamily: "Prompt_400Regular" },
  totalLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontFamily: "Prompt_600SemiBold", color: colors.textMuted, fontSize: 14 },
  totalValor: { fontFamily: "Prompt_700Bold", color: colors.primary, fontSize: 18 },
  inputObservacoes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
    minHeight: 90,
    textAlignVertical: "top",
  },
  botaoSalvarObservacoes: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 10,
  },
  botaoSalvarObservacoesTexto: { color: colors.surface, fontSize: 14, fontFamily: "Prompt_600SemiBold" },
  botaoEditar: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 28,
  },
  botaoEditarTexto: { color: colors.surface, fontSize: 16, fontFamily: "Prompt_600SemiBold" },
  botaoCancelar: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  botaoCancelarTexto: { color: colors.danger, fontSize: 16, fontFamily: "Prompt_600SemiBold" },
});
