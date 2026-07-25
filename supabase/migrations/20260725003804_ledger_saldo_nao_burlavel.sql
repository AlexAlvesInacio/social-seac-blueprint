-- Torna o saldo de beneficios/itens_estoque não-burlável: o saldo só pode mudar
-- pelas funções de movimentação (que também gravam o ledger). Fecha o achado da
-- revisão da PR #27 (UPDATE direto no saldo via API contornava o ledger insert-only).
--
-- Abordagem (mantém SECURITY INVOKER + RLS): um trigger BEFORE UPDATE rejeita
-- qualquer mudança de `saldo`, a menos que um flag transacional
-- (seac.saldo_via_rpc = 'on') esteja ligado. Cada RPC de movimentação liga o flag
-- (set_config ... is_local=true) antes de tocar o saldo. Um UPDATE direto via
-- PostgREST não liga o flag → é bloqueado (SEAS1). Updates que não mexem em saldo
-- (ex.: minimo/ativo) passam livremente.

-- ============================================================================
-- Trigger de proteção
-- ============================================================================

create function private.impedir_alteracao_saldo_direta()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.saldo is distinct from old.saldo
     and coalesce(current_setting('seac.saldo_via_rpc', true), '') <> 'on' then
    raise exception
      'O saldo só pode ser alterado pelas funções de movimentação de estoque (para preservar o ledger).'
      using errcode = 'SEAS1';
  end if;
  return new;
end;
$$;

comment on function private.impedir_alteracao_saldo_direta() is
  'Bloqueia UPDATE direto de saldo; só permite quando o flag transacional seac.saldo_via_rpc está ligado (setado pelas RPCs de movimentação).';

create trigger beneficios_saldo_protegido
before update on public.beneficios
for each row execute function private.impedir_alteracao_saldo_direta();

create trigger itens_estoque_saldo_protegido
before update on public.itens_estoque
for each row execute function private.impedir_alteracao_saldo_direta();

-- ============================================================================
-- RPCs de movimentação: ligam o flag antes de alterar o saldo.
-- Corpos idênticos às versões vigentes; única mudança = a linha set_config logo
-- após o guard de autorização.
-- ============================================================================

-- 1) registrar_movimentacao_estoque (beneficios) -----------------------------
create or replace function public.registrar_movimentacao_estoque(
  p_beneficio_id uuid,
  p_tipo public.movimentacao_estoque_tipo,
  p_quantidade integer,
  p_motivo text default null,
  p_observacao text default null
)
returns table (
  movimentacao_id uuid,
  saldo_resultante integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_saldo integer;
  v_novo integer;
  v_delta integer;
  v_movimentacao_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode movimentar o estoque.'
      using errcode = '42501';
  end if;

  perform set_config('seac.saldo_via_rpc', 'on', true);

  if p_beneficio_id is null or p_tipo is null then
    raise exception 'Benefício e tipo são obrigatórios.' using errcode = '22023';
  end if;

  if p_quantidade is null or p_quantidade < 0 then
    raise exception 'A quantidade é obrigatória e não pode ser negativa.' using errcode = '22023';
  end if;

  select b.saldo into v_saldo
  from public.beneficios as b
  where b.id = p_beneficio_id
  for update;

  if not found then
    raise exception 'Benefício não encontrado ou sem permissão.' using errcode = 'P0002';
  end if;

  if p_tipo = 'entrada'::public.movimentacao_estoque_tipo then
    if p_quantidade = 0 then
      raise exception 'Informe uma quantidade maior que zero.' using errcode = '22023';
    end if;
    v_novo := v_saldo + p_quantidade;
  elsif p_tipo = 'saida'::public.movimentacao_estoque_tipo then
    if p_quantidade = 0 then
      raise exception 'Informe uma quantidade maior que zero.' using errcode = '22023';
    end if;
    v_novo := v_saldo - p_quantidade;
    if v_novo < 0 then
      raise exception 'Saldo insuficiente para a saída (saldo atual %).', v_saldo
        using errcode = 'SEAE1';
    end if;
  else
    -- ajuste: p_quantidade é o novo saldo alvo.
    v_novo := p_quantidade;
  end if;

  v_delta := v_novo - v_saldo;

  insert into public.movimentacoes_estoque (
    beneficio_id, tipo, quantidade, saldo_resultante, motivo, observacao
  )
  values (
    p_beneficio_id, p_tipo, v_delta, v_novo,
    nullif(pg_catalog.btrim(p_motivo), ''),
    nullif(pg_catalog.btrim(p_observacao), '')
  )
  returning id into v_movimentacao_id;

  update public.beneficios
  set saldo = v_novo, atualizado_em = now()
  where id = p_beneficio_id;

  return query select v_movimentacao_id, v_novo;
end;
$$;

-- 2) registrar_movimentacao_item (itens_estoque) -----------------------------
create or replace function public.registrar_movimentacao_item(
  p_item_id uuid,
  p_tipo public.movimentacao_estoque_tipo,
  p_quantidade integer,
  p_motivo text default null,
  p_observacao text default null
)
returns table (
  movimentacao_id uuid,
  saldo_resultante integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_saldo integer;
  v_novo integer;
  v_delta integer;
  v_movimentacao_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode movimentar o estoque.'
      using errcode = '42501';
  end if;

  perform set_config('seac.saldo_via_rpc', 'on', true);

  if p_item_id is null or p_tipo is null then
    raise exception 'Item e tipo são obrigatórios.' using errcode = '22023';
  end if;

  if p_quantidade is null or p_quantidade < 0 then
    raise exception 'A quantidade é obrigatória e não pode ser negativa.' using errcode = '22023';
  end if;

  select i.saldo into v_saldo
  from public.itens_estoque as i
  where i.id = p_item_id
  for update;

  if not found then
    raise exception 'Item não encontrado ou sem permissão.' using errcode = 'P0002';
  end if;

  if p_tipo = 'entrada'::public.movimentacao_estoque_tipo then
    if p_quantidade = 0 then
      raise exception 'Informe uma quantidade maior que zero.' using errcode = '22023';
    end if;
    v_novo := v_saldo + p_quantidade;
  elsif p_tipo = 'saida'::public.movimentacao_estoque_tipo then
    if p_quantidade = 0 then
      raise exception 'Informe uma quantidade maior que zero.' using errcode = '22023';
    end if;
    v_novo := v_saldo - p_quantidade;
    if v_novo < 0 then
      raise exception 'Saldo insuficiente para a saída (saldo atual %).', v_saldo
        using errcode = 'SEAE1';
    end if;
  else
    -- ajuste: p_quantidade é o novo saldo alvo.
    v_novo := p_quantidade;
  end if;

  v_delta := v_novo - v_saldo;

  insert into public.movimentacoes_itens (
    item_id, tipo, quantidade, saldo_resultante, motivo, observacao
  )
  values (
    p_item_id, p_tipo, v_delta, v_novo,
    nullif(pg_catalog.btrim(p_motivo), ''),
    nullif(pg_catalog.btrim(p_observacao), '')
  )
  returning id into v_movimentacao_id;

  update public.itens_estoque
  set saldo = v_novo
  where id = p_item_id;

  return query select v_movimentacao_id, v_novo;
end;
$$;

-- 3) montar_cesta (itens_estoque + beneficios) -------------------------------
create or replace function public.montar_cesta(
  p_beneficio_id uuid,
  p_quantidade integer
)
returns table (
  beneficio_saldo integer,
  itens_consumidos integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_beneficio_saldo integer;
  v_linha record;
  v_saldo_item integer;
  v_necessario integer;
  v_novo_item integer;
  v_total integer := 0;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode montar cestas.'
      using errcode = '42501';
  end if;

  perform set_config('seac.saldo_via_rpc', 'on', true);

  if p_beneficio_id is null then
    raise exception 'O benefício é obrigatório.' using errcode = '22023';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade maior que zero.' using errcode = '22023';
  end if;

  select b.saldo into v_beneficio_saldo
  from public.beneficios as b
  where b.id = p_beneficio_id
  for update;

  if not found then
    raise exception 'Benefício não encontrado ou sem permissão.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.composicao_beneficio where beneficio_id = p_beneficio_id
  ) then
    raise exception 'O benefício não possui composição definida.' using errcode = '22023';
  end if;

  -- Baixa cada item da composição. A quantidade da composição é numérica, mas o
  -- saldo do item é inteiro; arredonda para cima o necessário por segurança.
  for v_linha in
    select c.item_id, ceil(c.quantidade * p_quantidade)::integer as necessario, i.nome
    from public.composicao_beneficio as c
    join public.itens_estoque as i on i.id = c.item_id
    where c.beneficio_id = p_beneficio_id
    -- Ordem determinística de aquisição dos locks (FOR UPDATE) evita deadlock
    -- entre montagens concorrentes de benefícios que compartilham itens.
    order by c.item_id
  loop
    v_necessario := v_linha.necessario;

    select i.saldo into v_saldo_item
    from public.itens_estoque as i
    where i.id = v_linha.item_id
    for update;

    if v_saldo_item < v_necessario then
      raise exception 'Saldo insuficiente de "%" para montar % cesta(s): necessário %, disponível %.',
        v_linha.nome, p_quantidade, v_necessario, v_saldo_item
        using errcode = 'SEAI1';
    end if;

    v_novo_item := v_saldo_item - v_necessario;

    insert into public.movimentacoes_itens (
      item_id, tipo, quantidade, saldo_resultante, motivo
    )
    values (
      v_linha.item_id, 'saida'::public.movimentacao_estoque_tipo,
      -v_necessario, v_novo_item, 'Montagem de cesta'
    );

    update public.itens_estoque set saldo = v_novo_item where id = v_linha.item_id;

    v_total := v_total + 1;
  end loop;

  -- Aumenta o benefício pronto e registra a entrada no ledger de benefícios.
  v_beneficio_saldo := v_beneficio_saldo + p_quantidade;

  update public.beneficios
  set saldo = v_beneficio_saldo, atualizado_em = now()
  where id = p_beneficio_id;

  insert into public.movimentacoes_estoque (
    beneficio_id, tipo, quantidade, saldo_resultante, motivo
  )
  values (
    p_beneficio_id, 'entrada'::public.movimentacao_estoque_tipo,
    p_quantidade, v_beneficio_saldo, 'Montagem de cesta'
  );

  return query select v_beneficio_saldo, v_total;
end;
$$;

-- 4) registrar_entrega_atendimento (beneficios) ------------------------------
create or replace function public.registrar_entrega_atendimento(
  p_assistido_id uuid,
  p_excepcional boolean default false,
  p_observacao text default null
)
returns table (
  status text,
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
  v_tipo_cadastro public.assistido_tipo_cadastro;
  v_status public.assistido_status;
  v_familia_id uuid;
  v_pessoa_id uuid;
  v_beneficio_nome text;
  v_beneficio_id uuid;
  v_saldo integer;
  v_controla boolean;
  v_ultima timestamptz;
  v_extras integer;
  v_intervalo integer := 25;
  v_limite_extra integer := 3;
  v_observacao text := nullif(pg_catalog.btrim(p_observacao), '');
  v_entrega_id uuid;
  v_tentativa_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode registrar entregas.'
      using errcode = '42501';
  end if;

  perform set_config('seac.saldo_via_rpc', 'on', true);

  -- Parâmetros autoritativos (fallback para os defaults se a linha sumir).
  select c.intervalo_minimo_dias, c.limite_extra
  into v_intervalo, v_limite_extra
  from public.configuracoes as c
  where c.id = 1;
  v_intervalo := coalesce(v_intervalo, 25);
  v_limite_extra := coalesce(v_limite_extra, 3);

  if p_assistido_id is null then
    raise exception 'O assistido é obrigatório.' using errcode = '22023';
  end if;

  select a.tipo_cadastro, a.status, a.familia_id, a.pessoa_id
  into v_tipo_cadastro, v_status, v_familia_id, v_pessoa_id
  from public.assistidos as a
  where a.id = p_assistido_id;

  if not found then
    raise exception 'Assistido não encontrado ou sem permissão.' using errcode = 'P0002';
  end if;

  if v_status <> 'ativo'::public.assistido_status then
    raise exception 'O assistido não está ativo.' using errcode = '22023';
  end if;

  v_beneficio_nome := case v_tipo_cadastro
    when 'definitivo'::public.assistido_tipo_cadastro then 'Cesta Padrão'
    when 'extra'::public.assistido_tipo_cadastro then 'Cesta Extra'
  end;

  -- Lock do saldo para evitar corrida/negativo entre atendimentos concorrentes.
  select b.id, b.saldo, b.controla_estoque
  into v_beneficio_id, v_saldo, v_controla
  from public.beneficios as b
  where b.nome = v_beneficio_nome
  for update;

  if not found then
    raise exception 'Benefício "%" não cadastrado.', v_beneficio_nome using errcode = 'P0002';
  end if;

  select count(*)
  into v_extras
  from public.entregas as e
  join public.beneficios as b2 on b2.id = e.beneficio_id
  where e.assistido_id = p_assistido_id
    and b2.nome = 'Cesta Extra';

  select max(e.criado_em)
  into v_ultima
  from public.entregas as e
  where e.assistido_id = p_assistido_id;

  -- 1) Extra que já completou o limite: aguarda avaliação (registra tentativa).
  if v_tipo_cadastro = 'extra'::public.assistido_tipo_cadastro and v_extras >= v_limite_extra then
    insert into public.tentativas_bloqueadas (
      assistido_id, familia_id, pessoa_id, beneficio_id, motivo, observacao
    )
    values (
      p_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
      'extra'::public.tentativa_motivo, v_observacao
    )
    returning id into v_tentativa_id;
    return query select 'bloqueado_extra'::text, null::uuid, v_beneficio_nome, null::integer, v_tentativa_id;
    return;
  end if;

  -- 2) Intervalo mínimo — liberável apenas por administrador com motivo.
  if v_ultima is not null and v_ultima > (now() - pg_catalog.make_interval(days => v_intervalo)) then
    if not (
      coalesce(p_excepcional, false)
      and private.usuario_atual_e_administrador_ativo()
      and v_observacao is not null
    ) then
      insert into public.tentativas_bloqueadas (
        assistido_id, familia_id, pessoa_id, beneficio_id, motivo, observacao
      )
      values (
        p_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
        'prazo'::public.tentativa_motivo, v_observacao
      )
      returning id into v_tentativa_id;
      return query select 'bloqueado_prazo'::text, null::uuid, v_beneficio_nome, null::integer, v_tentativa_id;
      return;
    end if;
  end if;

  -- 3) Estoque — nunca liberável, nem por exceção (registra tentativa).
  if v_controla and v_saldo <= 0 then
    insert into public.tentativas_bloqueadas (
      assistido_id, familia_id, pessoa_id, beneficio_id, motivo, observacao
    )
    values (
      p_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
      'estoque'::public.tentativa_motivo, v_observacao
    )
    returning id into v_tentativa_id;
    return query select 'bloqueado_estoque'::text, null::uuid, v_beneficio_nome, null::integer, v_tentativa_id;
    return;
  end if;

  -- 4) Liberado: grava entrega, baixa o saldo e registra a baixa no ledger.
  insert into public.entregas (
    assistido_id, familia_id, pessoa_id, beneficio_id, origem, excepcional, observacao
  )
  values (
    p_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
    'atendimento'::public.entrega_origem, coalesce(p_excepcional, false), v_observacao
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
    -1, v_saldo, 'Baixa automática', 'Entrega realizada', v_entrega_id
  );

  return query select 'entregue'::text, v_entrega_id, v_beneficio_nome, v_saldo, null::uuid;
end;
$$;

-- 5) criar_pre_cadastro (beneficios, na variante com entrega) -----------------
create or replace function public.criar_pre_cadastro(
  p_nome text,
  p_tipo_documento public.pessoa_tipo_documento,
  p_documento text,
  p_telefone text default null,
  p_nascimento date default null,
  p_pcd boolean default false,
  p_entregar boolean default false,
  p_observacao text default null
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
  v_documento text := pg_catalog.btrim(p_documento);
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

  if v_nome is null or v_nome = '' then
    raise exception 'O nome é obrigatório.' using errcode = '22023';
  end if;
  if p_tipo_documento is null then
    raise exception 'O tipo de documento é obrigatório.' using errcode = '22023';
  end if;
  if v_documento is null or v_documento = '' then
    raise exception 'O documento é obrigatório.' using errcode = '22023';
  end if;

  -- Pessoa (o trigger pessoas_normalizar_documento normaliza antes do ON CONFLICT).
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
        detail = 'O pré-cadastro foi cancelado sem alterar pessoa, família ou assistido.',
        hint = 'A reutilização de pessoa/família existente permanece fora do escopo desta RPC.';
  end if;

  -- Família implícita (o próprio pré-cadastrado como referência e responsável).
  insert into public.familias (nome_referencia, status, acompanhamento)
  values (v_nome, 'liberado'::public.familia_status, 'em_dia'::public.familia_acompanhamento)
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

  -- Só o pré-cadastro.
  if not coalesce(p_entregar, false) then
    return query select
      'criado'::text, v_familia_id, v_assistido_id,
      null::uuid, null::text, null::integer, null::uuid;
    return;
  end if;

  -- Pré-cadastro + entrega de Cesta Extra.
  select b.id, b.saldo, b.controla_estoque
  into v_beneficio_id, v_saldo, v_controla
  from public.beneficios as b
  where b.nome = 'Cesta Extra'
  for update;

  if not found then
    raise exception 'Benefício "Cesta Extra" não cadastrado.' using errcode = 'P0002';
  end if;

  -- Sem estoque: pré-cadastro permanece criado; entrega é pulada; registra tentativa.
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
