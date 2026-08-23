export type Estagio = "contato" | "reuniao" | "fechado" | "perdido";

export const ESTAGIOS: { id: Estagio; label: string }[] = [
  { id: "contato", label: "Contato feito" },
  { id: "reuniao", label: "Reunião marcada" },
  { id: "fechado", label: "Contrato fechado" },
  { id: "perdido", label: "Perdido" },
];

export type ProdutoInteresse = {
  id: string;
  nome: string;
};

export type Cliente = {
  id: string;
  vendedorId: string;
  cnpj: string;
  razaoSocial: string;
  telefone: string;
  email: string;
  produtosInteresse: (ProdutoInteresse | string)[];
  estabelecimento: string;
  estabelecimentoId: string;
  estagio?: Estagio;
  criadoEm: number;
};

export function normalizarProdutoInteresse(item: ProdutoInteresse | string): ProdutoInteresse {
  return typeof item === "string" ? { id: item, nome: item } : item;
}
