import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppStackParamList } from "../navigation/types";
import { ouvirTodosClientes } from "../services/clientes";
import { Estabelecimento, ouvirEstabelecimentos } from "../services/estabelecimentos";
import { ouvirVendedores, Vendedor } from "../services/vendedores";
import { colors } from "../theme/colors";
import {
  Cliente,
  ESTAGIOS,
  Estagio,
  labelPrazo,
  normalizarProdutoInteresse,
  valorTotalCliente,
} from "../types";
import { exportarPlanilha } from "../utils/planilha";
import { formatarMoeda, maskData, parseData } from "../utils/format";

type Props = NativeStackScreenProps<AppStackParamList, "Relatorio">;

const CORES_ESTAGIO: Record<Estagio, string> = {
  contato: colors.accent,
  reuniao: colors.warning,
  fechado: colors.success,
  perdido: colors.danger,
};

function labelEstagio(estagio: Estagio) {
  return ESTAGIOS.find((e) => e.id === estagio)?.label ?? estagio;
}

export default function RelatorioScreen({ navigation }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [vendedorIds, setVendedorIds] = useState<string[]>([]);
  const [estabelecimentoNomes, setEstabelecimentoNomes] = useState<string[]>([]);
  const [clienteIds, setClienteIds] = useState<string[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [exportando, setExportando] = useState(false);

  function alternarNaLista<T>(lista: T[], valor: T, setLista: (l: T[]) => void) {
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  }

  useEffect(() => {
    const unsub = ouvirTodosClientes((lista) => {
      setClientes(lista);
      setCarregando(false);
    });
    return unsub;
  }, []);

  useEffect(() => ouvirVendedores(setVendedores), []);
  useEffect(() => ouvirEstabelecimentos(setEstabelecimentos), []);

  const nomeVendedor = useMemo(() => {
    const mapa = new Map(vendedores.map((v) => [v.id, v.nome]));
    return (id: string) => mapa.get(id) ?? "Vendedor removido";
  }, [vendedores]);

  const clientesFiltrados = useMemo(() => {
    const inicio = parseData(dataInicio, false);
    const fim = parseData(dataFim, true);
    return clientes.filter((cliente) => {
      if (vendedorIds.length > 0 && !vendedorIds.includes(cliente.vendedorId)) return false;
      if (estabelecimentoNomes.length > 0 && !estabelecimentoNomes.includes(cliente.estabelecimento))
        return false;
      if (clienteIds.length > 0 && !clienteIds.includes(cliente.id)) return false;
      if (inicio !== null && cliente.criadoEm < inicio) return false;
      if (fim !== null && cliente.criadoEm > fim) return false;
      return true;
    });
  }, [clientes, vendedorIds, estabelecimentoNomes, clienteIds, dataInicio, dataFim]);

  const clientesEncontrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return [];
    return clientes
      .filter((c) => c.razaoSocial.toLowerCase().includes(termo))
      .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial))
      .slice(0, 20);
  }, [clientes, buscaCliente]);

  const clientesSelecionados = useMemo(
    () => clientes.filter((c) => clienteIds.includes(c.id)),
    [clientes, clienteIds]
  );

  const valorTotalFiltrado = useMemo(
    () => clientesFiltrados.reduce((total, c) => total + valorTotalCliente(c.produtosInteresse), 0),
    [clientesFiltrados]
  );

  async function handleExportar() {
    setExportando(true);
    try {
      const colunas = [
        "Razão Social",
        "CNPJ",
        "Telefone",
        "Email",
        "Estabelecimento",
        "Produtos de Interesse",
        "Valor Total",
        "Estágio",
        "Observações",
        "Cancelado",
        "Motivo do Cancelamento",
        "Vendedor",
        "Data de Cadastro",
      ];
      const linhas = clientesFiltrados.map((cliente) => [
        cliente.razaoSocial,
        cliente.cnpj,
        cliente.telefone,
        cliente.email,
        cliente.estabelecimento,
        cliente.produtosInteresse
          .map(normalizarProdutoInteresse)
          .map((p) => {
            const qtd = p.quantidade > 1 ? ` ×${p.quantidade}` : "";
            const prazo = p.prazoMeses
              ? ` (${labelPrazo(p.prazoMeses)}${p.descontoPercentual ? `, -${p.descontoPercentual}%` : ""})`
              : "";
            return `${p.nome}${qtd}${prazo}`;
          })
          .join("; "),
        formatarMoeda(valorTotalCliente(cliente.produtosInteresse)),
        labelEstagio(cliente.estagio ?? "contato"),
        cliente.observacoes ?? "",
        cliente.cancelado ? "Sim" : "Não",
        cliente.motivoCancelamento ?? "",
        nomeVendedor(cliente.vendedorId),
        new Date(cliente.criadoEm).toLocaleDateString("pt-BR"),
      ]);
      await exportarPlanilha("clientes.xlsx", colunas, linhas);
    } finally {
      setExportando(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.filtros}>
        <Text style={styles.label}>Período</Text>
        <View style={styles.linhaData}>
          <TextInput
            style={styles.inputData}
            placeholder="Início dd/mm/aaaa"
            value={dataInicio}
            onChangeText={(v) => setDataInicio(maskData(v))}
            keyboardType="number-pad"
          />
          <TextInput
            style={styles.inputData}
            placeholder="Fim dd/mm/aaaa"
            value={dataFim}
            onChangeText={(v) => setDataFim(maskData(v))}
            keyboardType="number-pad"
          />
        </View>

        <Text style={styles.label}>
          Vendedor{vendedorIds.length > 0 ? ` (${vendedorIds.length})` : ""}
        </Text>
        <View style={styles.opcoes}>
          <Pressable
            style={[styles.opcao, vendedorIds.length === 0 && styles.opcaoSelecionada]}
            onPress={() => setVendedorIds([])}
          >
            <Text
              style={[styles.opcaoTexto, vendedorIds.length === 0 && styles.opcaoTextoSelecionado]}
            >
              Todos
            </Text>
          </Pressable>
          {vendedores.map((v) => {
            const ativo = vendedorIds.includes(v.id);
            return (
              <Pressable
                key={v.id}
                style={[styles.opcao, ativo && styles.opcaoSelecionada]}
                onPress={() => alternarNaLista(vendedorIds, v.id, setVendedorIds)}
              >
                <Text style={[styles.opcaoTexto, ativo && styles.opcaoTextoSelecionado]}>
                  {v.nome}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>
          Estabelecimento{estabelecimentoNomes.length > 0 ? ` (${estabelecimentoNomes.length})` : ""}
        </Text>
        <View style={styles.opcoes}>
          <Pressable
            style={[styles.opcao, estabelecimentoNomes.length === 0 && styles.opcaoSelecionada]}
            onPress={() => setEstabelecimentoNomes([])}
          >
            <Text
              style={[
                styles.opcaoTexto,
                estabelecimentoNomes.length === 0 && styles.opcaoTextoSelecionado,
              ]}
            >
              Todos
            </Text>
          </Pressable>
          {estabelecimentos.map((e) => {
            const ativo = estabelecimentoNomes.includes(e.nome);
            return (
              <Pressable
                key={e.id}
                style={[styles.opcao, ativo && styles.opcaoSelecionada]}
                onPress={() => alternarNaLista(estabelecimentoNomes, e.nome, setEstabelecimentoNomes)}
              >
                <Text style={[styles.opcaoTexto, ativo && styles.opcaoTextoSelecionado]}>
                  {e.nome}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>
          Cliente{clienteIds.length > 0 ? ` (${clienteIds.length})` : ""}
        </Text>
        {clientesSelecionados.length > 0 && (
          <View style={styles.opcoes}>
            {clientesSelecionados.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.opcao, styles.opcaoSelecionada]}
                onPress={() => alternarNaLista(clienteIds, c.id, setClienteIds)}
              >
                <Text style={styles.opcaoTextoSelecionado}>{c.razaoSocial} ×</Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          style={styles.inputBuscaCliente}
          placeholder="Buscar cliente por nome para adicionar"
          value={buscaCliente}
          onChangeText={setBuscaCliente}
        />
        {clientesEncontrados.length > 0 && (
          <View style={styles.opcoes}>
            {clientesEncontrados.map((c) => {
              const ativo = clienteIds.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  style={[styles.opcao, ativo && styles.opcaoSelecionada]}
                  onPress={() => alternarNaLista(clienteIds, c.id, setClienteIds)}
                >
                  <Text style={[styles.opcaoTexto, ativo && styles.opcaoTextoSelecionado]}>
                    {c.razaoSocial}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.totalFiltroLinha}>
          <Text style={styles.totalFiltroLabel}>
            {clientesFiltrados.length} cliente{clientesFiltrados.length === 1 ? "" : "s"}
          </Text>
          <Text style={styles.totalFiltroValor}>{formatarMoeda(valorTotalFiltrado)}</Text>
        </View>

        <Pressable style={styles.botaoExportar} onPress={handleExportar} disabled={exportando}>
          {exportando ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoExportarTexto}>
              Exportar planilha ({clientesFiltrados.length})
            </Text>
          )}
        </Pressable>
      </View>

      {carregando ? (
        <View style={styles.carregando}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={clientesFiltrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={
            <Text style={styles.vazio}>Nenhum cliente encontrado com esses filtros.</Text>
          }
          renderItem={({ item }) => {
            const estagio = item.estagio ?? "contato";
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate("ClienteDetalhe", { clienteId: item.id })}
              >
                <View style={styles.cardTopo}>
                  <Text style={styles.razaoSocial}>{item.razaoSocial}</Text>
                  {item.cancelado ? (
                    <View style={[styles.tagEstagio, { backgroundColor: colors.danger }]}>
                      <Text style={styles.tagEstagioTexto}>Cancelado</Text>
                    </View>
                  ) : (
                    <View style={[styles.tagEstagio, { backgroundColor: CORES_ESTAGIO[estagio] }]}>
                      <Text style={styles.tagEstagioTexto}>{labelEstagio(estagio)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.detalhe}>Vendedor: {nomeVendedor(item.vendedorId)}</Text>
                <Text style={styles.detalhe}>Estabelecimento: {item.estabelecimento}</Text>
                <Text style={styles.detalhe}>
                  Cadastrado em: {new Date(item.criadoEm).toLocaleDateString("pt-BR")}
                </Text>
                {item.cancelado && item.motivoCancelamento ? (
                  <Text style={styles.detalheMotivo}>Motivo: {item.motivoCancelamento}</Text>
                ) : null}
                <Text style={styles.detalheValor}>
                  {formatarMoeda(valorTotalCliente(item.produtosInteresse))}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  carregando: { flex: 1, alignItems: "center", justifyContent: "center" },
  filtros: {
    backgroundColor: colors.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 12,
    fontFamily: "Prompt_600SemiBold",
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 10,
  },
  linhaData: { flexDirection: "row", gap: 8 },
  inputData: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  opcoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inputBuscaCliente: {
    borderWidth: 1,
    minWidth: 0,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
    marginBottom: 8,
  },
  opcao: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  opcaoSelecionada: { backgroundColor: colors.primary, borderColor: colors.primary },
  opcaoTexto: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
  opcaoTextoSelecionado: { color: colors.surface, fontFamily: "Prompt_600SemiBold" },
  totalFiltroLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalFiltroLabel: { fontFamily: "Prompt_400Regular", color: colors.textMuted, fontSize: 13 },
  totalFiltroValor: { fontFamily: "Prompt_700Bold", color: colors.primary, fontSize: 16 },
  botaoExportar: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 14,
  },
  botaoExportarTexto: { color: colors.surface, fontFamily: "Prompt_600SemiBold", fontSize: 14 },
  lista: { padding: 16, paddingBottom: 40 },
  vazio: { textAlign: "center", color: colors.textMuted, fontFamily: "Prompt_400Regular", marginTop: 40 },
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
    marginBottom: 6,
    gap: 8,
  },
  razaoSocial: { flex: 1, fontSize: 16, fontFamily: "Prompt_600SemiBold", color: colors.primary },
  tagEstagio: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagEstagioTexto: { color: colors.surface, fontSize: 11, fontFamily: "Prompt_600SemiBold" },
  detalhe: { fontSize: 14, fontFamily: "Prompt_400Regular", color: colors.text, marginBottom: 2 },
  detalheMotivo: {
    fontSize: 13,
    fontFamily: "Prompt_400Regular",
    color: colors.danger,
    marginTop: 2,
    marginBottom: 2,
  },
  detalheValor: { fontSize: 14, fontFamily: "Prompt_600SemiBold", color: colors.primary, marginTop: 2 },
});
