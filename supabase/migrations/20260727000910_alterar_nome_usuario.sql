-- Permite ao administrador editar o nome (nome_completo) de um perfil. Necessário
-- porque não há tela de cadastro no app: usuários criados sem metadata ficam com o
-- e-mail como nome_completo (fallback do trigger criar_profile_para_novo_usuario).
-- SECURITY DEFINER + guard de administrador ativo, no mesmo padrão de
-- alterar_papel_usuario.

create function public.alterar_nome_usuario(
  p_profile_id uuid,
  p_nome text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_nome text := pg_catalog.btrim(coalesce(p_nome, ''));
begin
  if v_usuario_id is null or not private.usuario_atual_e_administrador_ativo() then
    raise exception 'Apenas administrador ativo pode alterar o nome de usuários.'
      using errcode = '42501';
  end if;

  if v_nome = '' then
    raise exception 'O nome é obrigatório.' using errcode = '22023';
  end if;

  update public.profiles
  set nome_completo = v_nome
  where id = p_profile_id;

  if not found then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.alterar_nome_usuario(uuid, text) is
  'Altera o nome_completo de um perfil (admin ativo). Corrige usuários criados sem nome (nome = e-mail).';

revoke execute on function public.alterar_nome_usuario(uuid, text) from public;
revoke execute on function public.alterar_nome_usuario(uuid, text) from anon;
revoke execute on function public.alterar_nome_usuario(uuid, text) from authenticated;
grant execute on function public.alterar_nome_usuario(uuid, text) to authenticated;
