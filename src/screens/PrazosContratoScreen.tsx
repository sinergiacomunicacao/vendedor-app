import { useEffect, useState } from "react";
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
import {
  atualizarPrazo,
  criarPrazo,
  excluirPrazo,
  ouvirPrazos,
} from "../services/prazos";
import { colors } from "../theme/colors";
import { PrazoContrato, labelPrazo } from "../types";
import { showAlert } from "../utils/alert";

export default function PrazosContratoScreen() {
  const [prazos, setPrazos] = useState<PrazoContrato[]>([]);
  const [meses, setMeses] = useState("");
  const [desconto, setDesconto] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mesesEdicao, setMesesEdicao] = useState("");
  const [descontoEdicao, setDescontoEdicao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => ouvirPrazos(setPrazos), []);

  async function handleAdicionar() {
    setErro("");
    const mesesNumero = Number(meses);
    const descontoNumero = Number(desconto || "0");
    if (!meses.trim() || Number.isNaN(mesesNumero) || mesesNumero <= 0) {
      setErro("Informe uma quantidade de meses válida.");
      return;
    }
    if (Number.isNaN(descontoNumero) || descontoNumero < 0 || descontoNumero > 100) {
      setErro("Informe um desconto entre 0 e 100.");
      return;
    }
    if (prazos.some((p) => p.meses === Math.floor(mesesNumero))) {
      setErro("Já existe um prazo com essa quantidade de meses.");
      return;
    }
    setSalvando(true);
    try {
      await criarPrazo({ meses: Math.floor(mesesNumero), descontoPercentual: descontoNumero });
      setMeses("");
      setDesconto("");
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(prazo: PrazoContrato) {
    setEditandoId(prazo.id);
    setMesesEdicao(String(prazo.meses));
    setDescontoEdicao(String(prazo.descontoPercentual));
  }

  async function salvarEdicao(id: string) {
    const mesesNumero = Number(mesesEdicao);
    const descontoNumero = Number(descontoEdicao || "0");
    if (Number.isNaN(mesesNumero) || mesesNumero <= 0) return;
    if (Number.isNaN(descontoNumero) || descontoNumero < 0 || descontoNumero > 100) return;
    try {
      await atualizarPrazo(id, { meses: Math.floor(mesesNumero), descontoPercentual: descontoNumero });
      setEditandoId(null);
    } catch {
      showAlert("Erro", "Não foi possível salvar a alteração. Tente novamente.");
    }
  }

  function handleExcluir(prazo: PrazoContrato) {
    showAlert("Excluir prazo", `Remover o prazo de ${labelPrazo(prazo.meses)}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await excluirPrazo(prazo.id);
          } catch {
            showAlert("Erro", "Não foi possível excluir o prazo. Tente novamente.");
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.ajuda}>
        Prazos de contrato disponíveis pro vendedor escolher ao selecionar um produto, cada um
        com seu percentual de desconto sobre o valor de tabela.
      </Text>
      <View style={styles.form}>
        <View style={styles.formLinha}>
          <TextInput
            style={styles.inputMeses}
            placeholder="Meses"
            keyboardType="number-pad"
            value={meses}
            onChangeText={setMeses}
          />
          <TextInput
            style={styles.inputDesconto}
            placeholder="Desconto %"
            keyboardType="number-pad"
            value={desconto}
            onChangeText={setDesconto}
          />
        </View>
        <Pressable style={styles.botao} onPress={handleAdicionar} disabled={salvando}>
          {salvando ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoTexto}>Adicionar</Text>
          )}
        </Pressable>
      </View>
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <FlatList
        data={prazos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhum prazo cadastrado ainda.</Text>
        }
        renderItem={({ item }) =>
          editandoId === item.id ? (
            <View style={styles.item}>
              <TextInput
                style={styles.inputEdicaoMeses}
                value={mesesEdicao}
                onChangeText={setMesesEdicao}
                keyboardType="number-pad"
                autoFocus
              />
              <TextInput
                style={styles.inputEdicaoDesconto}
                value={descontoEdicao}
                onChangeText={setDescontoEdicao}
                keyboardType="number-pad"
              />
              <Pressable onPress={() => salvarEdicao(item.id)}>
                <Text style={styles.acaoSalvar}>Salvar</Text>
              </Pressable>
              <Pressable onPress={() => setEditandoId(null)}>
                <Text style={styles.acaoCancelar}>Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.item}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTexto}>{labelPrazo(item.meses)}</Text>
                <Text style={styles.itemDesconto}>
                  {item.descontoPercentual > 0
                    ? `${item.descontoPercentual}% de desconto`
                    : "Sem desconto"}
                </Text>
              </View>
              <View style={styles.acoes}>
                <Pressable onPress={() => iniciarEdicao(item)}>
                  <Text style={styles.acaoEditar}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => handleExcluir(item)}>
                  <Text style={styles.acaoExcluir}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          )
        }
      />
    </KeyboardAvoidingView>
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
  form: { gap: 8 },
  formLinha: { flexDirection: "row", gap: 8 },
  inputMeses: {
    width: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputDesconto: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputEdicaoMeses: {
    width: 80,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputEdicaoDesconto: {
    width: 90,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  botao: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  botaoTexto: { color: colors.surface, fontFamily: "Prompt_600SemiBold", fontSize: 14 },
  erro: { color: colors.danger, fontFamily: "Prompt_400Regular", marginTop: 10 },
  lista: { paddingTop: 20 },
  vazio: { color: colors.textMuted, fontFamily: "Prompt_400Regular", textAlign: "center", marginTop: 20 },
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
  itemInfo: { flex: 1 },
  itemTexto: { fontFamily: "Prompt_500Medium", color: colors.text, fontSize: 15 },
  itemDesconto: { fontFamily: "Prompt_400Regular", color: colors.textMuted, fontSize: 12, marginTop: 2 },
  acoes: { flexDirection: "row", gap: 16 },
  acaoEditar: { color: colors.accent, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoExcluir: { color: colors.danger, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoSalvar: { color: colors.success, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoCancelar: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
});
