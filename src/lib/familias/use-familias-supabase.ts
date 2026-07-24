import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  atualizarFamiliaNoSupabase,
  atualizarResponsavelFamiliaNoSupabase,
  buscarAssistidosAtivosNoSupabase,
  criarRecebimentoNoSupabase,
  definirComposicaoBeneficioNoSupabase,
  listarBeneficiosNoSupabase,
  listarComposicoesNoSupabase,
  listarEntregasRecentesNoSupabase,
  listarItensEstoqueNoSupabase,
  listarMovimentacoesEstoqueNoSupabase,
  listarRecebimentosNoSupabase,
  montarCestaNoSupabase,
  registrarMovimentacaoEstoqueNoSupabase,
  registrarMovimentacaoItemNoSupabase,
  type CriarRecebimentoInput,
  type DefinirComposicaoInput,
  type MontarCestaInput,
  type RegistrarMovimentacaoInput,
  type RegistrarMovimentacaoItemInput,
  criarAssistidoEmFamiliaNoSupabase,
  criarFamiliaComResponsavelNoSupabase,
  criarMembroEmFamiliaNoSupabase,
  criarObservacaoSocialNoSupabase,
  getFamiliaFromSupabaseById,
  getResumoAtendimentoAssistido,
  listFamiliasFromSupabase,
  registrarEntregaAtendimentoNoSupabase,
  registrarTentativaBloqueadaNoSupabase,
  type AtualizarFamiliaInput,
  type AtualizarResponsavelInput,
  type CriarAssistidoInput,
  type CriarFamiliaInput,
  type CriarMembroInput,
  type CriarObservacaoInput,
  type RegistrarEntregaInput,
  type RegistrarTentativaInput,
} from "@/lib/familias/familias-repository";
import {
  FamiliasSupabaseQueryError,
  FamiliasSupabaseWriteQueryError,
} from "@/lib/familias/familias-supabase-types";

export const familiasSupabaseQueryKeys = {
  all: ["familias", "supabase"] as const,
  detail: (id: string) => ["familias", "supabase", id] as const,
  resumoAtendimento: (assistidoId: string) =>
    ["familias", "supabase", "resumo-atendimento", assistidoId] as const,
  buscaAssistidos: (termo: string) => ["familias", "supabase", "busca-assistidos", termo] as const,
  beneficiosEstoque: ["familias", "supabase", "beneficios-estoque"] as const,
  movimentacoesEstoque: ["familias", "supabase", "movimentacoes-estoque"] as const,
  entregasPainel: ["familias", "supabase", "entregas-painel"] as const,
  recebimentos: ["familias", "supabase", "recebimentos"] as const,
  itensEstoque: ["familias", "supabase", "itens-estoque"] as const,
  composicoes: ["familias", "supabase", "composicoes"] as const,
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

export function useCriarObservacaoSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarObservacaoInput) => {
      const result = await criarObservacaoSocialNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.detail(variables.familiaId),
      });
    },
  });
}

export function useAtualizarResponsavelSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AtualizarResponsavelInput) => {
      const result = await atualizarResponsavelFamiliaNoSupabase(input);
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

export function useBuscarAssistidosAtendimento(termo: string) {
  const termoNormalizado = termo.trim();

  return useQuery({
    queryKey: familiasSupabaseQueryKeys.buscaAssistidos(termoNormalizado),
    queryFn: async () => {
      const result = await buscarAssistidosAtivosNoSupabase(termoNormalizado);
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
    enabled: termoNormalizado.length >= 3,
  });
}

export function useResumoAtendimento(assistidoId: string) {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.resumoAtendimento(assistidoId),
    queryFn: async () => {
      const result = await getResumoAtendimentoAssistido(assistidoId);
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
    enabled: assistidoId.length > 0,
  });
}

// Entrega/tentativa invalidam o detalhe da família (agregado) e o resumo do
// assistido, que alimenta o cenário de elegibilidade exibido.
function invalidarAtendimento(
  queryClient: ReturnType<typeof useQueryClient>,
  familiaId: string,
  assistidoId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: familiasSupabaseQueryKeys.detail(familiaId),
  });
  void queryClient.invalidateQueries({
    queryKey: familiasSupabaseQueryKeys.resumoAtendimento(assistidoId),
  });
}

export function useRegistrarEntregaSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegistrarEntregaInput) => {
      const result = await registrarEntregaAtendimentoNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      invalidarAtendimento(queryClient, variables.familiaId, variables.assistidoId);
    },
  });
}

export function useRegistrarTentativaSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegistrarTentativaInput) => {
      const result = await registrarTentativaBloqueadaNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      invalidarAtendimento(queryClient, variables.familiaId, variables.assistidoId);
    },
  });
}

export function useBeneficiosEstoque() {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.beneficiosEstoque,
    queryFn: async () => {
      const result = await listarBeneficiosNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useMovimentacoesEstoque() {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.movimentacoesEstoque,
    queryFn: async () => {
      const result = await listarMovimentacoesEstoqueNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useEntregasPainel() {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.entregasPainel,
    queryFn: async () => {
      const result = await listarEntregasRecentesNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useRecebimentos() {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.recebimentos,
    queryFn: async () => {
      const result = await listarRecebimentosNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useCriarRecebimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarRecebimentoInput) => {
      const result = await criarRecebimentoNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.recebimentos });
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
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.beneficiosEstoque });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.movimentacoesEstoque,
      });
    },
  });
}

export function useItensEstoque() {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.itensEstoque,
    queryFn: async () => {
      const result = await listarItensEstoqueNoSupabase();
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
  });
}

export function useComposicoes() {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.composicoes,
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
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.itensEstoque });
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
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.composicoes });
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
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.itensEstoque });
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.beneficiosEstoque });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.movimentacoesEstoque,
      });
    },
  });
}
