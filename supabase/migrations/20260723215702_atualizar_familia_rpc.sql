-- Atualização dos dados cadastrais de uma família existente.
--
-- A RPC altera somente colunas da própria tabela familias (nome de referência,
-- endereço e status). Não toca no responsável nem em outras pessoas — a edição
-- de pessoa (nome/documento/telefone) permanece fora do escopo. Usa SECURITY
-- INVOKER porque os grants e as policies já restringem a escrita a administrador
-- ou atendente com perfil ativo. Autoria/timestamps de atualização são mantidos
-- pelo trigger familias_definir_auditoria; a RPC não os recebe por parâmetro.

create function public.atualizar_familia(
  p_familia_id uuid,
  p_nome_referencia text,
  p_endereco text default null,
  p_numero text default null,
  p_complemento text default null,
  p_bairro text default null,
  p_cidade text default null,
  p_uf text default null,
  p_cep text default null,
  p_status public.familia_status default null
)
returns table (
  familia_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_nome_referencia text := pg_catalog.btrim(p_nome_referencia);
begin
  if v_usuario_id is null
    or not private.usuario_atual_pode_gerir_familias()
  then
    raise exception 'Apenas administrador ou atendente ativo pode editar famílias.'
      using errcode = '42501';
  end if;

  if p_familia_id is null then
    raise exception 'A família é obrigatória.'
      using errcode = '22023';
  end if;

  if v_nome_referencia is null or v_nome_referencia = '' then
    raise exception 'O nome de referência da família é obrigatório.'
      using errcode = '22023';
  end if;

  update public.familias as familia
  set
    nome_referencia = v_nome_referencia,
    endereco = nullif(pg_catalog.btrim(p_endereco), ''),
    numero = nullif(pg_catalog.btrim(p_numero), ''),
    complemento = nullif(pg_catalog.btrim(p_complemento), ''),
    bairro = nullif(pg_catalog.btrim(p_bairro), ''),
    cidade = nullif(pg_catalog.btrim(p_cidade), ''),
    uf = nullif(pg_catalog.btrim(p_uf), ''),
    cep = nullif(pg_catalog.btrim(p_cep), ''),
    status = coalesce(p_status, familia.status)
  where familia.id = p_familia_id;

  -- NOT FOUND cobre tanto família inexistente quanto registro invisível pela RLS.
  if not found then
    raise exception 'Família não encontrada ou sem permissão.'
      using errcode = 'P0002';
  end if;

  return query
  select p_familia_id;
end;
$$;

comment on function public.atualizar_familia(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.familia_status
) is
  'Atualiza nome de referência, endereço e status de uma família; não altera responsável nem outras pessoas.';

revoke execute on function public.atualizar_familia(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.familia_status
) from public;

revoke execute on function public.atualizar_familia(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.familia_status
) from anon;

revoke execute on function public.atualizar_familia(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.familia_status
) from authenticated;

grant execute on function public.atualizar_familia(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.familia_status
) to authenticated;

-- O trigger familias_definir_auditoria (BEFORE UPDATE) define atualizado_em e
-- atualizado_por com now() e auth.uid(); esses valores não são aceitos por
-- parâmetro. acompanhamento continua governado pelas regras de negócio.
