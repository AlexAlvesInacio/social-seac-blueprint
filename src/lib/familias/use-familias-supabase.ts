import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  atualizarFamiliaNoSupabase,
  criarAssistidoEmFamiliaNoSupabase,
  criarFamiliaComResponsavelNoSupabase,
  criarMembroEmFamiliaNoSupabase,
  getFamiliaFromSupabaseById,
  listFamiliasFromSupabase,
  type AtualizarFamiliaInput,
  type CriarAssistidoInput,
  type CriarFamiliaInput,
  type CriarMembroInput,
} from "@/lib/familias/familias-repository";
import {
  FamiliasSupabaseQueryError,
  FamiliasSupabaseWriteQueryError,
} from "@/lib/familias/familias-supabase-types";

export const familiasSupabaseQueryKeys = {
  all: ["familias", "supabase"] as const,
  detail: (id: string) => ["familias", "supabase", id] as const,
};

export function useFamiliasSupabase() {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.all,
    queryFn: async () => {
      const result = await listFamiliasFromSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useFamiliaSupabase(id: string) {
  const normalizedId = id.trim();

  return useQuery({
    queryKey: familiasSupabaseQueryKeys.detail(normalizedId),
    queryFn: async () => {
      const result = await getFamiliaFromSupabaseById(normalizedId);
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
    enabled: normalizedId.length > 0,
  });
}

/**
 * Estratégia de invalidação (ver ressalva em familias-repository.ts): após a
 * escrita transacional, invalidamos a raiz da listagem para que a lista releia
 * do Supabase. Não há atualização otimista porque o agregado depende de várias
 * consultas relacionadas.
 */
export function useCriarFamiliaSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarFamiliaInput) => {
      const result = await criarFamiliaComResponsavelNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
    },
  });
}

export function useCriarAssistidoSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarAssistidoInput) => {
      const result = await criarAssistidoEmFamiliaNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.detail(variables.familiaId),
      });
    },
  });
}

export function useCriarMembroSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarMembroInput) => {
      const result = await criarMembroEmFamiliaNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.detail(variables.familiaId),
      });
    },
  });
}

export function useAtualizarFamiliaSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AtualizarFamiliaInput) => {
      const result = await atualizarFamiliaNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.detail(variables.familiaId),
      });
    },
  });
}
