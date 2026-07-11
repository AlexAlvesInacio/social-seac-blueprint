import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BeneficioNome = "Cesta Padrão" | "Cesta Extra" | "Kit Gestante";

export type Entrega = {
  id: string;
  assistidoId?: string;
  familiaId?: number;
  documento: string;
  nome: string;
  familia: string;
  beneficio: BeneficioNome;
  dataISO: string;
  usuario: string;
  observacao?: string;
  excepcional?: boolean;
  origem: "atendimento" | "pre_cadastro";
};

export type TentativaBloqueada = {
  id: string;
  documento: string;
  nome: string;
  familia: string;
  motivo: "prazo" | "estoque";
  observacao?: string;
  dataISO: string;
  usuario: string;
};

type State = {
  entregas: Entrega[];
  bloqueios: TentativaBloqueada[];
  saldo: Record<string, number>;
  registrarEntrega: (
    e: Omit<Entrega, "id" | "dataISO"> & { dataISO?: string },
  ) => Entrega;
  registrarBloqueio: (
    b: Omit<TentativaBloqueada, "id" | "dataISO"> & { dataISO?: string },
  ) => TentativaBloqueada;
  getSaldo: (beneficio: string) => number;
  ajustar: (beneficio: string, delta: number) => void;
  ultimaEntrega: (documento: string) => Entrega | undefined;
  entregasAssistido: (documento: string) => Entrega[];
  contarExtras: (documento: string) => number;
};

const SEED_SALDO: Record<string, number> = {
  "Cesta Padrão": 120,
  "Cesta Extra": 25,
  "Kit Gestante": 8,
};

function normDoc(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export const useAtendimentoStore = create<State>()(
  persist(
    (set, get) => ({
      entregas: [],
      bloqueios: [],
      saldo: SEED_SALDO,
      registrarEntrega: (e) => {
        const nova: Entrega = {
          ...e,
          id: crypto.randomUUID(),
          dataISO: e.dataISO ?? new Date().toISOString(),
        };
        set((s) => ({
          entregas: [nova, ...s.entregas],
          saldo: {
            ...s.saldo,
            [e.beneficio]: Math.max(0, (s.saldo[e.beneficio] ?? 0) - 1),
          },
        }));
        return nova;
      },
      registrarBloqueio: (b) => {
        const dataISO = b.dataISO ?? new Date().toISOString();
        const ultimo = get().bloqueios[0];
        if (
          ultimo &&
          normDoc(ultimo.documento) === normDoc(b.documento) &&
          ultimo.motivo === b.motivo &&
          Math.abs(
            new Date(dataISO).getTime() - new Date(ultimo.dataISO).getTime(),
          ) < 3000
        ) {
          return ultimo;
        }
        const novo: TentativaBloqueada = {
          ...b,
          id: crypto.randomUUID(),
          dataISO,
        };
        set((s) => ({ bloqueios: [novo, ...s.bloqueios].slice(0, 500) }));
        return novo;
      },
      getSaldo: (b) => get().saldo[b] ?? 0,
      ajustar: (b, d) =>
        set((s) => ({
          saldo: { ...s.saldo, [b]: Math.max(0, (s.saldo[b] ?? 0) + d) },
        })),
      ultimaEntrega: (doc) => {
        const n = normDoc(doc);
        return get().entregas.find((e) => normDoc(e.documento) === n);
      },
      entregasAssistido: (doc) => {
        const n = normDoc(doc);
        return get().entregas.filter((e) => normDoc(e.documento) === n);
      },
      contarExtras: (doc) => {
        const n = normDoc(doc);
        return get().entregas.filter(
          (e) => normDoc(e.documento) === n && e.beneficio === "Cesta Extra",
        ).length;
      },
    }),
    { name: "seac.atendimento.v1" },
  ),
);