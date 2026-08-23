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
  quantidade: number;
  valorUnitario: number;
};

type ProdutoInteresseAntigo = { id: string; nome: string; quantidade?: number; valorUnitario?: number };

export type Cliente = {
  id: string;
  vendedorId: string;
  cnpj: string;
  razaoSocial: string;
  telefone: string;
  email: string;
  produtosInteresse: (ProdutoInteresseAntigo | string)[];
  estabelecimento: string;
  estabelecimentoId: string;
  estagio?: Estagio;
  observacoes?: string;
  cancelado?: boolean;
  motivoCancelamento?: string;
  canceladoEm?: number;
  criadoEm: number;
};

export function normalizarProdutoInteresse(item: ProdutoInteresseAntigo | string): ProdutoInteresse {
  if (typeof item === "string") {
    return { id: item, nome: item, quantidade: 1, valorUnitario: 0 };
  }
  return {
    id: item.id,
    nome: item.nome,
    quantidade: item.quantidade ?? 1,
    valorUnitario: item.valorUnitario ?? 0,
  };
}

export function valorTotalCliente(produtosInteresse: (ProdutoInteresseAntigo | string)[]): number {
  return produtosInteresse
    .map(normalizarProdutoInteresse)
    .reduce((total, p) => total + p.quantidade * p.valorUnitario, 0);
}
