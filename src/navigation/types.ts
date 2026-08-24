export type AuthStackParamList = {
  Login: undefined;
  Cadastro: undefined;
};

export type AppStackParamList = {
  Clientes: undefined;
  NovoCliente: { clienteId?: string } | undefined;
  ClienteDetalhe: { clienteId: string };
  Estabelecimentos: undefined;
  Produtos: { estabelecimentoId: string; estabelecimentoNome: string };
  Relatorio: undefined;
  PrazosContrato: undefined;
};
