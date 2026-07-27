import type { PostgrestError } from "@supabase/supabase-js";

import type { PapelPerfil, Perfil } from "@/lib/auth/types";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface UserAdminResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

export async function listProfiles(): Promise<UserAdminResult<Perfil[]>> {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select(
      "id, nome_completo, papel, status, criado_em, atualizado_em, aprovado_em, aprovado_por, inativado_em, inativado_por",
    )
    .order("criado_em", { ascending: false });

  return { data: data as Perfil[] | null, error };
}

export async function approveUser(profileId: string): Promise<UserAdminResult<null>> {
  const { error } = await getSupabaseClient().rpc("aprovar_usuario", {
    p_profile_id: profileId,
  });

  return { data: null, error };
}

export async function deactivateUser(profileId: string): Promise<UserAdminResult<null>> {
  const { error } = await getSupabaseClient().rpc("inativar_usuario", {
    p_profile_id: profileId,
  });

  return { data: null, error };
}

export async function changeUserRole(
  profileId: string,
  role: PapelPerfil,
): Promise<UserAdminResult<null>> {
  const { error } = await getSupabaseClient().rpc("alterar_papel_usuario", {
    p_profile_id: profileId,
    p_novo_papel: role,
  });

  return { data: null, error };
}

export async function changeUserName(
  profileId: string,
  nome: string,
): Promise<UserAdminResult<null>> {
  const { error } = await getSupabaseClient().rpc("alterar_nome_usuario", {
    p_profile_id: profileId,
    p_nome: nome,
  });

  return { data: null, error };
}
