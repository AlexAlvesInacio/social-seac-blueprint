-- Recebimentos: registro de doações/compras/investimentos + itens. Sem vínculo
-- com estoque nesta etapa (a entrada em estoque depende de itens_estoque, ainda
-- inexistente). Itens são texto livre por ora.

create type public.recebimento_origem as enum ('doacao', 'compra', 'investimento', 'ajuste');
create type public.recebimento_status as enum ('registrado', 'pendente', 'cancelado');

create table public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  origem public.recebimento_origem not null,
  parte text not null,
  documento text,
  valor numeric(12, 2) not null default 0,
  observacao text,
  status public.recebimento_status not null default 'registrado',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid not null references public.profiles (id) on delete restrict,
  atualizado_por uuid not null references public.profiles (id) on delete restrict,
  constraint recebimentos_parte_obrigatoria_check check (btrim(parte) <> ''),
  constraint recebimentos_valor_nao_negativo_check check (valor >= 0)
);

create index recebimentos_data_idx on public.recebimentos (data desc);
create index recebimentos_origem_idx on public.recebimentos (origem);
create index recebimentos_status_idx on public.recebimentos (status);
create index recebimentos_criado_por_idx on public.recebimentos (criado_por);

create trigger recebimentos_definir_auditoria
before insert or update on public.recebimentos
for each row execute function private.definir_auditoria_registro();

create table public.recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.recebimentos (id) on delete cascade,
  nome text not null,
  quantidade numeric(12, 3) not null,
  unidade text,
  valor_unitario numeric(12, 2),
  valor_total numeric(12, 2),
  criado_em timestamptz not null default now(),
  constraint recebimento_itens_nome_obrigatorio_check check (btrim(nome) <> ''),
  constraint recebimento_itens_quantidade_positiva_check check (quantidade > 0)
);

create index recebimento_itens_recebimento_id_idx
  on public.recebimento_itens (recebimento_id);

revoke all on table public.recebimentos from anon;
revoke all on table public.recebimento_itens from anon;
grant select, insert, update on table public.recebimentos to authenticated;
grant select, insert on table public.recebimento_itens to authenticated;

alter table public.recebimentos enable row level security;
alter table public.recebimento_itens enable row level security;

create policy "Equipe ativa consulta recebimentos"
on public.recebimentos for select to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere recebimentos"
on public.recebimentos for insert to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa atualiza recebimentos"
on public.recebimentos for update to authenticated
using ((select private.usuario_atual_pode_gerir_familias()))
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta recebimento itens"
on public.recebimento_itens for select to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere recebimento itens"
on public.recebimento_itens for insert to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

-- RPC transacional: grava o cabeçalho e os itens (jsonb) numa só operação.
-- Itens sem nome ou com quantidade não positiva são ignorados.
create function public.criar_recebimento(
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
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode registrar recebimentos.'
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

comment on function public.criar_recebimento(
  date,
  public.recebimento_origem,
  text,
  text,
  numeric,
  text,
  jsonb
) is
  'Registra um recebimento (cabeçalho + itens) numa transação. Não gera entrada de estoque nesta etapa.';

revoke execute on function public.criar_recebimento(
  date, public.recebimento_origem, text, text, numeric, text, jsonb
) from public;
revoke execute on function public.criar_recebimento(
  date, public.recebimento_origem, text, text, numeric, text, jsonb
) from anon;
revoke execute on function public.criar_recebimento(
  date, public.recebimento_origem, text, text, numeric, text, jsonb
) from authenticated;
grant execute on function public.criar_recebimento(
  date, public.recebimento_origem, text, text, numeric, text, jsonb
) to authenticated;
