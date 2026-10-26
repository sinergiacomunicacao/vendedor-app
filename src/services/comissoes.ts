import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// Comissões ficam em coleções à parte (e não no cliente nem no perfil do
// vendedor) porque as regras do Firestore só deixam o gestor ler e escrever
// aqui — o vendedor lê os próprios clientes e edita o próprio perfil.

// Quem pode receber comissão em um contrato:
// - "vendedor": quem fechou a venda;
// - "fixo": pessoas que recebem em todos os contratos, seja quem for o vendedor;
// - "estabelecimento": o estabelecimento dos produtos do contrato;
// - "agencia": quando o cliente veio pela agência.
export type PapelComissao = "vendedor" | "fixo" | "estabelecimento" | "agencia";

export type PessoaFixa = { vendedorId: string; nome: string; percentual: number };

// Regras gerais: um único documento, comissoesConfig/regras.
export type RegrasComissao = {
  vendedorPercentual: number;
  fixos: PessoaFixa[];
  // Percentual de cada estabelecimento, por id. Ausente = não recebe.
  estabelecimentos: Record<string, number>;
  agenciaNome: string;
  agenciaPercentual: number;
};

export const REGRAS_PADRAO: RegrasComissao = {
  vendedorPercentual: 10,
  fixos: [],
  estabelecimentos: {},
  agenciaNome: "Agência",
  agenciaPercentual: 20,
};

// Foto do que foi pago. Guarda também quem é o cliente e o beneficiário, para o
// histórico continuar legível mesmo se a ficha ou as regras mudarem depois.
export type PagamentoComissao = {
  em: number;
  porId: string;
  por: string;
  base: number;
  percentual: number;
  valor: number;
  papel: PapelComissao;
  beneficiarioChave: string;
  beneficiarioNome: string;
  razaoSocial: string;
  vendedorId: string;
  vendedorNome: string;
};

// Um documento por cliente (mesmo id da ficha). Cada comissão do contrato tem
// uma chave: "vendedor", "fixo_<vendedorId>", "estab_<estabelecimentoId>" ou
// "agencia".
export type RegistroComissao = {
  // O cliente veio pela agência.
  agencia?: boolean;
  // Ajuste de percentual só deste contrato, por chave.
  percentuais?: Record<string, number>;
  pagamentos?: Record<string, PagamentoComissao>;
};

// Situação do contrato em relação à comissão:
// - "ativo": contrato fechado e não cancelado (comissão devida);
// - "cancelado" / "reaberto": já teve comissão paga, mas a ficha foi cancelada ou
//   saiu de "Contrato fechado" depois — fica visível para o gestor decidir;
// - "excluido": já teve comissão paga, mas a ficha foi apagada.
export type SituacaoContrato = "ativo" | "cancelado" | "reaberto" | "excluido";

// Visão de uma comissão para a PESSOA que recebe (quem é usuário do app). O
// gestor grava estas linhas (a partir do próprio app) e cada vendedor lê só as
// dele: comissoesVendedor/{clienteId}_{chave}, com vendedorId = quem recebe.
// Os dados completos (outros beneficiários, regras) continuam só do gestor.
export type ProjecaoLinha = {
  vendedorId: string;
  clienteId: string;
  chave: string;
  razaoSocial: string;
  vendedorNome: string;
  papel: PapelComissao;
  base: number;
  percentual: number;
  valor: number;
  paga: boolean;
  pagaEm: number | null;
  dataFechamento: number | null;
  situacao: SituacaoContrato;
};

export type ProjecaoComId = ProjecaoLinha & { id: string; atualizadoEm?: number };

function projecoesRef() {
  return collection(db, "comissoesVendedor");
}

// Gestor: todas as linhas (para saber o que precisa atualizar).
export function ouvirProjecoes(callback: (linhas: Record<string, ProjecaoComId>) => void) {
  return onSnapshot(projecoesRef(), (snapshot) => {
    const linhas: Record<string, ProjecaoComId> = {};
    snapshot.docs.forEach((d) => {
      linhas[d.id] = { ...(d.data() as ProjecaoLinha), id: d.id, atualizadoEm: d.data().atualizadoEm };
    });
    callback(linhas);
  });
}

// Vendedor: só as linhas dele. O filtro por vendedorId é exigido pelas regras.
export function ouvirMinhasComissoes(
  vendedorId: string,
  callback: (linhas: ProjecaoComId[]) => void
) {
  const q = query(projecoesRef(), where("vendedorId", "==", vendedorId));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        ...(d.data() as ProjecaoLinha),
        id: d.id,
        atualizadoEm: d.data().atualizadoEm as number | undefined,
      }))
    );
  });
}

const CAMPOS_PROJECAO: (keyof ProjecaoLinha)[] = [
  "vendedorId",
  "clienteId",
  "chave",
  "razaoSocial",
  "vendedorNome",
  "papel",
  "base",
  "percentual",
  "valor",
  "paga",
  "pagaEm",
  "dataFechamento",
  "situacao",
];

function mudou(desejada: ProjecaoLinha, atual: ProjecaoLinha) {
  return CAMPOS_PROJECAO.some((campo) => desejada[campo] !== atual[campo]);
}

// Põe as linhas gravadas em dia com o que o gestor calculou: cria/atualiza o
// que mudou e apaga o que não existe mais. Só escreve a diferença; devolve
// quantas operações fez.
export async function sincronizarProjecoes(
  desejadas: Record<string, ProjecaoLinha>,
  atuais: Record<string, ProjecaoComId>
): Promise<number> {
  const operacoes: { tipo: "set" | "delete"; id: string; dados?: ProjecaoLinha }[] = [];
  for (const [id, desejada] of Object.entries(desejadas)) {
    const atual = atuais[id];
    if (!atual || mudou(desejada, atual)) operacoes.push({ tipo: "set", id, dados: desejada });
  }
  for (const id of Object.keys(atuais)) {
    if (!desejadas[id]) operacoes.push({ tipo: "delete", id });
  }

  const agora = Date.now();
  for (let i = 0; i < operacoes.length; i += 400) {
    const lote = writeBatch(db);
    for (const op of operacoes.slice(i, i + 400)) {
      const ref = doc(db, "comissoesVendedor", op.id);
      if (op.tipo === "set") lote.set(ref, { ...op.dados, atualizadoEm: agora });
      else lote.delete(ref);
    }
    await lote.commit();
  }
  return operacoes.length;
}

export function ouvirRegras(callback: (regras: RegrasComissao, existe: boolean) => void) {
  return onSnapshot(doc(db, "comissoesConfig", "regras"), (snapshot) => {
    const dados = snapshot.exists() ? (snapshot.data() as Partial<RegrasComissao>) : {};
    callback({ ...REGRAS_PADRAO, ...dados }, snapshot.exists());
  });
}

export async function salvarRegras(regras: RegrasComissao) {
  await setDoc(doc(db, "comissoesConfig", "regras"), { ...regras, atualizadoEm: Date.now() });
}

export function ouvirComissoes(callback: (registros: Record<string, RegistroComissao>) => void) {
  return onSnapshot(collection(db, "comissoes"), (snapshot) => {
    const registros: Record<string, RegistroComissao> = {};
    snapshot.docs.forEach((d) => {
      registros[d.id] = d.data() as RegistroComissao;
    });
    callback(registros);
  });
}

export async function definirAgencia(clienteId: string, agencia: boolean) {
  await setDoc(doc(db, "comissoes", clienteId), { agencia }, { merge: true });
}

// `null` remove o ajuste e volta a valer o percentual das regras.
export async function definirPercentualDaComissao(
  clienteId: string,
  chave: string,
  percentual: number | null
) {
  await setDoc(
    doc(db, "comissoes", clienteId),
    { percentuais: { [chave]: percentual === null ? deleteField() : percentual } },
    { merge: true }
  );
}

export async function marcarComissaoPaga(
  clienteId: string,
  chave: string,
  pagamento: PagamentoComissao
) {
  await setDoc(doc(db, "comissoes", clienteId), { pagamentos: { [chave]: pagamento } }, { merge: true });
}

export async function desfazerPagamentoComissao(clienteId: string, chave: string) {
  await setDoc(
    doc(db, "comissoes", clienteId),
    { pagamentos: { [chave]: deleteField() } },
    { merge: true }
  );
}
