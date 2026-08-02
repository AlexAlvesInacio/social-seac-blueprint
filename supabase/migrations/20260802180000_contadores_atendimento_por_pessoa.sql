-- Prazo de 25 dias e limite de Cestas Extra passam a contar por PESSOA, e não
-- por vínculo de assistido. Pré-requisito da transferência entre famílias
-- (issue #50).
--
-- Hoje os dois contadores de `registrar_entrega_atendimento` filtram por
-- `assistido_id`. Isso funciona porque `assistidos_pessoa_ativa_key` garante um
-- único assistido ativo por pessoa — então, na prática, contar por assistido ou
-- por pessoa dá o mesmo resultado. **Esta migration não muda comportamento
-- nenhum no estado atual.**
--
-- O que ela evita é o comportamento futuro: a transferência entre famílias
-- inativa o vínculo de origem e cria outro no destino. Com a contagem por
-- `assistido_id`, o novo vínculo nasce com histórico zerado, e a transferência
-- viraria caminho para burlar as duas regras que o projeto trata como
-- inegociáveis — inclusive sem má intenção, por um simples erro de cadastro.
--
-- Regra aprovada com o usuário em 2026-08-02: o histórico acompanha quem
-- recebeu, não o vínculo.
--
-- Corpo idêntico ao vigente, extraído com pg_get_functiondef; as únicas
-- mudanças são os dois `where` e os comentários que os explicam.

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

  -- Contagem por PESSOA, não por vínculo de assistido: uma transferência entre
  -- famílias cria um assistido novo, e contar por assistido_id zeraria o limite
  -- de extras a cada transferência (issue #50).
  select count(*)
  into v_extras
  from public.entregas as e
  join public.beneficios as b2 on b2.id = e.beneficio_id
  where e.pessoa_id = v_pessoa_id
    and b2.nome = 'Cesta Extra';

  -- Idem para o prazo mínimo: quem recebeu ontem continua bloqueado depois de
  -- ser transferido de família.
  select max(e.criado_em)
  into v_ultima
  from public.entregas as e
  where e.pessoa_id = v_pessoa_id;

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

comment on function public.registrar_entrega_atendimento(uuid, boolean, text) is
  'Registra a entrega aplicando prazo, limite de extras e estoque. Prazo e limite contam por pessoa (não por vínculo de assistido), para que a transferência entre famílias não zere o histórico.';
