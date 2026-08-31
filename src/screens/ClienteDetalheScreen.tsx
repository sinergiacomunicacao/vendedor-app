import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import {
  atualizarDataFechamentoCliente,
  atualizarEstagioCliente,
  atualizarObservacoesCliente,
  cancelarCliente,
} from "../services/clientes";
import { colors } from "../theme/colors";
import {
  Cliente,
  ESTAGIOS,
  Estagio,
  estabelecimentosDoCliente,
  labelPrazo,
  produtosPorEstabelecimento,
  valorTotalCliente,
} from "../types";
import { showAlert } from "../utils/alert";
import { formatarMoeda, maskData, parseData } from "../utils/format";

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
  const [dataFechamentoTexto, setDataFechamentoTexto] = useState("");
  const [erroDataFechamento, setErroDataFechamento] = useState("");
  const [salvandoDataFechamento, setSalvandoDataFechamento] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");

  useEffect(() => {
    return onSnapshot(doc(db, "clientes", clienteId), (snapshot) => {
      setCliente(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Cliente) : null);
      setCarregando(false);
    });
  }, [clienteId]);

  useEffect(() => {
    if (!cliente) return;
    setObservacoes(cliente.observacoes ?? "");
    setDataFechamentoTexto(
      cliente.dataFechamento ? new Date(cliente.dataFechamento).toLocaleDateString("pt-BR") : ""
    );
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

  async function handleSalvarDataFechamento() {
    if (!cliente) return;
    setErroDataFechamento("");
    const textoLimpo = dataFechamentoTexto.trim();
    const timestamp = textoLimpo ? parseData(textoLimpo) : null;
    if (textoLimpo && timestamp === null) {
      setErroDataFechamento("Data inválida.");
      return;
    }
    setSalvandoDataFechamento(true);
    try {
      await atualizarDataFechamentoCliente(cliente.id, timestamp);
    } catch {
      showAlert("Erro", "Não foi possível salvar a data de fechamento. Tente novamente.");
    } finally {
      setSalvandoDataFechamento(false);
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
    setMotivoCancelamento("");
    setModalCancelar(true);
  }

  async function confirmarCancelamento() {
    if (!cliente || !motivoCancelamento.trim()) return;
    setExcluindo(true);
    try {
      await cancelarCliente(cliente, motivoCancelamento);
      setModalCancelar(false);
      navigation.goBack();
    } catch {
      setExcluindo(false);
      showAlert("Erro", "Não foi possível cancelar o cliente. Tente novamente.");
    }
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
  const dataFechamentoOriginal = cliente.dataFechamento
    ? new Date(cliente.dataFechamento).toLocaleDateString("pt-BR")
    : "";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <Text style={styles.razaoSocial}>{cliente.razaoSocial}</Text>

      {cliente.cancelado && (
        <View style={styles.avisoCancelado}>
          <Text style={styles.avisoCanceladoTitulo}>
            Cliente cancelado
            {cliente.canceladoEm ? ` em ${new Date(cliente.canceladoEm).toLocaleDateString("pt-BR")}` : ""}
          </Text>
          {cliente.motivoCancelamento ? (
            <Text style={styles.avisoCanceladoTexto}>Motivo: {cliente.motivoCancelamento}</Text>
          ) : null}
        </View>
      )}

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

      <Text style={styles.rotulo}>Data de fechamento do contrato</Text>
      <TextInput
        style={styles.inputData}
        placeholder="dd/mm/aaaa"
        keyboardType="number-pad"
        value={dataFechamentoTexto}
        onChangeText={(v) => setDataFechamentoTexto(maskData(v))}
      />
      {erroDataFechamento ? <Text style={styles.erro}>{erroDataFechamento}</Text> : null}
      {dataFechamentoTexto !== dataFechamentoOriginal && (
        <Pressable
          style={styles.botaoSalvarObservacoes}
          onPress={handleSalvarDataFechamento}
          disabled={salvandoDataFechamento}
        >
          {salvandoDataFechamento ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoSalvarObservacoesTexto}>Salvar data de fechamento</Text>
          )}
        </Pressable>
      )}

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

      <Text style={styles.rotulo}>
        Estabelecimento{estabelecimentosDoCliente(cliente).length > 1 ? "s" : ""}
      </Text>
      <View style={styles.tagsLinha}>
        {estabelecimentosDoCliente(cliente).map((est) => (
          <View key={est.id} style={[styles.tag, styles.tagEstabelecimento]}>
            <Text style={[styles.tagTexto, styles.tagTextoEstabelecimento]}>{est.nome}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.rotulo}>Produtos de interesse</Text>
      {produtosPorEstabelecimento(cliente).map((grupo) => (
        <View key={grupo.estabelecimentoId} style={styles.grupoEstabelecimento}>
          {estabelecimentosDoCliente(cliente).length > 1 && (
            <Text style={styles.grupoEstabelecimentoTitulo}>{grupo.estabelecimentoNome}</Text>
          )}
          <View style={styles.listaProdutos}>
            {grupo.produtos.map((produto) => (
              <View key={produto.id} style={styles.produtoCard}>
                <View style={styles.produtoLinha}>
                  <Text style={styles.produtoNome}>
                    {produto.nome}
                    {produto.quantidade > 1 ? `  ×${produto.quantidade}` : ""}
                  </Text>
                  <Text style={styles.produtoValor}>
                    {formatarMoeda(produto.valorUnitario * produto.quantidade)}
                  </Text>
                </View>
                {produto.prazoMeses ? (
                  <Text style={styles.produtoPrazo}>
                    {labelPrazo(produto.prazoMeses)}
                    {produto.descontoPercentual ? ` · ${produto.descontoPercentual}% de desconto` : ""}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ))}
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

      {!cliente.cancelado && (
        <>
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
        </>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={modalCancelar}
        onRequestClose={() => setModalCancelar(false)}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCaixa}>
            <Text style={styles.modalTitulo}>Cancelar cliente</Text>
            <Text style={styles.modalMensagem}>
              Remover a ficha de "{cliente.razaoSocial}"? Essa ação não pode ser desfeita. Informe o
              motivo do cancelamento:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Motivo do cancelamento"
              multiline
              numberOfLines={3}
              value={motivoCancelamento}
              onChangeText={setMotivoCancelamento}
              autoFocus
            />
            <View style={styles.modalBotoes}>
              <Pressable onPress={() => setModalCancelar(false)} disabled={excluindo}>
                <Text style={styles.modalBotaoVoltarTexto}>Voltar</Text>
              </Pressable>
              <Pressable
                onPress={confirmarCancelamento}
                disabled={excluindo || !motivoCancelamento.trim()}
              >
                {excluindo ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text
                    style={[
                      styles.modalBotaoConfirmarTexto,
                      !motivoCancelamento.trim() && styles.modalBotaoDesabilitado,
                    ]}
                  >
                    Cancelar cliente
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  inputData: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
    maxWidth: 160,
  },
  erro: { color: colors.danger, fontFamily: "Prompt_400Regular", fontSize: 13, marginTop: 6 },
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
  grupoEstabelecimento: { marginBottom: 10 },
  grupoEstabelecimentoTitulo: {
    fontFamily: "Prompt_600SemiBold",
    color: colors.primary,
    fontSize: 12,
    marginBottom: 6,
  },
  listaProdutos: { gap: 6, marginBottom: 8 },
  produtoCard: {
    backgroundColor: colors.accent + "11",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  produtoLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  produtoNome: { color: colors.text, fontSize: 14, fontFamily: "Prompt_500Medium" },
  produtoValor: { color: colors.textMuted, fontSize: 13, fontFamily: "Prompt_400Regular" },
  produtoPrazo: {
    color: colors.success,
    fontSize: 12,
    fontFamily: "Prompt_400Regular",
    marginTop: 4,
  },
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
  avisoCancelado: {
    backgroundColor: colors.danger + "15",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  avisoCanceladoTitulo: { color: colors.danger, fontFamily: "Prompt_600SemiBold", fontSize: 14 },
  avisoCanceladoTexto: {
    color: colors.danger,
    fontFamily: "Prompt_400Regular",
    fontSize: 13,
    marginTop: 4,
  },
  modalFundo: {
    flex: 1,
    backgroundColor: "#00000066",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCaixa: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
  modalTitulo: { fontSize: 17, fontFamily: "Prompt_600SemiBold", color: colors.text, marginBottom: 8 },
  modalMensagem: {
    fontSize: 14,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
    minHeight: 70,
    textAlignVertical: "top",
  },
  modalBotoes: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 16,
  },
  modalBotaoVoltarTexto: { fontSize: 15, fontFamily: "Prompt_400Regular", color: colors.textMuted },
  modalBotaoConfirmarTexto: { fontSize: 15, fontFamily: "Prompt_600SemiBold", color: colors.danger },
  modalBotaoDesabilitado: { color: colors.border },
});
