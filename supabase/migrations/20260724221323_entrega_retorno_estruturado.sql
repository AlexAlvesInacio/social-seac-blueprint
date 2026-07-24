-- Atendimento: registro atômico do histórico de TODA tentativa (regras §7).
--
-- Antes, public.registrar_entrega_atendimento dava RAISE nos bloqueios
-- (SEAC1/2/3); para auditar, o cliente precisava chamar registrar_tentativa_bloqueada
-- numa segunda chamada — não-atômico, e um INSERT de tentativa dentro da própria
-- RPC seria desfeito pelo rollback do RAISE.
--
-- Agora a RPC deixa de dar RAISE nos bloqueios de elegibilidade e passa a RETORNAR
-- um resultado estruturado. No caso bloqueado, grava a tentativa e faz commit
-- (histórico garantido no servidor). No caso liberado, grava entrega + baixa +
-- ledger (Fatia B), como antes. Erros de verdade (permissão, assistido inválido,
-- benefício inexistente) continuam como RAISE.
--
--   status ∈ { entregue, bloqueado_prazo, bloqueado_estoque, bloqueado_extra }
--   entrega_id / saldo_resultante  -> preenchidos só quando entregue
--   tentativa_id                   -> preenchido só quando bloqueado
--
-- A mudança do tipo de retorno exige DROP + CREATE (CREATE OR REPLACE não altera
-- o tipo de retorno); por isso os grants são reemitidos.

drop function if exists public.registrar_entrega_atendimento(uuid, boolean, text);

create function public.registrar_entrega_atendimento(
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
  v_intervalo constant integer := 25;
  v_limite_extra constant integer := 3;
  v_observacao text := nullif(pg_catalog.btrim(p_observacao), '');
  v_entrega_id uuid;
  v_tentativa_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode registrar entregas.'
      using errcode = '42501';
  end if;

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

  -- 2) Intervalo de 25 dias — liberável apenas por administrador com motivo.
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

comment on function public.registrar_entrega_atendimento(uuid, boolean, text) is
  'Reaplica a elegibilidade oficial (25 dias / limite extra / estoque) e retorna status estruturado: se liberada, grava entrega + baixa + ledger; se bloqueada, grava a tentativa (prazo/estoque/extra) — tudo transacional. Liberação excepcional só para administrador com motivo e nunca contorna falta de estoque.';

revoke execute on function public.registrar_entrega_atendimento(uuid, boolean, text) from public;
revoke execute on function public.registrar_entrega_atendimento(uuid, boolean, text) from anon;
revoke execute on function public.registrar_entrega_atendimento(uuid, boolean, text) from authenticated;
grant execute on function public.registrar_entrega_atendimento(uuid, boolean, text) to authenticated;
