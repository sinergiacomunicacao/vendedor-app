import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { AppStackParamList } from "../navigation/types";
import { db } from "../services/firebase";
import { excluirCliente } from "../services/clientes";
import { colors } from "../theme/colors";
import { Cliente } from "../types";

type Props = NativeStackScreenProps<AppStackParamList, "ClienteDetalhe">;

export default function ClienteDetalheScreen({ navigation, route }: Props) {
  const { clienteId } = route.params;
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, "clientes", clienteId), (snapshot) => {
      setCliente(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Cliente) : null);
      setCarregando(false);
    });
  }, [clienteId]);

  function handleCancelar() {
    Alert.alert(
      "Cancelar cliente",
      `Remover a ficha de "${cliente?.razaoSocial}"? Essa ação não pode ser desfeita.`,
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Cancelar cliente",
          style: "destructive",
          onPress: async () => {
            setExcluindo(true);
            try {
              await excluirCliente(clienteId);
              navigation.goBack();
            } catch {
              setExcluindo(false);
              Alert.alert("Erro", "Não foi possível cancelar o cliente. Tente novamente.");
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <Text style={styles.razaoSocial}>{cliente.razaoSocial}</Text>

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
      <View style={styles.tagsLinha}>
        {cliente.produtosInteresse.map((produto) => (
          <View key={produto} style={styles.tag}>
            <Text style={styles.tagTexto}>{produto}</Text>
          </View>
        ))}
      </View>

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
    marginBottom: 20,
  },
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
