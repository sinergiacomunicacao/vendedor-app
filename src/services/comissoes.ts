import { collection, deleteField, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Comissões ficam em coleções à parte (e não no cliente nem no perfil do
// vendedor) porque as regras do Firestore só deixam o gestor ler e escrever
// aqui — o vendedor lê os próprios clientes e edita o próprio perfil.

// Foto do que foi pago. Guarda também quem é o cliente e o vendedor, para o
// histórico continuar legível mesmo se a ficha for editada ou excluída depois.
export type PagamentoComissao = {
  em: number;
  porId: string;
  por: string;
  base: number;
  percentual: number;
  valor: number;
  razaoSocial: string;
  vendedorId: string;
  vendedorNome: string;
};

// Um documento por cliente (mesmo id da ficha). `percentual` é um ajuste
// daquele contrato; ausente = vale o percentual padrão do vendedor.
export type RegistroComissao = {
  percentual?: number;
  pagamento?: PagamentoComissao;
};

export function ouvirComissoes(callback: (registros: Record<string, RegistroComissao>) => void) {
  return onSnapshot(collection(db, "comissoes"), (snapshot) => {
    const registros: Record<string, RegistroComissao> = {};
    snapshot.docs.forEach((d) => {
      registros[d.id] = d.data() as RegistroComissao;
    });
    callback(registros);
  });
}

// Percentual padrão de cada vendedor: comissoesConfig/{vendedorId}.
export function ouvirPercentuaisPadrao(callback: (percentuais: Record<string, number>) => void) {
  return onSnapshot(collection(db, "comissoesConfig"), (snapshot) => {
    const percentuais: Record<string, number> = {};
    snapshot.docs.forEach((d) => {
      percentuais[d.id] = (d.data().percentual as number | undefined) ?? 0;
    });
    callback(percentuais);
  });
}

export async function definirPercentualPadrao(vendedorId: string, percentual: number) {
  await setDoc(doc(db, "comissoesConfig", vendedorId), { percentual, atualizadoEm: Date.now() });
}

// `null` remove o ajuste do contrato e volta a valer o percentual do vendedor.
export async function definirPercentualContrato(clienteId: string, percentual: number | null) {
  await setDoc(
    doc(db, "comissoes", clienteId),
    { percentual: percentual === null ? deleteField() : percentual },
    { merge: true }
  );
}

export async function marcarComissaoPaga(clienteId: string, pagamento: PagamentoComissao) {
  await setDoc(doc(db, "comissoes", clienteId), { pagamento }, { merge: true });
}

export async function desfazerPagamentoComissao(clienteId: string) {
  await setDoc(doc(db, "comissoes", clienteId), { pagamento: deleteField() }, { merge: true });
}
