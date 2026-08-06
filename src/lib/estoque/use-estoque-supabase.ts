import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  definirComposicaoBeneficioNoSupabase,
  listarBeneficiosNoSupabase,
  listarComposicoesNoSupabase,
  listarItensEstoqueNoSupabase,
  listarMovimentacoesEstoqueNoSupabase,
  listarMovimentacoesItensNoSupabase,
  montarCestaNoSupabase,
  registrarMovimentacaoEstoqueNoSupabase,
  registrarMovimentacaoItemNoSupabase,
  type DefinirComposicaoInput,
  type MontarCestaInput,
  type RegistrarMovimentacaoInput,
  type RegistrarMovimentacaoItemInput,
} from "@/lib/estoque/estoque-repository";
import {
  FamiliasSupabaseQueryError,
  FamiliasSupabaseWriteQueryError,
} from "@/lib/familias/familias-supabase-types";

export const estoqueQueryKeys = {
  beneficios: ["estoque", "beneficios"] as const,
  movimentacoes: ["estoque", "movimentacoes"] as const,
  itens: ["estoque", "itens"] as const,
  movimentacoesItens: ["estoque", "movimentacoes-itens"] as const,
  composicoes: ["estoque", "composicoes"] as const,
};

export function useBeneficiosEstoque() {
  return useQuery({
    queryKey: estoqueQueryKeys.beneficios,
    queryFn: async () => {
      const result = await listarBeneficiosNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useMovimentacoesEstoque() {
  return useQuery({
    queryKey: estoqueQueryKeys.movimentacoes,
    queryFn: async () => {
      const result = await listarMovimentacoesEstoqueNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useRegistrarMovimentacaoEstoque() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegistrarMovimentacaoInput) => {
      const result = await registrarMovimentacaoEstoqueNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.beneficios });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.movimentacoes });
    },
  });
}

export function useItensEstoque() {
  return useQuery({
    queryKey: estoqueQueryKeys.itens,
    queryFn: async () => {
      const result = await listarItensEstoqueNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useMovimentacoesItens() {
  return useQuery({
    queryKey: estoqueQueryKeys.movimentacoesItens,
    queryFn: async () => {
      const result = await listarMovimentacoesItensNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useComposicoes() {
  return useQuery({
    queryKey: estoqueQueryKeys.composicoes,
    queryFn: async () => {
      const result = await listarComposicoesNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useRegistrarMovimentacaoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegistrarMovimentacaoItemInput) => {
      const result = await registrarMovimentacaoItemNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.itens });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.movimentacoesItens });
    },
  });
}

export function useDefinirComposicaoBeneficio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DefinirComposicaoInput) => {
      const result = await definirComposicaoBeneficioNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.composicoes });
    },
  });
}

export function useMontarCesta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MontarCestaInput) => {
      const result = await montarCestaNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: () => {
      // A montagem mexe em itens, saldo do benefício e nos dois ledgers.
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.itens });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.beneficios });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.movimentacoes });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.movimentacoesItens });
    },
  });
}
