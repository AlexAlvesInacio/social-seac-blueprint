import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  atualizarFamiliaNoSupabase,
  atualizarResponsavelFamiliaNoSupabase,
  buscarAssistidosAtivosNoSupabase,
  buscarPessoaPorDocumentoNoSupabase,
  criarRecebimentoNoSupabase,
  listarEntregasFamiliaNoSupabase,
  listarEntregasRecentesNoSupabase,
  listarRecebimentosNoSupabase,
  listarTentativasFamiliaNoSupabase,
  type CriarRecebimentoInput,
  aprovarAssistidoDefinitivoNoSupabase,
  inativarAssistidoNoSupabase,
  reativarAssistidoNoSupabase,
  atualizarMembroFamiliarNoSupabase,
  criarAssistidoEmFamiliaNoSupabase,
  criarFamiliaComResponsavelNoSupabase,
  criarMembroEmFamiliaNoSupabase,
  transferirPessoaEntreFamiliasNoSupabase,
  criarObservacaoSocialNoSupabase,
  criarPreCadastroNoSupabase,
  getFamiliaFromSupabaseById,
  getResumoAtendimentoAssistido,
  listFamiliasFromSupabase,
  registrarEntregaAtendimentoNoSupabase,
  registrarTentativaBloqueadaNoSupabase,
  type AtualizarFamiliaInput,
  type AtualizarMembroInput,
  type AtualizarResponsavelInput,
  type CriarAssistidoInput,
  type CriarFamiliaInput,
  type CriarMembroInput,
  type TransferirPessoaInput,
  type CriarObservacaoInput,
  type CriarPreCadastroInput,
  type RegistrarEntregaInput,
  type RegistrarTentativaInput,
} from "@/lib/familias/familias-repository";
import { estoqueQueryKeys } from "@/lib/estoque/use-estoque-supabase";
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
  entregasPainel: ["familias", "supabase", "entregas-painel"] as const,
  entregasFamilia: (familiaId: string) =>
    ["familias", "supabase", "entregas-familia", familiaId] as const,
  tentativasFamilia: (familiaId: string) =>
    ["familias", "supabase", "tentativas-familia", familiaId] as const,
  recebimentos: ["familias", "supabase", "recebimentos"] as const,
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

export function useAprovarAssistidoDefinitivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { assistidoId: string; familiaId: string }) => {
      const result = await aprovarAssistidoDefinitivoNoSupabase(variables.assistidoId);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.detail(variables.familiaId),
      });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.resumoAtendimento(variables.assistidoId),
      });
    },
  });
}

export function useInativarAssistido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { assistidoId: string; familiaId: string }) => {
      const result = await inativarAssistidoNoSupabase(variables.assistidoId);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.detail(variables.familiaId),
      });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.resumoAtendimento(variables.assistidoId),
      });
    },
  });
}

export function useReativarAssistido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { assistidoId: string; familiaId: string }) => {
      const result = await reativarAssistidoNoSupabase(variables.assistidoId);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.detail(variables.familiaId),
      });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.resumoAtendimento(variables.assistidoId),
      });
    },
  });
}

export function useAtualizarMembro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AtualizarMembroInput) => {
      const result = await atualizarMembroFamiliarNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      if (data?.familia_id) {
        void queryClient.invalidateQueries({
          queryKey: familiasSupabaseQueryKeys.detail(data.familia_id),
        });
      }
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

/**
 * Transfere a pessoa para a família de destino. Invalida o detalhe das DUAS
 * famílias: a de origem perde o vínculo (e possivelmente o assistido) e
 * continuaria exibindo dados velhos se só o destino fosse atualizado.
 */
export function useTransferirPessoa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TransferirPessoaInput) => {
      const result = await transferirPessoaEntreFamiliasNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.detail(variables.familiaDestinoId),
      });
      if (data) {
        void queryClient.invalidateQueries({
          queryKey: familiasSupabaseQueryKeys.detail(data.familia_origem_id),
        });
      }
      // A busca por documento alimenta o banner: sem invalidar, ele continuaria
      // dizendo que a pessoa está ativa na família antiga.
      void queryClient.invalidateQueries({
        queryKey: ["familias", "supabase", "pessoa-documento"],
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

export function usePessoaPorDocumento(documento: string) {
  const doc = documento.trim();
  const norm = doc.replace(/[^0-9a-z]/gi, "");
  return useQuery({
    queryKey: ["familias", "supabase", "pessoa-documento", norm] as const,
    queryFn: () => buscarPessoaPorDocumentoNoSupabase(doc),
    enabled: norm.length >= 3,
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
  void queryClient.invalidateQueries({
    queryKey: familiasSupabaseQueryKeys.entregasFamilia(familiaId),
  });
  void queryClient.invalidateQueries({
    queryKey: familiasSupabaseQueryKeys.tentativasFamilia(familiaId),
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
      // A entrega baixa o saldo e grava a baixa automática no ledger de estoque.
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.beneficios });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.movimentacoes });
    },
  });
}

export function useCriarPreCadastro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarPreCadastroInput) => {
      const result = await criarPreCadastroNoSupabase(input);
      if (result.error) throw new FamiliasSupabaseWriteQueryError(result.error);
      return result.data;
    },
    onSuccess: () => {
      // Cria família + assistido (e, na variante, entrega + baixa). Invalida amplo:
      // busca de atendimento, listas de família e estoque.
      void queryClient.invalidateQueries({ queryKey: familiasSupabaseQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.beneficios });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.movimentacoes });
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

export function useEntregasFamilia(familiaId: string) {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.entregasFamilia(familiaId),
    queryFn: async () => {
      const result = await listarEntregasFamiliaNoSupabase(familiaId);
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
    enabled: familiaId.length > 0,
  });
}

export function useTentativasFamilia(familiaId: string) {
  return useQuery({
    queryKey: familiasSupabaseQueryKeys.tentativasFamilia(familiaId),
    queryFn: async () => {
      const result = await listarTentativasFamiliaNoSupabase(familiaId);
      if (result.error) throw new FamiliasSupabaseQueryError(result.error);
      return result.data;
    },
    enabled: familiaId.length > 0,
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
      // Itens vinculados ao catálogo geram entrada no estoque.
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.itens });
      void queryClient.invalidateQueries({ queryKey: estoqueQueryKeys.movimentacoesItens });
    },
  });
}
