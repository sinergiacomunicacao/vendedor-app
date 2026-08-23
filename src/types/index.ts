export type Cliente = {
  id: string;
  vendedorId: string;
  cnpj: string;
  razaoSocial: string;
  telefone: string;
  email: string;
  produtosInteresse: string[];
  estabelecimento: string;
  criadoEm: number;
};
