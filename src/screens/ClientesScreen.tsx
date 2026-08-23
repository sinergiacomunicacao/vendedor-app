import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { AppStackParamList } from "../navigation/types";
import { ouvirClientesDoVendedor } from "../services/clientes";
import { colors } from "../theme/colors";
import { Cliente } from "../types";

type Props = NativeStackScreenProps<AppStackParamList, "Clientes">;

export default function ClientesScreen({ navigation }: Props) {
  const { user, gestor, sair } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = ouvirClientesDoVendedor(user.uid, setClientes);
    return unsubscribe;
  }, [user]);

  const renderItem = useCallback(
    ({ item }: { item: Cliente }) => (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate("ClienteDetalhe", { clienteId: item.id })}
      >
        <Text style={styles.razaoSocial}>{item.razaoSocial}</Text>
        <Text style={styles.detalhe}>CNPJ: {item.cnpj}</Text>
        <Text style={styles.detalhe}>Telefone: {item.telefone}</Text>
        <Text style={styles.detalhe}>Email: {item.email}</Text>
        <View style={styles.tagsLinha}>
          <View style={[styles.tag, styles.tagEstabelecimento]}>
            <Text style={[styles.tagTexto, styles.tagTextoEstabelecimento]}>
              {item.estabelecimento}
            </Text>
          </View>
          {item.produtosInteresse.map((produto) => (
            <View key={produto} style={styles.tag}>
              <Text style={styles.tagTexto}>{produto}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    ),
    [navigation]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.saudacao}>Olá, {user?.displayName ?? "vendedor"}</Text>
          <Text style={styles.contagem}>
            {clientes.length} cliente{clientes.length === 1 ? "" : "s"} cadastrado
            {clientes.length === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={styles.headerAcoes}>
          {gestor && (
            <Pressable onPress={() => navigation.navigate("Estabelecimentos")}>
              <Text style={styles.link}>Estabelecimentos</Text>
            </Pressable>
          )}
          <Pressable onPress={sair}>
            <Text style={styles.sair}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={clientes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhum cliente cadastrado ainda.</Text>
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
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  saudacao: { fontSize: 18, fontFamily: "Prompt_600SemiBold", color: colors.primary },
  contagem: { fontSize: 13, fontFamily: "Prompt_400Regular", color: colors.textMuted, marginTop: 2 },
  headerAcoes: { flexDirection: "row", alignItems: "center", gap: 16 },
  link: { color: colors.accent, fontFamily: "Prompt_600SemiBold" },
  sair: { color: colors.danger, fontFamily: "Prompt_600SemiBold" },
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
  razaoSocial: {
    fontSize: 16,
    fontFamily: "Prompt_600SemiBold",
    color: colors.primary,
    marginBottom: 6,
  },
  detalhe: { fontSize: 14, fontFamily: "Prompt_400Regular", color: colors.text, marginBottom: 2 },
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
