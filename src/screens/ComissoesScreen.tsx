import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "../contexts/AuthContext";
import {
  definirPercentualContrato,
  definirPercentualPadrao,
  desfazerPagamentoComissao,
  marcarComissaoPaga,
  ouvirComissoes,
  ouvirPercentuaisPadrao,
  RegistroComissao,
} from "../services/comissoes";
import { ouvirTodosClientes } from "../services/clientes";
import { ouvirVendedores, Vendedor } from "../services/vendedores";
import { colors } from "../theme/colors";
import { Cliente } from "../types";
import { LinhaComissao, montarLinhasComissao, SituacaoComissao } from "../utils/comissoes";
import { showAlert } from "../utils/alert";
import { formatarMoeda, formatarPercentual } from "../utils/format";

type Aba = "contratos" | "percentuais";
type FiltroStatus = "todas" | "pagar" | "pagas";

const ROTULO_SITUACAO: Record<SituacaoComissao, string> = {
  ativo: "",
  cancelado: "Contrato cancelado depois do pagamento",
  reaberto: "Saiu de \"Contrato fechado\" depois do pagamento",
  excluido: "Ficha excluída",
};

function data(ms: number) {
  return new Date(ms).toLocaleDateString("pt-BR");
}

// "7,5" ou "7.5" -> 7.5. Devolve null se estiver vazio ou fora de 0–100.
function lerPercentual(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return null;
  const numero = Number(limpo);
  if (Number.isNaN(numero) || numero < 0 || numero > 100) return null;
  return numero;
}

function textoPercentual(valor: number | undefined) {
  return valor === undefined ? "" : String(valor).replace(".", ",");
}

export default function ComissoesScreen() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [registros, setRegistros] = useState<Record<string, RegistroComissao>>({});
  const [padroes, setPadroes] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);

  const [aba, setAba] = useState<Aba>("contratos");
  const [vendedorFiltro, setVendedorFiltro] = useState<string | null>(null);
  const [status, setStatus] = useState<FiltroStatus>("todas");

  // Ajuste de percentual de um contrato (um por vez).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [percentualEdicao, setPercentualEdicao] = useState("");
  const [erroEdicao, setErroEdicao] = useState("");
  // Percentual padrão por vendedor, enquanto digita.
  const [padroesEdicao, setPadroesEdicao] = useState<Record<string, string>>({});
  const [erroPadrao, setErroPadrao] = useState<{ id: string; texto: string } | null>(null);

  useEffect(() => {
    return ouvirTodosClientes((lista) => {
      setClientes(lista);
      setCarregando(false);
    });
  }, []);
  useEffect(() => ouvirVendedores(setVendedores), []);
  useEffect(() => ouvirComissoes(setRegistros), []);
  useEffect(() => ouvirPercentuaisPadrao(setPadroes), []);

  const nomeVendedor = useMemo(() => {
    const mapa = new Map(vendedores.map((v) => [v.id, v.nome]));
    return (id: string) => mapa.get(id) ?? "Vendedor removido";
  }, [vendedores]);

  const linhas = useMemo(
    () => montarLinhasComissao(clientes, registros, padroes, nomeVendedor),
    [clientes, registros, padroes, nomeVendedor]
  );

  const vendedoresComLinhas = useMemo(() => {
    const mapa = new Map<string, string>();
    linhas.forEach((l) => mapa.set(l.vendedorId, l.vendedorNome));
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
  }, [linhas]);

  const doVendedor = useMemo(
    () => linhas.filter((l) => !vendedorFiltro || l.vendedorId === vendedorFiltro),
    [linhas, vendedorFiltro]
  );

  const visiveis = useMemo(
    () =>
      doVendedor.filter((l) =>
        status === "todas" ? true : status === "pagas" ? Boolean(l.pagamento) : !l.pagamento
      ),
    [doVendedor, status]
  );

  const totalAPagar = doVendedor.reduce((t, l) => (l.pagamento ? t : t + l.valor), 0);
  const totalPago = doVendedor.reduce((t, l) => (l.pagamento ? t + l.valor : t), 0);

  function iniciarEdicao(linha: LinhaComissao) {
    setEditandoId(linha.clienteId);
    setPercentualEdicao(textoPercentual(linha.percentual || undefined));
    setErroEdicao("");
  }

  async function salvarPercentualContrato(clienteId: string) {
    const percentual = lerPercentual(percentualEdicao);
    if (percentual === null) {
      setErroEdicao("Informe um percentual entre 0 e 100.");
      return;
    }
    try {
      await definirPercentualContrato(clienteId, percentual);
      setEditandoId(null);
    } catch {
      setErroEdicao("Não foi possível salvar. Tente novamente.");
    }
  }

  async function usarPercentualPadrao(clienteId: string) {
    try {
      await definirPercentualContrato(clienteId, null);
      setEditandoId(null);
    } catch {
      setErroEdicao("Não foi possível salvar. Tente novamente.");
    }
  }

  function pagar(linha: LinhaComissao) {
    if (linha.percentual <= 0) {
      showAlert(
        "Defina o percentual",
        "Esse contrato está sem percentual de comissão. Toque em \"Ajustar %\" ou defina o percentual padrão do vendedor na aba Percentuais."
      );
      return;
    }
    showAlert(
      "Marcar como paga",
      `Comissão de ${formatarMoeda(linha.valor)} (${formatarPercentual(linha.percentual)} de ${formatarMoeda(
        linha.base
      )}) para ${linha.vendedorNome}, do contrato "${linha.razaoSocial}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Marcar como paga",
          onPress: async () => {
            try {
              await marcarComissaoPaga(linha.clienteId, {
                em: Date.now(),
                porId: user?.uid ?? "",
                por: user?.displayName ?? "",
                base: linha.base,
                percentual: linha.percentual,
                valor: linha.valor,
                razaoSocial: linha.razaoSocial,
                vendedorId: linha.vendedorId,
                vendedorNome: linha.vendedorNome,
              });
            } catch {
              showAlert("Erro", "Não foi possível marcar como paga. Tente novamente.");
            }
          },
        },
      ]
    );
  }

  function desfazer(linha: LinhaComissao) {
    showAlert(
      "Desfazer pagamento",
      `A comissão de ${formatarMoeda(linha.valor)} do contrato "${linha.razaoSocial}" volta para "A pagar".`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desfazer",
          style: "destructive",
          onPress: async () => {
            try {
              await desfazerPagamentoComissao(linha.clienteId);
            } catch {
              showAlert("Erro", "Não foi possível desfazer. Tente novamente.");
            }
          },
        },
      ]
    );
  }

  async function salvarPadrao(vendedorId: string) {
    const percentual = lerPercentual(padroesEdicao[vendedorId] ?? "");
    if (percentual === null) {
      setErroPadrao({ id: vendedorId, texto: "Informe um percentual entre 0 e 100." });
      return;
    }
    setErroPadrao(null);
    try {
      await definirPercentualPadrao(vendedorId, percentual);
      setPadroesEdicao((atual) => {
        const { [vendedorId]: _removido, ...resto } = atual;
        return resto;
      });
    } catch {
      setErroPadrao({ id: vendedorId, texto: "Não foi possível salvar. Tente novamente." });
    }
  }

  function renderLinha({ item: linha }: { item: LinhaComissao }) {
    const editando = editandoId === linha.clienteId;
    const paga = Boolean(linha.pagamento);
    const aviso = ROTULO_SITUACAO[linha.situacao];
    return (
      <View style={styles.card}>
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>{linha.razaoSocial}</Text>
          <View style={[styles.selo, paga ? styles.seloPaga : styles.seloAPagar]}>
            <Text style={[styles.seloTexto, paga ? styles.seloTextoPaga : styles.seloTextoAPagar]}>
              {paga ? "Paga" : "A pagar"}
            </Text>
          </View>
        </View>
        <Text style={styles.detalhe}>
          Vendedor: {linha.vendedorNome}
          {linha.dataFechamento ? `  ·  Fechado em ${data(linha.dataFechamento)}` : ""}
        </Text>
        <Text style={styles.detalhe}>Valor do contrato: {formatarMoeda(linha.base)}</Text>
        <Text style={styles.detalhe}>
          Percentual: {linha.percentual > 0 ? formatarPercentual(linha.percentual) : "não definido"}
          {linha.percentualProprio && !paga ? "  (ajustado neste contrato)" : ""}
        </Text>
        <Text style={styles.comissao}>Comissão: {formatarMoeda(linha.valor)}</Text>
        {linha.pagamento ? (
          <Text style={styles.pagoEm}>
            Paga em {data(linha.pagamento.em)}
            {linha.pagamento.por ? ` por ${linha.pagamento.por}` : ""}
          </Text>
        ) : null}
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
        {linha.valorMudouDepoisDePagar ? (
          <Text style={styles.aviso}>O valor do contrato mudou depois do pagamento.</Text>
        ) : null}
        {!paga && linha.percentual <= 0 ? (
          <Text style={styles.aviso}>Defina o percentual para poder pagar.</Text>
        ) : null}

        {editando ? (
          <View style={styles.edicao}>
            <TextInput
              style={styles.input}
              placeholder="Percentual deste contrato (%)"
              keyboardType="decimal-pad"
              value={percentualEdicao}
              onChangeText={setPercentualEdicao}
              autoFocus
            />
            {erroEdicao ? <Text style={styles.erro}>{erroEdicao}</Text> : null}
            <View style={styles.acoes}>
              <Pressable onPress={() => salvarPercentualContrato(linha.clienteId)}>
                <Text style={styles.acaoSalvar}>Salvar</Text>
              </Pressable>
              {linha.percentualProprio ? (
                <Pressable onPress={() => usarPercentualPadrao(linha.clienteId)}>
                  <Text style={styles.acaoEditar}>Usar padrão do vendedor</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setEditandoId(null)}>
                <Text style={styles.acaoCancelar}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.acoes}>
            {paga ? (
              <Pressable onPress={() => desfazer(linha)}>
                <Text style={styles.acaoExcluir}>Desfazer pagamento</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.botaoPagar} onPress={() => pagar(linha)}>
                  <Text style={styles.botaoPagarTexto}>Marcar como paga</Text>
                </Pressable>
                <Pressable onPress={() => iniciarEdicao(linha)}>
                  <Text style={styles.acaoEditar}>Ajustar %</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  const cabecalhoContratos = (
    <View>
      <Text style={styles.rotuloFiltro}>Vendedor</Text>
      <View style={styles.chips}>
        <Chip texto="Todos" ativo={vendedorFiltro === null} onPress={() => setVendedorFiltro(null)} />
        {vendedoresComLinhas.map((v) => (
          <Chip
            key={v.id}
            texto={v.nome}
            ativo={vendedorFiltro === v.id}
            onPress={() => setVendedorFiltro(vendedorFiltro === v.id ? null : v.id)}
          />
        ))}
      </View>
      <Text style={styles.rotuloFiltro}>Situação</Text>
      <View style={styles.chips}>
        <Chip texto="Todas" ativo={status === "todas"} onPress={() => setStatus("todas")} />
        <Chip texto="A pagar" ativo={status === "pagar"} onPress={() => setStatus("pagar")} />
        <Chip texto="Pagas" ativo={status === "pagas"} onPress={() => setStatus("pagas")} />
      </View>
    </View>
  );

  const vendedoresAtivos = vendedores.filter((v) => v.ativo);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.resumo}>
        <View style={styles.resumoCaixa}>
          <Text style={styles.resumoRotulo}>A pagar</Text>
          <Text style={[styles.resumoValor, { color: colors.primary }]}>{formatarMoeda(totalAPagar)}</Text>
        </View>
        <View style={styles.resumoCaixa}>
          <Text style={styles.resumoRotulo}>Pagas</Text>
          <Text style={[styles.resumoValor, { color: colors.success }]}>{formatarMoeda(totalPago)}</Text>
        </View>
      </View>

      <View style={styles.abas}>
        <Pressable
          style={[styles.aba, aba === "contratos" && styles.abaAtiva]}
          onPress={() => setAba("contratos")}
        >
          <Text style={[styles.abaTexto, aba === "contratos" && styles.abaTextoAtivo]}>Contratos</Text>
        </Pressable>
        <Pressable
          style={[styles.aba, aba === "percentuais" && styles.abaAtiva]}
          onPress={() => setAba("percentuais")}
        >
          <Text style={[styles.abaTexto, aba === "percentuais" && styles.abaTextoAtivo]}>Percentuais</Text>
        </Pressable>
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
      ) : aba === "contratos" ? (
        <FlatList
          data={visiveis}
          keyExtractor={(l) => l.clienteId}
          renderItem={renderLinha}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={cabecalhoContratos}
          ListEmptyComponent={
            <Text style={styles.vazio}>
              {linhas.length === 0
                ? "Nenhum contrato fechado ainda. Quando um cliente for para \"Contrato fechado\", a comissão aparece aqui."
                : "Nenhum contrato nesse filtro."}
            </Text>
          }
        />
      ) : (
        <FlatList
          data={vendedoresAtivos}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.ajuda}>
              Percentual de comissão padrão de cada vendedor, aplicado sobre o valor do contrato. Em
              cada contrato você ainda pode ajustar o percentual.
            </Text>
          }
          renderItem={({ item: v }) => {
            const salvo = padroes[v.id];
            const valor = padroesEdicao[v.id] ?? textoPercentual(salvo);
            const mudou = padroesEdicao[v.id] !== undefined;
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitulo}>
                  {v.nome}
                  {v.papel === "gestor" ? "  (gestor)" : ""}
                </Text>
                <Text style={styles.detalhe}>
                  {salvo === undefined ? "Sem percentual definido" : `Padrão atual: ${formatarPercentual(salvo)}`}
                </Text>
                <View style={styles.linhaPadrao}>
                  <TextInput
                    style={[styles.input, styles.inputPadrao]}
                    placeholder="%"
                    keyboardType="decimal-pad"
                    value={valor}
                    onChangeText={(texto) => setPadroesEdicao((atual) => ({ ...atual, [v.id]: texto }))}
                  />
                  <Pressable
                    style={[styles.botaoPagar, !mudou && styles.botaoDesabilitado]}
                    onPress={() => salvarPadrao(v.id)}
                    disabled={!mudou}
                  >
                    <Text style={styles.botaoPagarTexto}>Salvar</Text>
                  </Pressable>
                </View>
                {erroPadrao?.id === v.id ? <Text style={styles.erro}>{erroPadrao.texto}</Text> : null}
              </View>
            );
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function Chip({ texto, ativo, onPress }: { texto: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, ativo && styles.chipAtivo]} onPress={onPress}>
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  resumo: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  resumoCaixa: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  resumoRotulo: { fontSize: 12, fontFamily: "Prompt_500Medium", color: colors.textMuted },
  resumoValor: { fontSize: 18, fontFamily: "Prompt_600SemiBold", marginTop: 2 },
  abas: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  aba: { flex: 1, paddingVertical: 10, alignItems: "center" },
  abaAtiva: { backgroundColor: colors.primary },
  abaTexto: { fontSize: 14, fontFamily: "Prompt_500Medium", color: colors.textMuted },
  abaTextoAtivo: { color: colors.surface, fontFamily: "Prompt_600SemiBold" },
  lista: { padding: 20, paddingBottom: 40 },
  ajuda: {
    fontSize: 13,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  rotuloFiltro: {
    fontSize: 11,
    fontFamily: "Prompt_600SemiBold",
    color: colors.textMuted,
    marginBottom: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  chipAtivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTexto: { fontSize: 12, fontFamily: "Prompt_400Regular", color: colors.textMuted },
  chipTextoAtivo: { color: colors.surface, fontFamily: "Prompt_600SemiBold" },
  vazio: {
    color: colors.textMuted,
    fontFamily: "Prompt_400Regular",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 6,
  },
  cardTitulo: { flex: 1, fontSize: 15, fontFamily: "Prompt_600SemiBold", color: colors.text, marginBottom: 2 },
  selo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  seloAPagar: { backgroundColor: colors.warning + "33" },
  seloPaga: { backgroundColor: colors.success + "33" },
  seloTexto: { fontSize: 12, fontFamily: "Prompt_600SemiBold" },
  seloTextoAPagar: { color: colors.primary },
  seloTextoPaga: { color: colors.primary },
  detalhe: { fontSize: 13, fontFamily: "Prompt_400Regular", color: colors.text, marginBottom: 2 },
  comissao: { fontSize: 15, fontFamily: "Prompt_600SemiBold", color: colors.primary, marginTop: 4 },
  pagoEm: { fontSize: 12, fontFamily: "Prompt_500Medium", color: colors.textMuted, marginTop: 4 },
  aviso: { fontSize: 12, fontFamily: "Prompt_600SemiBold", color: colors.danger, marginTop: 4 },
  edicao: { marginTop: 12, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputPadrao: { flex: 1, minWidth: 0 },
  linhaPadrao: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 10 },
  erro: { color: colors.danger, fontFamily: "Prompt_400Regular", fontSize: 13, marginTop: 6 },
  acoes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16, marginTop: 12 },
  botaoPagar: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  botaoPagarTexto: { color: colors.surface, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  botaoDesabilitado: { opacity: 0.4 },
  acaoEditar: { color: colors.accent, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoExcluir: { color: colors.danger, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoSalvar: { color: colors.success, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoCancelar: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
});
