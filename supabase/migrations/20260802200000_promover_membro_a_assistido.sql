-- Corrige um bloqueio que impedia promover um membro da família a assistido
-- (pré-requisito da tela de transferência, issue #50 parte 3 — mas é bug
-- independente dela).
--
-- Situação até aqui: uma pessoa já cadastrada como membro comum de uma família
-- não podia virar assistida dessa mesma família. Os dois caminhos falhavam:
--
--   * informando p_pessoa_id → `private.obter_ou_criar_pessoa` recusava com
--     SEAP1, porque a checagem "já é membro ativo" não excluía a própria
--     família de destino. A mensagem ainda dizia "de outra família", quando era
--     a mesma;
--   * sem p_pessoa_id → 23505, documento duplicado.
--
-- Ou seja: para dar benefício a alguém que já constava como morador, era
-- preciso contornar o cadastro. Verificado no banco de produção em 2026-08-02.
--
-- Isso também bloqueava a regra 2 da transferência (o vínculo de assistido não
-- acompanha; a pessoa entra como membro no destino e é cadastrada como
-- assistida lá): sem esta correção, a segunda etapa era impossível.
--
-- Duas mudanças, ambas com o corpo restante idêntico ao vigente (extraído com
-- pg_get_functiondef):
--
--   1. `obter_ou_criar_pessoa` recebe `p_familia_id` opcional. Quando informado,
--      um vínculo ativo NAQUELA família deixa de bloquear o reuso; vínculo em
--      qualquer outra continua exigindo transferência (SEAP1 preservado).
--   2. `criar_assistido_em_familia` informa a família e faz upsert do vínculo
--      de membro, reaproveitando a linha existente — a unicidade é
--      (familia_id, pessoa_id).
--
-- `criar_membro_em_familia` e `criar_pre_cadastro` não passam p_familia_id, então
-- o comportamento delas fica exatamente como está.

-- Nota: a assinatura muda (ganha p_familia_id), então a versão de 7 parâmetros
-- é removida antes. Mantê-la tornaria ambíguas as chamadas com 7 argumentos,
-- que passariam a casar tanto com ela quanto com a nova via DEFAULT.

drop function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean
);

CREATE OR REPLACE FUNCTION private.obter_ou_criar_pessoa(p_pessoa_id uuid, p_nome text, p_tipo_documento pessoa_tipo_documento, p_documento text, p_telefone text, p_nascimento date, p_pcd boolean, p_familia_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_nome text := pg_catalog.btrim(coalesce(p_nome, ''));
  v_documento text := pg_catalog.btrim(coalesce(p_documento, ''));
  v_pessoa_id uuid;
begin
  -- Reuso de pessoa existente.
  if p_pessoa_id is not null then
    perform 1 from public.pessoas where id = p_pessoa_id;
    if not found then
      raise exception 'Pessoa informada para reuso não encontrada.' using errcode = 'P0002';
    end if;
    -- p_familia_id, quando informado, é a família de destino: um vínculo ativo
    -- NELA não impede o reuso (é o caso de promover um membro já cadastrado a
    -- assistido). Vínculo ativo em qualquer outra família continua exigindo
    -- transferência.
    if exists (
      select 1 from public.membros_familiares
      where pessoa_id = p_pessoa_id
        and status = 'ativo'::public.membro_familiar_status
        and (p_familia_id is null or familia_id <> p_familia_id)
    ) then
      raise exception 'Esta pessoa já é membro ativo de outra família; use a transferência.'
        using errcode = 'SEAP1';
    end if;
    return p_pessoa_id;
  end if;

  -- Criação de pessoa inédita (comportamento atual).
  if v_nome = '' then
    raise exception 'O nome é obrigatório.' using errcode = '22023';
  end if;
  if p_tipo_documento is null then
    raise exception 'O tipo de documento é obrigatório.' using errcode = '22023';
  end if;
  if v_documento = '' then
    raise exception 'O documento é obrigatório.' using errcode = '22023';
  end if;

  insert into public.pessoas (nome, tipo_documento, documento, telefone, nascimento, pcd)
  values (
    v_nome, p_tipo_documento, v_documento,
    nullif(pg_catalog.btrim(p_telefone), ''), p_nascimento, coalesce(p_pcd, false)
  )
  on conflict on constraint pessoas_documento_normalizado_key do nothing
  returning id into v_pessoa_id;

  if v_pessoa_id is null then
    raise exception 'Já existe uma pessoa cadastrada com este documento.'
      using
        errcode = '23505',
        detail = 'O cadastro foi cancelado sem alterar dados existentes.',
        hint = 'Informe p_pessoa_id para reutilizar a pessoa já cadastrada.';
  end if;

  return v_pessoa_id;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.criar_assistido_em_familia(p_familia_id uuid, p_nome text, p_tipo_documento pessoa_tipo_documento, p_documento text, p_tipo_cadastro assistido_tipo_cadastro, p_parentesco text DEFAULT NULL::text, p_telefone text DEFAULT NULL::text, p_nascimento date DEFAULT NULL::date, p_pcd boolean DEFAULT false, p_gestante boolean DEFAULT false, p_pessoa_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(familia_id uuid, pessoa_id uuid, membro_familiar_id uuid, assistido_id uuid)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_usuario_id uuid := auth.uid();
  v_pessoa_id uuid;
  v_membro_familiar_id uuid;
  v_assistido_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode cadastrar assistidos.'
      using errcode = '42501';
  end if;

  if p_familia_id is null then
    raise exception 'A família é obrigatória.' using errcode = '22023';
  end if;

  perform 1 from public.familias as familia where familia.id = p_familia_id;
  if not found then
    raise exception 'Família não encontrada ou sem permissão.' using errcode = 'P0002';
  end if;

  if p_tipo_cadastro is null then
    raise exception 'O tipo de cadastro do assistido é obrigatório.' using errcode = '22023';
  end if;

  v_pessoa_id := private.obter_ou_criar_pessoa(
    p_pessoa_id, p_nome, p_tipo_documento, p_documento, p_telefone, p_nascimento, p_pcd,
    p_familia_id
  );

  -- A pessoa pode já ser membro desta família (promoção de membro a assistido)
  -- ou ter tido um vínculo inativado antes. A unicidade é (familia_id,
  -- pessoa_id): reaproveita-se a linha em vez de tentar inserir outra.
  insert into public.membros_familiares (
    familia_id, pessoa_id, parentesco, responsavel_principal, gestante, status
  )
  values (
    p_familia_id, v_pessoa_id,
    nullif(pg_catalog.btrim(p_parentesco), ''),
    false, coalesce(p_gestante, false), 'ativo'::public.membro_familiar_status
  )
  -- Pela constraint, e não pela lista de colunas: `familia_id` também é um
  -- parâmetro de saída desta função, e a lista de colunas ficaria ambígua.
  on conflict on constraint membros_familiares_familia_pessoa_key do update
    set status = 'ativo'::public.membro_familiar_status,
        parentesco = coalesce(excluded.parentesco, public.membros_familiares.parentesco),
        gestante = excluded.gestante
  returning id into v_membro_familiar_id;

  insert into public.assistidos (
    familia_id, pessoa_id, membro_familiar_id, tipo_cadastro, beneficio, status
  )
  values (
    p_familia_id, v_pessoa_id, v_membro_familiar_id, p_tipo_cadastro,
    case p_tipo_cadastro
      when 'definitivo'::public.assistido_tipo_cadastro then 'Cesta Padrão'
      when 'extra'::public.assistido_tipo_cadastro then 'Cesta Extra'
    end,
    'ativo'::public.assistido_status
  )
  returning id into v_assistido_id;

  return query select p_familia_id, v_pessoa_id, v_membro_familiar_id, v_assistido_id;
end;
$function$

;

comment on function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean, uuid
) is
  'Reutiliza a pessoa p_pessoa_id ou cria uma inédita. Com p_familia_id, um vínculo ativo nessa família não bloqueia o reuso (promoção de membro a assistido); vínculo ativo em outra família recusa com SEAP1.';

-- Mesmos privilégios da versão anterior: `authenticated` precisa de EXECUTE
-- porque as RPCs de cadastro são SECURITY INVOKER e chamam este helper com o
-- privilégio de quem as invocou.
revoke execute on function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean, uuid
) from public;
revoke execute on function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean, uuid
) from anon;
grant execute on function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean, uuid
) to authenticated;
