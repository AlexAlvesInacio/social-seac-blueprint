import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient, supabase } from "@/lib/supabase/client";
import { limitesDoPeriodo } from "@/lib/auditoria/periodo";

/** Entrada emitida pela aplicação. `usuario` é aceito por compatibilidade com o
 * helper legado, mas é ignorado — o autor real vem de `criado_por` (auth.uid()). */
export interface AuditoriaEventoInput {
  acao: string;
  modulo: string;
  registro?: string;
  observacao?: string;
  usuario?: string;
  contexto?: Record<string, unknown>;
}

export interface AuditoriaEventoReadModel {
  id: string;
  criadoEm: string;
  autor: string;
  acao: string;
  modulo: string;
  registro: string;
  observacao?: string;
}

export interface PeriodoAuditoria {
  /** Data local YYYY-MM-DD; vazio não restringe. */
  de: string;
  ate: string;
}

/**
 * Resultado da consulta. `atingiuLimite` existe para que a tela possa avisar que
 * há mais eventos no período do que ela mostrou — antes o excedente sumia calado.
 */
export interface EventosAuditoriaPagina {
  eventos: AuditoriaEventoReadModel[];
  atingiuLimite: boolean;
}

export const auditoriaQueryKeys = {
  eventos: ["auditoria", "eventos"] as const,
  periodo: (de: string, ate: string) => ["auditoria", "eventos", de, ate] as const,
};

/**
 * Registra um evento de auditoria no Supabase (best-effort, fire-and-forget). A
 * trilha é imutável no banco; aqui só inserimos. Falhas não interrompem a ação do
 * usuário — apenas não geram o registro. No-op quando o Supabase não está
 * configurado (ex.: build sem env).
 */
export function registrarAuditoria(input: AuditoriaEventoInput): void {
  if (!supabase) return;
  void supabase
    .from("auditoria_eventos")
    .insert({
      acao: input.acao,
      modulo: input.modulo,
      registro: input.registro ?? null,
      observacao: input.observacao ?? null,
      contexto: input.contexto ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn("Falha ao registrar auditoria:", error.message);
    });
}

type AuditoriaRow = {
  id: string;
  criado_em: string;
  criado_por: string;
  acao: string;
  modulo: string;
  registro: string | null;
  observacao: string | null;
};

const LIMITE_EVENTOS = 500;

async function listarEventosAuditoria(periodo: PeriodoAuditoria): Promise<EventosAuditoriaPagina> {
  const client = getSupabaseClient();
  const { desde, antesDe } = limitesDoPeriodo(periodo.de, periodo.ate);

  // O recorte vai para o servidor: sem ele a consulta é sempre "os 500 últimos de
  // todos os tempos", e o que passa disso não aparece nem avisa.
  let query = client
    .from("auditoria_eventos")
    .select("id, criado_em, criado_por, acao, modulo, registro, observacao")
    .order("criado_em", { ascending: false })
    .limit(LIMITE_EVENTOS);

  if (desde) query = query.gte("criado_em", desde);
  if (antesDe) query = query.lt("criado_em", antesDe);

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AuditoriaRow[];
  const atingiuLimite = rows.length >= LIMITE_EVENTOS;
  if (rows.length === 0) return { eventos: [], atingiuLimite: false };

  // Resolve o nome do autor (best-effort; RLS pode restringir a leitura de perfis).
  const autorIds = [...new Set(rows.map((r) => r.criado_por))];
  const nomePorId = new Map<string, string>();
  const perfis = await client.from("profiles").select("id, nome_completo").in("id", autorIds);
  if (!perfis.error) {
    for (const p of (perfis.data ?? []) as { id: string; nome_completo: string }[]) {
      nomePorId.set(p.id, p.nome_completo);
    }
  }

  return {
    eventos: rows.map((r) => ({
      id: r.id,
      criadoEm: r.criado_em,
      autor: nomePorId.get(r.criado_por) ?? "—",
      acao: r.acao,
      modulo: r.modulo,
      registro: r.registro ?? "—",
      observacao: r.observacao ?? undefined,
    })),
    atingiuLimite,
  };
}

export function useEventosAuditoria(periodo: PeriodoAuditoria) {
  return useQuery({
    queryKey: auditoriaQueryKeys.periodo(periodo.de, periodo.ate),
    queryFn: () => listarEventosAuditoria(periodo),
  });
}
