-- Correção de robustez em public.montar_cesta (introduzida em
-- 20260724081410_itens_estoque_composicao_montagem.sql).
--
-- A versão original percorre os itens da composição sem ORDER BY e adquire os
-- locks (SELECT ... FOR UPDATE) na ordem — não determinística — retornada pelo
-- planner. Duas montagens concorrentes de benefícios que compartilham itens
-- podem adquirir os mesmos locks em ordens diferentes e travar em deadlock.
--
-- Reaplicamos a função com CREATE OR REPLACE (preserva grants) adicionando
-- ORDER BY c.item_id ao loop, fixando uma ordem global de aquisição de locks.
-- O restante do corpo é idêntico à versão original.

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
