import * as XLSX from "xlsx";
import { Platform } from "react-native";

// Exporta como .xlsx de verdade (não .csv) para nunca depender de como o
// Excel/Planilhas Google decide interpretar a codificação de um arquivo de
// texto — evita acentos/cedilha saindo corrompidos ao abrir o arquivo.
export async function exportarPlanilha(nomeArquivo: string, colunas: string[], linhas: string[][]) {
  const planilha = XLSX.utils.aoa_to_sheet([colunas, ...linhas]);
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, planilha, "Clientes");

  if (Platform.OS === "web") {
    XLSX.writeFile(pasta, nomeArquivo, { bookType: "xlsx" });
    return;
  }

  const bytes = XLSX.write(pasta, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");
  const file = new File(Paths.cache, nomeArquivo);
  file.create({ overwrite: true });
  file.write(new Uint8Array(bytes));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Exportar clientes",
    });
  }
}
