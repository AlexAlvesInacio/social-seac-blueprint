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
      "id, nome_completo, email, papel, status, criado_em, atualizado_em, aprovado_em, aprovado_por, inativado_em, inativado_por",
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

export async function reactivateUser(profileId: string): Promise<UserAdminResult<null>> {
  const { error } = await getSupabaseClient().rpc("reativar_usuario", {
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

export interface CriarUsuarioInput {
  nome: string;
  email: string;
  papel: PapelPerfil;
}

/**
 * Cria um usuário já ativo (sem senha, sem convite) via Edge Function `criar-usuario`
 * (a service_role fica no servidor). O usuário define a senha no 1º acesso pela opção
 * "Esqueci a senha" da tela de login.
 */
export async function criarUsuario(
  input: CriarUsuarioInput,
): Promise<{ error: { message: string } | null }> {
  const { data, error } = await getSupabaseClient().functions.invoke("criar-usuario", {
    body: input,
  });

  if (error) return { error: { message: error.message || "Falha ao chamar a função." } };
  if (data && data.ok === false)
    return { error: { message: data.error || "Não foi possível incluir o usuário." } };
  return { error: null };
}
