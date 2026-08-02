-- Fecha o achado SEG-2 da security review geral (issue #79): o motor de regras
-- do atendimento era opcional.
--
-- `grant insert on public.entregas to authenticated` + a policy "Equipe ativa
-- insere entregas" (with check apenas usuario_atual_pode_gerir_familias())
-- permitiam que um atendente ativo gravasse uma entrega direto pelo PostgREST,
-- pulando prazo de 25 dias, limite de extras, bloqueio por estoque e a
-- exigência de administrador+motivo na liberação excepcional. A entrega forjada
-- ainda contaminava a leitura: elegibilidade, enforcement server-side e o
-- histórico de estoque (que sintetiza entrega sem ledger como "Baixa
-- automática") passam a divergir do saldo real.
--
-- A correção repete o padrão que já protege o saldo (20260725003804): um
-- trigger exige um flag transacional que só as RPCs ligam, via `set_config`
-- com `is_local => true`.
--
-- Nota de histórico: a primeira versão desta migration usava
-- `alter function ... set seac.atendimento_via_rpc = 'on'`, que seria mais
-- enxuto por não tocar nos corpos. **Não funciona no Supabase** — definir um
-- parâmetro personalizado no catálogo exige superusuário, e o papel `postgres`
-- do Supabase não é. O push falhou com `permission denied to set parameter`
-- (SQLSTATE 42501) e a migration inteira sofreu rollback. O `set_config` em
-- tempo de execução não tem essa restrição, e é por isso que o flag do saldo
-- sempre funcionou. Os corpos abaixo são as definições vigentes extraídas do
-- próprio banco com `pg_get_functiondef`, com uma única linha acrescentada
-- logo depois do guard de autorização.

-- ============================================================================
-- 1) Trigger: entregas e tentativas só nascem dentro das RPCs
-- ============================================================================

create function private.impedir_registro_atendimento_direto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(current_setting('seac.atendimento_via_rpc', true), '') <> 'on' then
    raise exception
      'Entregas e tentativas só podem ser registradas pelas funções de atendimento (que aplicam prazo, limite extra e estoque).'
      using errcode = 'SEAS2';
  end if;
  return new;
end;
$$;

comment on function private.impedir_registro_atendimento_direto() is
  'Bloqueia INSERT direto em entregas/tentativas_bloqueadas; só permite quando o flag seac.atendimento_via_rpc está ligado (setado pelas RPCs de atendimento).';

create trigger entregas_somente_via_rpc
before insert on public.entregas
for each row execute function private.impedir_registro_atendimento_direto();

create trigger tentativas_somente_via_rpc
before insert on public.tentativas_bloqueadas
for each row execute function private.impedir_registro_atendimento_direto();

-- ============================================================================
-- 2) As três RPCs que gravam nessas tabelas ligam o flag
-- ============================================================================
-- Corpos idênticos aos vigentes; única mudança = a linha set_config logo após
-- o guard de autorização. Qualquer RPC nova que grave nessas tabelas precisa da
-- mesma linha, senão o trigger a rejeita — falha explícita, não silenciosa.

-- registrar_entrega_atendimento ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_entrega_atendimento(p_assistido_id uuid, p_excepcional boolean DEFAULT false, p_observacao text DEFAULT NULL::text)
 RETURNS TABLE(status text, entrega_id uuid, beneficio text, saldo_resultante integer, tentativa_id uuid)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  perform set_config('seac.atendimento_via_rpc', 'on', true);

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
$function$

;

-- registrar_tentativa_bloqueada ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_tentativa_bloqueada(p_assistido_id uuid, p_motivo tentativa_motivo, p_observacao text DEFAULT NULL::text)
 RETURNS TABLE(tentativa_id uuid)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_usuario_id uuid := auth.uid();
  v_familia_id uuid;
  v_pessoa_id uuid;
  v_tipo_cadastro public.assistido_tipo_cadastro;
  v_beneficio_id uuid;
  v_tentativa_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode registrar tentativas.'
      using errcode = '42501';
  end if;

  perform set_config('seac.atendimento_via_rpc', 'on', true);

  if p_assistido_id is null then
    raise exception 'O assistido é obrigatório.' using errcode = '22023';
  end if;

  if p_motivo is null then
    raise exception 'O motivo do bloqueio é obrigatório.' using errcode = '22023';
  end if;

  select a.familia_id, a.pessoa_id, a.tipo_cadastro
  into v_familia_id, v_pessoa_id, v_tipo_cadastro
  from public.assistidos as a
  where a.id = p_assistido_id;

  if not found then
    raise exception 'Assistido não encontrado ou sem permissão.' using errcode = 'P0002';
  end if;

  select b.id
  into v_beneficio_id
  from public.beneficios as b
  where b.nome = case v_tipo_cadastro
    when 'definitivo'::public.assistido_tipo_cadastro then 'Cesta Padrão'
    when 'extra'::public.assistido_tipo_cadastro then 'Cesta Extra'
  end;

  insert into public.tentativas_bloqueadas (
    assistido_id, familia_id, pessoa_id, beneficio_id, motivo, observacao
  )
  values (
    p_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id, p_motivo,
    nullif(pg_catalog.btrim(p_observacao), '')
  )
  returning id into v_tentativa_id;

  return query select v_tentativa_id;
end;
$function$

;

-- criar_pre_cadastro ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_pre_cadastro(p_nome text, p_tipo_documento pessoa_tipo_documento, p_documento text, p_telefone text DEFAULT NULL::text, p_nascimento date DEFAULT NULL::date, p_pcd boolean DEFAULT false, p_entregar boolean DEFAULT false, p_observacao text DEFAULT NULL::text, p_pessoa_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(status text, familia_id uuid, assistido_id uuid, entrega_id uuid, beneficio text, saldo_resultante integer, tentativa_id uuid)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  perform set_config('seac.atendimento_via_rpc', 'on', true);

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
$function$

;

