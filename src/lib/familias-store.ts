import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FaixaEtaria = "crianca" | "adolescente" | "adulto" | "idoso";

/** Idade em anos completos a partir de uma data ISO (YYYY-MM-DD). */
export function calcularIdade(nascimento?: string): number | null {
  if (!nascimento) return null;
  const d = new Date(nascimento);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  if (d.getTime() > hoje.getTime()) return null;
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}

/**
 * Regras oficiais SEAC Social:
 * - Criança: 0 a 12 anos
 * - Adolescente: 13 a 17 anos
 * - Adulto: 18 a 59 anos
 * - Idoso: 60 anos ou mais
 */
export function calcularFaixaEtaria(nascimento?: string): FaixaEtaria | null {
  const idade = calcularIdade(nascimento);
  if (idade === null) return null;
  if (idade <= 12) return "crianca";
  if (idade <= 17) return "adolescente";
  if (idade < 60) return "adulto";
  return "idoso";
}

export function rotuloFaixaEtaria(faixa: FaixaEtaria | null): string {
  switch (faixa) {
    case "crianca": return "Criança";
    case "adolescente": return "Adolescente";
    case "adulto": return "Adulto";
    case "idoso": return "Idoso";
    default: return "—";
  }
}

export type FamiliaStatus = "liberado" | "bloqueado" | "inativo" | "avaliar";
export type TipoCadastro = "definitivo" | "extra";
export type Acompanhamento = "em_dia" | "atencao_45" | "atencao_60" | "sem_retirada_90" | "inativo";

export type Assistido = {
  id: string;
  familiaId: number;
  nome: string;
  documento: string;
  telefone?: string;
  nascimento?: string;
  tipoCadastro: TipoCadastro;
  beneficio: string;
  status: "ativo" | "inativo" | "bloqueado";
  pcd: boolean;
  observacoes?: string;
  origemMembroId?: string;
};

export type Membro = {
  id: string;
  familiaId: number;
  nome: string;
  parentesco: string;
  documento?: string;
  telefone?: string;
  nascimento?: string;
  crianca: boolean;
  adolescente: boolean;
  idoso: boolean;
  gestante: boolean;
  pcd: boolean;
  observacoes?: string;
  assistidoId?: string;
};

export type Observacao = {
  id: string;
  familiaId: number;
  tipo: "Social" | "Atendimento" | "Documento" | "Endereço" | "Saúde/PCD" | "Outro";
  texto: string;
  data: string;
  usuario: string;
};

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
  assistidos: Assistido[];
  membros: Membro[];
  observacoes: Observacao[];
  add: (f: Omit<Familia, "id">) => Familia;
  update: (id: number, patch: Partial<Omit<Familia, "id">>) => void;
  existsDocumento: (doc: string) => boolean;
  existsAssistidoDoc: (doc: string) => boolean;
  addAssistido: (a: Omit<Assistido, "id">) => Assistido;
  addMembro: (m: Omit<Membro, "id">) => Membro;
  addObservacao: (o: Omit<Observacao, "id" | "data" | "usuario"> & { usuario?: string }) => Observacao;
};

export const useFamilias = create<State>()(
  persist(
    (set, get) => ({
      familias: SEED,
      assistidos: [],
      membros: [],
      observacoes: [],
      add: (f) => {
        const id = Math.max(0, ...get().familias.map((x) => x.id)) + 1;
        const nova: Familia = { ...f, id };
        set((s) => ({ familias: [nova, ...s.familias] }));
        return nova;
      },
      update: (id, patch) =>
        set((s) => ({
          familias: s.familias.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),
      existsDocumento: (doc) => {
        const norm = doc.replace(/\D/g, "");
        if (!norm) return false;
        return get().familias.some((x) => x.documento.replace(/\D/g, "") === norm);
      },
      existsAssistidoDoc: (doc) => {
        const norm = doc.replace(/\D/g, "");
        if (!norm) return false;
        return get().assistidos.some((x) => x.documento.replace(/\D/g, "") === norm);
      },
      addAssistido: (a) => {
        const novo: Assistido = { ...a, id: crypto.randomUUID() };
        set((s) => ({ assistidos: [novo, ...s.assistidos] }));
        return novo;
      },
      addMembro: (m) => {
        const faixa = calcularFaixaEtaria(m.nascimento);
        const novo: Membro = {
          ...m,
          id: crypto.randomUUID(),
          crianca: faixa === "crianca",
          adolescente: faixa === "adolescente",
          idoso: faixa === "idoso",
        };
        set((s) => ({ membros: [novo, ...s.membros] }));
        return novo;
      },
      addObservacao: (o) => {
        const novo: Observacao = {
          ...o,
          id: crypto.randomUUID(),
          data: new Date().toISOString(),
          usuario: o.usuario ?? "operador",
        };
        set((s) => ({ observacoes: [novo, ...s.observacoes] }));
        return novo;
      },
    }),
    { name: "seac.familias.v1" },
  ),
);