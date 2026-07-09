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
        set((s) => ({
          eventos: [
            {
              id: crypto.randomUUID(),
              datahora: e.datahora ?? new Date().toISOString(),
              usuario: e.usuario,
              acao: e.acao,
              modulo: e.modulo,
              registro: e.registro,
              observacao: e.observacao,
            },
            ...s.eventos,
          ].slice(0, 500),
        })),
      limpar: () => set({ eventos: [] }),
    }),
    { name: "seac.auditoria.v1" },
  ),
);

export function registrarAuditoria(e: Omit<AuditoriaEvento, "id" | "datahora">) {
  useAuditoria.getState().registrar(e);
}