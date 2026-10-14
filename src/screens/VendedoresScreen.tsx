import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import {
  alterarPapelVendedor,
  excluirVendedor,
  ouvirVendedores,
  Papel,
  reativarVendedor,
  Vendedor,
} from "../services/vendedores";
import { colors } from "../theme/colors";
import { showAlert } from "../utils/alert";

export default function VendedoresScreen() {
  const { user } = useAuth();
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);

  useEffect(() => ouvirVendedores(setVendedores), []);

  const ativos = useMemo(() => vendedores.filter((v) => v.ativo), [vendedores]);
  const quantidadeExcluidos = vendedores.length - ativos.length;
  const lista = mostrarExcluidos ? vendedores : ativos;

  function handleExcluir(vendedor: Vendedor) {
    const aviso =
      vendedor.papel === "gestor" ? " Atenção: essa pessoa é gestora e perde essa permissão junto." : "";
    showAlert(
      "Excluir vendedor",
      `Excluir "${vendedor.nome}"? Ele perde o acesso ao app na hora. Os clientes que ele cadastrou continuam no sistema, e dá para reativá-lo depois.${aviso}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await excluirVendedor(vendedor.id, user?.uid ?? "", user?.displayName ?? "Gestor");
            } catch {
              showAlert("Erro", "Não foi possível excluir o vendedor. Tente novamente.");
            }
          },
        },
      ]
    );
  }

  function handleAlterarPapel(vendedor: Vendedor, papel: Papel) {
    const promover = papel === "gestor";
    showAlert(
      promover ? "Promover a gestor" : "Tornar vendedor",
      promover
        ? `Promover "${vendedor.nome}" a gestor? Ele passa a ver todos os clientes, editar ou excluir qualquer cadastro, aprovar descontos e gerenciar os vendedores.`
        : `Tirar a permissão de gestor de "${vendedor.nome}"? Ele volta a ver só os próprios clientes.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: promover ? "Promover" : "Confirmar",
          onPress: async () => {
            try {
              await alterarPapelVendedor(vendedor.id, papel);
            } catch {
              showAlert("Erro", "Não foi possível alterar a permissão. Tente novamente.");
            }
          },
        },
      ]
    );
  }

  function handleReativar(vendedor: Vendedor) {
    showAlert("Reativar vendedor", `Reativar "${vendedor.nome}"? Ele volta a poder entrar no app.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Reativar",
        onPress: async () => {
          try {
            await reativarVendedor(vendedor.id);
          } catch {
            showAlert("Erro", "Não foi possível reativar o vendedor. Tente novamente.");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.ajuda}>
        Quem for excluído perde o acesso ao app na hora. O e-mail da pessoa continua reservado:
        para ela voltar, reative aqui em vez de criar outra conta.
      </Text>

      <Text style={styles.contagem}>
        {ativos.length} vendedor{ativos.length === 1 ? "" : "es"} ativo{ativos.length === 1 ? "" : "s"}
      </Text>

      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum vendedor cadastrado.</Text>}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemInfo}>
              <View style={styles.nomeLinha}>
                <Text style={[styles.nome, !item.ativo && styles.nomeExcluido]}>{item.nome}</Text>
                {item.papel === "gestor" && (
                  <View style={styles.tag}>
                    <Text style={styles.tagTexto}>Gestor</Text>
                  </View>
                )}
                {!item.ativo && (
                  <View style={[styles.tag, styles.tagExcluido]}>
                    <Text style={[styles.tagTexto, styles.tagTextoExcluido]}>Excluído</Text>
                  </View>
                )}
              </View>
              {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
            </View>
            {item.id === user?.uid ? (
              <Text style={styles.voce}>Você</Text>
            ) : (
              <View style={styles.acoes}>
                {item.ativo &&
                  (item.papel === "gestor" ? (
                    <Pressable onPress={() => handleAlterarPapel(item, "vendedor")} hitSlop={8}>
                      <Text style={styles.acaoPapel}>Tornar vendedor</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => handleAlterarPapel(item, "gestor")} hitSlop={8}>
                      <Text style={styles.acaoPapel}>Promover a gestor</Text>
                    </Pressable>
                  ))}
                {item.ativo ? (
                  <Pressable onPress={() => handleExcluir(item)} hitSlop={8}>
                    <Text style={styles.acaoExcluir}>Excluir</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => handleReativar(item)} hitSlop={8}>
                    <Text style={styles.acaoReativar}>Reativar</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          quantidadeExcluidos > 0 ? (
            <Pressable onPress={() => setMostrarExcluidos((v) => !v)} style={styles.alternar}>
              <Text style={styles.alternarTexto}>
                {mostrarExcluidos
                  ? "Ocultar excluídos"
                  : `Mostrar excluídos (${quantidadeExcluidos})`}
              </Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: 20 },
  ajuda: {
    fontSize: 13,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  contagem: {
    fontSize: 12,
    fontFamily: "Prompt_500Medium",
    color: colors.textMuted,
    marginBottom: 8,
  },
  lista: { paddingBottom: 20 },
  vazio: {
    color: colors.textMuted,
    fontFamily: "Prompt_400Regular",
    textAlign: "center",
    marginTop: 20,
  },
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
  itemInfo: { flex: 1, minWidth: 0 },
  nomeLinha: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  nome: { fontFamily: "Prompt_600SemiBold", color: colors.primary, fontSize: 15 },
  nomeExcluido: { color: colors.textMuted, textDecorationLine: "line-through" },
  email: { fontFamily: "Prompt_400Regular", color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tag: {
    backgroundColor: colors.accent + "22",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagTexto: { color: colors.accent, fontSize: 11, fontFamily: "Prompt_600SemiBold" },
  tagExcluido: { backgroundColor: colors.danger + "22" },
  tagTextoExcluido: { color: colors.danger },
  voce: { fontFamily: "Prompt_400Regular", color: colors.textMuted, fontSize: 13 },
  acoes: { alignItems: "flex-end", gap: 10 },
  acaoPapel: { color: colors.accent, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoExcluir: { color: colors.danger, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoReativar: { color: colors.success, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  alternar: { paddingVertical: 16, alignItems: "center" },
  alternarTexto: { color: colors.accent, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
});
