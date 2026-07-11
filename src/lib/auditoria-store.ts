import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuditoriaEvento = {
  id: string;
  datahora: string; // ISO
  usuario: string;
  acao: string;
  modulo: string;
  registro: string;
  observacao?: string;
};

type AuditoriaState = {
  eventos: AuditoriaEvento[];
  registrar: (e: Omit<AuditoriaEvento, "id" | "datahora"> & { datahora?: string }) => void;
  limpar: () => void;
};

export const useAuditoria = create<AuditoriaState>()(
  persist(
    (set) => ({
      eventos: [],
      registrar: (e) =>
        set((s) => {
          const datahora = e.datahora ?? new Date().toISOString();
          const ultimo = s.eventos[0];
          if (
            ultimo &&
            ultimo.usuario === e.usuario &&
            ultimo.acao === e.acao &&
            ultimo.modulo === e.modulo &&
            ultimo.registro === e.registro &&
            (ultimo.observacao ?? "") === (e.observacao ?? "") &&
            Math.abs(
              new Date(datahora).getTime() - new Date(ultimo.datahora).getTime(),
            ) < 3000
          ) {
            return s;
          }
          return {
            eventos: [
              {
                id: crypto.randomUUID(),
                datahora,
                usuario: e.usuario,
                acao: e.acao,
                modulo: e.modulo,
                registro: e.registro,
                observacao: e.observacao,
              },
              ...s.eventos,
            ].slice(0, 500),
          };
        }),
      limpar: () => set({ eventos: [] }),
    }),
    { name: "seac.auditoria.v1" },
  ),
);

export function registrarAuditoria(e: Omit<AuditoriaEvento, "id" | "datahora">) {
  useAuditoria.getState().registrar(e);
}