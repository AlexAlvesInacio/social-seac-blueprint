-- Corrige "column reference familia_id is ambiguous" em aprovar_assistido_definitivo
-- e inativar_assistido.
--
-- O RETURNS TABLE(... familia_id ...) cria uma variável de saída chamada familia_id
-- que colide com a coluna homônima em "returning familia_id into v_familia_id". A
-- correção qualifica a coluna com um alias da tabela (returning a.familia_id).
-- CREATE OR REPLACE (mesma assinatura/retorno); apenas o corpo muda.

create or replace function public.aprovar_assistido_definitivo(p_assistido_id uuid)
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

  update public.assistidos as a
  set
    tipo_cadastro = 'definitivo'::public.assistido_tipo_cadastro,
    beneficio = 'Cesta Padrão'
  where a.id = p_assistido_id
  returning a.familia_id into v_familia_id;

  return query
  select p_assistido_id, v_familia_id;
end;
$$;

create or replace function public.inativar_assistido(p_assistido_id uuid)
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

  update public.assistidos as a
  set status = 'inativo'::public.assistido_status
  where a.id = p_assistido_id
  returning a.familia_id into v_familia_id;

  return query
  select p_assistido_id, v_familia_id;
end;
$$;
