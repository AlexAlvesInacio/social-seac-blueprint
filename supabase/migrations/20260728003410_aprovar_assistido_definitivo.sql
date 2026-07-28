-- Aprovação manual do cadastro definitivo (Extra -> Definitivo).
--
-- REGRAS_ATENDIMENTO_SEAC.md §3: após a 3ª retirada de Cesta Extra, o cadastro deve
-- ser avaliado e, se aprovado, passa a receber Cesta Padrão — "nunca converter
-- automaticamente". Esta RPC faz a conversão MANUAL, disparada pelo operador no
-- atendimento. Administrador ou atendente ativos podem aprovar (mesma regra de
-- gestão de famílias). SECURITY INVOKER: o UPDATE passa pela policy existente
-- "Equipe ativa atualiza assistidos".

create function public.aprovar_assistido_definitivo(p_assistido_id uuid)
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
  v_tipo public.assistido_tipo_cadastro;
  v_status public.assistido_status;
  v_familia_id uuid;
begin
  if v_usuario_id is null
    or not private.usuario_atual_pode_gerir_familias()
  then
    raise exception 'Apenas administrador ou atendente ativo pode aprovar o cadastro definitivo.'
      using errcode = '42501';
  end if;

  select a.tipo_cadastro, a.status
  into v_tipo, v_status
  from public.assistidos as a
  where a.id = p_assistido_id;

  if not found then
    raise exception 'Assistido não encontrado.'
      using errcode = 'P0002';
  end if;

  if v_status <> 'ativo'::public.assistido_status then
    raise exception 'Só é possível aprovar um assistido ativo.'
      using errcode = '22023';
  end if;

  if v_tipo = 'definitivo'::public.assistido_tipo_cadastro then
    raise exception 'O cadastro já é definitivo.'
      using errcode = '22023';
  end if;

  update public.assistidos
  set
    tipo_cadastro = 'definitivo'::public.assistido_tipo_cadastro,
    beneficio = 'Cesta Padrão'
  where id = p_assistido_id
  returning familia_id into v_familia_id;

  return query
  select p_assistido_id, v_familia_id;
end;
$$;

comment on function public.aprovar_assistido_definitivo(uuid) is
  'Converte um assistido extra em definitivo (beneficio Cesta Padrão) — aprovação manual por administrador ou atendente ativo. Não converte automaticamente.';

revoke execute on function public.aprovar_assistido_definitivo(uuid) from public;
revoke execute on function public.aprovar_assistido_definitivo(uuid) from anon;
revoke execute on function public.aprovar_assistido_definitivo(uuid) from authenticated;
grant execute on function public.aprovar_assistido_definitivo(uuid) to authenticated;
