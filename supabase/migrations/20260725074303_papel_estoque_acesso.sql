-- Papel `estoque` passa a acessar estoque, itens, composição e recebimentos
-- (docs/05_SEGURANCA: "estoque acessa estoque e recebimentos"). Modelo SUPERSET,
-- não-regressivo: administrador + atendente + estoque (mantém o acesso atual do
-- atendente e adiciona o do estoque).
--
-- Módulos de família/atendimento continuam em usuario_atual_pode_gerir_familias()
-- (admin + atendente) — o papel estoque NÃO ganha acesso a cadastros/atendimento.

-- ============================================================================
-- Novo predicado
-- ============================================================================

create function private.usuario_atual_pode_gerir_estoque()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.status = 'ativo'::public.usuario_status
        and profile.papel in (
          'administrador'::public.usuario_papel,
          'atendente'::public.usuario_papel,
          'estoque'::public.usuario_papel
        )
    );
$$;

comment on function private.usuario_atual_pode_gerir_estoque() is
  'Autoriza administrador, atendente ou estoque com perfil ativo; pendente, inativo e anon são recusados.';

revoke execute on function private.usuario_atual_pode_gerir_estoque() from public;
revoke execute on function private.usuario_atual_pode_gerir_estoque() from anon;
revoke execute on function private.usuario_atual_pode_gerir_estoque() from authenticated;
grant execute on function private.usuario_atual_pode_gerir_estoque() to authenticated;

-- ============================================================================
-- RLS: repõe o predicado nas policies das tabelas de estoque/recebimentos.
-- (ALTER POLICY troca só a expressão, preservando o restante.)
-- ============================================================================

-- beneficios
alter policy "Equipe ativa consulta beneficios" on public.beneficios
  using ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa atualiza beneficios" on public.beneficios
  using ((select private.usuario_atual_pode_gerir_estoque()))
  with check ((select private.usuario_atual_pode_gerir_estoque()));

-- movimentacoes_estoque
alter policy "Equipe ativa consulta movimentacoes" on public.movimentacoes_estoque
  using ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa insere movimentacoes" on public.movimentacoes_estoque
  with check ((select private.usuario_atual_pode_gerir_estoque()));

-- itens_estoque
alter policy "Equipe ativa consulta itens" on public.itens_estoque
  using ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa insere itens" on public.itens_estoque
  with check ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa atualiza itens" on public.itens_estoque
  using ((select private.usuario_atual_pode_gerir_estoque()))
  with check ((select private.usuario_atual_pode_gerir_estoque()));

-- movimentacoes_itens
alter policy "Equipe ativa consulta movimentacoes itens" on public.movimentacoes_itens
  using ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa insere movimentacoes itens" on public.movimentacoes_itens
  with check ((select private.usuario_atual_pode_gerir_estoque()));

-- composicao_beneficio
alter policy "Equipe ativa consulta composicao" on public.composicao_beneficio
  using ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa insere composicao" on public.composicao_beneficio
  with check ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa atualiza composicao" on public.composicao_beneficio
  using ((select private.usuario_atual_pode_gerir_estoque()))
  with check ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa remove composicao" on public.composicao_beneficio
  using ((select private.usuario_atual_pode_gerir_estoque()));

-- recebimentos
alter policy "Equipe ativa consulta recebimentos" on public.recebimentos
  using ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa insere recebimentos" on public.recebimentos
  with check ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa atualiza recebimentos" on public.recebimentos
  using ((select private.usuario_atual_pode_gerir_estoque()))
  with check ((select private.usuario_atual_pode_gerir_estoque()));

-- recebimento_itens
alter policy "Equipe ativa consulta recebimento itens" on public.recebimento_itens
  using ((select private.usuario_atual_pode_gerir_estoque()));
alter policy "Equipe ativa insere recebimento itens" on public.recebimento_itens
  with check ((select private.usuario_atual_pode_gerir_estoque()));

-- ============================================================================
-- RPCs de estoque/recebimentos: guard passa a aceitar o papel estoque.
-- Corpos idênticos às versões vigentes; única mudança = predicado do guard e a
-- mensagem de erro. (registrar_entrega_atendimento / criar_pre_cadastro são de
-- atendimento e permanecem em gerir_familias.)
-- ============================================================================

-- 1) registrar_movimentacao_estoque ------------------------------------------
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
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_estoque() then
    raise exception 'Apenas administrador, atendente ou estoque ativo pode movimentar o estoque.'
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

-- 2) registrar_movimentacao_item ---------------------------------------------
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
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_estoque() then
    raise exception 'Apenas administrador, atendente ou estoque ativo pode movimentar o estoque.'
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

-- 3) montar_cesta ------------------------------------------------------------
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
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_estoque() then
    raise exception 'Apenas administrador, atendente ou estoque ativo pode montar cestas.'
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

-- 4) definir_composicao_beneficio --------------------------------------------
create or replace function public.definir_composicao_beneficio(
  p_beneficio_id uuid,
  p_itens jsonb default '[]'::jsonb
)
returns table (
  total_itens integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_item jsonb;
  v_item_id uuid;
  v_qtd numeric;
  v_total integer := 0;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_estoque() then
    raise exception 'Apenas administrador, atendente ou estoque ativo pode definir a composição.'
      using errcode = '42501';
  end if;

  if p_beneficio_id is null then
    raise exception 'O benefício é obrigatório.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.beneficios where id = p_beneficio_id) then
    raise exception 'Benefício não encontrado ou sem permissão.' using errcode = 'P0002';
  end if;

  delete from public.composicao_beneficio where beneficio_id = p_beneficio_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_item_id := nullif(v_item ->> 'item_id', '')::uuid;
    v_qtd := nullif(v_item ->> 'quantidade', '')::numeric;
    if v_item_id is null or v_qtd is null or v_qtd <= 0 then
      continue;
    end if;

    insert into public.composicao_beneficio (beneficio_id, item_id, quantidade)
    values (p_beneficio_id, v_item_id, v_qtd)
    on conflict (beneficio_id, item_id)
    do update set quantidade = excluded.quantidade;

    v_total := v_total + 1;
  end loop;

  return query select v_total;
end;
$$;

-- 5) criar_recebimento -------------------------------------------------------
create or replace function public.criar_recebimento(
  p_data date,
  p_origem public.recebimento_origem,
  p_parte text,
  p_documento text default null,
  p_valor numeric default 0,
  p_observacao text default null,
  p_itens jsonb default '[]'::jsonb
)
returns table (
  recebimento_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_parte text := pg_catalog.btrim(p_parte);
  v_recebimento_id uuid;
  v_item jsonb;
  v_nome text;
  v_qtd numeric;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_estoque() then
    raise exception 'Apenas administrador, atendente ou estoque ativo pode registrar recebimentos.'
      using errcode = '42501';
  end if;

  if p_data is null then
    raise exception 'A data do recebimento é obrigatória.' using errcode = '22023';
  end if;

  if p_origem is null then
    raise exception 'A origem do recebimento é obrigatória.' using errcode = '22023';
  end if;

  if v_parte is null or v_parte = '' then
    raise exception 'A parte (doador/fornecedor) é obrigatória.' using errcode = '22023';
  end if;

  insert into public.recebimentos (data, origem, parte, documento, valor, observacao)
  values (
    p_data,
    p_origem,
    v_parte,
    nullif(pg_catalog.btrim(p_documento), ''),
    coalesce(p_valor, 0),
    nullif(pg_catalog.btrim(p_observacao), '')
  )
  returning id into v_recebimento_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_nome := pg_catalog.btrim(v_item ->> 'nome');
    v_qtd := nullif(v_item ->> 'quantidade', '')::numeric;
    if v_nome is null or v_nome = '' or v_qtd is null or v_qtd <= 0 then
      continue;
    end if;

    insert into public.recebimento_itens (
      recebimento_id, nome, quantidade, unidade, valor_unitario, valor_total
    )
    values (
      v_recebimento_id,
      v_nome,
      v_qtd,
      nullif(pg_catalog.btrim(v_item ->> 'unidade'), ''),
      nullif(v_item ->> 'valor_unitario', '')::numeric,
      nullif(v_item ->> 'valor_total', '')::numeric
    );
  end loop;

  return query select v_recebimento_id;
end;
$$;
