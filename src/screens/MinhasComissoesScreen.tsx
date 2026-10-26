import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { ouvirMinhasComissoes, PapelComissao, ProjecaoComId } from "../services/comissoes";
import { colors } from "../theme/colors";
import { formatarMoeda, formatarPercentual } from "../utils/format";

type FiltroStatus = "todas" | "pagar" | "pagas";

const ROTULO_MEU_PAPEL: Record<PapelComissao, string> = {
  vendedor: "Você fechou esta venda",
  fixo: "Comissão em todos os contratos",
  estabelecimento: "Estabelecimento",
  agencia: "Agência",
};

const AVISO_SITUACAO = {
  ativo: "",
  cancelado: "Contrato cancelado depois do pagamento",
  reaberto: "Saiu de \"Contrato fechado\" depois do pagamento",
  excluido: "Ficha excluída",
} as const;

function data(ms: number) {
  return new Date(ms).toLocaleDateString("pt-BR");
}

export default function MinhasComissoesScreen() {
  const { user } = useAuth();
  const [linhas, setLinhas] = useState<ProjecaoComId[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState<FiltroStatus>("todas");

  useEffect(() => {
    if (!user) return;
    return ouvirMinhasComissoes(user.uid, (lista) => {
      setLinhas(lista);
      setCarregando(false);
    });
  }, [user]);

  // Mais recentes primeiro: pela data de fechamento, ou pelo pagamento.
  const ordenadas = useMemo(
    () =>
      [...linhas].sort(
        (a, b) => (b.dataFechamento ?? b.pagaEm ?? 0) - (a.dataFechamento ?? a.pagaEm ?? 0)
      ),
    [linhas]
  );

  const visiveis = ordenadas.filter((l) =>
    status === "todas" ? true : status === "pagas" ? l.paga : !l.paga
  );
  const totalAPagar = linhas.reduce((t, l) => (l.paga ? t : t + l.valor), 0);
  const totalPago = linhas.reduce((t, l) => (l.paga ? t + l.valor : t), 0);
  const atualizadoEm = linhas.reduce((max, l) => Math.max(max, l.atualizadoEm ?? 0), 0);

  function renderLinha({ item }: { item: ProjecaoComId }) {
    const aviso = AVISO_SITUACAO[item.situacao];
    return (
      <View style={styles.card}>
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>{item.razaoSocial}</Text>
          <View style={[styles.selo, item.paga ? styles.seloPaga : styles.seloAPagar]}>
            <Text style={styles.seloTexto}>{item.paga ? "Recebida" : "A receber"}</Text>
          </View>
        </View>
        <Text style={styles.detalhe}>{ROTULO_MEU_PAPEL[item.papel]}</Text>
        {item.papel !== "vendedor" ? (
          <Text style={styles.detalhe}>Vendedor: {item.vendedorNome}</Text>
        ) : null}
        {item.dataFechamento ? (
          <Text style={styles.detalhe}>Fechado em {data(item.dataFechamento)}</Text>
        ) : null}
        <Text style={styles.detalhe}>
          {formatarPercentual(item.percentual)} de {formatarMoeda(item.base)}
        </Text>
        <Text style={styles.comissao}>{formatarMoeda(item.valor)}</Text>
        {item.paga && item.pagaEm ? <Text style={styles.pagoEm}>Paga em {data(item.pagaEm)}</Text> : null}
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.resumo}>
        <View style={styles.resumoCaixa}>
          <Text style={styles.resumoRotulo}>A receber</Text>
          <Text style={[styles.resumoValor, { color: colors.primary }]}>{formatarMoeda(totalAPagar)}</Text>
        </View>
        <View style={styles.resumoCaixa}>
          <Text style={styles.resumoRotulo}>Já recebido</Text>
          <Text style={[styles.resumoValor, { color: colors.success }]}>{formatarMoeda(totalPago)}</Text>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
      ) : (
        <FlatList
          data={visiveis}
          keyExtractor={(l) => l.id}
          renderItem={renderLinha}
          contentContainerStyle={styles.lista}
          ListHeaderComponent={
            <View>
              <View style={styles.chips}>
                <Chip texto="Todas" ativo={status === "todas"} onPress={() => setStatus("todas")} />
                <Chip texto="A receber" ativo={status === "pagar"} onPress={() => setStatus("pagar")} />
                <Chip texto="Recebidas" ativo={status === "pagas"} onPress={() => setStatus("pagas")} />
              </View>
            </View>
          }
          ListFooterComponent={
            atualizadoEm > 0 ? (
              <Text style={styles.rodape}>
                Valores atualizados em {data(atualizadoEm)},{" "}
                {new Date(atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.vazio}>
              {linhas.length === 0
                ? "Você ainda não tem comissões. Quando um contrato seu for fechado, a comissão aparece aqui."
                : "Nenhuma comissão nesse filtro."}
            </Text>
          }
        />
      )}
    </View>
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
  lista: { padding: 20, paddingBottom: 40 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
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
  rodape: {
    fontSize: 12,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
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
    marginBottom: 4,
  },
  cardTitulo: { flex: 1, fontSize: 15, fontFamily: "Prompt_600SemiBold", color: colors.text },
  selo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  seloAPagar: { backgroundColor: colors.warning + "33" },
  seloPaga: { backgroundColor: colors.success + "33" },
  seloTexto: { fontSize: 12, fontFamily: "Prompt_600SemiBold", color: colors.primary },
  detalhe: { fontSize: 13, fontFamily: "Prompt_400Regular", color: colors.text, marginBottom: 2 },
  comissao: { fontSize: 16, fontFamily: "Prompt_600SemiBold", color: colors.primary, marginTop: 4 },
  pagoEm: { fontSize: 12, fontFamily: "Prompt_500Medium", color: colors.textMuted, marginTop: 4 },
  aviso: { fontSize: 12, fontFamily: "Prompt_600SemiBold", color: colors.danger, marginTop: 4 },
});
