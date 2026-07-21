import { useQuery } from "@tanstack/react-query";

import {
  getFamiliaFromSupabaseById,
  listFamiliasFromSupabase,
} from "@/lib/familias/familias-repository";
import { FamiliasSupabaseQueryError } from "@/lib/familias/familias-supabase-types";

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
