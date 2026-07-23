-- Atualização dos dados do responsável principal de uma família.
--
-- Atualiza a pessoa vinculada como responsável principal ativo da família
-- (nome, tipo/número do documento e telefone). Não cria nem troca o vínculo de
-- responsável; a transferência de responsável fica fora do escopo. Usa SECURITY
-- INVOKER porque grants e policies já restringem a escrita a administrador ou
-- atendente com perfil ativo. A normalização e a unicidade do documento são
-- garantidas pelos triggers/constraints existentes em pessoas.

create function public.atualizar_responsavel_familia(
  p_familia_id uuid,
  p_nome text,
  p_tipo_documento public.pessoa_tipo_documento,
  p_documento text,
  p_telefone text default null
)
returns table (
  familia_id uuid,
  pessoa_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_nome text := pg_catalog.btrim(p_nome);
  v_documento text := pg_catalog.btrim(p_documento);
  v_pessoa_id uuid;
begin
  if v_usuario_id is null
    or not private.usuario_atual_pode_gerir_familias()
  then
    raise exception 'Apenas administrador ou atendente ativo pode editar o responsável.'
      using errcode = '42501';
  end if;

  if p_familia_id is null then
    raise exception 'A família é obrigatória.'
      using errcode = '22023';
  end if;

  if v_nome is null or v_nome = '' then
    raise exception 'O nome do responsável é obrigatório.'
      using errcode = '22023';
  end if;

  if p_tipo_documento is null then
    raise exception 'O tipo de documento do responsável é obrigatório.'
      using errcode = '22023';
  end if;

  if v_documento is null or v_documento = '' then
    raise exception 'O documento do responsável é obrigatório.'
      using errcode = '22023';
  end if;

  -- Sob SECURITY INVOKER, o SELECT respeita a policy; only-one-active garantido
  -- pelo índice membros_familiares_responsavel_principal_ativo_key.
  select membro.pessoa_id
  into v_pessoa_id
  from public.membros_familiares as membro
  where membro.familia_id = p_familia_id
    and membro.responsavel_principal = true
    and membro.status = 'ativo'::public.membro_familiar_status;

  if v_pessoa_id is null then
    raise exception 'Responsável principal ativo não encontrado para a família.'
      using errcode = 'P0002';
  end if;

  -- O trigger pessoas_normalizar_documento recalcula documento_normalizado antes
  -- da checagem de unicidade; alterar para o documento de outra pessoa dispara
  -- 23505. Manter o mesmo documento não conflita (é a própria linha).
  update public.pessoas as pessoa
  set
    nome = v_nome,
    tipo_documento = p_tipo_documento,
    documento = v_documento,
    telefone = nullif(pg_catalog.btrim(p_telefone), '')
  where pessoa.id = v_pessoa_id;

  return query
  select p_familia_id, v_pessoa_id;
end;
$$;

comment on function public.atualizar_responsavel_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  text
) is
  'Atualiza nome, documento e telefone da pessoa responsável principal ativa de uma família; não troca o vínculo de responsável.';

revoke execute on function public.atualizar_responsavel_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  text
) from public;

revoke execute on function public.atualizar_responsavel_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  text
) from anon;

revoke execute on function public.atualizar_responsavel_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  text
) from authenticated;

grant execute on function public.atualizar_responsavel_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  text
) to authenticated;

-- O trigger pessoas_definir_auditoria (BEFORE UPDATE) mantém atualizado_em e
-- atualizado_por com now() e auth.uid(); nao sao aceitos por parametro.
