import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const missingEnvironmentVariables = [
  !supabaseUrl && "VITE_SUPABASE_URL",
  !supabaseAnonKey && "VITE_SUPABASE_ANON_KEY",
].filter((variableName): variableName is string => Boolean(variableName));

export const isSupabaseConfigured = missingEnvironmentVariables.length === 0;

const configurationErrorMessage =
  "Supabase não está configurado. Defina VITE_SUPABASE_URL e " +
  "VITE_SUPABASE_ANON_KEY no arquivo .env.local.";

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.error(
    `${configurationErrorMessage} Variáveis ausentes: ${missingEnvironmentVariables.join(", ")}.`,
  );
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(configurationErrorMessage);
  }

  return supabase;
}
