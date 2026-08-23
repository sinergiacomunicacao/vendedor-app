import { Platform } from "react-native";

export function paraCsv(colunas: string[], linhas: string[][]): string {
  const escapar = (valor: string) => {
    if (/[",\n;]/.test(valor)) {
      return `"${valor.replace(/"/g, '""')}"`;
    }
    return valor;
  };
  return [colunas, ...linhas].map((linha) => linha.map(escapar).join(";")).join("\n");
}

export async function exportarCsv(nomeArquivo: string, csv: string) {
  if (Platform.OS === "web") {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");
  const file = new File(Paths.cache, nomeArquivo);
  file.create({ overwrite: true });
  file.write(csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Exportar clientes" });
  }
}
