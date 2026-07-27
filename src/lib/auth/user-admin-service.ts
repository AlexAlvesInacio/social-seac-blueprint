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

export interface InviteUserInput {
  nome: string;
  email: string;
  papel: PapelPerfil;
}

/**
 * Convida um usuário por e-mail via Edge Function `criar-usuario` (a service_role
 * fica no servidor). O usuário definirá a senha em /definir-senha e já entra ativo.
 */
export async function inviteUser(
  input: InviteUserInput,
): Promise<{ error: { message: string } | null }> {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/definir-senha` : undefined;

  const { data, error } = await getSupabaseClient().functions.invoke("criar-usuario", {
    body: { ...input, redirectTo },
  });

  if (error) return { error: { message: error.message || "Falha ao chamar a função." } };
  if (data && data.ok === false)
    return { error: { message: data.error || "Não foi possível incluir o usuário." } };
  return { error: null };
}
