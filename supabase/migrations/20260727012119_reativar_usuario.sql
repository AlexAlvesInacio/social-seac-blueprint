-- Reativa um usuário inativo (inativo -> ativo). Como a inativação só muda o
-- status do perfil (a conta no Auth continua existindo), reativar devolve o acesso
-- e o usuário entra com a senha que já tinha. Admin-only, no padrão de
-- inativar_usuario/aprovar_usuario.

create function public.reativar_usuario(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  lock table public.profiles in share row exclusive mode;

  if v_usuario_id is null or not private.usuario_atual_e_administrador_ativo() then
    raise exception 'Apenas administrador ativo pode reativar usuários.'
      using errcode = '42501';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = p_profile_id
    and profile.status = 'inativo'::public.usuario_status;

  if not found then
    raise exception 'A reativação exige um perfil existente com status inativo.';
  end if;

  update public.profiles
  set status = 'ativo'::public.usuario_status,
      aprovado_em = now(),
      aprovado_por = v_usuario_id,
      inativado_em = null,
      inativado_por = null
  where id = p_profile_id;
end;
$$;

comment on function public.reativar_usuario(uuid) is
  'Reativa um perfil inativo (inativo -> ativo), devolvendo o acesso; a senha existente é mantida.';

revoke execute on function public.reativar_usuario(uuid) from public;
revoke execute on function public.reativar_usuario(uuid) from anon;
revoke execute on function public.reativar_usuario(uuid) from authenticated;
grant execute on function public.reativar_usuario(uuid) to authenticated;
