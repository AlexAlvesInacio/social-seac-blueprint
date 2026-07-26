-- Reuso de pessoa existente no cadastro (tarefa 7). Até aqui, se o documento já
-- existia, as RPCs de cadastro recusavam com 23505. Agora, quando o cliente informa
-- p_pessoa_id, a pessoa é reutilizada (sem criar nova) — desde que não esteja como
-- membro ativo de outra família (nesse caso seria transferência, fora de escopo:
-- erro SEAP1 claro). Sem p_pessoa_id, o comportamento é o atual.
--
-- Também adiciona buscar_pessoa_por_documento, para a UI detectar a pessoa existente
-- (e onde ela está ativa) antes de submeter.

-- ============================================================================
-- Helper: obtém a pessoa a reutilizar ou cria uma nova. Centraliza a lógica das
-- 3 RPCs de cadastro (SECURITY INVOKER: respeita RLS/grants existentes).
-- ============================================================================

create function private.obter_ou_criar_pessoa(
  p_pessoa_id uuid,
  p_nome text,
  p_tipo_documento public.pessoa_tipo_documento,
  p_documento text,
  p_telefone text,
  p_nascimento date,
  p_pcd boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
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
    if exists (
      select 1 from public.membros_familiares
      where pessoa_id = p_pessoa_id and status = 'ativo'::public.membro_familiar_status
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
$$;

comment on function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean
) is
  'Reutiliza a pessoa p_pessoa_id (recusa se já for membro ativo de outra família, SEAP1) ou cria uma pessoa inédita (23505 em documento duplicado).';

revoke execute on function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean
) from public;
revoke execute on function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean
) from anon;
grant execute on function private.obter_ou_criar_pessoa(
  uuid, text, public.pessoa_tipo_documento, text, text, date, boolean
) to authenticated;

-- ============================================================================
-- Busca de pessoa por documento (normaliza igual ao trigger)
-- ============================================================================

create function public.buscar_pessoa_por_documento(p_documento text)
returns table (
  pessoa_id uuid,
  nome text,
  documento text,
  telefone text,
  familia_ativa_id uuid,
  familia_ativa_nome text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_norm text := upper(
    pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_documento, '')), '[^0-9A-Za-z]', '', 'g')
  );
begin
  if v_norm = '' or not private.usuario_atual_pode_gerir_familias() then
    return;
  end if;

  return query
  select
    p.id, p.nome, p.documento, p.telefone,
    mf.familia_id, f.nome_referencia
  from public.pessoas as p
  left join public.membros_familiares as mf
    on mf.pessoa_id = p.id and mf.status = 'ativo'::public.membro_familiar_status
  left join public.familias as f on f.id = mf.familia_id
  where p.documento_normalizado = v_norm
  limit 1;
end;
$$;

comment on function public.buscar_pessoa_por_documento(text) is
  'Localiza uma pessoa pelo documento (normalizado) e informa em qual família ela é membro ativo, se houver. Base do reuso no cadastro.';

revoke execute on function public.buscar_pessoa_por_documento(text) from public;
revoke execute on function public.buscar_pessoa_por_documento(text) from anon;
revoke execute on function public.buscar_pessoa_por_documento(text) from authenticated;
grant execute on function public.buscar_pessoa_por_documento(text) to authenticated;

-- ============================================================================
-- criar_assistido_em_familia — agora com p_pessoa_id (reuso). DROP+CREATE porque
-- a assinatura muda (novo parâmetro).
-- ============================================================================

drop function if exists public.criar_assistido_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, public.assistido_tipo_cadastro,
  text, text, date, boolean, boolean
);

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
  p_gestante boolean default false,
  p_pessoa_id uuid default null
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
    p_pessoa_id, p_nome, p_tipo_documento, p_documento, p_telefone, p_nascimento, p_pcd
  );

  insert into public.membros_familiares (
    familia_id, pessoa_id, parentesco, responsavel_principal, gestante, status
  )
  values (
    p_familia_id, v_pessoa_id,
    nullif(pg_catalog.btrim(p_parentesco), ''),
    false, coalesce(p_gestante, false), 'ativo'::public.membro_familiar_status
  )
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
$$;

revoke execute on function public.criar_assistido_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, public.assistido_tipo_cadastro,
  text, text, date, boolean, boolean, uuid
) from public;
revoke execute on function public.criar_assistido_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, public.assistido_tipo_cadastro,
  text, text, date, boolean, boolean, uuid
) from anon;
revoke execute on function public.criar_assistido_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, public.assistido_tipo_cadastro,
  text, text, date, boolean, boolean, uuid
) from authenticated;
grant execute on function public.criar_assistido_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, public.assistido_tipo_cadastro,
  text, text, date, boolean, boolean, uuid
) to authenticated;

-- ============================================================================
-- criar_membro_em_familia — agora com p_pessoa_id (reuso).
-- ============================================================================

drop function if exists public.criar_membro_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, text, text, date, boolean, boolean
);

create function public.criar_membro_em_familia(
  p_familia_id uuid,
  p_nome text,
  p_tipo_documento public.pessoa_tipo_documento,
  p_documento text,
  p_parentesco text default null,
  p_telefone text default null,
  p_nascimento date default null,
  p_pcd boolean default false,
  p_gestante boolean default false,
  p_pessoa_id uuid default null
)
returns table (
  familia_id uuid,
  pessoa_id uuid,
  membro_familiar_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_pessoa_id uuid;
  v_membro_familiar_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode cadastrar membros.'
      using errcode = '42501';
  end if;

  if p_familia_id is null then
    raise exception 'A família é obrigatória.' using errcode = '22023';
  end if;

  perform 1 from public.familias as familia where familia.id = p_familia_id;
  if not found then
    raise exception 'Família não encontrada ou sem permissão.' using errcode = 'P0002';
  end if;

  v_pessoa_id := private.obter_ou_criar_pessoa(
    p_pessoa_id, p_nome, p_tipo_documento, p_documento, p_telefone, p_nascimento, p_pcd
  );

  insert into public.membros_familiares (
    familia_id, pessoa_id, parentesco, responsavel_principal, gestante, status
  )
  values (
    p_familia_id, v_pessoa_id,
    nullif(pg_catalog.btrim(p_parentesco), ''),
    false, coalesce(p_gestante, false), 'ativo'::public.membro_familiar_status
  )
  returning id into v_membro_familiar_id;

  return query select p_familia_id, v_pessoa_id, v_membro_familiar_id;
end;
$$;

revoke execute on function public.criar_membro_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, text, text, date, boolean, boolean, uuid
) from public;
revoke execute on function public.criar_membro_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, text, text, date, boolean, boolean, uuid
) from anon;
revoke execute on function public.criar_membro_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, text, text, date, boolean, boolean, uuid
) from authenticated;
grant execute on function public.criar_membro_em_familia(
  uuid, text, public.pessoa_tipo_documento, text, text, text, date, boolean, boolean, uuid
) to authenticated;

-- ============================================================================
-- criar_pre_cadastro — agora com p_pessoa_id (reuso). Mantém a família implícita,
-- o flag do ledger (tarefa 3) e o guard/entrega existentes.
-- ============================================================================

drop function if exists public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text
);

create function public.criar_pre_cadastro(
  p_nome text,
  p_tipo_documento public.pessoa_tipo_documento,
  p_documento text,
  p_telefone text default null,
  p_nascimento date default null,
  p_pcd boolean default false,
  p_entregar boolean default false,
  p_observacao text default null,
  p_pessoa_id uuid default null
)
returns table (
  status text,
  familia_id uuid,
  assistido_id uuid,
  entrega_id uuid,
  beneficio text,
  saldo_resultante integer,
  tentativa_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_nome text := pg_catalog.btrim(p_nome);
  v_observacao text := nullif(pg_catalog.btrim(p_observacao), '');
  v_pessoa_id uuid;
  v_familia_id uuid;
  v_membro_id uuid;
  v_assistido_id uuid;
  v_beneficio_id uuid;
  v_saldo integer;
  v_controla boolean;
  v_entrega_id uuid;
  v_tentativa_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode criar pré-cadastro.'
      using errcode = '42501';
  end if;

  perform set_config('seac.saldo_via_rpc', 'on', true);

  v_pessoa_id := private.obter_ou_criar_pessoa(
    p_pessoa_id, p_nome, p_tipo_documento, p_documento, p_telefone, p_nascimento, p_pcd
  );

  -- Família implícita (nome de referência a partir do nome informado; no reuso, usa
  -- o nome enviado ou um rótulo padrão).
  insert into public.familias (nome_referencia, status, acompanhamento)
  values (
    coalesce(nullif(v_nome, ''), 'Pré-cadastro'),
    'liberado'::public.familia_status,
    'em_dia'::public.familia_acompanhamento
  )
  returning id into v_familia_id;

  insert into public.membros_familiares (
    familia_id, pessoa_id, parentesco, responsavel_principal, status
  )
  values (
    v_familia_id, v_pessoa_id, 'Responsável', true, 'ativo'::public.membro_familiar_status
  )
  returning id into v_membro_id;

  insert into public.assistidos (
    familia_id, pessoa_id, membro_familiar_id, tipo_cadastro, beneficio, status
  )
  values (
    v_familia_id, v_pessoa_id, v_membro_id,
    'extra'::public.assistido_tipo_cadastro, 'Cesta Extra', 'ativo'::public.assistido_status
  )
  returning id into v_assistido_id;

  if not coalesce(p_entregar, false) then
    return query select
      'criado'::text, v_familia_id, v_assistido_id,
      null::uuid, null::text, null::integer, null::uuid;
    return;
  end if;

  select b.id, b.saldo, b.controla_estoque
  into v_beneficio_id, v_saldo, v_controla
  from public.beneficios as b
  where b.nome = 'Cesta Extra'
  for update;

  if not found then
    raise exception 'Benefício "Cesta Extra" não cadastrado.' using errcode = 'P0002';
  end if;

  if v_controla and v_saldo <= 0 then
    insert into public.tentativas_bloqueadas (
      assistido_id, familia_id, pessoa_id, beneficio_id, motivo, observacao
    )
    values (
      v_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
      'estoque'::public.tentativa_motivo, v_observacao
    )
    returning id into v_tentativa_id;
    return query select
      'criado_sem_estoque'::text, v_familia_id, v_assistido_id,
      null::uuid, 'Cesta Extra'::text, v_saldo, v_tentativa_id;
    return;
  end if;

  insert into public.entregas (
    assistido_id, familia_id, pessoa_id, beneficio_id, origem, excepcional, observacao
  )
  values (
    v_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
    'pre_cadastro'::public.entrega_origem, false, v_observacao
  )
  returning id into v_entrega_id;

  update public.beneficios
  set saldo = saldo - 1, atualizado_em = now()
  where id = v_beneficio_id
  returning saldo into v_saldo;

  insert into public.movimentacoes_estoque (
    beneficio_id, tipo, quantidade, saldo_resultante, motivo, observacao, entrega_id
  )
  values (
    v_beneficio_id, 'saida'::public.movimentacao_estoque_tipo,
    -1, v_saldo, 'Baixa automática', 'Entrega de pré-cadastro', v_entrega_id
  );

  return query select
    'criado_e_entregue'::text, v_familia_id, v_assistido_id,
    v_entrega_id, 'Cesta Extra'::text, v_saldo, null::uuid;
end;
$$;

revoke execute on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text, uuid
) from public;
revoke execute on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text, uuid
) from anon;
revoke execute on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text, uuid
) from authenticated;
grant execute on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text, uuid
) to authenticated;
