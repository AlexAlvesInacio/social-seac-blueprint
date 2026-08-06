-- Entrega de mais de um benefício na mesma visita (Ovo de Páscoa, Cesta de
-- Natal, Kit Gestante…), decidido com o usuário em 2026-08-06.
--
-- Até aqui a entrega só conhecia dois benefícios: `registrar_entrega_atendimento`
-- resolvia o benefício pelo tipo de cadastro (definitivo → Cesta Padrão, extra →
-- Cesta Extra) e nenhum outro tinha como sair. Kit Gestante e qualquer benefício
-- sazonal ficavam presos no estoque: dava para montar, não dava para entregar.
--
-- Regras homologadas para o benefício adicional:
--   * herda o prazo de 25 dias da cesta — não tem contador próprio, porque nunca
--     sai sozinho (é sempre marcado junto de uma cesta liberada);
--   * falta de saldo **bloqueia a entrega inteira**, cesta incluída. A tela
--     desabilita o check quando o saldo é zero, então na prática isso só dispara
--     se o estoque acabar entre abrir a tela e confirmar;
--   * 1 por família é o padrão. Acima disso exige administrador e justificativa,
--     mesmo padrão da liberação excepcional de prazo, e gera evento de auditoria.
--
-- A cesta do próprio assistido continua sendo decidida pelo tipo de cadastro e
-- não pode ser marcada como adicional.

-- ---------------------------------------------------------------------------
-- 1. `entregas` passa a registrar quantidade e quem autorizou o excedente
-- ---------------------------------------------------------------------------

alter table public.entregas
  add column if not exists quantidade integer not null default 1,
  add column if not exists autorizado_por uuid references public.profiles (id) on delete restrict;

alter table public.entregas
  drop constraint if exists entregas_quantidade_positiva_check;

alter table public.entregas
  add constraint entregas_quantidade_positiva_check check (quantidade > 0);

comment on column public.entregas.quantidade is
  'Unidades entregues nesta linha. Sempre 1 na cesta do assistido; benefício adicional pode ser maior, e nesse caso exige administrador e justificativa.';
comment on column public.entregas.autorizado_por is
  'Administrador que autorizou quantidade acima de 1. NULL quando quantidade = 1.';

-- ---------------------------------------------------------------------------
-- 2. RPC com os benefícios adicionais
-- ---------------------------------------------------------------------------
-- Drop + create porque a assinatura ganha um parâmetro: manter as duas versões
-- tornaria a chamada de 3 argumentos ambígua (42725). O parâmetro novo tem
-- default, então chamadas antigas continuam válidas durante o deploy.

drop function if exists public.registrar_entrega_atendimento(uuid, boolean, text);

create function public.registrar_entrega_atendimento(
  p_assistido_id uuid,
  p_excepcional boolean default false,
  p_observacao text default null,
  p_beneficios_extras jsonb default '[]'::jsonb
)
returns table (
  status text,
  entrega_id uuid,
  beneficio text,
  saldo_resultante integer,
  tentativa_id uuid,
  extras jsonb
)
language plpgsql
security invoker
set search_path to ''
as $function$
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
  v_admin boolean := private.usuario_atual_e_administrador_ativo();
  v_lista jsonb := coalesce(p_beneficios_extras, '[]'::jsonb);
  v_extra_id uuid;
  v_extra_qtd integer;
  v_extra_justificativa text;
  v_extra_nome text;
  v_extra_saldo integer;
  v_extra_controla boolean;
  v_extra_ativo boolean;
  v_extra_entrega_id uuid;
  v_aplicados jsonb := '[]'::jsonb;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode registrar entregas.'
      using errcode = '42501';
  end if;

  perform set_config('seac.atendimento_via_rpc', 'on', true);

  perform set_config('seac.saldo_via_rpc', 'on', true);

  if pg_catalog.jsonb_typeof(v_lista) <> 'array' then
    raise exception 'Os benefícios adicionais devem vir como lista.' using errcode = '22023';
  end if;

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
    return query select 'bloqueado_extra'::text, null::uuid, v_beneficio_nome, null::integer,
                        v_tentativa_id, '[]'::jsonb;
    return;
  end if;

  -- 2) Intervalo mínimo — liberável apenas por administrador com motivo.
  if v_ultima is not null and v_ultima > (now() - pg_catalog.make_interval(days => v_intervalo)) then
    if not (
      coalesce(p_excepcional, false)
      and v_admin
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
      return query select 'bloqueado_prazo'::text, null::uuid, v_beneficio_nome, null::integer,
                          v_tentativa_id, '[]'::jsonb;
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
    return query select 'bloqueado_estoque'::text, null::uuid, v_beneficio_nome, null::integer,
                        v_tentativa_id, '[]'::jsonb;
    return;
  end if;

  -- 4) Liberado: grava entrega, baixa o saldo e registra a baixa no ledger.
  insert into public.entregas (
    assistido_id, familia_id, pessoa_id, beneficio_id, origem, excepcional, observacao, quantidade
  )
  values (
    p_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
    'atendimento'::public.entrega_origem, coalesce(p_excepcional, false), v_observacao, 1
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

  -- 5) Benefícios adicionais da mesma visita. Qualquer recusa aqui derruba a
  -- transação inteira — inclusive a cesta gravada acima. É a regra homologada:
  -- sem saldo do adicional, a entrega não acontece.
  if pg_catalog.jsonb_array_length(v_lista) > 0 then
    if (
      select count(*) <> count(distinct item.value->>'beneficio_id')
      from pg_catalog.jsonb_array_elements(v_lista) as item
    ) then
      raise exception 'O mesmo benefício adicional foi informado mais de uma vez.'
        using errcode = '22023';
    end if;

    -- `order by` para que atendimentos concorrentes adquiram os locks de saldo
    -- na mesma ordem (mesmo motivo do `order by c.item_id` em montar_cesta).
    for v_extra_id, v_extra_qtd, v_extra_justificativa in
      select (item.value->>'beneficio_id')::uuid,
             coalesce((item.value->>'quantidade')::integer, 1),
             nullif(pg_catalog.btrim(item.value->>'justificativa'), '')
      from pg_catalog.jsonb_array_elements(v_lista) as item
      order by 1
    loop
      if v_extra_id is null then
        raise exception 'Benefício adicional sem identificador.' using errcode = '22023';
      end if;

      if v_extra_id = v_beneficio_id then
        raise exception 'A cesta do assistido não pode ser marcada como benefício adicional.'
          using errcode = '22023';
      end if;

      if v_extra_qtd is null or v_extra_qtd <= 0 then
        raise exception 'A quantidade do benefício adicional deve ser maior que zero.'
          using errcode = '22023';
      end if;

      -- Acima de 1 por família: administrador e justificativa, como na
      -- liberação excepcional de prazo.
      if v_extra_qtd > 1 then
        if not v_admin then
          raise exception 'Quantidade acima de 1 exige um administrador.' using errcode = '42501';
        end if;
        if v_extra_justificativa is null then
          raise exception 'Quantidade acima de 1 exige justificativa.' using errcode = '22023';
        end if;
      end if;

      select b.nome, b.saldo, b.controla_estoque, b.ativo
      into v_extra_nome, v_extra_saldo, v_extra_controla, v_extra_ativo
      from public.beneficios as b
      where b.id = v_extra_id
      for update;

      if not found then
        raise exception 'Benefício adicional não encontrado.' using errcode = 'P0002';
      end if;

      if not v_extra_ativo then
        raise exception 'O benefício "%" está inativo.', v_extra_nome using errcode = '22023';
      end if;

      if v_extra_controla and v_extra_saldo < v_extra_qtd then
        raise exception 'Sem saldo de "%": necessário %, disponível %.',
          v_extra_nome, v_extra_qtd, v_extra_saldo
          using errcode = 'SEAE1';
      end if;

      insert into public.entregas (
        assistido_id, familia_id, pessoa_id, beneficio_id, origem, excepcional,
        observacao, quantidade, autorizado_por
      )
      values (
        p_assistido_id, v_familia_id, v_pessoa_id, v_extra_id,
        'atendimento'::public.entrega_origem, false,
        v_extra_justificativa, v_extra_qtd,
        case when v_extra_qtd > 1 then v_usuario_id else null end
      )
      returning id into v_extra_entrega_id;

      update public.beneficios
      set saldo = saldo - v_extra_qtd, atualizado_em = now()
      where id = v_extra_id
      returning saldo into v_extra_saldo;

      insert into public.movimentacoes_estoque (
        beneficio_id, tipo, quantidade, saldo_resultante, motivo, observacao, entrega_id
      )
      values (
        v_extra_id, 'saida'::public.movimentacao_estoque_tipo,
        -v_extra_qtd, v_extra_saldo, 'Baixa automática',
        'Entrega realizada — benefício adicional', v_extra_entrega_id
      );

      if v_extra_qtd > 1 then
        insert into public.auditoria_eventos (acao, modulo, registro, observacao, contexto)
        values (
          'Entrega acima de 1 por família autorizada',
          'atendimento',
          v_extra_entrega_id::text,
          v_extra_justificativa,
          pg_catalog.jsonb_build_object(
            'beneficio', v_extra_nome,
            'quantidade', v_extra_qtd,
            'assistido_id', p_assistido_id,
            'familia_id', v_familia_id
          )
        );
      end if;

      v_aplicados := v_aplicados || pg_catalog.jsonb_build_object(
        'entrega_id', v_extra_entrega_id,
        'beneficio', v_extra_nome,
        'quantidade', v_extra_qtd,
        'saldo_resultante', v_extra_saldo
      );
    end loop;
  end if;

  return query select 'entregue'::text, v_entrega_id, v_beneficio_nome, v_saldo,
                      null::uuid, v_aplicados;
end;
$function$;

comment on function public.registrar_entrega_atendimento(uuid, boolean, text, jsonb) is
  'Registra a entrega da cesta do assistido (prazo, limite de extras e estoque contados por pessoa) e, na mesma transação, os benefícios adicionais marcados na visita. Falta de saldo em qualquer adicional derruba a entrega inteira; quantidade acima de 1 exige administrador, justificativa e gera auditoria.';

revoke all on function public.registrar_entrega_atendimento(uuid, boolean, text, jsonb) from public;
revoke all on function public.registrar_entrega_atendimento(uuid, boolean, text, jsonb) from anon;
grant execute on function public.registrar_entrega_atendimento(uuid, boolean, text, jsonb) to authenticated;
