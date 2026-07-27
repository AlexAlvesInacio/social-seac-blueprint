-- Cadastro de família passa a criar o responsável JÁ como assistido.
--
-- Mudança de regra homologada (registrada em docs/REGRAS_APROVADAS_SEAC_SOCIAL.md):
-- antes a criação de família criava o responsável só como membro e NÃO criava
-- assistido; agora, na mesma transação, o responsável é cadastrado como assistido
-- do tipo escolhido pelo operador (definitivo → Cesta Padrão, extra → Cesta Extra),
-- pois no fluxo real do SEAC o responsável quase sempre é o beneficiário.
--
-- A assinatura muda (novo parâmetro p_tipo_cadastro) e o retorno ganha assistido_id,
-- então é necessário DROP + CREATE (CREATE OR REPLACE não permite mudar o retorno).
-- A migration 20260721222755 permanece imutável. Continua SECURITY INVOKER: os
-- INSERTs em pessoas/familias/membros_familiares/assistidos passam pelas policies
-- existentes (predicate private.usuario_atual_pode_gerir_familias()).

drop function if exists public.criar_familia_com_responsavel(
  text,
  text,
  public.pessoa_tipo_documento,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

create function public.criar_familia_com_responsavel(
  p_nome_referencia text,
  p_responsavel_nome text,
  p_responsavel_tipo_documento public.pessoa_tipo_documento,
  p_responsavel_documento text,
  p_tipo_cadastro public.assistido_tipo_cadastro,
  p_responsavel_telefone text default null,
  p_endereco text default null,
  p_numero text default null,
  p_complemento text default null,
  p_bairro text default null,
  p_cidade text default null,
  p_uf text default null,
  p_cep text default null
)
returns table (
  familia_id uuid,
  pessoa_id uuid,
  membro_familiar_id uuid,
  assistido_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_nome_referencia text := pg_catalog.btrim(p_nome_referencia);
  v_responsavel_nome text := pg_catalog.btrim(p_responsavel_nome);
  v_responsavel_documento text := pg_catalog.btrim(p_responsavel_documento);
  v_familia_id uuid;
  v_pessoa_id uuid;
  v_membro_familiar_id uuid;
  v_assistido_id uuid;
begin
  if v_usuario_id is null
    or not private.usuario_atual_pode_gerir_familias()
  then
    raise exception 'Apenas administrador ou atendente ativo pode criar famílias.'
      using errcode = '42501';
  end if;

  if v_nome_referencia is null or v_nome_referencia = '' then
    raise exception 'O nome de referência da família é obrigatório.'
      using errcode = '22023';
  end if;

  if v_responsavel_nome is null or v_responsavel_nome = '' then
    raise exception 'O nome do responsável é obrigatório.'
      using errcode = '22023';
  end if;

  if p_responsavel_tipo_documento is null then
    raise exception 'O tipo de documento do responsável é obrigatório.'
      using errcode = '22023';
  end if;

  if v_responsavel_documento is null or v_responsavel_documento = '' then
    raise exception 'O documento do responsável é obrigatório.'
      using errcode = '22023';
  end if;

  if p_tipo_cadastro is null then
    raise exception 'O tipo de cadastro do responsável é obrigatório.'
      using errcode = '22023';
  end if;

  -- O trigger pessoas_normalizar_documento é a fonte canônica da normalização
  -- e executa antes da verificação da constraint usada pelo ON CONFLICT.
  insert into public.pessoas (
    nome,
    tipo_documento,
    documento,
    telefone
  )
  values (
    v_responsavel_nome,
    p_responsavel_tipo_documento,
    v_responsavel_documento,
    nullif(pg_catalog.btrim(p_responsavel_telefone), '')
  )
  on conflict on constraint pessoas_documento_normalizado_key do nothing
  returning id into v_pessoa_id;

  if v_pessoa_id is null then
    raise exception 'Já existe uma pessoa cadastrada com este documento.'
      using
        errcode = '23505',
        detail = 'A criação foi cancelada sem alterar família, pessoa ou vínculo.',
        hint = 'A reutilização ou transferência de pessoa existente será implementada em etapa futura.';
  end if;

  insert into public.familias (
    nome_referencia,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    cep,
    status,
    acompanhamento
  )
  values (
    v_nome_referencia,
    nullif(pg_catalog.btrim(p_endereco), ''),
    nullif(pg_catalog.btrim(p_numero), ''),
    nullif(pg_catalog.btrim(p_complemento), ''),
    nullif(pg_catalog.btrim(p_bairro), ''),
    nullif(pg_catalog.btrim(p_cidade), ''),
    nullif(pg_catalog.btrim(p_uf), ''),
    nullif(pg_catalog.btrim(p_cep), ''),
    'liberado'::public.familia_status,
    'em_dia'::public.familia_acompanhamento
  )
  returning id into v_familia_id;

  insert into public.membros_familiares (
    familia_id,
    pessoa_id,
    parentesco,
    responsavel_principal,
    status
  )
  values (
    v_familia_id,
    v_pessoa_id,
    'Responsável',
    true,
    'ativo'::public.membro_familiar_status
  )
  returning id into v_membro_familiar_id;

  -- O responsável é cadastrado como assistido na mesma transação. O benefício é
  -- derivado do tipo de cadastro (mesma regra de criar_assistido_em_familia).
  insert into public.assistidos (
    familia_id,
    pessoa_id,
    membro_familiar_id,
    tipo_cadastro,
    beneficio,
    status
  )
  values (
    v_familia_id,
    v_pessoa_id,
    v_membro_familiar_id,
    p_tipo_cadastro,
    case p_tipo_cadastro
      when 'definitivo'::public.assistido_tipo_cadastro then 'Cesta Padrão'
      when 'extra'::public.assistido_tipo_cadastro then 'Cesta Extra'
    end,
    'ativo'::public.assistido_status
  )
  returning id into v_assistido_id;

  return query
  select
    v_familia_id,
    v_pessoa_id,
    v_membro_familiar_id,
    v_assistido_id;
end;
$$;

comment on function public.criar_familia_com_responsavel(
  text,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) is
  'Cria atomicamente família, pessoa responsável inédita, vínculo principal e o assistido do responsável (tipo definitivo/extra). Não reutiliza pessoa existente.';

revoke execute on function public.criar_familia_com_responsavel(
  text,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

revoke execute on function public.criar_familia_com_responsavel(
  text,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from anon;

revoke execute on function public.criar_familia_com_responsavel(
  text,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from authenticated;

grant execute on function public.criar_familia_com_responsavel(
  text,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

-- Qualquer exceção não tratada encerra a chamada e reverte os quatro INSERTs.
-- A autoria e os timestamps continuam sendo definidos pelos triggers existentes
-- com auth.uid() e now(); nenhum desses valores é aceito como parâmetro.
-- Reutilização e transferência de pessoa existente permanecem pendentes (issue #50).
