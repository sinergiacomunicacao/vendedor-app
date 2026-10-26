import {
  PagamentoComissao,
  PapelComissao,
  ProjecaoLinha,
  RegistroComissao,
  RegrasComissao,
  SituacaoContrato,
} from "../services/comissoes";
import { Cliente, produtosPorEstabelecimento, valorTotalCliente } from "../types";

export type { SituacaoContrato };

// Uma comissão de um contrato para um beneficiário.
export type LinhaComissao = {
  clienteId: string;
  chave: string;
  papel: PapelComissao;
  // Identifica a pessoa/entidade que recebe (uma pessoa pode receber por
  // papéis diferentes no mesmo contrato): "p_<id>", "e_<id>" ou "agencia".
  beneficiarioChave: string;
  beneficiarioNome: string;
  base: number;
  percentual: number;
  valor: number;
  // Tem percentual próprio neste contrato (diferente das regras).
  percentualProprio: boolean;
  pagamento?: PagamentoComissao;
  // Foi paga, mas já não se aplica (a regra ou o contrato mudou depois).
  naoSeAplicaMais: boolean;
  // O valor-base mudou depois do pagamento.
  valorMudouDepoisDePagar: boolean;
};

export type ContratoComissao = {
  clienteId: string;
  razaoSocial: string;
  vendedorId: string;
  vendedorNome: string;
  dataFechamento: number | null;
  valorTotal: number;
  situacao: SituacaoContrato;
  veioPelaAgencia: boolean;
  linhas: LinhaComissao[];
};

export const ROTULO_PAPEL: Record<PapelComissao, string> = {
  vendedor: "Vendedor que fechou",
  fixo: "Todos os contratos",
  estabelecimento: "Estabelecimento",
  agencia: "Agência",
};

function arredondar(valor: number) {
  return Math.round(valor * 100) / 100;
}

export function calcularComissao(base: number, percentual: number) {
  return arredondar((base * percentual) / 100);
}

type Candidata = {
  chave: string;
  papel: PapelComissao;
  beneficiarioChave: string;
  beneficiarioNome: string;
  base: number;
  percentualPadrao: number;
};

// Quem poderia receber neste contrato, segundo as regras de hoje.
function candidatasDoContrato(
  cliente: Cliente,
  agencia: boolean,
  regras: RegrasComissao,
  nomeVendedor: (id: string) => string,
  nomeEstabelecimento: (id: string, nomeNaFicha: string) => string
): Candidata[] {
  const valorTotal = valorTotalCliente(cliente.produtosInteresse);
  const candidatas: Candidata[] = [
    {
      chave: "vendedor",
      papel: "vendedor",
      beneficiarioChave: `p_${cliente.vendedorId}`,
      beneficiarioNome: nomeVendedor(cliente.vendedorId),
      base: valorTotal,
      percentualPadrao: regras.vendedorPercentual,
    },
  ];

  for (const fixo of regras.fixos) {
    candidatas.push({
      chave: `fixo_${fixo.vendedorId}`,
      papel: "fixo",
      beneficiarioChave: `p_${fixo.vendedorId}`,
      beneficiarioNome: fixo.nome,
      base: valorTotal,
      percentualPadrao: fixo.percentual,
    });
  }

  for (const grupo of produtosPorEstabelecimento(cliente)) {
    if (!grupo.estabelecimentoId) continue;
    candidatas.push({
      chave: `estab_${grupo.estabelecimentoId}`,
      papel: "estabelecimento",
      beneficiarioChave: `e_${grupo.estabelecimentoId}`,
      beneficiarioNome: nomeEstabelecimento(grupo.estabelecimentoId, grupo.estabelecimentoNome),
      base: grupo.produtos.reduce((total, p) => total + p.quantidade * p.valorUnitario, 0),
      percentualPadrao: regras.estabelecimentos[grupo.estabelecimentoId] ?? 0,
    });
  }

  if (agencia) {
    candidatas.push({
      chave: "agencia",
      papel: "agencia",
      beneficiarioChave: "agencia",
      beneficiarioNome: regras.agenciaNome || "Agência",
      base: valorTotal,
      percentualPadrao: regras.agenciaPercentual,
    });
  }
  return candidatas;
}

export function montarContratosComissao(
  clientes: Cliente[],
  registros: Record<string, RegistroComissao>,
  regras: RegrasComissao,
  nomeVendedor: (id: string) => string,
  nomeEstabelecimento: (id: string, nomeNaFicha: string) => string
): ContratoComissao[] {
  const contratos: ContratoComissao[] = [];
  const vistos = new Set<string>();

  for (const cliente of clientes) {
    const registro = registros[cliente.id];
    const pagamentos = registro?.pagamentos ?? {};
    const fechado = cliente.estagio === "fechado" && !cliente.cancelado;
    if (!fechado && Object.keys(pagamentos).length === 0) continue;
    vistos.add(cliente.id);

    const veioPelaAgencia = registro?.agencia === true;
    const candidatas = candidatasDoContrato(cliente, veioPelaAgencia, regras, nomeVendedor, nomeEstabelecimento);
    const linhas: LinhaComissao[] = [];
    const chavesVistas = new Set<string>();

    for (const c of candidatas) {
      const pagamento = pagamentos[c.chave];
      const percentual = registro?.percentuais?.[c.chave] ?? c.percentualPadrao;
      const aplica = fechado && percentual > 0;
      if (!aplica && !pagamento) continue;
      chavesVistas.add(c.chave);
      linhas.push({
        clienteId: cliente.id,
        chave: c.chave,
        papel: c.papel,
        beneficiarioChave: pagamento ? pagamento.beneficiarioChave : c.beneficiarioChave,
        beneficiarioNome: pagamento ? pagamento.beneficiarioNome : c.beneficiarioNome,
        // Comissão paga mostra o que foi pago, não o cálculo de hoje.
        base: pagamento ? pagamento.base : c.base,
        percentual: pagamento ? pagamento.percentual : percentual,
        valor: pagamento ? pagamento.valor : calcularComissao(c.base, percentual),
        percentualProprio: registro?.percentuais?.[c.chave] !== undefined,
        pagamento,
        naoSeAplicaMais: Boolean(pagamento) && fechado && !aplica,
        valorMudouDepoisDePagar: pagamento ? arredondar(pagamento.base) !== arredondar(c.base) : false,
      });
    }

    // Pagamentos de beneficiários que já não aparecem nas regras de hoje
    // (pessoa removida, agência desmarcada, estabelecimento trocado...).
    for (const [chave, pagamento] of Object.entries(pagamentos)) {
      if (chavesVistas.has(chave)) continue;
      linhas.push({
        clienteId: cliente.id,
        chave,
        papel: pagamento.papel,
        beneficiarioChave: pagamento.beneficiarioChave,
        beneficiarioNome: pagamento.beneficiarioNome,
        base: pagamento.base,
        percentual: pagamento.percentual,
        valor: pagamento.valor,
        percentualProprio: registro?.percentuais?.[chave] !== undefined,
        pagamento,
        naoSeAplicaMais: fechado,
        valorMudouDepoisDePagar: false,
      });
    }

    contratos.push({
      clienteId: cliente.id,
      razaoSocial: cliente.razaoSocial,
      vendedorId: cliente.vendedorId,
      vendedorNome: nomeVendedor(cliente.vendedorId),
      dataFechamento: cliente.dataFechamento ?? null,
      valorTotal: valorTotalCliente(cliente.produtosInteresse),
      situacao: fechado ? "ativo" : cliente.cancelado ? "cancelado" : "reaberto",
      veioPelaAgencia,
      linhas: ordenarLinhas(linhas),
    });
  }

  // Pagamentos de fichas que já não existem.
  for (const [clienteId, registro] of Object.entries(registros)) {
    const pagamentos = registro.pagamentos ?? {};
    const chaves = Object.keys(pagamentos);
    if (vistos.has(clienteId) || chaves.length === 0) continue;
    const primeiro = pagamentos[chaves[0]];
    contratos.push({
      clienteId,
      razaoSocial: primeiro.razaoSocial,
      vendedorId: primeiro.vendedorId,
      vendedorNome: primeiro.vendedorNome,
      dataFechamento: null,
      valorTotal: 0,
      situacao: "excluido",
      veioPelaAgencia: registro.agencia === true,
      linhas: ordenarLinhas(
        chaves.map((chave) => {
          const p = pagamentos[chave];
          return {
            clienteId,
            chave,
            papel: p.papel,
            beneficiarioChave: p.beneficiarioChave,
            beneficiarioNome: p.beneficiarioNome,
            base: p.base,
            percentual: p.percentual,
            valor: p.valor,
            percentualProprio: registro.percentuais?.[chave] !== undefined,
            pagamento: p,
            naoSeAplicaMais: false,
            valorMudouDepoisDePagar: false,
          };
        })
      ),
    });
  }

  // Mais recentes primeiro: pela data de fechamento, ou pelo último pagamento.
  const dataDoContrato = (c: ContratoComissao) =>
    c.dataFechamento ?? Math.max(0, ...c.linhas.map((l) => l.pagamento?.em ?? 0));
  return contratos.sort((a, b) => dataDoContrato(b) - dataDoContrato(a));
}

const ORDEM_PAPEL: Record<PapelComissao, number> = { vendedor: 0, fixo: 1, estabelecimento: 2, agencia: 3 };

function ordenarLinhas(linhas: LinhaComissao[]) {
  return linhas.sort(
    (a, b) =>
      ORDEM_PAPEL[a.papel] - ORDEM_PAPEL[b.papel] || a.beneficiarioNome.localeCompare(b.beneficiarioNome, "pt-BR")
  );
}

// As linhas que cada pessoa (usuário do app) pode ver: só as comissões em que
// ela é a beneficiária — quem fechou a venda ou quem recebe em todos os
// contratos. Estabelecimentos e agência não são usuários, não entram aqui.
// A chave do resultado é o id do documento: "<clienteId>_<chave>".
export function projetarLinhasDosVendedores(contratos: ContratoComissao[]): Record<string, ProjecaoLinha> {
  const projecao: Record<string, ProjecaoLinha> = {};
  for (const contrato of contratos) {
    for (const linha of contrato.linhas) {
      if (!linha.beneficiarioChave.startsWith("p_")) continue;
      projecao[`${linha.clienteId}_${linha.chave}`] = {
        vendedorId: linha.beneficiarioChave.slice(2),
        clienteId: linha.clienteId,
        chave: linha.chave,
        razaoSocial: contrato.razaoSocial,
        vendedorNome: contrato.vendedorNome,
        papel: linha.papel,
        base: linha.base,
        percentual: linha.percentual,
        valor: linha.valor,
        paga: Boolean(linha.pagamento),
        pagaEm: linha.pagamento?.em ?? null,
        dataFechamento: contrato.dataFechamento,
        situacao: contrato.situacao,
      };
    }
  }
  return projecao;
}

export type ResumoBeneficiario = {
  chave: string;
  nome: string;
  papeis: PapelComissao[];
  aPagar: number;
  pago: number;
  quantidade: number;
};

// Quanto cada pessoa/entidade tem a receber e já recebeu, somando os contratos.
export function resumirPorBeneficiario(linhas: LinhaComissao[]): ResumoBeneficiario[] {
  const mapa = new Map<string, ResumoBeneficiario>();
  for (const l of linhas) {
    let r = mapa.get(l.beneficiarioChave);
    if (!r) {
      r = { chave: l.beneficiarioChave, nome: l.beneficiarioNome, papeis: [], aPagar: 0, pago: 0, quantidade: 0 };
      mapa.set(l.beneficiarioChave, r);
    }
    if (!r.papeis.includes(l.papel)) r.papeis.push(l.papel);
    r.quantidade += 1;
    if (l.pagamento) r.pago = arredondar(r.pago + l.valor);
    else r.aPagar = arredondar(r.aPagar + l.valor);
  }
  return Array.from(mapa.values()).sort((a, b) => b.aPagar - a.aPagar || a.nome.localeCompare(b.nome, "pt-BR"));
}
