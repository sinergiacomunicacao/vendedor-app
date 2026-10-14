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
import { ouvirDescontos } from "../services/descontos";
import { colors } from "../theme/colors";
import {
  DescontoPadrao,
  ProdutoInteresse,
  nomeDescontoPadrao,
  produtoComEstabelecimento,
} from "../types";
import {
  formatarMoeda,
  formatarPercentual,
  isValidCnpj,
  isValidEmail,
  maskCnpj,
  maskTelefone,
} from "../utils/format";

type Props = NativeStackScreenProps<AppStackParamList, "NovoCliente">;

function chave(estabelecimentoId: string, produtoId: string) {
  return `${estabelecimentoId}::${produtoId}`;
}

export default function NovoClienteScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const clienteId = route.params?.clienteId;
  const modoEdicao = Boolean(clienteId);

  const [carregandoCliente, setCarregandoCliente] = useState(modoEdicao);
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [estabelecimentoIds, setEstabelecimentoIds] = useState<string[]>([]);
  const [produtosPorEstab, setProdutosPorEstab] = useState<Record<string, Produto[]>>({});
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [descontos, setDescontos] = useState<DescontoPadrao[]>([]);
  const [descontosCarregados, setDescontosCarregados] = useState(false);
  const [descontosSelecionados, setDescontosSelecionados] = useState<Record<string, string | null>>({});
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

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
      setResponsavel(cliente.responsavel ?? "");
      setTelefone(cliente.telefone);
      setEmail(cliente.email);
      setObservacoes(cliente.observacoes ?? "");
      setProdutosOriginais(
        cliente.produtosInteresse.map((item) => produtoComEstabelecimento(item, cliente))
      );
      setCarregandoCliente(false);
    });
  }, [clienteId]);

  useEffect(() => ouvirEstabelecimentos(setEstabelecimentos), []);

  useEffect(() => {
    const unsubs = estabelecimentoIds.map((id) =>
      ouvirProdutos(id, (produtos) => {
        setProdutosPorEstab((atual) => ({ ...atual, [id]: produtos }));
      })
    );
    return () => unsubs.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estabelecimentoIds.join(",")]);

  const [prefilAplicado, setPrefilAplicado] = useState(false);
  useEffect(() => {
    if (prefilAplicado || !produtosOriginais) return;
    const idsIniciais = Array.from(
      new Set(produtosOriginais.map((p) => p.estabelecimentoId).filter((id): id is string => Boolean(id)))
    );
    setEstabelecimentoIds(idsIniciais);
    const qtds: Record<string, number> = {};
    produtosOriginais.forEach((p) => {
      qtds[chave(p.estabelecimentoId || "", p.id)] = p.quantidade;
    });
    setQuantidades(qtds);
    setPrefilAplicado(true);
  }, [produtosOriginais, prefilAplicado]);

  useEffect(() => {
    return ouvirDescontos((lista) => {
      setDescontos(lista);
      setDescontosCarregados(true);
    });
  }, []);

  // Descobre qual desconto padrão o produto já usava. Registros novos guardam o
  // id; os antigos só têm prazo (e percentual), então casa por eles.
  function descontoDoProduto(p: ProdutoInteresse): DescontoPadrao | undefined {
    const porId = p.descontoId ? descontos.find((d) => d.id === p.descontoId) : undefined;
    if (porId) return porId;
    const exato = descontos.find(
      (d) => (d.meses ?? 0) === (p.prazoMeses ?? 0) && d.descontoPercentual === (p.descontoPercentual ?? 0)
    );
    if (exato) return exato;
    return p.prazoMeses ? descontos.find((d) => d.meses === p.prazoMeses) : undefined;
  }

  const [prefilDescontoAplicado, setPrefilDescontoAplicado] = useState(false);
  useEffect(() => {
    if (prefilDescontoAplicado || !produtosOriginais || !descontosCarregados) return;
    const inicial: Record<string, string | null> = {};
    produtosOriginais.forEach((p) => {
      if (p.prazoMeses || p.descontoPercentual) {
        const encontrado = descontoDoProduto(p);
        inicial[chave(p.estabelecimentoId || "", p.id)] = encontrado ? encontrado.id : null;
      }
    });
    setDescontosSelecionados(inicial);
    setPrefilDescontoAplicado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtosOriginais, descontos, descontosCarregados, prefilDescontoAplicado]);

  function alternarEstabelecimento(id: string) {
    setEstabelecimentoIds((atual) =>
      atual.includes(id) ? atual.filter((v) => v !== id) : [...atual, id]
    );
  }

  function selecionarDesconto(estabelecimentoId: string, produtoId: string, descontoId: string | null) {
    setDescontosSelecionados((atual) => ({
      ...atual,
      [chave(estabelecimentoId, produtoId)]: descontoId,
    }));
  }

  function valorComDesconto(produto: Produto, descontoId: string | null | undefined) {
    const desconto = descontoId ? descontos.find((d) => d.id === descontoId) : null;
    if (!desconto) return produto.valorTabela;
    return produto.valorTabela * (1 - desconto.descontoPercentual / 100);
  }

  function disponivelParaEsteCliente(estabelecimentoId: string, produto: Produto) {
    const original =
      produtosOriginais?.find((p) => p.estabelecimentoId === estabelecimentoId && p.id === produto.id)
        ?.quantidade ?? 0;
    return produto.estoque + original;
  }

  function alterarQuantidade(estabelecimentoId: string, produto: Produto, delta: number) {
    const disponivel = disponivelParaEsteCliente(estabelecimentoId, produto);
    const k = chave(estabelecimentoId, produto.id);
    setQuantidades((atual) => {
      const atualQtd = atual[k] ?? 0;
      const novaQtd = Math.max(0, Math.min(disponivel, atualQtd + delta));
      return { ...atual, [k]: novaQtd };
    });
  }

  const valorTotal = estabelecimentoIds.reduce((totalGeral, estId) => {
    const produtosDoEst = produtosPorEstab[estId] ?? [];
    return (
      totalGeral +
      produtosDoEst.reduce((total, p) => {
        const k = chave(estId, p.id);
        return total + (quantidades[k] ?? 0) * valorComDesconto(p, descontosSelecionados[k]);
      }, 0)
    );
  }, 0);

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
    if (estabelecimentoIds.length === 0) {
      setErro("Selecione ao menos um estabelecimento.");
      return;
    }

    const produtosSelecionados: ProdutoInteresse[] = estabelecimentoIds.flatMap((estId) => {
      const nomeEstabelecimento = estabelecimentos.find((e) => e.id === estId)?.nome ?? "";
      return (produtosPorEstab[estId] ?? [])
        .filter((p) => (quantidades[chave(estId, p.id)] ?? 0) > 0)
        .map((p) => {
          const k = chave(estId, p.id);
          const descontoId = descontosSelecionados[k] ?? null;
          const desconto = descontoId ? descontos.find((d) => d.id === descontoId) : null;
          return {
            id: p.id,
            nome: p.nome,
            quantidade: quantidades[k],
            valorUnitario: valorComDesconto(p, descontoId),
            estabelecimentoId: estId,
            estabelecimentoNome: nomeEstabelecimento,
            ...(desconto
              ? {
                  descontoId: desconto.id,
                  descontoPercentual: desconto.descontoPercentual,
                  ...(desconto.descricao ? { descontoDescricao: desconto.descricao } : {}),
                  ...(desconto.meses ? { prazoMeses: desconto.meses } : {}),
                }
              : {}),
          };
        });
    });
    if (produtosSelecionados.length === 0) {
      setErro("Selecione ao menos um produto.");
      return;
    }
    if (!user) return;

    const dados = {
      vendedorId: user.uid,
      vendedorNome: user.displayName ?? "",
      cnpj,
      razaoSocial: razaoSocial.trim(),
      responsavel: responsavel.trim(),
      telefone,
      email: email.trim(),
      produtosSelecionados,
      observacoes,
    };

    setSalvando(true);
    try {
      if (clienteId) {
        await atualizarCliente(clienteId, dados, produtosOriginais ?? []);
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

        <Text style={styles.label}>Responsável pelo contato</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome de quem trata o contrato"
          value={responsavel}
          onChangeText={setResponsavel}
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

        <Text style={styles.label}>
          Estabelecimento{estabelecimentoIds.length > 0 ? ` (${estabelecimentoIds.length})` : ""}
        </Text>
        <Text style={styles.ajuda}>
          Pode escolher mais de um, se o cliente tiver interesse em anunciar em vários lugares.
        </Text>
        {estabelecimentos.length === 0 ? (
          <Text style={styles.vazio}>Nenhum estabelecimento cadastrado ainda.</Text>
        ) : (
          <View style={styles.opcoes}>
            {estabelecimentos.map((local) => {
              const ativo = estabelecimentoIds.includes(local.id);
              return (
                <Pressable
                  key={local.id}
                  style={[styles.opcao, ativo && styles.opcaoSelecionada]}
                  onPress={() => alternarEstabelecimento(local.id)}
                >
                  <Text style={[styles.opcaoTexto, ativo && styles.opcaoTextoSelecionado]}>
                    {local.nome}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {estabelecimentoIds.map((estId) => {
          const nomeEstabelecimento = estabelecimentos.find((e) => e.id === estId)?.nome ?? "";
          const produtosDoEst = produtosPorEstab[estId];
          return (
            <View key={estId} style={styles.blocoEstabelecimento}>
              <Text style={styles.label}>Produtos em {nomeEstabelecimento}</Text>
              {produtosDoEst && produtosDoEst.length === 0 ? (
                <Text style={styles.vazio}>Nenhum produto cadastrado para esse estabelecimento ainda.</Text>
              ) : (
                <View style={styles.listaProdutos}>
                  {(produtosDoEst ?? []).map((produto) => {
                    const disponivel = disponivelParaEsteCliente(estId, produto);
                    const k = chave(estId, produto.id);
                    const quantidade = quantidades[k] ?? 0;
                    const esgotado = disponivel <= 0;
                    const descontoSelecionadoId = descontosSelecionados[k] ?? null;
                    const valorFinal = valorComDesconto(produto, descontoSelecionadoId);
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
                              {esgotado
                                ? "Esgotado"
                                : `${disponivel} disponíve${disponivel === 1 ? "l" : "is"}`}
                            </Text>
                          </View>
                          <View style={styles.stepper}>
                            <Pressable
                              style={[
                                styles.stepperBotao,
                                quantidade <= 0 && styles.stepperBotaoDesabilitado,
                              ]}
                              onPress={() => alterarQuantidade(estId, produto, -1)}
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
                              onPress={() => alterarQuantidade(estId, produto, 1)}
                              disabled={quantidade >= disponivel}
                            >
                              <Text style={styles.stepperBotaoTexto}>+</Text>
                            </Pressable>
                          </View>
                        </View>

                        {quantidade > 0 && descontos.length > 0 && (
                          <View style={styles.prazoContainer}>
                            <Text style={styles.prazoLabel}>Desconto</Text>
                            <View style={styles.prazoOpcoes}>
                              <Pressable
                                style={[
                                  styles.prazoOpcao,
                                  !descontoSelecionadoId && styles.prazoOpcaoSelecionada,
                                ]}
                                onPress={() => selecionarDesconto(estId, produto.id, null)}
                              >
                                <Text
                                  style={[
                                    styles.prazoOpcaoTexto,
                                    !descontoSelecionadoId && styles.prazoOpcaoTextoSelecionado,
                                  ]}
                                >
                                  Sem desconto
                                </Text>
                              </Pressable>
                              {descontos.map((desconto) => {
                                const ativo = descontoSelecionadoId === desconto.id;
                                return (
                                  <Pressable
                                    key={desconto.id}
                                    style={[styles.prazoOpcao, ativo && styles.prazoOpcaoSelecionada]}
                                    onPress={() => selecionarDesconto(estId, produto.id, desconto.id)}
                                  >
                                    <Text
                                      style={[
                                        styles.prazoOpcaoTexto,
                                        ativo && styles.prazoOpcaoTextoSelecionado,
                                      ]}
                                    >
                                      {nomeDescontoPadrao(desconto)}
                                      {desconto.descontoPercentual > 0
                                        ? ` -${formatarPercentual(desconto.descontoPercentual)}`
                                        : ""}
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
            </View>
          );
        })}

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
  blocoEstabelecimento: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
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
