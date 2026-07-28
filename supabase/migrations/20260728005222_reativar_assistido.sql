-- Reativação de assistido (desfaz o "negar cadastro").
--
-- Um assistido negado (inativo) some da busca de atendimento. Esta RPC permite
-- reativá-lo pelo detalhe da família. Administrador ou atendente ativo. SECURITY
-- INVOKER: passa pela policy "Equipe ativa atualiza assistidos".
--
-- O índice único parcial assistidos_pessoa_ativa_key permite só UM assistido ativo
-- por pessoa; se a pessoa já tiver outro ativo, a reativação é recusada com mensagem
-- amigável (em vez do erro cru de unique violation).

create function public.reativar_assistido(p_assistido_id uuid)
returns table (
  assistido_id uuid,
  familia_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_status public.assistido_status;
  v_pessoa_id uuid;
  v_familia_id uuid;
begin
  if v_usuario_id is null
    or not private.usuario_atual_pode_gerir_familias()
  then
    raise exception 'Apenas administrador ou atendente ativo pode reativar assistidos.'
      using errcode = '42501';
  end if;

  select a.status, a.pessoa_id, a.familia_id
  into v_status, v_pessoa_id, v_familia_id
  from public.assistidos as a
  where a.id = p_assistido_id;

  if not found then
    raise exception 'Assistido não encontrado.'
      using errcode = 'P0002';
  end if;

  if v_status <> 'inativo'::public.assistido_status then
    raise exception 'O assistido não está inativo.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.assistidos as a
    where a.pessoa_id = v_pessoa_id
      and a.status = 'ativo'::public.assistido_status
      and a.id <> p_assistido_id
  ) then
    raise exception 'Esta pessoa já possui um assistido ativo.'
      using errcode = '23505';
  end if;

  update public.assistidos
  set status = 'ativo'::public.assistido_status
  where id = p_assistido_id;

  return query
  select p_assistido_id, v_familia_id;
end;
$$;

comment on function public.reativar_assistido(uuid) is
  'Reativa um assistido inativo (status ativo). Administrador ou atendente ativo. Recusa se a pessoa já tiver outro assistido ativo.';

revoke execute on function public.reativar_assistido(uuid) from public;
revoke execute on function public.reativar_assistido(uuid) from anon;
revoke execute on function public.reativar_assistido(uuid) from authenticated;
grant execute on function public.reativar_assistido(uuid) to authenticated;
