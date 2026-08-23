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
import { colors } from "../theme/colors";
import { isValidCnpj, isValidEmail, maskCnpj, maskTelefone } from "../utils/format";

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
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [estabelecimentoNomeOriginal, setEstabelecimentoNomeOriginal] = useState<string | null>(
    null
  );
  const [produtosOriginais, setProdutosOriginais] = useState<string[] | null>(null);

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
      setEstabelecimentoNomeOriginal(cliente.estabelecimento);
      setProdutosOriginais(cliente.produtosInteresse);
      setCarregandoCliente(false);
    });
  }, [clienteId]);

  useEffect(() => {
    return ouvirEstabelecimentos((lista) => {
      setEstabelecimentos(lista);
      setEstabelecimentoId((atual) => {
        if (atual) return atual;
        if (estabelecimentoNomeOriginal) {
          const encontrado = lista.find((e) => e.nome === estabelecimentoNomeOriginal);
          if (encontrado) return encontrado.id;
        }
        return modoEdicao ? "" : lista[0]?.id || "";
      });
    });
  }, [estabelecimentoNomeOriginal, modoEdicao]);

  useEffect(() => {
    setProdutos([]);
    setProdutosSelecionados([]);
    if (!estabelecimentoId) return;
    return ouvirProdutos(estabelecimentoId, setProdutos);
  }, [estabelecimentoId]);

  const [prefilAplicado, setPrefilAplicado] = useState(false);
  useEffect(() => {
    if (prefilAplicado || !produtosOriginais || !estabelecimentoId) return;
    setProdutosSelecionados(produtosOriginais);
    setPrefilAplicado(true);
  }, [estabelecimentoId, produtosOriginais, prefilAplicado]);

  function alternarProduto(nome: string) {
    setProdutosSelecionados((atual) =>
      atual.includes(nome) ? atual.filter((p) => p !== nome) : [...atual, nome]
    );
  }

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
      produtosInteresse: produtosSelecionados,
    };

    setSalvando(true);
    try {
      if (clienteId) {
        await atualizarCliente(clienteId, dados);
      } else {
        await criarCliente(dados);
      }
      navigation.goBack();
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
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
        <Text style={styles.ajuda}>Pode marcar mais de um.</Text>
        {estabelecimentoId && produtos.length === 0 ? (
          <Text style={styles.vazio}>
            Nenhum produto cadastrado para esse estabelecimento ainda.
          </Text>
        ) : (
          <View style={styles.opcoes}>
            {produtos.map((produto) => {
              const selecionado = produtosSelecionados.includes(produto.nome);
              return (
                <Pressable
                  key={produto.id}
                  style={[styles.opcao, selecionado && styles.opcaoSelecionada]}
                  onPress={() => alternarProduto(produto.nome)}
                >
                  <Text
                    style={[styles.opcaoTexto, selecionado && styles.opcaoTextoSelecionado]}
                  >
                    {selecionado ? "✓ " : ""}
                    {produto.nome}
                  </Text>
                </Pressable>
              );
            })}
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
