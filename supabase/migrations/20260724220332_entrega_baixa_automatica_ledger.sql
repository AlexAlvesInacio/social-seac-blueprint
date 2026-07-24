-- Baixa automática de estoque na entrega confirmada (regras REGRAS_ATENDIMENTO_SEAC.md §8).
--
-- Até aqui, public.registrar_entrega_atendimento (migration 20260723233626) baixava
-- direto em beneficios.saldo, sem gerar linha no ledger public.movimentacoes_estoque.
-- As regras exigem que a entrega gere uma movimentação identificada como
-- "Baixa automática" / "Entrega realizada", relacionando a entrega que a originou.
--
-- Esta migration:
--   1. adiciona movimentacoes_estoque.entrega_id (FK opcional -> entregas) para
--      rastrear a entrega que gerou a baixa (movimentações manuais ficam com NULL);
--   2. reaplica registrar_entrega_atendimento com CREATE OR REPLACE (preserva grants)
--      inserindo a linha no ledger na mesma transação da baixa. Corpo idêntico ao
--      original, exceto o INSERT no ledger no passo 4.
--
-- Segurança do check: beneficios.saldo tem check (saldo >= 0) e o UPDATE roda antes
-- do INSERT; logo saldo_resultante do ledger é sempre >= 0 (não viola o check da
-- movimentacoes_estoque).

-- ============================================================================
-- 1) Rastreabilidade da baixa automática
-- ============================================================================

alter table public.movimentacoes_estoque
  add column entrega_id uuid references public.entregas (id) on delete restrict;

comment on column public.movimentacoes_estoque.entrega_id is
  'Entrega que originou a baixa automática; NULL em movimentações manuais.';

create index movimentacoes_estoque_entrega_id_idx
  on public.movimentacoes_estoque (entrega_id);

-- ============================================================================
-- 2) Entrega grava a baixa no ledger na mesma transação
-- ============================================================================

create or replace function public.registrar_entrega_atendimento(
  p_assistido_id uuid,
  p_excepcional boolean default false,
  p_observacao text default null
)
returns table (
  entrega_id uuid,
  beneficio text,
  saldo_resultante integer
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

  -- 1) Extra que já completou o limite: aguarda avaliação.
  if v_tipo_cadastro = 'extra'::public.assistido_tipo_cadastro and v_extras >= v_limite_extra then
    raise exception 'Cadastro extra já realizou % retiradas; aguardar avaliação.', v_limite_extra
      using errcode = 'SEAC1';
  end if;

  -- 2) Intervalo de 25 dias — liberável apenas por administrador com motivo.
  if v_ultima is not null and v_ultima > (now() - pg_catalog.make_interval(days => v_intervalo)) then
    if not (
      coalesce(p_excepcional, false)
      and private.usuario_atual_e_administrador_ativo()
      and v_observacao is not null
    ) then
      raise exception 'Entrega bloqueada: intervalo mínimo de % dias não cumprido.', v_intervalo
        using errcode = 'SEAC2';
    end if;
  end if;

  -- 3) Estoque — nunca liberável, nem por exceção.
  if v_controla and v_saldo <= 0 then
    raise exception 'Entrega bloqueada: sem saldo de "%" em estoque.', v_beneficio_nome
      using errcode = 'SEAC3';
  end if;

  -- 4) Grava entrega e baixa o saldo.
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

  -- 4b) Baixa automática no ledger de estoque (regras §8), vinculada à entrega.
  insert into public.movimentacoes_estoque (
    beneficio_id, tipo, quantidade, saldo_resultante, motivo, observacao, entrega_id
  )
  values (
    v_beneficio_id, 'saida'::public.movimentacao_estoque_tipo,
    -1, v_saldo, 'Baixa automática', 'Entrega realizada', v_entrega_id
  );

  return query select v_entrega_id, v_beneficio_nome, v_saldo;
end;
$$;

comment on function public.registrar_entrega_atendimento(uuid, boolean, text) is
  'Reaplica a elegibilidade oficial (25 dias / limite extra / estoque) e, se liberada, grava a entrega, baixa o saldo e registra a baixa automática no ledger de estoque, tudo na mesma transação. Liberação excepcional só para administrador com motivo e nunca contorna falta de estoque.';
