import type { AuthError, PostgrestError, Session, User } from "@supabase/supabase-js";

import type { Perfil } from "@/lib/auth/types";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface AuthResult<T> {
  data: T | null;
  error: AuthError | null;
}

export interface AuthUserSession {
  user: User | null;
  session: Session | null;
}

export interface ProfileResult {
  data: Perfil | null;
  error: AuthError | PostgrestError | null;
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult<AuthUserSession>> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  return getSupabaseClient().auth.signOut();
}

export async function getSession(): Promise<AuthResult<{ session: Session | null }>> {
  return getSupabaseClient().auth.getSession();
}

export async function getCurrentUser(): Promise<AuthResult<{ user: User | null }>> {
  return getSupabaseClient().auth.getUser();
}

export async function getCurrentProfile(): Promise<ProfileResult> {
  const client = getSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError || !userData.user) {
    return { data: null, error: userError };
  }

  const { data, error } = await client
    .from("profiles")
    .select(
      "id, nome_completo, papel, status, criado_em, atualizado_em, aprovado_em, aprovado_por, inativado_em, inativado_por",
    )
    .eq("id", userData.user.id)
    .maybeSingle();

  return { data: data as Perfil | null, error };
}

export async function resetPassword(email: string): Promise<AuthResult<Record<string, never>>> {
  return getSupabaseClient().auth.resetPasswordForEmail(email);
}
