import type { User } from "@supabase/supabase-js";

export const papeisPerfil = ["administrador", "atendente", "estoque"] as const;

export type PapelPerfil = (typeof papeisPerfil)[number];

export const statusPerfil = ["pendente", "ativo", "inativo"] as const;

export type StatusPerfil = (typeof statusPerfil)[number];

export interface Perfil {
  id: string;
  nome_completo: string;
  papel: PapelPerfil;
  status: StatusPerfil;
  criado_em: string;
  atualizado_em: string;
  aprovado_em: string | null;
  aprovado_por: string | null;
  inativado_em: string | null;
  inativado_por: string | null;
}

export interface SessaoAtual {
  usuario: User;
  perfil: Perfil;
}
