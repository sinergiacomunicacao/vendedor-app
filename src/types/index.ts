export type Estagio = "contato" | "reuniao" | "fechado" | "perdido";

export const ESTAGIOS: { id: Estagio; label: string }[] = [
  { id: "contato", label: "Contato feito" },
  { id: "reuniao", label: "Reunião marcada" },
  { id: "fechado", label: "Contrato fechado" },
  { id: "perdido", label: "Perdido" },
];

export type PrazoContrato = {
  id: string;
  meses: number;
  descontoPercentual: number;
};

export type ProdutoInteresse = {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  prazoMeses?: number;
  descontoPercentual?: number;
  // Cada produto carrega o próprio estabelecimento — permite que um cliente
  // tenha interesse em anunciar em mais de um estabelecimento ao mesmo tempo.
  // Ausente em registros antigos (formato de um único estabelecimento por
  // cliente); nesse caso cai no fallback de Cliente.estabelecimento(Id).
  estabelecimentoId?: string;
  estabelecimentoNome?: string;
};

type ProdutoInteresseAntigo = {
  id: string;
  nome: string;
  quantidade?: number;
  valorUnitario?: number;
  prazoMeses?: number;
  descontoPercentual?: number;
  estabelecimentoId?: string;
  estabelecimentoNome?: string;
};

export type Cliente = {
  id: string;
  vendedorId: string;
  cnpj: string;
  razaoSocial: string;
  telefone: string;
  email: string;
  produtosInteresse: (ProdutoInteresseAntigo | string)[];
  // Legado: registros criados antes do suporte a múltiplos estabelecimentos.
  // Novos clientes não gravam mais esses dois campos — o estabelecimento de
  // cada produto vive em ProdutoInteresse.estabelecimentoId/estabelecimentoNome.
  estabelecimento?: string;
  estabelecimentoId?: string;
  estagio?: Estagio;
  observacoes?: string;
  cancelado?: boolean;
  motivoCancelamento?: string;
  canceladoEm?: number;
  dataFechamento?: number;
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
    prazoMeses: item.prazoMeses,
    descontoPercentual: item.descontoPercentual,
    estabelecimentoId: item.estabelecimentoId,
    estabelecimentoNome: item.estabelecimentoNome,
  };
}

export function labelPrazo(meses: number) {
  return meses === 1 ? "1 mês" : `${meses} meses`;
}

export function valorTotalCliente(produtosInteresse: (ProdutoInteresseAntigo | string)[]): number {
  return produtosInteresse
    .map(normalizarProdutoInteresse)
    .reduce((total, p) => total + p.quantidade * p.valorUnitario, 0);
}

// Uma linha de produto sem estabelecimento próprio (registro antigo) herda o
// único estabelecimento que o cliente tinha antes de existir multi-seleção.
export function produtoComEstabelecimento(
  item: ProdutoInteresseAntigo | string,
  cliente: Pick<Cliente, "estabelecimento" | "estabelecimentoId">
): ProdutoInteresse {
  const produto = normalizarProdutoInteresse(item);
  return {
    ...produto,
    estabelecimentoId: produto.estabelecimentoId || cliente.estabelecimentoId || "",
    estabelecimentoNome: produto.estabelecimentoNome || cliente.estabelecimento || "",
  };
}

// Lista de estabelecimentos distintos em que o cliente tem interesse —
// usada em telas/filtros que precisam exibir ou comparar o conjunto todo.
export function estabelecimentosDoCliente(cliente: Cliente): { id: string; nome: string }[] {
  const vistos = new Map<string, string>();
  cliente.produtosInteresse
    .map((item) => produtoComEstabelecimento(item, cliente))
    .forEach((p) => {
      if (p.estabelecimentoId) vistos.set(p.estabelecimentoId, p.estabelecimentoNome || "");
    });
  return Array.from(vistos, ([id, nome]) => ({ id, nome }));
}

// Produtos de interesse agrupados por estabelecimento, na ordem em que os
// estabelecimentos aparecem — usado pra mostrar a ficha do cliente organizada.
export function produtosPorEstabelecimento(
  cliente: Cliente
): { estabelecimentoId: string; estabelecimentoNome: string; produtos: ProdutoInteresse[] }[] {
  const grupos = new Map<string, { estabelecimentoNome: string; produtos: ProdutoInteresse[] }>();
  cliente.produtosInteresse
    .map((item) => produtoComEstabelecimento(item, cliente))
    .forEach((p) => {
      const id = p.estabelecimentoId || "";
      if (!grupos.has(id)) grupos.set(id, { estabelecimentoNome: p.estabelecimentoNome || "", produtos: [] });
      grupos.get(id)!.produtos.push(p);
    });
  return Array.from(grupos, ([estabelecimentoId, g]) => ({ estabelecimentoId, ...g }));
}

// Quantos dias faltam pro fim do contrato (data de fechamento + o maior
// prazo entre os produtos do cliente). Retorna null quando não dá pra
// calcular (sem data de fechamento, ou nenhum produto com prazo definido).
export function diasParaVencimento(cliente: Cliente): number | null {
  if (!cliente.dataFechamento) return null;
  const maiorPrazoMeses = cliente.produtosInteresse
    .map(normalizarProdutoInteresse)
    .reduce((maior, p) => (p.prazoMeses && p.prazoMeses > maior ? p.prazoMeses : maior), 0);
  if (maiorPrazoMeses === 0) return null;

  const vencimento = new Date(cliente.dataFechamento);
  vencimento.setMonth(vencimento.getMonth() + maiorPrazoMeses);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  vencimento.setHours(0, 0, 0, 0);

  return Math.round((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}
