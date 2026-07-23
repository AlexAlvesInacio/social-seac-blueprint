-- Criação transacional de assistido em uma família existente.
--
-- A RPC cria somente uma pessoa inédita, seu vínculo familiar ativo e o
-- assistido correspondente. Ela usa SECURITY INVOKER porque os grants e as
-- policies existentes já restringem leitura e escrita a administrador ou
-- atendente com perfil ativo, sem contornar RLS.

create function public.criar_assistido_em_familia(
  p_familia_id uuid,
  p_nome text,
  p_tipo_documento public.pessoa_tipo_documento,
  p_documento text,
  p_tipo_cadastro public.assistido_tipo_cadastro,
  p_parentesco text default null,
  p_telefone text default null,
  p_nascimento date default null,
  p_pcd boolean default false,
  p_gestante boolean default false
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
  v_nome text := pg_catalog.btrim(p_nome);
  v_documento text := pg_catalog.btrim(p_documento);
  v_pessoa_id uuid;
  v_membro_familiar_id uuid;
  v_assistido_id uuid;
begin
  if v_usuario_id is null
    or not private.usuario_atual_pode_gerir_familias()
  then
    raise exception 'Apenas administrador ou atendente ativo pode cadastrar assistidos.'
      using errcode = '42501';
  end if;

  if p_familia_id is null then
    raise exception 'A família é obrigatória.'
      using errcode = '22023';
  end if;

  if v_nome is null or v_nome = '' then
    raise exception 'O nome do assistido é obrigatório.'
      using errcode = '22023';
  end if;

  if p_tipo_documento is null then
    raise exception 'O tipo de documento do assistido é obrigatório.'
      using errcode = '22023';
  end if;

  if v_documento is null or v_documento = '' then
    raise exception 'O documento do assistido é obrigatório.'
      using errcode = '22023';
  end if;

  if p_tipo_cadastro is null then
    raise exception 'O tipo de cadastro do assistido é obrigatório.'
      using errcode = '22023';
  end if;

  -- Sob SECURITY INVOKER, esta consulta também respeita a policy de SELECT.
  perform 1
  from public.familias as familia
  where familia.id = p_familia_id;

  if not found then
    raise exception 'Família não encontrada ou sem permissão.'
      using errcode = 'P0002';
  end if;

  -- O trigger pessoas_normalizar_documento é a fonte canônica da normalização
  -- e executa antes da verificação da constraint usada pelo ON CONFLICT.
  insert into public.pessoas (
    nome,
    tipo_documento,
    documento,
    telefone,
    nascimento,
    pcd
  )
  values (
    v_nome,
    p_tipo_documento,
    v_documento,
    nullif(pg_catalog.btrim(p_telefone), ''),
    p_nascimento,
    coalesce(p_pcd, false)
  )
  on conflict on constraint pessoas_documento_normalizado_key do nothing
  returning id into v_pessoa_id;

  if v_pessoa_id is null then
    raise exception 'Já existe uma pessoa cadastrada com este documento.'
      using
        errcode = '23505',
        detail = 'O cadastro foi cancelado sem alterar pessoa, vínculo familiar ou assistido.',
        hint = 'A reutilização de pessoa existente permanece fora do escopo desta RPC.';
  end if;

  insert into public.membros_familiares (
    familia_id,
    pessoa_id,
    parentesco,
    responsavel_principal,
    gestante,
    status
  )
  values (
    p_familia_id,
    v_pessoa_id,
    nullif(pg_catalog.btrim(p_parentesco), ''),
    false,
    coalesce(p_gestante, false),
    'ativo'::public.membro_familiar_status
  )
  returning id into v_membro_familiar_id;

  insert into public.assistidos (
    familia_id,
    pessoa_id,
    membro_familiar_id,
    tipo_cadastro,
    beneficio,
    status
  )
  values (
    p_familia_id,
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
    p_familia_id,
    v_pessoa_id,
    v_membro_familiar_id,
    v_assistido_id;
end;
$$;

comment on function public.criar_assistido_em_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  date,
  boolean,
  boolean
) is
  'Cria atomicamente pessoa inédita, vínculo familiar ativo e assistido na mesma família; não reutiliza pessoa existente.';

revoke execute on function public.criar_assistido_em_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  date,
  boolean,
  boolean
) from public;

revoke execute on function public.criar_assistido_em_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  date,
  boolean,
  boolean
) from anon;

revoke execute on function public.criar_assistido_em_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  date,
  boolean,
  boolean
) from authenticated;

grant execute on function public.criar_assistido_em_familia(
  uuid,
  text,
  public.pessoa_tipo_documento,
  text,
  public.assistido_tipo_cadastro,
  text,
  text,
  date,
  boolean,
  boolean
) to authenticated;

-- Qualquer exceção não tratada encerra a chamada e reverte os três INSERTs.
-- Autoria e timestamps são definidos pelos triggers existentes com auth.uid()
-- e now(); a RPC não recebe esses valores nem status por parâmetro.
-- O benefício é derivado do tipo de cadastro conforme as regras oficiais.
