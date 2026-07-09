import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FamiliaStatus = "liberado" | "bloqueado" | "inativo" | "avaliar";
export type TipoCadastro = "definitivo" | "extra";
export type Acompanhamento = "em_dia" | "atencao_45" | "atencao_60" | "sem_retirada_90" | "inativo";

export type Familia = {
  id: number;
  nome: string;
  responsavel: string;
  documento: string;
  telefone: string;
  bairro: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  tipoCadastro: TipoCadastro;
  progressoExtra: string | null;
  ultimaRetirada: string;
  proximaData: string;
  acompanhamento: Acompanhamento;
  status: FamiliaStatus;
  moradores?: number;
  criancas?: number;
  idosos?: number;
  gestantes?: number;
  pcd?: number;
  observacoes?: string;
};

const SEED: Familia[] = [
  { id: 15, nome: "Família da Silva", responsavel: "João da Silva", documento: "987.654.321-00", telefone: "(11) 97654-3210", bairro: "São João", tipoCadastro: "definitivo", progressoExtra: null, ultimaRetirada: "16/05/2025", proximaData: "10/06/2025 (Faltam 18 dias)", acompanhamento: "em_dia", status: "liberado" },
  { id: 23, nome: "Família Santos", responsavel: "Maria Santos", documento: "321.654.987-00", telefone: "(11) 91234-5678", bairro: "Vila Nova", tipoCadastro: "extra", progressoExtra: "2/3", ultimaRetirada: "20/05/2025", proximaData: "13/06/2025 (Faltam 21 dias)", acompanhamento: "em_dia", status: "liberado" },
  { id: 31, nome: "Família Oliveira", responsavel: "Carlos Oliveira", documento: "123.987.654-00", telefone: "(11) 99876-5432", bairro: "Jardim Esperança", tipoCadastro: "extra", progressoExtra: "3/3", ultimaRetirada: "18/05/2025", proximaData: "11/06/2025 (Faltam 19 dias)", acompanhamento: "em_dia", status: "avaliar" },
  { id: 42, nome: "Família Souza", responsavel: "Ana Souza", documento: "456.123.789-00", telefone: "(11) 95555-1212", bairro: "Cidade Alta", tipoCadastro: "definitivo", progressoExtra: null, ultimaRetirada: "05/05/2025", proximaData: "30/05/2025 (Atrasado)", acompanhamento: "atencao_60", status: "bloqueado" },
  { id: 57, nome: "Família Lima", responsavel: "Pedro Lima", documento: "789.321.456-00", telefone: "(11) 93333-4444", bairro: "São José", tipoCadastro: "extra", progressoExtra: "1/3", ultimaRetirada: "10/02/2025", proximaData: "04/06/2025 (Faltam 12 dias)", acompanhamento: "sem_retirada_90", status: "liberado" },
  { id: 68, nome: "Família Martins", responsavel: "Luciana Martins", documento: "654.987.321-00", telefone: "(11) 94444-5555", bairro: "Vila Esperança", tipoCadastro: "extra", progressoExtra: "novo", ultimaRetirada: "—", proximaData: "—", acompanhamento: "inativo", status: "inativo" },
];

type State = {
  familias: Familia[];
  add: (f: Omit<Familia, "id">) => Familia;
  existsDocumento: (doc: string) => boolean;
};

export const useFamilias = create<State>()(
  persist(
    (set, get) => ({
      familias: SEED,
      add: (f) => {
        const id = Math.max(0, ...get().familias.map((x) => x.id)) + 1;
        const nova: Familia = { ...f, id };
        set((s) => ({ familias: [nova, ...s.familias] }));
        return nova;
      },
      existsDocumento: (doc) => {
        const norm = doc.replace(/\D/g, "");
        if (!norm) return false;
        return get().familias.some((x) => x.documento.replace(/\D/g, "") === norm);
      },
    }),
    { name: "seac.familias.v1" },
  ),
);