import type { AuthError, Session, User } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabase/client";

export interface AuthResult<T> {
  data: T | null;
  error: AuthError | null;
}

export interface AuthUserSession {
  user: User | null;
  session: Session | null;
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

export async function resetPassword(email: string): Promise<AuthResult<Record<string, never>>> {
  return getSupabaseClient().auth.resetPasswordForEmail(email);
}
