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
  atualizarDesconto,
  criarDesconto,
  excluirDesconto,
  ouvirDescontos,
} from "../services/descontos";
import { colors } from "../theme/colors";
import { DescontoPadrao, labelPrazo, nomeDescontoPadrao } from "../types";
import { showAlert } from "../utils/alert";
import { formatarPercentual } from "../utils/format";

type DadosValidados = { descricao: string; descontoPercentual: number; meses?: number };

// Aceita vírgula ("7,5") e devolve a mensagem de erro em vez dos dados quando
// algo está inválido. Meses em branco = desconto sem prazo de contrato.
function validar(
  descricao: string,
  desconto: string,
  meses: string
): { erro: string } | { dados: DadosValidados } {
  if (!descricao.trim()) return { erro: "Informe a descrição do desconto." };
  const descontoNumero = Number(desconto.trim().replace(",", ".") || "0");
  if (Number.isNaN(descontoNumero) || descontoNumero < 0 || descontoNumero > 100) {
    return { erro: "Informe um desconto entre 0 e 100." };
  }
  let mesesNumero: number | undefined;
  if (meses.trim()) {
    const valor = Number(meses.trim());
    if (Number.isNaN(valor) || valor < 1) {
      return { erro: "Meses de contrato deve ser um número maior que zero (ou deixe em branco)." };
    }
    mesesNumero = Math.floor(valor);
  }
  return {
    dados: {
      descricao: descricao.trim(),
      descontoPercentual: descontoNumero,
      ...(mesesNumero ? { meses: mesesNumero } : {}),
    },
  };
}

export default function DescontosPadraoScreen() {
  const [descontos, setDescontos] = useState<DescontoPadrao[]>([]);
  const [descricao, setDescricao] = useState("");
  const [desconto, setDesconto] = useState("");
  const [meses, setMeses] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [descricaoEdicao, setDescricaoEdicao] = useState("");
  const [descontoEdicao, setDescontoEdicao] = useState("");
  const [mesesEdicao, setMesesEdicao] = useState("");
  const [erro, setErro] = useState("");
  const [erroEdicao, setErroEdicao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => ouvirDescontos(setDescontos), []);

  function descricaoJaExiste(texto: string, ignorarId?: string) {
    const alvo = texto.trim().toLowerCase();
    return descontos.some((d) => d.id !== ignorarId && d.descricao.toLowerCase() === alvo);
  }

  async function handleAdicionar() {
    setErro("");
    const resultado = validar(descricao, desconto, meses);
    if ("erro" in resultado) {
      setErro(resultado.erro);
      return;
    }
    if (descricaoJaExiste(resultado.dados.descricao)) {
      setErro("Já existe um desconto com essa descrição.");
      return;
    }
    setSalvando(true);
    try {
      await criarDesconto(resultado.dados);
      setDescricao("");
      setDesconto("");
      setMeses("");
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(item: DescontoPadrao) {
    setEditandoId(item.id);
    setDescricaoEdicao(item.descricao);
    setDescontoEdicao(String(item.descontoPercentual).replace(".", ","));
    setMesesEdicao(item.meses ? String(item.meses) : "");
    setErroEdicao("");
  }

  async function salvarEdicao(id: string) {
    setErroEdicao("");
    const resultado = validar(descricaoEdicao, descontoEdicao, mesesEdicao);
    if ("erro" in resultado) {
      setErroEdicao(resultado.erro);
      return;
    }
    if (descricaoJaExiste(resultado.dados.descricao, id)) {
      setErroEdicao("Já existe um desconto com essa descrição.");
      return;
    }
    try {
      await atualizarDesconto(id, resultado.dados);
      setEditandoId(null);
    } catch {
      showAlert("Erro", "Não foi possível salvar a alteração. Tente novamente.");
    }
  }

  function handleExcluir(item: DescontoPadrao) {
    showAlert(
      "Excluir desconto",
      `Remover "${nomeDescontoPadrao(item)}"? Clientes que já usam esse desconto continuam com o valor combinado.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await excluirDesconto(item.id);
            } catch {
              showAlert("Erro", "Não foi possível excluir o desconto. Tente novamente.");
            }
          },
        },
      ]
    );
  }

  const cabecalho = (
    <View>
      <Text style={styles.ajuda}>
        Descontos que o vendedor pode escolher ao selecionar um produto. Cada um tem uma descrição e
        um percentual sobre o valor de tabela. O prazo de contrato é opcional: quando preenchido, o
        app calcula o vencimento do contrato e avisa quando estiver perto de acabar.
      </Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Descrição (ex.: Pagamento à vista)"
          value={descricao}
          onChangeText={setDescricao}
        />
        <View style={styles.formLinha}>
          <TextInput
            style={styles.inputDesconto}
            placeholder="Desconto %"
            keyboardType="decimal-pad"
            value={desconto}
            onChangeText={setDesconto}
          />
          <TextInput
            style={styles.inputMeses}
            placeholder="Meses (opcional)"
            keyboardType="number-pad"
            value={meses}
            onChangeText={setMeses}
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
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={descontos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum desconto cadastrado ainda.</Text>}
        renderItem={({ item }) =>
          editandoId === item.id ? (
            <View style={styles.itemEdicao}>
              <TextInput
                style={styles.inputEdicao}
                placeholder="Descrição"
                value={descricaoEdicao}
                onChangeText={setDescricaoEdicao}
                autoFocus
              />
              <View style={styles.formLinha}>
                <TextInput
                  style={styles.inputEdicaoDesconto}
                  placeholder="Desconto %"
                  value={descontoEdicao}
                  onChangeText={setDescontoEdicao}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={styles.inputEdicaoMeses}
                  placeholder="Meses (opcional)"
                  value={mesesEdicao}
                  onChangeText={setMesesEdicao}
                  keyboardType="number-pad"
                />
              </View>
              {erroEdicao ? <Text style={styles.erro}>{erroEdicao}</Text> : null}
              <View style={styles.acoes}>
                <Pressable onPress={() => salvarEdicao(item.id)}>
                  <Text style={styles.acaoSalvar}>Salvar</Text>
                </Pressable>
                <Pressable onPress={() => setEditandoId(null)}>
                  <Text style={styles.acaoCancelar}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.item}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTexto}>{item.descricao || nomeDescontoPadrao(item)}</Text>
                <Text style={styles.itemDesconto}>
                  {item.descontoPercentual > 0
                    ? `${formatarPercentual(item.descontoPercentual)} de desconto`
                    : "Sem desconto"}
                  {item.meses ? ` · contrato de ${labelPrazo(item.meses)}` : " · sem prazo de contrato"}
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

const campo = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 8,
  fontSize: 15,
  fontFamily: "Prompt_400Regular",
  color: colors.text,
} as const;

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
  input: { ...campo, padding: 14 },
  inputDesconto: { ...campo, flex: 1, minWidth: 0, padding: 14 },
  inputMeses: { ...campo, flex: 1, minWidth: 0, padding: 14 },
  itemEdicao: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  inputEdicao: { ...campo, borderColor: colors.accent, padding: 10 },
  inputEdicaoDesconto: { ...campo, borderColor: colors.accent, flex: 1, minWidth: 0, padding: 10 },
  inputEdicaoMeses: { ...campo, borderColor: colors.accent, flex: 1, minWidth: 0, padding: 10 },
  botao: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  botaoTexto: { color: colors.surface, fontFamily: "Prompt_600SemiBold", fontSize: 14 },
  erro: { color: colors.danger, fontFamily: "Prompt_400Regular", marginTop: 10 },
  lista: { paddingBottom: 20 },
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
