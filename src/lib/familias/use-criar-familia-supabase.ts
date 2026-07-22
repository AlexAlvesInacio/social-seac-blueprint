import { useMutation, useQueryClient } from "@tanstack/react-query";

import { criarFamiliaComResponsavelNoSupabase } from "@/lib/familias/familias-write-repository";
import { familiasSupabaseQueryKeys } from "@/lib/familias/use-familias-supabase";

export function useCriarFamiliaSupabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: criarFamiliaComResponsavelNoSupabase,
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: familiasSupabaseQueryKeys.all,
        exact: true,
      });
    },
  });
}
