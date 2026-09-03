import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { AppStackParamList } from "../navigation/types";
import { ouvirClientesDoVendedor, ouvirTodosClientes } from "../services/clientes";
import { ouvirVendedores, Vendedor } from "../services/vendedores";
import { colors } from "../theme/colors";
import {
  Cliente,
  ESTAGIOS,
  Estagio,
  diasParaVencimento,
  estabelecimentosDoCliente,
  normalizarProdutoInteresse,
  valorTotalCliente,
} from "../types";
import { formatarMoeda } from "../utils/format";

const CORES_ESTAGIO: Record<Estagio, string> = {
  contato: colors.accent,
  reuniao: colors.warning,
  fechado: colors.success,
  perdido: colors.danger,
};

function labelEstagio(estagio: Estagio) {
  return ESTAGIOS.find((e) => e.id === estagio)?.label ?? estagio;
}

type Props = NativeStackScreenProps<AppStackParamList, "Clientes">;

export default function ClientesScreen({ navigation }: Props) {
  const { user, gestor, sair } = useAuth();
  const insets = useSafeAreaInsets();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [busca, setBusca] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);

  function irPara(tela: "Relatorio" | "Estabelecimentos" | "PrazosContrato") {
    setMenuAberto(false);
    navigation.navigate(tela);
  }

  useEffect(() => {
    if (!user) return;
    // Gestor vê os clientes de toda a equipe nesta mesma tela; vendedor comum
    // continua vendo só a própria carteira.
    const unsubscribe = gestor
      ? ouvirTodosClientes(setClientes)
      : ouvirClientesDoVendedor(user.uid, setClientes);
    return unsubscribe;
  }, [user, gestor]);

  useEffect(() => {
    if (!gestor) return;
    return ouvirVendedores(setVendedores);
  }, [gestor]);

  const nomeVendedor = useMemo(() => {
    const mapa = new Map(vendedores.map((v) => [v.id, v.nome]));
    return (id: string) => mapa.get(id) ?? "Vendedor removido";
  }, [vendedores]);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((cliente) =>
      [
        cliente.razaoSocial,
        cliente.cnpj,
        cliente.responsavel ?? "",
        cliente.telefone,
        cliente.email,
        ...estabelecimentosDoCliente(cliente).map((e) => e.nome),
        cliente.observacoes ?? "",
        gestor ? nomeVendedor(cliente.vendedorId) : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [clientes, busca, gestor, nomeVendedor]);

  const renderItem = useCallback(
    ({ item }: { item: Cliente }) => {
      const estagio = item.estagio ?? "contato";
      const diasRestantes = diasParaVencimento(item);
      const alertaVencimento =
        diasRestantes !== null && diasRestantes <= 15
          ? diasRestantes < 0
            ? `Contrato vencido há ${Math.abs(diasRestantes)} dia${Math.abs(diasRestantes) === 1 ? "" : "s"}`
            : diasRestantes === 0
              ? "Contrato vence hoje"
              : `Contrato vence em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`
          : null;
      return (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("ClienteDetalhe", { clienteId: item.id })}
        >
          <View style={styles.cardTopo}>
            <Text style={styles.razaoSocial}>{item.razaoSocial}</Text>
            <View style={[styles.tagEstagio, { backgroundColor: CORES_ESTAGIO[estagio] }]}>
              <Text style={styles.tagEstagioTexto}>{labelEstagio(estagio)}</Text>
            </View>
          </View>
          {gestor && <Text style={styles.detalheVendedor}>Vendedor: {nomeVendedor(item.vendedorId)}</Text>}
          {alertaVencimento && <Text style={styles.alertaVencimento}>{alertaVencimento}</Text>}
          <Text style={styles.detalhe}>CNPJ: {item.cnpj}</Text>
          {item.responsavel ? (
            <Text style={styles.detalhe}>Responsável: {item.responsavel}</Text>
          ) : null}
          <Text style={styles.detalhe}>Telefone: {item.telefone}</Text>
          <Text style={styles.detalhe}>Email: {item.email}</Text>
          <Text style={styles.detalheValor}>{formatarMoeda(valorTotalCliente(item.produtosInteresse))}</Text>
          <View style={styles.tagsLinha}>
            {estabelecimentosDoCliente(item).map((est) => (
              <View key={est.id} style={[styles.tag, styles.tagEstabelecimento]}>
                <Text style={[styles.tagTexto, styles.tagTextoEstabelecimento]}>{est.nome}</Text>
              </View>
            ))}
            {item.produtosInteresse.map(normalizarProdutoInteresse).map((produto) => (
              <View key={produto.id} style={styles.tag}>
                <Text style={styles.tagTexto}>
                  {produto.nome}
                  {produto.quantidade > 1 ? ` ×${produto.quantidade}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
      );
    },
    [navigation, gestor, nomeVendedor]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.marca}>
          <Image
            source={require("../../assets/logo-mark.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.marcaTexto}>
            <Text style={styles.saudacao} numberOfLines={1}>
              Olá, {user?.displayName ?? "vendedor"}
            </Text>
            <Text style={styles.contagem}>
              {busca.trim()
                ? `${clientesFiltrados.length} de ${clientes.length} cliente${clientes.length === 1 ? "" : "s"}`
                : `${clientes.length} cliente${clientes.length === 1 ? "" : "s"} cadastrado${clientes.length === 1 ? "" : "s"}`}
            </Text>
          </View>
        </View>
        <View style={styles.headerAcoes}>
          {gestor && (
            <Pressable onPress={() => setMenuAberto(true)} hitSlop={8}>
              <Text style={styles.link}>Menu</Text>
            </Pressable>
          )}
          <Pressable onPress={sair} hitSlop={8}>
            <Text style={styles.sair}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={menuAberto}
        onRequestClose={() => setMenuAberto(false)}
      >
        <Pressable style={styles.menuFundo} onPress={() => setMenuAberto(false)}>
          <View style={[styles.menuCaixa, { marginTop: insets.top + 70 }]}>
            <Pressable style={styles.menuItem} onPress={() => irPara("Relatorio")}>
              <Text style={styles.menuItemTexto}>Relatório</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => irPara("Estabelecimentos")}>
              <Text style={styles.menuItemTexto}>Estabelecimentos</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, styles.menuItemUltimo]} onPress={() => irPara("PrazosContrato")}>
              <Text style={styles.menuItemTexto}>Prazos de contrato</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {clientes.length > 0 && (
        <View style={styles.buscaContainer}>
          <TextInput
            style={styles.buscaInput}
            placeholder="Buscar por nome, CNPJ, telefone, email ou estabelecimento"
            value={busca}
            onChangeText={setBusca}
          />
        </View>
      )}

      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vazio}>
            {busca.trim() ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
          </Text>
        }
        renderItem={renderItem}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate("NovoCliente")}>
        <Text style={styles.fabTexto}>+ Novo cliente</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  marca: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  marcaTexto: { flex: 1, minWidth: 0 },
  logo: { width: 34, height: 34, flexShrink: 0 },
  saudacao: { fontSize: 18, fontFamily: "Prompt_600SemiBold", color: colors.primary },
  contagem: { fontSize: 13, fontFamily: "Prompt_400Regular", color: colors.textMuted, marginTop: 2 },
  headerAcoes: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 0 },
  link: { color: colors.accent, fontFamily: "Prompt_600SemiBold" },
  sair: { color: colors.danger, fontFamily: "Prompt_600SemiBold" },
  menuFundo: { flex: 1, backgroundColor: "#00000055" },
  menuCaixa: {
    marginRight: 20,
    marginLeft: "auto",
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 6,
    width: 220,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemUltimo: { borderBottomWidth: 0 },
  menuItemTexto: { color: colors.text, fontFamily: "Prompt_500Medium", fontSize: 15 },
  buscaContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  buscaInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
    backgroundColor: colors.background,
  },
  lista: { padding: 16, paddingBottom: 100 },
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
  razaoSocial: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Prompt_600SemiBold",
    color: colors.primary,
  },
  tagEstagio: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagEstagioTexto: { color: colors.surface, fontSize: 11, fontFamily: "Prompt_600SemiBold" },
  alertaVencimento: {
    fontSize: 13,
    fontFamily: "Prompt_600SemiBold",
    color: colors.danger,
    marginBottom: 6,
  },
  detalhe: { fontSize: 14, fontFamily: "Prompt_400Regular", color: colors.text, marginBottom: 2 },
  detalheVendedor: {
    fontSize: 13,
    fontFamily: "Prompt_500Medium",
    color: colors.textMuted,
    marginBottom: 6,
  },
  detalheValor: { fontSize: 14, fontFamily: "Prompt_600SemiBold", color: colors.primary, marginTop: 2 },
  tagsLinha: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent + "22",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagTexto: { color: colors.accent, fontSize: 12, fontFamily: "Prompt_600SemiBold" },
  tagEstabelecimento: { backgroundColor: colors.warning + "33" },
  tagTextoEstabelecimento: { color: colors.primary },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: colors.primary,
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 22,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabTexto: { color: colors.surface, fontFamily: "Prompt_700Bold", fontSize: 15 },
});
