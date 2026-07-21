-- Bootstrap e fluxo administrativo de usuários do SEAC Social.
--
-- Esta migration não cria usuários nem promove automaticamente um perfil.
-- O bootstrap deve ser executado uma única vez por operador autorizado,
-- diretamente no ambiente controlado do Supabase, e não pode ser chamado pelo
-- frontend. As demais alterações administrativas ocorrem somente pelas funções
-- públicas protegidas abaixo.

revoke update (
  nome_completo,
  papel,
  status
) on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;

drop policy "Administrador ativo atualiza perfis" on public.profiles;

create function private.bootstrap_primeiro_administrador(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  lock table public.profiles in share row exclusive mode;

  if exists (
    select 1
    from public.profiles as profile
    where profile.papel = 'administrador'::public.usuario_papel
      and profile.status = 'ativo'::public.usuario_status
  ) then
    raise exception 'O bootstrap não pode ser executado: já existe administrador ativo.';
  end if;

  update public.profiles
  set papel = 'administrador'::public.usuario_papel,
      status = 'ativo'::public.usuario_status,
      aprovado_em = now(),
      aprovado_por = null
  where id = p_profile_id
    and status = 'pendente'::public.usuario_status
  returning id into v_profile_id;

  if v_profile_id is null then
    raise exception 'O bootstrap exige um perfil existente com status pendente.';
  end if;
end;
$$;

comment on function private.bootstrap_primeiro_administrador(uuid) is
  'Promove um perfil pendente somente quando ainda não existe administrador ativo; uso exclusivo do ambiente administrativo controlado.';

revoke execute on function private.bootstrap_primeiro_administrador(uuid) from public;
revoke execute on function private.bootstrap_primeiro_administrador(uuid) from anon;
revoke execute on function private.bootstrap_primeiro_administrador(uuid) from authenticated;

create function public.aprovar_usuario(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_profile_id uuid;
begin
  if v_usuario_id is null
    or not private.usuario_atual_e_administrador_ativo()
  then
    raise exception 'Apenas administrador ativo pode aprovar usuários.'
      using errcode = '42501';
  end if;

  update public.profiles
  set status = 'ativo'::public.usuario_status,
      aprovado_em = now(),
      aprovado_por = v_usuario_id
  where id = p_profile_id
    and status = 'pendente'::public.usuario_status
  returning id into v_profile_id;

  if v_profile_id is null then
    raise exception 'A aprovação exige um perfil existente com status pendente.';
  end if;
end;
$$;

comment on function public.aprovar_usuario(uuid) is
  'Ativa um perfil pendente e registra data e administrador responsável.';

revoke execute on function public.aprovar_usuario(uuid) from public;
revoke execute on function public.aprovar_usuario(uuid) from anon;
revoke execute on function public.aprovar_usuario(uuid) from authenticated;
grant execute on function public.aprovar_usuario(uuid) to authenticated;

create function public.inativar_usuario(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_papel_atual public.usuario_papel;
begin
  lock table public.profiles in share row exclusive mode;

  if v_usuario_id is null
    or not private.usuario_atual_e_administrador_ativo()
  then
    raise exception 'Apenas administrador ativo pode inativar usuários.'
      using errcode = '42501';
  end if;

  if p_profile_id = v_usuario_id then
    raise exception 'Um administrador não pode inativar a si mesmo nesta etapa.';
  end if;

  select profile.papel
  into v_papel_atual
  from public.profiles as profile
  where profile.id = p_profile_id
    and profile.status = 'ativo'::public.usuario_status;

  if not found then
    raise exception 'A inativação exige um perfil existente com status ativo.';
  end if;

  if v_papel_atual = 'administrador'::public.usuario_papel
    and (
      select count(*)
      from public.profiles as profile
      where profile.papel = 'administrador'::public.usuario_papel
        and profile.status = 'ativo'::public.usuario_status
    ) <= 1
  then
    raise exception 'O último administrador ativo não pode ser inativado.';
  end if;

  update public.profiles
  set status = 'inativo'::public.usuario_status,
      inativado_em = now(),
      inativado_por = v_usuario_id
  where id = p_profile_id;
end;
$$;

comment on function public.inativar_usuario(uuid) is
  'Inativa um perfil ativo, registra a autoria e preserva ao menos um administrador ativo.';

revoke execute on function public.inativar_usuario(uuid) from public;
revoke execute on function public.inativar_usuario(uuid) from anon;
revoke execute on function public.inativar_usuario(uuid) from authenticated;
grant execute on function public.inativar_usuario(uuid) to authenticated;

create function public.alterar_papel_usuario(
  p_profile_id uuid,
  p_novo_papel public.usuario_papel
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_papel_atual public.usuario_papel;
begin
  lock table public.profiles in share row exclusive mode;

  if v_usuario_id is null
    or not private.usuario_atual_e_administrador_ativo()
  then
    raise exception 'Apenas administrador ativo pode alterar papéis.'
      using errcode = '42501';
  end if;

  if p_profile_id = v_usuario_id then
    raise exception 'Um administrador não pode alterar o próprio papel nesta etapa.';
  end if;

  if p_novo_papel is null then
    raise exception 'O novo papel é obrigatório.';
  end if;

  select profile.papel
  into v_papel_atual
  from public.profiles as profile
  where profile.id = p_profile_id
    and profile.status = 'ativo'::public.usuario_status;

  if not found then
    raise exception 'A alteração de papel exige um perfil existente com status ativo.';
  end if;

  if v_papel_atual = 'administrador'::public.usuario_papel
    and p_novo_papel <> 'administrador'::public.usuario_papel
    and (
      select count(*)
      from public.profiles as profile
      where profile.papel = 'administrador'::public.usuario_papel
        and profile.status = 'ativo'::public.usuario_status
    ) <= 1
  then
    raise exception 'O último administrador ativo não pode ser rebaixado.';
  end if;

  update public.profiles
  set papel = p_novo_papel
  where id = p_profile_id;
end;
$$;

comment on function public.alterar_papel_usuario(uuid, public.usuario_papel) is
  'Altera o papel de perfil ativo após autorização e protege o último administrador ativo.';

revoke execute on function public.alterar_papel_usuario(uuid, public.usuario_papel) from public;
revoke execute on function public.alterar_papel_usuario(uuid, public.usuario_papel) from anon;
revoke execute on function public.alterar_papel_usuario(uuid, public.usuario_papel) from authenticated;
grant execute on function public.alterar_papel_usuario(uuid, public.usuario_papel) to authenticated;

-- Datas e responsáveis administrativos nunca são parâmetros das funções.
-- Aprovação e inativação usam exclusivamente auth.uid() e now(). A alteração
-- de papel aceita somente o novo enum solicitado, valida o chamador e o estado
-- do perfil e não permite atualização direta da tabela pelo frontend.
--
-- A exclusão de um administrador ainda depende da estratégia futura de
-- preservação das referências históricas aprovado_por e inativado_por. Esta
-- migration não altera essas chaves estrangeiras nem apaga histórico existente.
-- A alteração de papel ainda não possui campos próprios de auditoria. A futura
-- trilha de auditoria deverá registrar autor, data, papel anterior e novo papel
-- sem criar ou alterar esses campos nesta migration.
