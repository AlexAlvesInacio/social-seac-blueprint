import { create } from "zustand";
import { persist } from "zustand/middleware";

// Resquício do protótipo local: itens e benefícios ainda vivem aqui até serem
// religados às tabelas reais itens_estoque/beneficios do Supabase (fatia
// pendente em docs/07_STATUS_IMPLEMENTACAO.md). Unidades, categorias, doadores
// e fornecedores já migraram para src/lib/cadastros/cadastros-supabase.ts.

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

export type Beneficio = {
  codigo: string;
  nome: string;
  tipo: string;
  controlaEstoque: boolean;
  status: Status;
  observacao?: string;
};

const SEED_ITENS: Item[] = [
  {
    codigo: "0001",
    nome: "Arroz 5kg",
    categoria: "ALI",
    unidade: "PCT",
    estoqueMinimo: 50,
    status: "ativo",
  },
  {
    codigo: "0002",
    nome: "Feijão 1kg",
    categoria: "ALI",
    unidade: "PCT",
    estoqueMinimo: 40,
    status: "ativo",
  },
  {
    codigo: "0003",
    nome: "Óleo 900ml",
    categoria: "ALI",
    unidade: "UN",
    estoqueMinimo: 30,
    status: "ativo",
  },
  {
    codigo: "0004",
    nome: "Macarrão",
    categoria: "ALI",
    unidade: "PCT",
    estoqueMinimo: 20,
    status: "ativo",
  },
  {
    codigo: "0005",
    nome: "Açúcar 1kg",
    categoria: "ALI",
    unidade: "PCT",
    estoqueMinimo: 20,
    status: "ativo",
  },
  {
    codigo: "0006",
    nome: "Café 500g",
    categoria: "ALI",
    unidade: "PCT",
    estoqueMinimo: 15,
    status: "ativo",
  },
  {
    codigo: "0007",
    nome: "Leite em pó",
    categoria: "ALI",
    unidade: "UN",
    estoqueMinimo: 20,
    status: "ativo",
  },
  {
    codigo: "0008",
    nome: "Cesta Padrão",
    categoria: "BEN",
    unidade: "UN",
    estoqueMinimo: 30,
    status: "ativo",
  },
  {
    codigo: "0009",
    nome: "Cesta Extra",
    categoria: "BEN",
    unidade: "UN",
    estoqueMinimo: 20,
    status: "ativo",
  },
  {
    codigo: "0010",
    nome: "Kit Gestante",
    categoria: "BEN",
    unidade: "UN",
    estoqueMinimo: 10,
    status: "ativo",
  },
];

const SEED_BENEFICIOS: Beneficio[] = [
  {
    codigo: "BEN001",
    nome: "Cesta Padrão",
    tipo: "Cadastro definitivo",
    controlaEstoque: true,
    status: "ativo",
  },
  {
    codigo: "BEN002",
    nome: "Cesta Extra",
    tipo: "Cadastro em avaliação",
    controlaEstoque: true,
    status: "ativo",
  },
  {
    codigo: "BEN003",
    nome: "Kit Gestante",
    tipo: "Benefício específico",
    controlaEstoque: true,
    status: "ativo",
  },
  {
    codigo: "BEN004",
    nome: "Comida de Rua",
    tipo: "Ação social",
    controlaEstoque: true,
    status: "ativo",
  },
];

type CrudMethods<T extends { codigo: string }> = {
  upsert: (r: T) => void;
  remove: (codigo: string) => void;
  setStatus: (codigo: string, status: Status) => void;
};

function makeStore<T extends { codigo: string }>(name: string, seed: T[]) {
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
export const useBeneficios = makeStore<Beneficio>("seac.beneficios.v1", SEED_BENEFICIOS);
