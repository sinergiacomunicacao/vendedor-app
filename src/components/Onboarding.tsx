import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

const CHAVE_TUTORIAL_VISTO = "tutorial_visto_v1";

type Slide = { titulo: string; texto: string };

const SLIDES: Slide[] = [
  {
    titulo: "Bem-vindo ao Sinergia Comercial",
    texto:
      "Aqui você cadastra seus clientes, acompanha o andamento de cada venda e vê tudo salvo automaticamente, sem precisar de planilha.",
  },
  {
    titulo: "Cadastre um cliente",
    texto:
      "Toque em \"+ Novo cliente\", escolha o estabelecimento e os produtos de interesse. A quantidade de cada produto é limitada pelo estoque disponível na hora.",
  },
  {
    titulo: "Acompanhe o funil de vendas",
    texto:
      "Na ficha de cada cliente, marque o estágio atual: Contato feito, Reunião marcada, Contrato fechado ou Perdido. Você pode mudar isso a qualquer momento.",
  },
];

export default function Onboarding() {
  const [visivel, setVisivel] = useState(false);
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_TUTORIAL_VISTO).then((valor) => {
      if (!valor) setVisivel(true);
    });
  }, []);

  function fechar() {
    setVisivel(false);
    AsyncStorage.setItem(CHAVE_TUTORIAL_VISTO, "true");
  }

  function avancar() {
    if (passo < SLIDES.length - 1) {
      setPasso((atual) => atual + 1);
    } else {
      fechar();
    }
  }

  if (!visivel) return null;

  const slide = SLIDES[passo];
  const ultimoPasso = passo === SLIDES.length - 1;

  return (
    <Modal transparent animationType="fade" visible={visivel} onRequestClose={fechar}>
      <View style={styles.fundo}>
        <View style={styles.caixa}>
          <Pressable style={styles.pular} onPress={fechar}>
            <Text style={styles.pularTexto}>Pular</Text>
          </Pressable>

          <Text style={styles.titulo}>{slide.titulo}</Text>
          <Text style={styles.texto}>{slide.texto}</Text>

          <View style={styles.pontos}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.ponto, i === passo && styles.pontoAtivo]} />
            ))}
          </View>

          <Pressable style={styles.botao} onPress={avancar}>
            <Text style={styles.botaoTexto}>{ultimoPasso ? "Começar a usar" : "Próximo"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "#00000088",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  caixa: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    paddingTop: 40,
    width: "100%",
    maxWidth: 380,
  },
  pular: { position: "absolute", top: 16, right: 16, padding: 4 },
  pularTexto: { color: colors.textMuted, fontFamily: "Prompt_400Regular", fontSize: 13 },
  titulo: {
    fontSize: 20,
    fontFamily: "Prompt_700Bold",
    color: colors.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  texto: {
    fontSize: 15,
    fontFamily: "Prompt_400Regular",
    color: colors.text,
    lineHeight: 22,
    textAlign: "center",
  },
  pontos: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
  },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  pontoAtivo: { backgroundColor: colors.primary, width: 20 },
  botao: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  botaoTexto: { color: colors.surface, fontSize: 15, fontFamily: "Prompt_600SemiBold" },
});
