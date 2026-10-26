import { collection, deleteField, doc, onSnapshot, setDoc } from "firebase/firestore";
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
