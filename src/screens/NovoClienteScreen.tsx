import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { AppStackParamList } from "../navigation/types";
import { atualizarCliente, buscarCliente, criarCliente } from "../services/clientes";
import {
  Estabelecimento,
  Produto,
  ouvirEstabelecimentos,
  ouvirProdutos,
} from "../services/estabelecimentos";
import { ouvirPrazos } from "../services/prazos";
import { colors } from "../theme/colors";
import { PrazoContrato, ProdutoInteresse, labelPrazo, normalizarProdutoInteresse } from "../types";
import { formatarMoeda, isValidCnpj, isValidEmail, maskCnpj, maskTelefone } from "../utils/format";

type Props = NativeStackScreenProps<AppStackParamList, "NovoCliente">;

export default function NovoClienteScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const clienteId = route.params?.clienteId;
  const modoEdicao = Boolean(clienteId);

  const [carregandoCliente, setCarregandoCliente] = useState(modoEdicao);
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [estabelecimentoId, setEstabelecimentoId] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [prazos, setPrazos] = useState<PrazoContrato[]>([]);
  const [prazosCarregados, setPrazosCarregados] = useState(false);
  const [prazosSelecionados, setPrazosSelecionados] = useState<Record<string, string | null>>({});
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [estabelecimentoNomeOriginal, setEstabelecimentoNomeOriginal] = useState<string | null>(
    null
  );
  const [estabelecimentoIdOriginal, setEstabelecimentoIdOriginal] = useState<string | null>(null);
  const [produtosOriginais, setProdutosOriginais] = useState<ProdutoInteresse[] | null>(null);

  useEffect(() => {
    if (!clienteId) return;
    buscarCliente(clienteId).then((cliente) => {
      if (!cliente) {
        setErro("Cliente não encontrado.");
        setCarregandoCliente(false);
        return;
      }
      setCnpj(cliente.cnpj);
      setRazaoSocial(cliente.razaoSocial);
      setTelefone(cliente.telefone);
      setEmail(cliente.email);
      setObservacoes(cliente.observacoes ?? "");
      setEstabelecimentoNomeOriginal(cliente.estabelecimento);
      setEstabelecimentoIdOriginal(cliente.estabelecimentoId || null);
      setProdutosOriginais(cliente.produtosInteresse.map(normalizarProdutoInteresse));
      setCarregandoCliente(false);
    });
  }, [clienteId]);

  useEffect(() => {
    return ouvirEstabelecimentos((lista) => {
      setEstabelecimentos(lista);
      setEstabelecimentoId((atual) => {
        if (atual) return atual;
        if (estabelecimentoIdOriginal) return estabelecimentoIdOriginal;
        if (estabelecimentoNomeOriginal) {
          const encontrado = lista.find((e) => e.nome === estabelecimentoNomeOriginal);
          if (encontrado) return encontrado.id;
        }
        return modoEdicao ? "" : lista[0]?.id || "";
      });
    });
  }, [estabelecimentoNomeOriginal, estabelecimentoIdOriginal, modoEdicao]);

  useEffect(() => {
    setProdutos([]);
    setQuantidades({});
    if (!estabelecimentoId) return;
    return ouvirProdutos(estabelecimentoId, setProdutos);
  }, [estabelecimentoId]);

  const [prefilAplicado, setPrefilAplicado] = useState(false);
  useEffect(() => {
    if (prefilAplicado || !produtosOriginais || !estabelecimentoId) return;
    if (estabelecimentoId === estabelecimentoIdOriginal) {
      const inicial: Record<string, number> = {};
      produtosOriginais.forEach((p) => {
        inicial[p.id] = p.quantidade;
      });
      setQuantidades(inicial);
    }
    setPrefilAplicado(true);
  }, [estabelecimentoId, estabelecimentoIdOriginal, produtosOriginais, prefilAplicado]);

  useEffect(() => {
    return ouvirPrazos((lista) => {
      setPrazos(lista);
      setPrazosCarregados(true);
    });
  }, []);

  const [prefilPrazoAplicado, setPrefilPrazoAplicado] = useState(false);
  useEffect(() => {
    if (prefilPrazoAplicado || !produtosOriginais || !prazosCarregados) return;
    const inicial: Record<string, string | null> = {};
    produtosOriginais.forEach((p) => {
      if (p.prazoMeses) {
        const encontrado = prazos.find((pr) => pr.meses === p.prazoMeses);
        inicial[p.id] = encontrado ? encontrado.id : null;
      }
    });
    setPrazosSelecionados(inicial);
    setPrefilPrazoAplicado(true);
  }, [produtosOriginais, prazos, prazosCarregados, prefilPrazoAplicado]);

  function selecionarPrazo(produtoId: string, prazoId: string | null) {
    setPrazosSelecionados((atual) => ({ ...atual, [produtoId]: prazoId }));
  }

  function valorComDesconto(produto: Produto, prazoId: string | null | undefined) {
    const prazo = prazoId ? prazos.find((p) => p.id === prazoId) : null;
    if (!prazo) return produto.valorTabela;
    return produto.valorTabela * (1 - prazo.descontoPercentual / 100);
  }

  function disponivelParaEsteCliente(produto: Produto) {
    const original =
      estabelecimentoId === estabelecimentoIdOriginal
        ? produtosOriginais?.find((p) => p.id === produto.id)?.quantidade ?? 0
        : 0;
    return produto.estoque + original;
  }

  function alterarQuantidade(produto: Produto, delta: number) {
    const disponivel = disponivelParaEsteCliente(produto);
    setQuantidades((atual) => {
      const atualQtd = atual[produto.id] ?? 0;
      const novaQtd = Math.max(0, Math.min(disponivel, atualQtd + delta));
      return { ...atual, [produto.id]: novaQtd };
    });
  }

  const valorTotal = produtos.reduce(
    (total, p) =>
      total + (quantidades[p.id] ?? 0) * valorComDesconto(p, prazosSelecionados[p.id]),
    0
  );

  async function handleSalvar() {
    setErro("");
    if (!isValidCnpj(cnpj)) {
      setErro("CNPJ inválido.");
      return;
    }
    if (!razaoSocial.trim()) {
      setErro("Informe a razão social.");
      return;
    }
    if (telefone.replace(/\D/g, "").length < 10) {
      setErro("Informe um telefone válido.");
      return;
    }
    if (!isValidEmail(email)) {
      setErro("Informe um email válido.");
      return;
    }
    const estabelecimento = estabelecimentos.find((e) => e.id === estabelecimentoId);
    if (!estabelecimento) {
      setErro("Selecione um estabelecimento.");
      return;
    }
    const produtosSelecionados: ProdutoInteresse[] = produtos
      .filter((p) => (quantidades[p.id] ?? 0) > 0)
      .map((p) => {
        const prazoId = prazosSelecionados[p.id] ?? null;
        const prazo = prazoId ? prazos.find((pr) => pr.id === prazoId) : null;
        return {
          id: p.id,
          nome: p.nome,
          quantidade: quantidades[p.id],
          valorUnitario: valorComDesconto(p, prazoId),
          prazoMeses: prazo?.meses,
          descontoPercentual: prazo?.descontoPercentual,
        };
      });
    if (produtosSelecionados.length === 0) {
      setErro("Selecione ao menos um produto.");
      return;
    }
    if (!user) return;

    const dados = {
      vendedorId: user.uid,
      cnpj,
      razaoSocial: razaoSocial.trim(),
      telefone,
      email: email.trim(),
      estabelecimento: estabelecimento.nome,
      estabelecimentoId: estabelecimento.id,
      produtosSelecionados,
      observacoes,
    };

    setSalvando(true);
    try {
      if (clienteId) {
        await atualizarCliente(
          clienteId,
          dados,
          produtosOriginais && estabelecimentoIdOriginal === estabelecimentoId
            ? produtosOriginais
            : [],
          estabelecimentoIdOriginal ?? estabelecimentoId
        );
      } else {
        await criarCliente(dados);
      }
      navigation.goBack();
    } catch (e: any) {
      const mensagem = String(e?.message ?? "");
      if (mensagem.startsWith("ESGOTADO:")) {
        setErro(`O produto "${mensagem.slice(9)}" não tem mais estoque suficiente. Ajuste a quantidade.`);
      } else {
        setErro("Não foi possível salvar. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  if (carregandoCliente) {
    return (
      <View style={styles.carregando}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titulo}>
          {modoEdicao ? "Editar cliente" : "Nova ficha de cliente"}
        </Text>

        <Text style={styles.label}>CNPJ</Text>
        <TextInput
          style={styles.input}
          placeholder="00.000.000/0000-00"
          keyboardType="number-pad"
          value={cnpj}
          onChangeText={(v) => setCnpj(maskCnpj(v))}
        />

        <Text style={styles.label}>Razão social</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome da empresa"
          value={razaoSocial}
          onChangeText={setRazaoSocial}
        />

        <Text style={styles.label}>Telefone</Text>
        <TextInput
          style={styles.input}
          placeholder="(00) 00000-0000"
          keyboardType="phone-pad"
          value={telefone}
          onChangeText={(v) => setTelefone(maskTelefone(v))}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="contato@empresa.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Estabelecimento</Text>
        {estabelecimentos.length === 0 ? (
          <Text style={styles.vazio}>Nenhum estabelecimento cadastrado ainda.</Text>
        ) : (
          <View style={styles.opcoes}>
            {estabelecimentos.map((local) => (
              <Pressable
                key={local.id}
                style={[
                  styles.opcao,
                  estabelecimentoId === local.id && styles.opcaoSelecionada,
                ]}
                onPress={() => setEstabelecimentoId(local.id)}
              >
                <Text
                  style={[
                    styles.opcaoTexto,
                    estabelecimentoId === local.id && styles.opcaoTextoSelecionado,
                  ]}
                >
                  {local.nome}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Produtos de interesse</Text>
        <Text style={styles.ajuda}>Use os botões para escolher a quantidade de cada produto.</Text>
        {estabelecimentoId && produtos.length === 0 ? (
          <Text style={styles.vazio}>
            Nenhum produto cadastrado para esse estabelecimento ainda.
          </Text>
        ) : (
          <View style={styles.listaProdutos}>
            {produtos.map((produto) => {
              const disponivel = disponivelParaEsteCliente(produto);
              const quantidade = quantidades[produto.id] ?? 0;
              const esgotado = disponivel <= 0;
              const prazoSelecionadoId = prazosSelecionados[produto.id] ?? null;
              const valorFinal = valorComDesconto(produto, prazoSelecionadoId);
              return (
                <View
                  key={produto.id}
                  style={[styles.produtoCard, esgotado && styles.produtoLinhaDesabilitada]}
                >
                  <View style={styles.produtoLinha}>
                    <View style={styles.produtoInfo}>
                      <Text style={styles.produtoNome}>{produto.nome}</Text>
                      <Text style={styles.produtoDetalhe}>
                        {formatarMoeda(produto.valorTabela)}
                        {"  ·  "}
                        {esgotado ? "Esgotado" : `${disponivel} disponíve${disponivel === 1 ? "l" : "is"}`}
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        style={[styles.stepperBotao, quantidade <= 0 && styles.stepperBotaoDesabilitado]}
                        onPress={() => alterarQuantidade(produto, -1)}
                        disabled={quantidade <= 0}
                      >
                        <Text style={styles.stepperBotaoTexto}>−</Text>
                      </Pressable>
                      <Text style={styles.stepperValor}>{quantidade}</Text>
                      <Pressable
                        style={[
                          styles.stepperBotao,
                          quantidade >= disponivel && styles.stepperBotaoDesabilitado,
                        ]}
                        onPress={() => alterarQuantidade(produto, 1)}
                        disabled={quantidade >= disponivel}
                      >
                        <Text style={styles.stepperBotaoTexto}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  {quantidade > 0 && prazos.length > 0 && (
                    <View style={styles.prazoContainer}>
                      <Text style={styles.prazoLabel}>Prazo do contrato</Text>
                      <View style={styles.prazoOpcoes}>
                        <Pressable
                          style={[styles.prazoOpcao, !prazoSelecionadoId && styles.prazoOpcaoSelecionada]}
                          onPress={() => selecionarPrazo(produto.id, null)}
                        >
                          <Text
                            style={[
                              styles.prazoOpcaoTexto,
                              !prazoSelecionadoId && styles.prazoOpcaoTextoSelecionado,
                            ]}
                          >
                            Sem prazo
                          </Text>
                        </Pressable>
                        {prazos.map((prazo) => {
                          const ativo = prazoSelecionadoId === prazo.id;
                          return (
                            <Pressable
                              key={prazo.id}
                              style={[styles.prazoOpcao, ativo && styles.prazoOpcaoSelecionada]}
                              onPress={() => selecionarPrazo(produto.id, prazo.id)}
                            >
                              <Text
                                style={[
                                  styles.prazoOpcaoTexto,
                                  ativo && styles.prazoOpcaoTextoSelecionado,
                                ]}
                              >
                                {labelPrazo(prazo.meses)}
                                {prazo.descontoPercentual > 0 ? ` -${prazo.descontoPercentual}%` : ""}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {valorFinal !== produto.valorTabela && (
                        <Text style={styles.prazoValorComDesconto}>
                          {formatarMoeda(valorFinal)} com desconto (de {formatarMoeda(produto.valorTabela)})
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Observações</Text>
        <TextInput
          style={styles.inputObservacoes}
          placeholder="Anotações sobre o cliente, histórico de contato, etc."
          multiline
          numberOfLines={4}
          value={observacoes}
          onChangeText={setObservacoes}
        />

        {valorTotal > 0 && (
          <View style={styles.totalLinha}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValor}>{formatarMoeda(valorTotal)}</Text>
          </View>
        )}

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <Pressable style={styles.botao} onPress={handleSalvar} disabled={salvando}>
          {salvando ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoTexto}>
              {modoEdicao ? "Salvar alterações" : "Salvar cliente"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  carregando: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  scroll: { padding: 20 },
  titulo: {
    fontSize: 22,
    fontFamily: "Prompt_700Bold",
    color: colors.primary,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontFamily: "Prompt_600SemiBold",
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 12,
  },
  ajuda: {
    fontSize: 12,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  inputObservacoes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
    minHeight: 90,
    textAlignVertical: "top",
  },
  opcoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcao: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  opcaoSelecionada: { backgroundColor: colors.primary, borderColor: colors.primary },
  opcaoTexto: { color: colors.textMuted, fontFamily: "Prompt_400Regular" },
  opcaoTextoSelecionado: { color: colors.surface, fontFamily: "Prompt_600SemiBold" },
  vazio: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
  listaProdutos: { gap: 8 },
  produtoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
  },
  produtoLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  produtoLinhaDesabilitada: { backgroundColor: colors.background, opacity: 0.6 },
  prazoContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prazoLabel: {
    fontSize: 11,
    fontFamily: "Prompt_600SemiBold",
    color: colors.textMuted,
    marginBottom: 6,
  },
  prazoOpcoes: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  prazoOpcao: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  prazoOpcaoSelecionada: { backgroundColor: colors.accent, borderColor: colors.accent },
  prazoOpcaoTexto: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 12 },
  prazoOpcaoTextoSelecionado: { color: colors.surface, fontFamily: "Prompt_600SemiBold" },
  prazoValorComDesconto: {
    fontFamily: "Prompt_600SemiBold",
    color: colors.success,
    fontSize: 12,
    marginTop: 8,
  },
  produtoInfo: { flex: 1 },
  produtoNome: { fontFamily: "Prompt_500Medium", color: colors.text, fontSize: 14 },
  produtoDetalhe: { fontFamily: "Prompt_400Regular", color: colors.textMuted, fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBotao: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBotaoDesabilitado: { backgroundColor: colors.border },
  stepperBotaoTexto: { color: colors.surface, fontSize: 18, fontFamily: "Prompt_600SemiBold", lineHeight: 20 },
  stepperValor: { fontFamily: "Prompt_600SemiBold", color: colors.text, fontSize: 15, minWidth: 20, textAlign: "center" },
  totalLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontFamily: "Prompt_600SemiBold", color: colors.textMuted, fontSize: 14 },
  totalValor: { fontFamily: "Prompt_700Bold", color: colors.primary, fontSize: 18 },
  erro: { color: colors.danger, fontFamily: "Prompt_400Regular", marginTop: 16, textAlign: "center" },
  botao: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
  },
  botaoTexto: { color: colors.surface, fontSize: 16, fontFamily: "Prompt_600SemiBold" },
});
