import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { ouvirEmpresasAtendidas } from "../services/clientes";
import { colors } from "../theme/colors";
import { EmpresaAtendida } from "../types";

export default function EmpresasAtendidasScreen() {
  const [empresas, setEmpresas] = useState<EmpresaAtendida[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => ouvirEmpresasAtendidas(setEmpresas), []);

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((empresa) =>
      [empresa.razaoSocial, empresa.cnpj, empresa.vendedorNome]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [empresas, busca]);

  return (
    <View style={styles.container}>
      <Text style={styles.ajuda}>
        Todas as empresas já cadastradas por qualquer vendedor, para você conferir antes de
        abordar um cliente novo. Mostra só razão social, CNPJ e quem atendeu — sem dados de
        contato.
      </Text>

      <View style={styles.buscaContainer}>
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar por razão social, CNPJ ou vendedor"
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      <Text style={styles.contagem}>
        {busca.trim()
          ? `${empresasFiltradas.length} de ${empresas.length} empresa${empresas.length === 1 ? "" : "s"}`
          : `${empresas.length} empresa${empresas.length === 1 ? "" : "s"} atendida${empresas.length === 1 ? "" : "s"}`}
      </Text>

      <FlatList
        data={empresasFiltradas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vazio}>
            {busca.trim() ? "Nenhuma empresa encontrada." : "Nenhuma empresa atendida ainda."}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.razaoSocial}>{item.razaoSocial}</Text>
            <Text style={styles.detalhe}>CNPJ: {item.cnpj}</Text>
            <Text style={styles.detalheVendedor}>Atendido por: {item.vendedorNome}</Text>
          </View>
        )}
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
  buscaContainer: { marginBottom: 10 },
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
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  razaoSocial: { fontFamily: "Prompt_600SemiBold", color: colors.primary, fontSize: 15 },
  detalhe: {
    fontFamily: "Prompt_400Regular",
    color: colors.text,
    fontSize: 13,
    marginTop: 2,
  },
  detalheVendedor: {
    fontFamily: "Prompt_500Medium",
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
