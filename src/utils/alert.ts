import { Alert, Platform } from "react-native";

export type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type Handler = (title: string, message: string | undefined, buttons: AlertButton[]) => void;

let handler: Handler | null = null;

export function registrarAlertHandler(fn: Handler | null) {
  handler = fn;
}

// Substituto de Alert.alert que funciona também no web: react-native-web não
// implementa Alert (chamadas viram no-op silencioso), então no web mostramos
// um modal próprio via AlertHost; no nativo usamos o Alert de sempre.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const botoes = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  if (Platform.OS !== "web") {
    Alert.alert(title, message, botoes);
    return;
  }
  if (handler) {
    handler(title, message, botoes);
  }
}
