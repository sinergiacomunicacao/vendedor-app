import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useDadosComissao } from "../hooks/useDadosComissao";
import {
  definirAgencia,
  definirPercentualDaComissao,
  desfazerPagamentoComissao,
  marcarComissaoPaga,
  RegrasComissao,
  salvarRegras,
} from "../services/comissoes";
import { colors } from "../theme/colors";
import {
  ContratoComissao,
  LinhaComissao,
  resumirPorBeneficiario,
  ResumoBeneficiario,
  ROTULO_PAPEL,
  SituacaoContrato,
} from "../utils/comissoes";
import { showAlert } from "../utils/alert";
import { formatarMoeda, formatarPercentual } from "../utils/format";

type Aba = "resumo" | "contratos" | "regras";
type FiltroStatus = "todas" | "pagar" | "pagas";

const ROTULO_SITUACAO: Record<SituacaoContrato, string> = {
  ativo: "",
  cancelado: "Contrato cancelado depois do pagamento",
  reaberto: "Saiu de \"Contrato fechado\" depois do pagamento",
  excluido: "Ficha excluída",
};

function data(ms: number) {
  return new Date(ms).toLocaleDateString("pt-BR");
}

// "7,5" ou "7.5" -> 7.5. Vazio vale 0. Devolve null se for inválido ou fora de 0–100.
function lerPercentual(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return 0;
  const numero = Number(limpo);
  if (Number.isNaN(numero) || numero < 0 || numero > 100) return null;
  return numero;
}

function textoPercentual(valor: number | undefined) {
  return valor === undefined ? "" : String(valor).replace(".", ",");
}

type FormularioRegras = {
  vendedor: string;
  fixos: { vendedorId: string; nome: string; percentual: string }[];
  estabelecimentos: Record<string, string>;
  agenciaNome: string;
  agencia: string;
};

function paraFormulario(regras: RegrasComissao): FormularioRegras {
  return {
    vendedor: textoPercentual(regras.vendedorPercentual),
    fixos: regras.fixos.map((f) => ({
      vendedorId: f.vendedorId,
      nome: f.nome,
      percentual: textoPercentual(f.percentual),
    })),
    estabelecimentos: Object.fromEntries(
      Object.entries(regras.estabelecimentos).map(([id, p]) => [id, textoPercentual(p)])
    ),
    agenciaNome: regras.agenciaNome,
    agencia: textoPercentual(regras.agenciaPercentual),
  };
}

export default function ComissoesScreen() {
  const { user } = useAuth();
  const { vendedores, estabelecimentos, regras, regrasCarregadas, clientesCarregados, contratos } =
    useDadosComissao(true);
  const carregando = !clientesCarregados;

  const [aba, setAba] = useState<Aba>("resumo");
  const [beneficiarioFiltro, setBeneficiarioFiltro] = useState<string | null>(null);
  const [status, setStatus] = useState<FiltroStatus>("todas");

  // Ajuste de percentual de uma comissão (uma por vez): "<clienteId>|<chave>".
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [percentualEdicao, setPercentualEdicao] = useState("");
  const [erroEdicao, setErroEdicao] = useState("");

  const [form, setForm] = useState<FormularioRegras | null>(null);
  const [erroRegras, setErroRegras] = useState("");
  const [mensagemRegras, setMensagemRegras] = useState("");
  const [salvandoRegras, setSalvandoRegras] = useState(false);

  // O formulário de regras parte do que está salvo, uma vez só.
  useEffect(() => {
    if (regrasCarregadas && form === null) setForm(paraFormulario(regras));
  }, [regrasCarregadas, form, regras]);

  const todasLinhas = useMemo(() => contratos.flatMap((c) => c.linhas), [contratos]);
  const resumo = useMemo(() => resumirPorBeneficiario(todasLinhas), [todasLinhas]);

  const doBeneficiario = useMemo(
    () => todasLinhas.filter((l) => !beneficiarioFiltro || l.beneficiarioChave === beneficiarioFiltro),
    [todasLinhas, beneficiarioFiltro]
  );
  const totalAPagar = doBeneficiario.reduce((t, l) => (l.pagamento ? t : t + l.valor), 0);
  const totalPago = doBeneficiario.reduce((t, l) => (l.pagamento ? t + l.valor : t), 0);

  const contratosVisiveis = useMemo(() => {
    const semFiltros = !beneficiarioFiltro && status === "todas";
    const resultado: { contrato: ContratoComissao; linhas: LinhaComissao[] }[] = [];
    for (const contrato of contratos) {
      const linhas = contrato.linhas.filter(
        (l) =>
          (!beneficiarioFiltro || l.beneficiarioChave === beneficiarioFiltro) &&
          (status === "todas" ? true : status === "pagas" ? Boolean(l.pagamento) : !l.pagamento)
      );
      // Contrato fechado sem nenhuma comissão ainda aparece, para dar para
      // marcar "veio pela agência".
      if (linhas.length > 0 || (semFiltros && contrato.situacao === "ativo")) {
        resultado.push({ contrato, linhas });
      }
    }
    return resultado;
  }, [contratos, beneficiarioFiltro, status]);

  function abrirContratosDe(chave: string) {
    setBeneficiarioFiltro(chave);
    setStatus("todas");
    setAba("contratos");
  }

  function idDaLinha(l: LinhaComissao) {
    return `${l.clienteId}|${l.chave}`;
  }

  function iniciarEdicao(linha: LinhaComissao) {
    setEditandoId(idDaLinha(linha));
    setPercentualEdicao(textoPercentual(linha.percentual || undefined));
    setErroEdicao("");
  }

  async function salvarPercentualDaLinha(linha: LinhaComissao) {
    const percentual = lerPercentual(percentualEdicao);
    if (percentual === null) {
      setErroEdicao("Informe um percentual entre 0 e 100.");
      return;
    }
    try {
      await definirPercentualDaComissao(linha.clienteId, linha.chave, percentual);
      setEditandoId(null);
    } catch {
      setErroEdicao("Não foi possível salvar. Tente novamente.");
    }
  }

  async function usarPercentualDasRegras(linha: LinhaComissao) {
    try {
      await definirPercentualDaComissao(linha.clienteId, linha.chave, null);
      setEditandoId(null);
    } catch {
      setErroEdicao("Não foi possível salvar. Tente novamente.");
    }
  }

  function pagar(contrato: ContratoComissao, linha: LinhaComissao) {
    showAlert(
      "Marcar como paga",
      `Comissão de ${formatarMoeda(linha.valor)} (${formatarPercentual(linha.percentual)} de ${formatarMoeda(
        linha.base
      )}) para ${linha.beneficiarioNome} (${ROTULO_PAPEL[linha.papel].toLowerCase()}), do contrato "${
        contrato.razaoSocial
      }"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Marcar como paga",
          onPress: async () => {
            try {
              await marcarComissaoPaga(linha.clienteId, linha.chave, {
                em: Date.now(),
                porId: user?.uid ?? "",
                por: user?.displayName ?? "",
                base: linha.base,
                percentual: linha.percentual,
                valor: linha.valor,
                papel: linha.papel,
                beneficiarioChave: linha.beneficiarioChave,
                beneficiarioNome: linha.beneficiarioNome,
                razaoSocial: contrato.razaoSocial,
                vendedorId: contrato.vendedorId,
                vendedorNome: contrato.vendedorNome,
              });
            } catch {
              showAlert("Erro", "Não foi possível marcar como paga. Tente novamente.");
            }
          },
        },
      ]
    );
  }

  function desfazer(contrato: ContratoComissao, linha: LinhaComissao) {
    showAlert(
      "Desfazer pagamento",
      `A comissão de ${formatarMoeda(linha.valor)} de ${linha.beneficiarioNome}, do contrato "${contrato.razaoSocial}", volta para "A pagar".`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desfazer",
          style: "destructive",
          onPress: async () => {
            try {
              await desfazerPagamentoComissao(linha.clienteId, linha.chave);
            } catch {
              showAlert("Erro", "Não foi possível desfazer. Tente novamente.");
            }
          },
        },
      ]
    );
  }

  async function alternarAgencia(contrato: ContratoComissao) {
    const novoValor = !contrato.veioPelaAgencia;
    if (!novoValor && contrato.linhas.some((l) => l.papel === "agencia" && l.pagamento)) {
      showAlert(
        "Comissão da agência já paga",
        "Desfaça o pagamento da agência antes de desmarcar \"Veio pela agência\"."
      );
      return;
    }
    try {
      await definirAgencia(contrato.clienteId, novoValor);
    } catch {
      showAlert("Erro", "Não foi possível salvar. Tente novamente.");
    }
  }

  async function handleSalvarRegras() {
    if (!form) return;
    setErroRegras("");
    setMensagemRegras("");
    const vendedorPercentual = lerPercentual(form.vendedor);
    const agenciaPercentual = lerPercentual(form.agencia);
    const fixos = form.fixos.map((f) => ({ ...f, valor: lerPercentual(f.percentual) }));
    const estabelecimentosLidos = Object.entries(form.estabelecimentos).map(([id, texto]) => ({
      id,
      valor: lerPercentual(texto),
    }));
    if (
      vendedorPercentual === null ||
      agenciaPercentual === null ||
      fixos.some((f) => f.valor === null) ||
      estabelecimentosLidos.some((e) => e.valor === null)
    ) {
      setErroRegras("Todos os percentuais devem estar entre 0 e 100.");
      return;
    }
    const novas: RegrasComissao = {
      vendedorPercentual,
      fixos: fixos.map((f) => ({ vendedorId: f.vendedorId, nome: f.nome, percentual: f.valor as number })),
      estabelecimentos: Object.fromEntries(
        estabelecimentosLidos.filter((e) => (e.valor as number) > 0).map((e) => [e.id, e.valor as number])
      ),
      agenciaNome: form.agenciaNome.trim() || "Agência",
      agenciaPercentual,
    };
    setSalvandoRegras(true);
    try {
      await salvarRegras(novas);
      setMensagemRegras("Regras salvas. As comissões ainda não pagas já usam os novos percentuais.");
    } catch {
      setErroRegras("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvandoRegras(false);
    }
  }

  function editarForm(mudanca: Partial<FormularioRegras>) {
    setForm((atual) => (atual ? { ...atual, ...mudanca } : atual));
    setMensagemRegras("");
  }

  function renderLinha(contrato: ContratoComissao, linha: LinhaComissao) {
    const editando = editandoId === idDaLinha(linha);
    const paga = Boolean(linha.pagamento);
    return (
      <View key={linha.chave} style={styles.linha}>
        <View style={styles.linhaTopo}>
          <Text style={styles.linhaNome}>{linha.beneficiarioNome}</Text>
          <View style={[styles.selo, paga ? styles.seloPaga : styles.seloAPagar]}>
            <Text style={styles.seloTexto}>{paga ? "Paga" : "A pagar"}</Text>
          </View>
        </View>
        <Text style={styles.detalhe}>
          {ROTULO_PAPEL[linha.papel]}
          {"  ·  "}
          {formatarPercentual(linha.percentual)} de {formatarMoeda(linha.base)}
          {linha.percentualProprio && !paga ? "  (ajustado)" : ""}
        </Text>
        <Text style={styles.comissao}>{formatarMoeda(linha.valor)}</Text>
        {linha.pagamento ? (
          <Text style={styles.pagoEm}>
            Paga em {data(linha.pagamento.em)}
            {linha.pagamento.por ? ` por ${linha.pagamento.por}` : ""}
          </Text>
        ) : null}
        {linha.naoSeAplicaMais ? (
          <Text style={styles.aviso}>Não se aplica mais: a regra ou o contrato mudou depois do pagamento.</Text>
        ) : null}
        {linha.valorMudouDepoisDePagar ? (
          <Text style={styles.aviso}>O valor do contrato mudou depois do pagamento.</Text>
        ) : null}

        {editando ? (
          <View style={styles.edicao}>
            <TextInput
              style={styles.input}
              placeholder="Percentual desta comissão (%)"
              keyboardType="decimal-pad"
              value={percentualEdicao}
              onChangeText={setPercentualEdicao}
              autoFocus
            />
            {erroEdicao ? <Text style={styles.erro}>{erroEdicao}</Text> : null}
            <View style={styles.acoes}>
              <Pressable onPress={() => salvarPercentualDaLinha(linha)}>
                <Text style={styles.acaoSalvar}>Salvar</Text>
              </Pressable>
              {linha.percentualProprio ? (
                <Pressable onPress={() => usarPercentualDasRegras(linha)}>
                  <Text style={styles.acaoEditar}>Usar o das regras</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setEditandoId(null)}>
                <Text style={styles.acaoCancelar}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.acoes}>
            {paga ? (
              <Pressable onPress={() => desfazer(contrato, linha)}>
                <Text style={styles.acaoExcluir}>Desfazer pagamento</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.botaoPagar} onPress={() => pagar(contrato, linha)}>
                  <Text style={styles.botaoPagarTexto}>Marcar como paga</Text>
                </Pressable>
                <Pressable onPress={() => iniciarEdicao(linha)}>
                  <Text style={styles.acaoEditar}>Ajustar %</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderContrato({ item }: { item: { contrato: ContratoComissao; linhas: LinhaComissao[] } }) {
    const { contrato, linhas } = item;
    const aviso = ROTULO_SITUACAO[contrato.situacao];
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitulo}>{contrato.razaoSocial}</Text>
        <Text style={styles.detalhe}>
          Vendedor: {contrato.vendedorNome}
          {contrato.dataFechamento ? `  ·  Fechado em ${data(contrato.dataFechamento)}` : ""}
        </Text>
        {contrato.situacao !== "excluido" ? (
          <Text style={styles.detalhe}>Valor do contrato: {formatarMoeda(contrato.valorTotal)}</Text>
        ) : null}
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
        {contrato.situacao === "ativo" ? (
          <Pressable style={styles.agencia} onPress={() => alternarAgencia(contrato)}>
            <View style={[styles.caixa, contrato.veioPelaAgencia && styles.caixaMarcada]}>
              {contrato.veioPelaAgencia ? <Text style={styles.caixaVisto}>✓</Text> : null}
            </View>
            <Text style={styles.agenciaTexto}>Cliente veio pela {regras.agenciaNome || "agência"}</Text>
          </Pressable>
        ) : null}
        {linhas.length === 0 ? (
          <Text style={styles.semLinhas}>
            Nenhuma comissão neste contrato. Defina percentuais na aba Regras.
          </Text>
        ) : (
          linhas.map((linha) => renderLinha(contrato, linha))
        )}
      </View>
    );
  }

  function renderResumo({ item }: { item: ResumoBeneficiario }) {
    return (
      <Pressable style={styles.card} onPress={() => abrirContratosDe(item.chave)}>
        <Text style={styles.cardTitulo}>{item.nome}</Text>
        <Text style={styles.detalhe}>
          {item.papeis.map((p) => ROTULO_PAPEL[p]).join("  ·  ")}
          {"  ·  "}
          {item.quantidade} comiss{item.quantidade === 1 ? "ão" : "ões"}
        </Text>
        <View style={styles.resumoLinha}>
          <View style={styles.resumoCol}>
            <Text style={styles.resumoRotulo}>A pagar</Text>
            <Text style={[styles.resumoValorPequeno, { color: colors.primary }]}>{formatarMoeda(item.aPagar)}</Text>
          </View>
          <View style={styles.resumoCol}>
            <Text style={styles.resumoRotulo}>Pagas</Text>
            <Text style={[styles.resumoValorPequeno, { color: colors.success }]}>{formatarMoeda(item.pago)}</Text>
          </View>
        </View>
        <Text style={styles.verContratos}>Ver contratos ›</Text>
      </Pressable>
    );
  }

  const cabecalhoContratos = (
    <View>
      <Text style={styles.rotuloFiltro}>Quem recebe</Text>
      <View style={styles.chips}>
        <Chip texto="Todos" ativo={beneficiarioFiltro === null} onPress={() => setBeneficiarioFiltro(null)} />
        {resumo.map((r) => (
          <Chip
            key={r.chave}
            texto={r.nome}
            ativo={beneficiarioFiltro === r.chave}
            onPress={() => setBeneficiarioFiltro(beneficiarioFiltro === r.chave ? null : r.chave)}
          />
        ))}
      </View>
      <Text style={styles.rotuloFiltro}>Situação</Text>
      <View style={styles.chips}>
        <Chip texto="Todas" ativo={status === "todas"} onPress={() => setStatus("todas")} />
        <Chip texto="A pagar" ativo={status === "pagar"} onPress={() => setStatus("pagar")} />
        <Chip texto="Pagas" ativo={status === "pagas"} onPress={() => setStatus("pagas")} />
      </View>
    </View>
  );

  const vendedoresDisponiveis = vendedores.filter(
    (v) => v.ativo && !form?.fixos.some((f) => f.vendedorId === v.id)
  );

  const abaRegras = form ? (
    <ScrollView contentContainerStyle={styles.lista} keyboardShouldPersistTaps="handled">
      <Text style={styles.ajuda}>
        Percentuais aplicados sobre o valor do contrato. Cada contrato fechado gera uma comissão para cada
        um destes. Em cada contrato você ainda pode ajustar o percentual.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Vendedor que fechou a venda</Text>
        <Text style={styles.detalhe}>Vale para todos os vendedores.</Text>
        <CampoPercentual valor={form.vendedor} onChange={(v) => editarForm({ vendedor: v })} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Recebem em todos os contratos</Text>
        <Text style={styles.detalhe}>Seja qual for o vendedor da venda.</Text>
        {form.fixos.length === 0 ? <Text style={styles.semLinhas}>Ninguém adicionado.</Text> : null}
        {form.fixos.map((f) => (
          <View key={f.vendedorId} style={styles.fixoLinha}>
            <Text style={styles.fixoNome}>{f.nome}</Text>
            <CampoPercentual
              valor={f.percentual}
              onChange={(v) =>
                editarForm({
                  fixos: form.fixos.map((x) => (x.vendedorId === f.vendedorId ? { ...x, percentual: v } : x)),
                })
              }
            />
            <Pressable
              onPress={() => editarForm({ fixos: form.fixos.filter((x) => x.vendedorId !== f.vendedorId) })}
            >
              <Text style={styles.acaoExcluir}>Remover</Text>
            </Pressable>
          </View>
        ))}
        {vendedoresDisponiveis.length > 0 ? (
          <View>
            <Text style={styles.rotuloFiltro}>Adicionar pessoa</Text>
            <View style={styles.chips}>
              {vendedoresDisponiveis.map((v) => (
                <Chip
                  key={v.id}
                  texto={`+ ${v.nome}`}
                  ativo={false}
                  onPress={() =>
                    editarForm({ fixos: [...form.fixos, { vendedorId: v.id, nome: v.nome, percentual: "" }] })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Estabelecimentos</Text>
        <Text style={styles.detalhe}>Sobre o valor dos produtos do contrato naquele estabelecimento.</Text>
        {estabelecimentos.length === 0 ? <Text style={styles.semLinhas}>Nenhum estabelecimento.</Text> : null}
        {estabelecimentos.map((e) => (
          <View key={e.id} style={styles.fixoLinha}>
            <Text style={styles.fixoNome}>{e.nome}</Text>
            <CampoPercentual
              valor={form.estabelecimentos[e.id] ?? ""}
              onChange={(v) => editarForm({ estabelecimentos: { ...form.estabelecimentos, [e.id]: v } })}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Agência</Text>
        <Text style={styles.detalhe}>
          Recebe quando o contrato é marcado como "veio pela agência", sobre o valor total.
        </Text>
        <TextInput
          style={[styles.input, { marginTop: 10 }]}
          placeholder="Nome da agência"
          value={form.agenciaNome}
          onChangeText={(v) => editarForm({ agenciaNome: v })}
        />
        <CampoPercentual valor={form.agencia} onChange={(v) => editarForm({ agencia: v })} />
      </View>

      {erroRegras ? <Text style={styles.erro}>{erroRegras}</Text> : null}
      {mensagemRegras ? <Text style={styles.sucesso}>{mensagemRegras}</Text> : null}
      <Pressable style={styles.botaoSalvarRegras} onPress={handleSalvarRegras} disabled={salvandoRegras}>
        {salvandoRegras ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.botaoPagarTexto}>Salvar regras</Text>
        )}
      </Pressable>
    </ScrollView>
  ) : (
    <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.resumoTotais}>
        <View style={styles.resumoCaixa}>
          <Text style={styles.resumoRotulo}>A pagar</Text>
          <Text style={[styles.resumoValor, { color: colors.primary }]}>{formatarMoeda(totalAPagar)}</Text>
        </View>
        <View style={styles.resumoCaixa}>
          <Text style={styles.resumoRotulo}>Pagas</Text>
          <Text style={[styles.resumoValor, { color: colors.success }]}>{formatarMoeda(totalPago)}</Text>
        </View>
      </View>

      <View style={styles.abas}>
        {(["resumo", "contratos", "regras"] as Aba[]).map((a) => (
          <Pressable key={a} style={[styles.aba, aba === a && styles.abaAtiva]} onPress={() => setAba(a)}>
            <Text style={[styles.abaTexto, aba === a && styles.abaTextoAtivo]}>
              {a === "resumo" ? "Resumo" : a === "contratos" ? "Contratos" : "Regras"}
            </Text>
          </Pressable>
        ))}
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
      ) : aba === "resumo" ? (
        <FlatList
          data={resumo}
          keyExtractor={(r) => r.chave}
          renderItem={renderResumo}
          contentContainerStyle={styles.lista}
          ListHeaderComponent={
            <Text style={styles.ajuda}>
              Quanto cada pessoa e cada estabelecimento tem a receber e já recebeu. Toque para ver os contratos.
            </Text>
          }
          ListEmptyComponent={
            <Text style={styles.vazio}>
              Nenhuma comissão ainda. Quando um cliente for para "Contrato fechado", as comissões aparecem aqui
              (confira os percentuais na aba Regras).
            </Text>
          }
        />
      ) : aba === "contratos" ? (
        <FlatList
          data={contratosVisiveis}
          keyExtractor={(i) => i.contrato.clienteId}
          renderItem={renderContrato}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={cabecalhoContratos}
          ListEmptyComponent={
            <Text style={styles.vazio}>
              {contratos.length === 0
                ? "Nenhum contrato fechado ainda."
                : "Nenhum contrato nesse filtro."}
            </Text>
          }
        />
      ) : (
        abaRegras
      )}
    </KeyboardAvoidingView>
  );
}

function Chip({ texto, ativo, onPress }: { texto: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, ativo && styles.chipAtivo]} onPress={onPress}>
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{texto}</Text>
    </Pressable>
  );
}

function CampoPercentual({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.campoPercentual}>
      <TextInput
        style={[styles.input, styles.inputPercentual]}
        placeholder="0"
        keyboardType="decimal-pad"
        value={valor}
        onChangeText={onChange}
      />
      <Text style={styles.sinalPercentual}>%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  resumoTotais: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  resumoCaixa: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  resumoRotulo: { fontSize: 12, fontFamily: "Prompt_500Medium", color: colors.textMuted },
  resumoValor: { fontSize: 18, fontFamily: "Prompt_600SemiBold", marginTop: 2 },
  resumoValorPequeno: { fontSize: 16, fontFamily: "Prompt_600SemiBold", marginTop: 2 },
  resumoLinha: { flexDirection: "row", gap: 20, marginTop: 8 },
  resumoCol: { minWidth: 0 },
  verContratos: {
    alignSelf: "flex-end",
    fontSize: 12,
    fontFamily: "Prompt_600SemiBold",
    color: colors.accent,
    marginTop: 6,
  },
  abas: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  aba: { flex: 1, paddingVertical: 10, alignItems: "center" },
  abaAtiva: { backgroundColor: colors.primary },
  abaTexto: { fontSize: 14, fontFamily: "Prompt_500Medium", color: colors.textMuted },
  abaTextoAtivo: { color: colors.surface, fontFamily: "Prompt_600SemiBold" },
  lista: { padding: 20, paddingBottom: 40 },
  ajuda: {
    fontSize: 13,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  rotuloFiltro: {
    fontSize: 11,
    fontFamily: "Prompt_600SemiBold",
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 4,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  chipAtivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTexto: { fontSize: 12, fontFamily: "Prompt_400Regular", color: colors.textMuted },
  chipTextoAtivo: { color: colors.surface, fontFamily: "Prompt_600SemiBold" },
  vazio: {
    color: colors.textMuted,
    fontFamily: "Prompt_400Regular",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitulo: { fontSize: 15, fontFamily: "Prompt_600SemiBold", color: colors.text, marginBottom: 2 },
  detalhe: { fontSize: 13, fontFamily: "Prompt_400Regular", color: colors.text, marginBottom: 2 },
  agencia: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, paddingVertical: 4 },
  agenciaTexto: { flex: 1, fontSize: 13, fontFamily: "Prompt_500Medium", color: colors.text },
  caixa: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  caixaMarcada: { backgroundColor: colors.accent, borderColor: colors.accent },
  caixaVisto: { color: colors.surface, fontSize: 14, fontFamily: "Prompt_600SemiBold" },
  semLinhas: {
    fontSize: 13,
    fontFamily: "Prompt_400Regular",
    color: colors.textMuted,
    marginTop: 10,
    lineHeight: 18,
  },
  linha: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linhaTopo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 2,
  },
  linhaNome: { flex: 1, fontSize: 14, fontFamily: "Prompt_600SemiBold", color: colors.text },
  selo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  seloAPagar: { backgroundColor: colors.warning + "33" },
  seloPaga: { backgroundColor: colors.success + "33" },
  seloTexto: { fontSize: 12, fontFamily: "Prompt_600SemiBold", color: colors.primary },
  comissao: { fontSize: 15, fontFamily: "Prompt_600SemiBold", color: colors.primary, marginTop: 2 },
  pagoEm: { fontSize: 12, fontFamily: "Prompt_500Medium", color: colors.textMuted, marginTop: 4 },
  aviso: { fontSize: 12, fontFamily: "Prompt_600SemiBold", color: colors.danger, marginTop: 4 },
  edicao: { marginTop: 12, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
  },
  campoPercentual: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  inputPercentual: { width: 90 },
  sinalPercentual: { fontSize: 15, fontFamily: "Prompt_500Medium", color: colors.textMuted },
  fixoLinha: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  fixoNome: { fontSize: 14, fontFamily: "Prompt_500Medium", color: colors.text },
  erro: { color: colors.danger, fontFamily: "Prompt_400Regular", fontSize: 13, marginTop: 6 },
  sucesso: { color: colors.success, fontFamily: "Prompt_600SemiBold", fontSize: 13, marginTop: 6 },
  acoes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16, marginTop: 10 },
  botaoPagar: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  botaoPagarTexto: { color: colors.surface, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  botaoSalvarRegras: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
  },
  acaoEditar: { color: colors.accent, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoExcluir: { color: colors.danger, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoSalvar: { color: colors.success, fontFamily: "Prompt_600SemiBold", fontSize: 13 },
  acaoCancelar: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
});
