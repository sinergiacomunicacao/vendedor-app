import { PagamentoComissao, RegistroComissao } from "../services/comissoes";
import { Cliente, valorTotalCliente } from "../types";

// Por que a linha está na lista:
// - "ativo": contrato fechado e não cancelado (comissão devida);
// - "cancelado" / "reaberto": já foi paga, mas a ficha foi cancelada ou saiu de
//   "Contrato fechado" depois — fica visível para o gestor decidir;
// - "excluido": já foi paga, mas a ficha foi apagada.
export type SituacaoComissao = "ativo" | "cancelado" | "reaberto" | "excluido";

export type LinhaComissao = {
  clienteId: string;
  razaoSocial: string;
  vendedorId: string;
  vendedorNome: string;
  dataFechamento: number | null;
  base: number;
  percentual: number;
  valor: number;
  // O contrato tem percentual próprio (diferente do padrão do vendedor).
  percentualProprio: boolean;
  situacao: SituacaoComissao;
  pagamento?: PagamentoComissao;
  // O valor do contrato mudou depois do pagamento.
  valorMudouDepoisDePagar: boolean;
};

function arredondar(valor: number) {
  return Math.round(valor * 100) / 100;
}

export function calcularComissao(base: number, percentual: number) {
  return arredondar((base * percentual) / 100);
}

export function montarLinhasComissao(
  clientes: Cliente[],
  registros: Record<string, RegistroComissao>,
  padroes: Record<string, number>,
  nomeVendedor: (id: string) => string
): LinhaComissao[] {
  const linhas: LinhaComissao[] = [];
  const vistos = new Set<string>();

  for (const cliente of clientes) {
    const registro = registros[cliente.id];
    const pagamento = registro?.pagamento;
    const fechado = cliente.estagio === "fechado" && !cliente.cancelado;
    if (!fechado && !pagamento) continue;
    vistos.add(cliente.id);

    const baseAtual = valorTotalCliente(cliente.produtosInteresse);
    const percentualAtual = registro?.percentual ?? padroes[cliente.vendedorId] ?? 0;
    linhas.push({
      clienteId: cliente.id,
      razaoSocial: cliente.razaoSocial,
      vendedorId: cliente.vendedorId,
      vendedorNome: nomeVendedor(cliente.vendedorId),
      dataFechamento: cliente.dataFechamento ?? null,
      // Contrato pago mostra o que foi pago, não o cálculo de hoje.
      base: pagamento ? pagamento.base : baseAtual,
      percentual: pagamento ? pagamento.percentual : percentualAtual,
      valor: pagamento ? pagamento.valor : calcularComissao(baseAtual, percentualAtual),
      percentualProprio: registro?.percentual !== undefined,
      situacao: fechado ? "ativo" : cliente.cancelado ? "cancelado" : "reaberto",
      pagamento,
      valorMudouDepoisDePagar: pagamento ? arredondar(pagamento.base) !== arredondar(baseAtual) : false,
    });
  }

  // Pagamentos de fichas que já não existem.
  for (const [clienteId, registro] of Object.entries(registros)) {
    const pagamento = registro.pagamento;
    if (vistos.has(clienteId) || !pagamento) continue;
    linhas.push({
      clienteId,
      razaoSocial: pagamento.razaoSocial,
      vendedorId: pagamento.vendedorId,
      vendedorNome: pagamento.vendedorNome,
      dataFechamento: null,
      base: pagamento.base,
      percentual: pagamento.percentual,
      valor: pagamento.valor,
      percentualProprio: registro.percentual !== undefined,
      situacao: "excluido",
      pagamento,
      valorMudouDepoisDePagar: false,
    });
  }

  // Mais recentes primeiro: pela data de fechamento, ou pelo pagamento.
  const dataDaLinha = (l: LinhaComissao) => l.dataFechamento ?? l.pagamento?.em ?? 0;
  return linhas.sort((a, b) => dataDaLinha(b) - dataDaLinha(a));
}
