import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSupabaseClient } from "@/lib/supabase/client";

export interface Configuracoes {
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
}

/** Defaults oficiais; usados como fallback quando o Supabase não responde. */
export const CONFIGURACOES_PADRAO: Configuracoes = {
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

export const configuracoesQueryKeys = {
  atual: ["configuracoes", "atual"] as const,
};

type ConfiguracoesRow = {
  intervalo_minimo_dias: number;
  alerta_liberado_sem_retirada_dias: number;
  limite_extra: number;
  apos_limite_extra: string;
  inatividade_contato_dias: number;
  liberacao_excepcional: "admin" | "admin_atendente";
  bloqueio_sem_estoque: boolean;
  observacao_obrigatoria_liberacao: boolean;
  auditoria_ativa: boolean;
  baixa_automatica: boolean;
};

function mapRow(row: ConfiguracoesRow): Configuracoes {
  return {
    intervaloMinimoDias: row.intervalo_minimo_dias,
    alertaLiberadoSemRetiradaDias: row.alerta_liberado_sem_retirada_dias,
    limiteExtra: row.limite_extra,
    aposLimiteExtra: row.apos_limite_extra,
    inatividadeContatoDias: row.inatividade_contato_dias,
    liberacaoExcepcional: row.liberacao_excepcional,
    bloqueioSemEstoque: row.bloqueio_sem_estoque,
    observacaoObrigatoriaLiberacao: row.observacao_obrigatoria_liberacao,
    auditoriaAtiva: row.auditoria_ativa,
    baixaAutomatica: row.baixa_automatica,
  };
}

/** Lê a configuração (linha única id=1). Retorna os defaults em caso de erro. */
export async function getConfiguracoes(): Promise<Configuracoes> {
  const { data, error } = await getSupabaseClient()
    .from("configuracoes")
    .select(
      "intervalo_minimo_dias, alerta_liberado_sem_retirada_dias, limite_extra, apos_limite_extra, inatividade_contato_dias, liberacao_excepcional, bloqueio_sem_estoque, observacao_obrigatoria_liberacao, auditoria_ativa, baixa_automatica",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return CONFIGURACOES_PADRAO;
  return mapRow(data as ConfiguracoesRow);
}

export async function atualizarConfiguracoes(input: Configuracoes): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("configuracoes")
    .update({
      intervalo_minimo_dias: input.intervaloMinimoDias,
      alerta_liberado_sem_retirada_dias: input.alertaLiberadoSemRetiradaDias,
      limite_extra: input.limiteExtra,
      apos_limite_extra: input.aposLimiteExtra,
      inatividade_contato_dias: input.inatividadeContatoDias,
      liberacao_excepcional: input.liberacaoExcepcional,
      bloqueio_sem_estoque: input.bloqueioSemEstoque,
      observacao_obrigatoria_liberacao: input.observacaoObrigatoriaLiberacao,
      auditoria_ativa: input.auditoriaAtiva,
      baixa_automatica: input.baixaAutomatica,
    })
    .eq("id", 1);

  if (error) throw new Error(error.message);
}

export function useConfiguracoes() {
  return useQuery({
    queryKey: configuracoesQueryKeys.atual,
    queryFn: getConfiguracoes,
  });
}

export function useAtualizarConfiguracoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: atualizarConfiguracoes,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: configuracoesQueryKeys.atual });
    },
  });
}
