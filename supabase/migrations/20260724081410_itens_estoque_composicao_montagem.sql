-- Itens de estoque (catálogo de alimentos/higiene), composição das cestas por
-- benefício e montagem de cestas. Modelo: há DOIS estoques distintos —
--   * itens de alimento (public.itens_estoque + ledger public.movimentacoes_itens)
--   * benefício pronto (public.beneficios.saldo + ledger public.movimentacoes_estoque, já existentes)
-- A regra de negócio (docs/02_REGRAS_NEGOCIO.md): a MONTAGEM baixa os itens da
-- composição e aumenta o benefício pronto; a ENTREGA baixa o benefício, não
-- novamente seus itens.
--
-- Divergência anotada: docs/03_MODELAGEM_SUPABASE.md prevê um único
-- movimentacoes_estoque com FK item. Como o ledger existente já usa FK benefício
-- (homologado), criamos um ledger próprio movimentacoes_itens (FK item) em vez de
-- alterá-lo, evitando quebrar /estoque.

-- ============================================================================
-- Tabelas
-- ============================================================================

-- Catálogo de itens. criado_por/atualizado_por são NULL nas linhas de seed do
-- sistema (sem usuário autenticado na migration); o gatilho de auditoria é criado
-- depois do seed e passa a preencher a autoria em toda escrita da aplicação.
create table public.itens_estoque (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  unidade text not null,
  saldo integer not null default 0,
  minimo integer not null default 0,
  valor numeric(12, 2) not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id) on delete restrict,
  atualizado_por uuid references public.profiles (id) on delete restrict,
  constraint itens_estoque_nome_key unique (nome),
  constraint itens_estoque_nome_obrigatorio_check check (btrim(nome) <> ''),
  constraint itens_estoque_unidade_obrigatoria_check check (btrim(unidade) <> ''),
  constraint itens_estoque_saldo_nao_negativo_check check (saldo >= 0),
  constraint itens_estoque_minimo_nao_negativo_check check (minimo >= 0),
  constraint itens_estoque_valor_nao_negativo_check check (valor >= 0)
);

comment on table public.itens_estoque is
  'Catálogo de itens de alimento/higiene com saldo próprio; base da composição das cestas.';

create index itens_estoque_nome_idx on public.itens_estoque (nome);
create index itens_estoque_categoria_idx on public.itens_estoque (categoria);
create index itens_estoque_ativo_idx on public.itens_estoque (ativo);

-- Ledger de movimentações de item (insert-only).
create table public.movimentacoes_itens (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.itens_estoque (id) on delete restrict,
  tipo public.movimentacao_estoque_tipo not null,
  quantidade integer not null,
  saldo_resultante integer not null check (saldo_resultante >= 0),
  motivo text,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid not null references public.profiles (id) on delete restrict
);

comment on table public.movimentacoes_itens is
  'Ledger insert-only de movimentações de itens de estoque (entrada/saída/ajuste); quantidade é o delta aplicado.';

create index movimentacoes_itens_item_data_idx
  on public.movimentacoes_itens (item_id, criado_em desc);
create index movimentacoes_itens_tipo_idx on public.movimentacoes_itens (tipo);

-- Composição de cada benefício: quantos de cada item entram numa unidade.
create table public.composicao_beneficio (
  id uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references public.beneficios (id) on delete cascade,
  item_id uuid not null references public.itens_estoque (id) on delete restrict,
  quantidade numeric(12, 3) not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id) on delete restrict,
  atualizado_por uuid references public.profiles (id) on delete restrict,
  constraint composicao_beneficio_item_key unique (beneficio_id, item_id),
  constraint composicao_beneficio_quantidade_positiva_check check (quantidade > 0)
);

comment on table public.composicao_beneficio is
  'Receita de cada benefício: item x quantidade por unidade montada.';

create index composicao_beneficio_beneficio_idx
  on public.composicao_beneficio (beneficio_id);
create index composicao_beneficio_item_idx on public.composicao_beneficio (item_id);

-- ============================================================================
-- Seed (antes dos gatilhos de auditoria; sem depender de auth.uid())
-- ============================================================================

insert into public.itens_estoque (nome, categoria, unidade, saldo, minimo, valor) values
  ('Arroz 5kg', 'Alimento', 'pacote', 200, 10, 24.00),
  ('Feijão 1kg', 'Alimento', 'pacote', 80, 10, 8.50),
  ('Óleo 900ml', 'Alimento', 'unidade', 15, 10, 7.50),
  ('Macarrão', 'Alimento', 'pacote', 100, 10, 4.20),
  ('Açúcar 1kg', 'Alimento', 'pacote', 60, 10, 5.50),
  ('Café 500g', 'Alimento', 'pacote', 40, 10, 16.00),
  ('Leite em pó', 'Alimento', 'unidade', 25, 10, 18.00),
  ('Sabonete', 'Higiene', 'unidade', 90, 10, 3.00),
  ('Fralda descartável', 'Higiene', 'pacote', 12, 10, 28.00);

-- Composição inicial (resolve nomes -> ids de benefício e item).
insert into public.composicao_beneficio (beneficio_id, item_id, quantidade)
select b.id, i.id, c.quantidade
from (values
  ('Cesta Padrão', 'Arroz 5kg', 1),
  ('Cesta Padrão', 'Feijão 1kg', 2),
  ('Cesta Padrão', 'Óleo 900ml', 1),
  ('Cesta Padrão', 'Macarrão', 2),
  ('Cesta Padrão', 'Açúcar 1kg', 1),
  ('Cesta Padrão', 'Café 500g', 1),
  ('Cesta Padrão', 'Leite em pó', 1),
  ('Cesta Extra', 'Arroz 5kg', 1),
  ('Cesta Extra', 'Feijão 1kg', 1),
  ('Cesta Extra', 'Macarrão', 1),
  ('Cesta Extra', 'Óleo 900ml', 1),
  ('Kit Gestante', 'Leite em pó', 2),
  ('Kit Gestante', 'Sabonete', 3),
  ('Kit Gestante', 'Fralda descartável', 1)
) as c(beneficio_nome, item_nome, quantidade)
join public.beneficios as b on b.nome = c.beneficio_nome
join public.itens_estoque as i on i.nome = c.item_nome;

-- ============================================================================
-- Gatilhos de auditoria (após o seed)
-- ============================================================================

create trigger itens_estoque_definir_auditoria
before insert or update on public.itens_estoque
for each row execute function private.definir_auditoria_registro();

create trigger composicao_beneficio_definir_auditoria
before insert or update on public.composicao_beneficio
for each row execute function private.definir_auditoria_registro();

create trigger movimentacoes_itens_definir_autoria
before insert or update on public.movimentacoes_itens
for each row execute function private.definir_autoria_registro_insert();

-- ============================================================================
-- Grants + RLS
-- ============================================================================

revoke all on table public.itens_estoque from anon;
revoke all on table public.movimentacoes_itens from anon;
revoke all on table public.composicao_beneficio from anon;

grant select, insert, update on table public.itens_estoque to authenticated;
grant select, insert on table public.movimentacoes_itens to authenticated;
grant select, insert, update, delete on table public.composicao_beneficio to authenticated;

alter table public.itens_estoque enable row level security;
alter table public.movimentacoes_itens enable row level security;
alter table public.composicao_beneficio enable row level security;

create policy "Equipe ativa consulta itens" on public.itens_estoque
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_familias()));
create policy "Equipe ativa insere itens" on public.itens_estoque
  for insert to authenticated
  with check ((select private.usuario_atual_pode_gerir_familias()));
create policy "Equipe ativa atualiza itens" on public.itens_estoque
  for update to authenticated
  using ((select private.usuario_atual_pode_gerir_familias()))
  with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta movimentacoes itens" on public.movimentacoes_itens
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_familias()));
create policy "Equipe ativa insere movimentacoes itens" on public.movimentacoes_itens
  for insert to authenticated
  with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta composicao" on public.composicao_beneficio
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_familias()));
create policy "Equipe ativa insere composicao" on public.composicao_beneficio
  for insert to authenticated
  with check ((select private.usuario_atual_pode_gerir_familias()));
create policy "Equipe ativa atualiza composicao" on public.composicao_beneficio
  for update to authenticated
  using ((select private.usuario_atual_pode_gerir_familias()))
  with check ((select private.usuario_atual_pode_gerir_familias()));
create policy "Equipe ativa remove composicao" on public.composicao_beneficio
  for delete to authenticated
  using ((select private.usuario_atual_pode_gerir_familias()));

-- ============================================================================
-- RPC: movimentação manual de item (entrada/saída/ajuste)
-- Espelha registrar_movimentacao_estoque. SEAE1 = saldo insuficiente na saída.
-- ============================================================================

create function public.registrar_movimentacao_item(
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

comment on function public.registrar_movimentacao_item(
  uuid, public.movimentacao_estoque_tipo, integer, text, text
) is
  'Registra uma movimentação de item (entrada/saída/ajuste) e atualiza o saldo do item na mesma transação.';

-- ============================================================================
-- RPC: definir composição de um benefício (replace-set)
-- ============================================================================

create function public.definir_composicao_beneficio(
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
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode definir a composição.'
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

comment on function public.definir_composicao_beneficio(uuid, jsonb) is
  'Substitui a composição de um benefício pelo conjunto informado ([{item_id, quantidade}]).';

-- ============================================================================
-- RPC: montar cestas — baixa os itens da composição e aumenta o benefício pronto.
-- SEAI1 = saldo de item insuficiente para a montagem.
-- ============================================================================

create function public.montar_cesta(
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

comment on function public.montar_cesta(uuid, integer) is
  'Monta N cestas de um benefício: baixa os itens da composição e aumenta o benefício pronto, numa transação.';

-- ============================================================================
-- Grants de execução das RPCs
-- ============================================================================

revoke execute on function public.registrar_movimentacao_item(
  uuid, public.movimentacao_estoque_tipo, integer, text, text
) from public;
revoke execute on function public.registrar_movimentacao_item(
  uuid, public.movimentacao_estoque_tipo, integer, text, text
) from anon;
revoke execute on function public.registrar_movimentacao_item(
  uuid, public.movimentacao_estoque_tipo, integer, text, text
) from authenticated;
grant execute on function public.registrar_movimentacao_item(
  uuid, public.movimentacao_estoque_tipo, integer, text, text
) to authenticated;

revoke execute on function public.definir_composicao_beneficio(uuid, jsonb) from public;
revoke execute on function public.definir_composicao_beneficio(uuid, jsonb) from anon;
revoke execute on function public.definir_composicao_beneficio(uuid, jsonb) from authenticated;
grant execute on function public.definir_composicao_beneficio(uuid, jsonb) to authenticated;

revoke execute on function public.montar_cesta(uuid, integer) from public;
revoke execute on function public.montar_cesta(uuid, integer) from anon;
revoke execute on function public.montar_cesta(uuid, integer) from authenticated;
grant execute on function public.montar_cesta(uuid, integer) to authenticated;
