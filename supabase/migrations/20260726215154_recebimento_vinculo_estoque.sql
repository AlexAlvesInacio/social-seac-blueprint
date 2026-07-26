-- Vínculo recebimento → estoque: um item de recebimento pode apontar para o
-- catálogo (itens_estoque). Quando aponta, o recebimento gera uma ENTRADA no
-- estoque do item (movimentacoes_itens + saldo), como as regras preveem. Itens
-- sem vínculo continuam texto solto (retrocompatível).

-- ============================================================================
-- Vínculo opcional ao catálogo
-- ============================================================================

alter table public.recebimento_itens
  add column item_id uuid references public.itens_estoque (id) on delete restrict;

comment on column public.recebimento_itens.item_id is
  'Item do catálogo vinculado; quando presente, o recebimento gera entrada no estoque. NULL = item texto solto.';

create index recebimento_itens_item_id_idx on public.recebimento_itens (item_id);

-- ============================================================================
-- criar_recebimento: grava o vínculo e, para itens do catálogo, gera a entrada.
-- CREATE OR REPLACE (mesmo retorno). Além do vínculo/entrada, mantém o guard de
-- gerir_estoque (tarefa 4) e liga o flag do ledger (tarefa 3) para a baixa/entrada.
-- A quantidade é numérica; a entrada no estoque usa round() para inteiro.
-- ============================================================================

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
  v_item_id uuid;
  v_entrada integer;
  v_saldo_item integer;
  v_novo_item integer;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_estoque() then
    raise exception 'Apenas administrador, atendente ou estoque ativo pode registrar recebimentos.'
      using errcode = '42501';
  end if;

  -- Necessário para as entradas de estoque abaixo (trigger de saldo protegido).
  perform set_config('seac.saldo_via_rpc', 'on', true);

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
    v_item_id := nullif(v_item ->> 'item_id', '')::uuid;
    if v_nome is null or v_nome = '' or v_qtd is null or v_qtd <= 0 then
      continue;
    end if;

    insert into public.recebimento_itens (
      recebimento_id, item_id, nome, quantidade, unidade, valor_unitario, valor_total
    )
    values (
      v_recebimento_id,
      v_item_id,
      v_nome,
      v_qtd,
      nullif(pg_catalog.btrim(v_item ->> 'unidade'), ''),
      nullif(v_item ->> 'valor_unitario', '')::numeric,
      nullif(v_item ->> 'valor_total', '')::numeric
    );

    -- Item vinculado ao catálogo: gera entrada no estoque (arredonda para inteiro).
    if v_item_id is not null then
      v_entrada := round(v_qtd)::integer;
      if v_entrada > 0 then
        select i.saldo into v_saldo_item
        from public.itens_estoque as i
        where i.id = v_item_id
        for update;

        if not found then
          raise exception 'Item de estoque vinculado não encontrado.' using errcode = 'P0002';
        end if;

        v_novo_item := v_saldo_item + v_entrada;

        insert into public.movimentacoes_itens (
          item_id, tipo, quantidade, saldo_resultante, motivo, observacao
        )
        values (
          v_item_id, 'entrada'::public.movimentacao_estoque_tipo,
          v_entrada, v_novo_item, 'Entrada por recebimento', 'Recebimento de ' || v_parte
        );

        update public.itens_estoque set saldo = v_novo_item where id = v_item_id;
      end if;
    end if;
  end loop;

  return query select v_recebimento_id;
end;
$$;
