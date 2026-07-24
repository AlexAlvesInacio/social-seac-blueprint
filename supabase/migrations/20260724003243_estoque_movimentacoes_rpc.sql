-- Estoque de benefícios: mínimo por benefício, ledger de movimentações manuais
-- (entrada/saída/ajuste) e RPC transacional que atualiza o saldo. A baixa
-- automática continua sendo registrada em public.entregas (não alterada aqui);
-- a visão de movimentações mescla as duas fontes no frontend.

-- Mínimo por benefício, para alertas de estoque baixo.
alter table public.beneficios
  add column minimo integer not null default 0 check (minimo >= 0);

update public.beneficios
set minimo = case nome
  when 'Cesta Padrão' then 30
  when 'Cesta Extra' then 20
  when 'Kit Gestante' then 10
  else minimo
end;

create type public.movimentacao_estoque_tipo as enum ('entrada', 'saida', 'ajuste');

-- Ledger de movimentações manuais (insert-only).
create table public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references public.beneficios (id) on delete restrict,
  tipo public.movimentacao_estoque_tipo not null,
  quantidade integer not null,
  saldo_resultante integer not null check (saldo_resultante >= 0),
  motivo text,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid not null references public.profiles (id) on delete restrict
);

create index movimentacoes_estoque_beneficio_data_idx
  on public.movimentacoes_estoque (beneficio_id, criado_em desc);
create index movimentacoes_estoque_tipo_idx on public.movimentacoes_estoque (tipo);

create trigger movimentacoes_estoque_definir_autoria
before insert or update on public.movimentacoes_estoque
for each row execute function private.definir_autoria_registro_insert();

revoke all on table public.movimentacoes_estoque from anon;
grant select, insert on table public.movimentacoes_estoque to authenticated;

alter table public.movimentacoes_estoque enable row level security;

create policy "Equipe ativa consulta movimentacoes"
on public.movimentacoes_estoque for select to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere movimentacoes"
on public.movimentacoes_estoque for insert to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

-- RPC transacional: valida, calcula o novo saldo conforme o tipo, grava a
-- movimentação e atualiza beneficios.saldo na mesma transação.
-- SEAE1 = saldo insuficiente para a saída.
create function public.registrar_movimentacao_estoque(
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

comment on function public.registrar_movimentacao_estoque(
  uuid,
  public.movimentacao_estoque_tipo,
  integer,
  text,
  text
) is
  'Registra uma movimentação manual de estoque (entrada/saída/ajuste) e atualiza o saldo do benefício na mesma transação; a saída não deixa o saldo negativo.';

revoke execute on function public.registrar_movimentacao_estoque(
  uuid,
  public.movimentacao_estoque_tipo,
  integer,
  text,
  text
) from public;

revoke execute on function public.registrar_movimentacao_estoque(
  uuid,
  public.movimentacao_estoque_tipo,
  integer,
  text,
  text
) from anon;

revoke execute on function public.registrar_movimentacao_estoque(
  uuid,
  public.movimentacao_estoque_tipo,
  integer,
  text,
  text
) from authenticated;

grant execute on function public.registrar_movimentacao_estoque(
  uuid,
  public.movimentacao_estoque_tipo,
  integer,
  text,
  text
) to authenticated;
