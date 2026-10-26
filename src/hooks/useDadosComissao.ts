import { useEffect, useMemo, useRef, useState } from "react";
import { ouvirTodosClientes } from "../services/clientes";
import {
  ouvirComissoes,
  ouvirProjecoes,
  ouvirRegras,
  ProjecaoComId,
  REGRAS_PADRAO,
  RegistroComissao,
  RegrasComissao,
  sincronizarProjecoes,
} from "../services/comissoes";
import { Estabelecimento, ouvirEstabelecimentos } from "../services/estabelecimentos";
import { ouvirVendedores, Vendedor } from "../services/vendedores";
import { Cliente } from "../types";
import { montarContratosComissao, projetarLinhasDosVendedores } from "../utils/comissoes";

// Tudo o que o gestor precisa para calcular as comissões: clientes, vendedores,
// estabelecimentos, regras e o que já foi pago/ajustado. `ativo` liga as
// consultas (só o gestor tem permissão para elas).
export function useDadosComissao(ativo: boolean) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [registros, setRegistros] = useState<Record<string, RegistroComissao>>({});
  const [regras, setRegras] = useState<RegrasComissao>(REGRAS_PADRAO);
  const [carregado, setCarregado] = useState({
    clientes: false,
    vendedores: false,
    estabelecimentos: false,
    registros: false,
    regras: false,
  });

  function marcar(fonte: keyof typeof carregado) {
    setCarregado((atual) => (atual[fonte] ? atual : { ...atual, [fonte]: true }));
  }

  useEffect(() => {
    if (!ativo) return;
    return ouvirTodosClientes((lista) => {
      setClientes(lista);
      marcar("clientes");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
  useEffect(() => {
    if (!ativo) return;
    return ouvirVendedores((lista) => {
      setVendedores(lista);
      marcar("vendedores");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
  useEffect(() => {
    if (!ativo) return;
    return ouvirEstabelecimentos((lista) => {
      setEstabelecimentos(lista);
      marcar("estabelecimentos");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
  useEffect(() => {
    if (!ativo) return;
    return ouvirComissoes((r) => {
      setRegistros(r);
      marcar("registros");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
  useEffect(() => {
    if (!ativo) return;
    return ouvirRegras((r) => {
      setRegras(r);
      marcar("regras");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const nomeVendedor = useMemo(() => {
    const mapa = new Map(vendedores.map((v) => [v.id, v.nome]));
    return (id: string) => mapa.get(id) ?? "Vendedor removido";
  }, [vendedores]);

  const nomeEstabelecimento = useMemo(() => {
    const mapa = new Map(estabelecimentos.map((e) => [e.id, e.nome]));
    return (id: string, nomeNaFicha: string) => mapa.get(id) ?? (nomeNaFicha || "Estabelecimento");
  }, [estabelecimentos]);

  const contratos = useMemo(
    () => montarContratosComissao(clientes, registros, regras, nomeVendedor, nomeEstabelecimento),
    [clientes, registros, regras, nomeVendedor, nomeEstabelecimento]
  );

  const pronto = Object.values(carregado).every(Boolean);

  return {
    clientes,
    vendedores,
    estabelecimentos,
    registros,
    regras,
    regrasCarregadas: carregado.regras,
    clientesCarregados: carregado.clientes,
    pronto,
    contratos,
    nomeVendedor,
    nomeEstabelecimento,
  };
}

// Mantém a visão de cada vendedor (collection comissoesVendedor) em dia com o
// cálculo do gestor. Roda no app do gestor enquanto ele estiver com o app
// aberto; o vendedor só lê. Só escreve a diferença, então não gera tráfego
// quando nada mudou.
export function useSincronizarComissoes(ativo: boolean) {
  const dados = useDadosComissao(ativo);
  const [projecoes, setProjecoes] = useState<Record<string, ProjecaoComId> | null>(null);
  const [rodada, setRodada] = useState(0);
  const ocupado = useRef(false);

  useEffect(() => {
    if (!ativo) return;
    return ouvirProjecoes(setProjecoes);
  }, [ativo]);

  const desejadas = useMemo(
    () => (dados.pronto ? projetarLinhasDosVendedores(dados.contratos) : null),
    [dados.pronto, dados.contratos]
  );

  useEffect(() => {
    // Sem clientes carregados não dá para saber o que é "desejado": melhor
    // não apagar nada do que apagar por engano.
    if (!ativo || !desejadas || !projecoes || dados.clientes.length === 0 || ocupado.current) return;
    ocupado.current = true;
    sincronizarProjecoes(desejadas, projecoes)
      .then((operacoes) => {
        // Se escreveu algo, confere de novo quando as gravações chegarem.
        if (operacoes > 0) setRodada((n) => n + 1);
      })
      .catch(() => {
        // Sem permissão ou sem rede: tenta de novo na próxima mudança.
      })
      .finally(() => {
        ocupado.current = false;
      });
  }, [ativo, desejadas, projecoes, dados.clientes.length, rodada]);
}
