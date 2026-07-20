export const papeisPerfil = ["administrador", "atendente", "estoque"] as const;

export type PapelPerfil = (typeof papeisPerfil)[number];

export const statusPerfil = ["pendente", "ativo", "inativo"] as const;

export type StatusPerfil = (typeof statusPerfil)[number];

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  papel: PapelPerfil;
  status: StatusPerfil;
  created_at: string;
  updated_at: string;
}
