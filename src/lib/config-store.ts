import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Status = "ativo" | "inativo";

export type Item = {
  codigo: string;
  nome: string;
  categoria: string;
  unidade: string;
  estoqueMinimo: number;
  status: Status;
  observacao?: string;
};

export type Unidade = {
  codigo: string;
  nome: string;
  sigla: string;
  usadaEstoque: boolean;
  status: Status;
};

export type Categoria = {
  codigo: string;
  nome: string;
  descricao: string;
  status: Status;
};

export type Beneficio = {
  codigo: string;
  nome: string;
  tipo: string;
  controlaEstoque: boolean;
  status: Status;
  observacao?: string;
};

export type Doador = {
  codigo: string; // id interno
  nome: string;
  tipo: "Pessoa física" | "Empresa" | "Anônimo";
  documento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  ultimaDoacao?: string;
  observacao?: string;
  status: Status;
};

export type Fornecedor = {
  codigo: string;
  nome: string;
  documento?: string;
  telefone?: string;
  email?: string;
  categoria: string;
  observacao?: string;
  status: Status;
};

export type Parametros = {
  intervaloMinimoDias: number;
  alertaLiberadoSemRetiradaDias: number;
  limiteExtra: number;
  aposLimiteExtra: string;
  inatividadeContatoDias: number;
  liberacaoExcepcional: "admin" | "admin_atendente";
  bloqueioSemEstoque: boolean;
  observacaoObrigatoriaLiberacao: boolean;
  auditoriaAtiva: boolean;
  baixaAutomatica: boolean;
};

const SEED_ITENS: Item[] = [
  { codigo: "0001", nome: "Arroz 5kg", categoria: "ALI", unidade: "PCT", estoqueMinimo: 50, status: "ativo" },
  { codigo: "0002", nome: "Feijão 1kg", categoria: "ALI", unidade: "PCT", estoqueMinimo: 40, status: "ativo" },
  { codigo: "0003", nome: "Óleo 900ml", categoria: "ALI", unidade: "UN", estoqueMinimo: 30, status: "ativo" },
  { codigo: "0004", nome: "Macarrão", categoria: "ALI", unidade: "PCT", estoqueMinimo: 20, status: "ativo" },
  { codigo: "0005", nome: "Açúcar 1kg", categoria: "ALI", unidade: "PCT", estoqueMinimo: 20, status: "ativo" },
  { codigo: "0006", nome: "Café 500g", categoria: "ALI", unidade: "PCT", estoqueMinimo: 15, status: "ativo" },
  { codigo: "0007", nome: "Leite em pó", categoria: "ALI", unidade: "UN", estoqueMinimo: 20, status: "ativo" },
  { codigo: "0008", nome: "Cesta Padrão", categoria: "BEN", unidade: "UN", estoqueMinimo: 30, status: "ativo" },
  { codigo: "0009", nome: "Cesta Extra", categoria: "BEN", unidade: "UN", estoqueMinimo: 20, status: "ativo" },
  { codigo: "0010", nome: "Kit Gestante", categoria: "BEN", unidade: "UN", estoqueMinimo: 10, status: "ativo" },
];

const SEED_UNIDADES: Unidade[] = [
  { codigo: "UN", nome: "Unidade", sigla: "un.", usadaEstoque: true, status: "ativo" },
  { codigo: "PCT", nome: "Pacote", sigla: "pct.", usadaEstoque: true, status: "ativo" },
  { codigo: "KG", nome: "Quilo", sigla: "kg", usadaEstoque: true, status: "ativo" },
  { codigo: "LT", nome: "Litro", sigla: "lt", usadaEstoque: true, status: "ativo" },
  { codigo: "CX", nome: "Caixa", sigla: "cx", usadaEstoque: true, status: "ativo" },
  { codigo: "FD", nome: "Fardo", sigla: "fd", usadaEstoque: true, status: "ativo" },
];

const SEED_CATEGORIAS: Categoria[] = [
  { codigo: "ALI", nome: "Alimentos", descricao: "Itens de alimentação usados em cestas", status: "ativo" },
  { codigo: "BEB", nome: "Bebidas", descricao: "Leite, sucos e bebidas em geral", status: "ativo" },
  { codigo: "BEN", nome: "Benefício montado", descricao: "Cesta Padrão, Cesta Extra e kits", status: "ativo" },
  { codigo: "HIG", nome: "Higiene", descricao: "Produtos de higiene pessoal", status: "ativo" },
  { codigo: "REF", nome: "Refeição", descricao: "Itens usados em ações de comida de rua", status: "ativo" },
  { codigo: "OUT", nome: "Outros", descricao: "Itens diversos", status: "ativo" },
];

const SEED_BENEFICIOS: Beneficio[] = [
  { codigo: "BEN001", nome: "Cesta Padrão", tipo: "Cadastro definitivo", controlaEstoque: true, status: "ativo" },
  { codigo: "BEN002", nome: "Cesta Extra", tipo: "Cadastro em avaliação", controlaEstoque: true, status: "ativo" },
  { codigo: "BEN003", nome: "Kit Gestante", tipo: "Benefício específico", controlaEstoque: true, status: "ativo" },
  { codigo: "BEN004", nome: "Comida de Rua", tipo: "Ação social", controlaEstoque: true, status: "ativo" },
];

const SEED_DOADORES: Doador[] = [
  { codigo: "DOA001", nome: "Supermercado Exemplo", tipo: "Empresa", documento: "00.000.000/0001-00", telefone: "(11) 99999-0000", ultimaDoacao: "2025-05-21", status: "ativo" },
  { codigo: "DOA002", nome: "Família Anônima", tipo: "Pessoa física", documento: "Não informado", telefone: "", ultimaDoacao: "2025-05-10", status: "ativo" },
  { codigo: "DOA003", nome: "Padaria Bom Pão", tipo: "Empresa", documento: "11.111.111/0001-11", telefone: "(11) 98888-1111", ultimaDoacao: "2025-05-15", status: "ativo" },
];

const SEED_FORNECEDORES: Fornecedor[] = [
  { codigo: "FOR001", nome: "Atacadão Exemplo", documento: "22.222.222/0001-22", telefone: "(11) 97777-2222", categoria: "Alimentos", status: "ativo" },
  { codigo: "FOR002", nome: "Mercado Bom Preço", documento: "33.333.333/0001-33", telefone: "(11) 96666-3333", categoria: "Alimentos", status: "ativo" },
  { codigo: "FOR003", nome: "Distribuidora Solidária", documento: "44.444.444/0001-44", telefone: "(11) 95555-4444", categoria: "Diversos", status: "ativo" },
];

const SEED_PARAMETROS: Parametros = {
  intervaloMinimoDias: 25,
  alertaLiberadoSemRetiradaDias: 45,
  limiteExtra: 3,
  aposLimiteExtra: "Avaliar cadastro definitivo",
  inatividadeContatoDias: 90,
  liberacaoExcepcional: "admin",
  bloqueioSemEstoque: true,
  observacaoObrigatoriaLiberacao: true,
  auditoriaAtiva: true,
  baixaAutomatica: true,
};

type CrudMethods<T extends { codigo: string }> = {
  upsert: (r: T) => void;
  remove: (codigo: string) => void;
  setStatus: (codigo: string, status: Status) => void;
};

function makeStore<T extends { codigo: string }>(
  name: string,
  seed: T[],
) {
  return create<{ rows: T[] } & CrudMethods<T>>()(
    persist(
      (set) => ({
        rows: seed,
        upsert: (r) =>
          set((s) => {
            const i = s.rows.findIndex((x) => x.codigo === r.codigo);
            if (i === -1) return { rows: [...s.rows, r] };
            const copy = s.rows.slice();
            copy[i] = r;
            return { rows: copy };
          }),
        remove: (codigo) => set((s) => ({ rows: s.rows.filter((x) => x.codigo !== codigo) })),
        setStatus: (codigo, status) =>
          set((s) => ({
            rows: s.rows.map((x) => (x.codigo === codigo ? { ...x, status } : x)),
          })),
      }),
      { name },
    ),
  );
}

export const useItens = makeStore<Item>("seac.itens.v1", SEED_ITENS);
export const useUnidades = makeStore<Unidade>("seac.unidades.v1", SEED_UNIDADES);
export const useCategorias = makeStore<Categoria>("seac.categorias.v1", SEED_CATEGORIAS);
export const useBeneficios = makeStore<Beneficio>("seac.beneficios.v1", SEED_BENEFICIOS);
export const useDoadores = makeStore<Doador>("seac.doadores.v1", SEED_DOADORES);
export const useFornecedores = makeStore<Fornecedor>("seac.fornecedores.v1", SEED_FORNECEDORES);

export const useParametros = create<{
  params: Parametros;
  setParams: (p: Parametros) => void;
}>()(
  persist(
    (set) => ({
      params: SEED_PARAMETROS,
      setParams: (p) => set({ params: p }),
    }),
    { name: "seac.parametros.v1" },
  ),
);

// Helpers para outras telas: apenas ativos.
export const getItensAtivos = () => useItens.getState().rows.filter((r) => r.status === "ativo");
export const getUnidadesAtivas = () => useUnidades.getState().rows.filter((r) => r.status === "ativo");
export const getCategoriasAtivas = () => useCategorias.getState().rows.filter((r) => r.status === "ativo");
export const getBeneficiosAtivos = () => useBeneficios.getState().rows.filter((r) => r.status === "ativo");
export const getDoadoresAtivos = () => useDoadores.getState().rows.filter((r) => r.status === "ativo");
export const getFornecedoresAtivos = () => useFornecedores.getState().rows.filter((r) => r.status === "ativo");