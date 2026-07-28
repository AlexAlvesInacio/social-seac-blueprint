-- Inativação de assistido (negar cadastro na avaliação).
--
-- Complementa aprovar_assistido_definitivo: no estado "Extra completou", o operador
-- pode NEGAR o cadastro — o assistido vira inativo, deixa de receber cesta e some da
-- busca de atendimento (que só retorna ativos). Administrador ou atendente ativo.
-- SECURITY INVOKER: passa pela policy "Equipe ativa atualiza assistidos".
--
-- O índice único parcial assistidos_pessoa_ativa_key é sobre status='ativo'; ao
-- inativar, a linha sai do índice — sem conflito.

create function public.inativar_assistido(p_assistido_id uuid)
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
  v_familia_id uuid;
begin
  if v_usuario_id is null
    or not private.usuario_atual_pode_gerir_familias()
  then
    raise exception 'Apenas administrador ou atendente ativo pode inativar assistidos.'
      using errcode = '42501';
  end if;

  select a.status
  into v_status
  from public.assistidos as a
  where a.id = p_assistido_id;

  if not found then
    raise exception 'Assistido não encontrado.'
      using errcode = 'P0002';
  end if;

  if v_status = 'inativo'::public.assistido_status then
    raise exception 'O assistido já está inativo.'
      using errcode = '22023';
  end if;

  update public.assistidos
  set status = 'inativo'::public.assistido_status
  where id = p_assistido_id
  returning familia_id into v_familia_id;

  return query
  select p_assistido_id, v_familia_id;
end;
$$;

comment on function public.inativar_assistido(uuid) is
  'Inativa um assistido (status inativo) — usado ao negar o cadastro na avaliação. Administrador ou atendente ativo.';

revoke execute on function public.inativar_assistido(uuid) from public;
revoke execute on function public.inativar_assistido(uuid) from anon;
revoke execute on function public.inativar_assistido(uuid) from authenticated;
grant execute on function public.inativar_assistido(uuid) to authenticated;
