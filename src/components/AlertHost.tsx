import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { AlertButton, registrarAlertHandler } from "../utils/alert";

type AlertState = { title: string; message?: string; buttons: AlertButton[] };

export default function AlertHost() {
  const [alerta, setAlerta] = useState<AlertState | null>(null);

  useEffect(() => {
    registrarAlertHandler((title, message, buttons) => setAlerta({ title, message, buttons }));
    return () => registrarAlertHandler(null);
  }, []);

  if (!alerta) return null;

  function handlePress(botao: AlertButton) {
    setAlerta(null);
    botao.onPress?.();
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setAlerta(null)}>
      <View style={styles.fundo}>
        <View style={styles.caixa}>
          <Text style={styles.titulo}>{alerta.title}</Text>
          {alerta.message ? <Text style={styles.mensagem}>{alerta.message}</Text> : null}
          <View style={styles.botoes}>
            {alerta.buttons.map((botao, i) => (
              <Pressable key={i} style={styles.botao} onPress={() => handlePress(botao)}>
                <Text
                  style={[
                    styles.botaoTexto,
                    botao.style === "cancel" && styles.botaoTextoCancelar,
                    botao.style === "destructive" && styles.botaoTextoDestrutivo,
                  ]}
                >
                  {botao.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "#00000066",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  caixa: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 340,
  },
  titulo: { fontSize: 17, fontFamily: "Prompt_600SemiBold", color: colors.text, marginBottom: 8 },
  mensagem: { fontSize: 14, fontFamily: "Prompt_400Regular", color: colors.textMuted, lineHeight: 20 },
  botoes: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 20,
  },
  botao: { paddingVertical: 6, paddingHorizontal: 4 },
  botaoTexto: { fontSize: 15, fontFamily: "Prompt_600SemiBold", color: colors.accent },
  botaoTextoCancelar: { color: colors.textMuted, fontFamily: "Prompt_400Regular" },
  botaoTextoDestrutivo: { color: colors.danger },
});
