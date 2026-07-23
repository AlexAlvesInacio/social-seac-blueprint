-- Fatia 1 de Atendimento no Supabase: benefícios (estoque mínimo), entregas,
-- tentativas bloqueadas e RPCs transacionais que reaplicam a elegibilidade no
-- servidor. Enforcement autoritativo dos valores oficiais (25 dias / 3 extras,
-- fonte REGRAS_ATENDIMENTO_SEAC.md); overrides de config são só de exibição.
-- Ledger de movimentações de estoque e recebimentos ficam para etapas futuras;
-- nesta fatia a tabela entregas é o próprio registro da baixa.

-- Enums de domínio.
create type public.entrega_origem as enum ('atendimento', 'pre_cadastro');
create type public.tentativa_motivo as enum ('prazo', 'estoque');

-- Autoria insert-only genérica para registros de atendimento (não editáveis).
create function private.definir_autoria_registro_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Usuário autenticado é obrigatório para registrar a operação.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.criado_por := v_usuario_id;
  else
    if new.id is distinct from old.id then
      raise exception 'O identificador do registro não pode ser alterado.';
    end if;
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  end if;

  return new;
end;
$$;

revoke execute on function private.definir_autoria_registro_insert() from public;
revoke execute on function private.definir_autoria_registro_insert() from anon;
revoke execute on function private.definir_autoria_registro_insert() from authenticated;

-- Catálogo de benefícios com saldo simples (estoque mínimo desta fatia).
-- Sem colunas de autoria: é dado de referência, semeado na própria migration.
create table public.beneficios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  saldo integer not null default 0,
  controla_estoque boolean not null default true,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint beneficios_nome_key unique (nome),
  constraint beneficios_nome_obrigatorio_check check (btrim(nome) <> ''),
  constraint beneficios_saldo_nao_negativo_check check (saldo >= 0)
);

comment on table public.beneficios is
  'Catálogo de benefícios entregáveis com saldo simples de estoque; o ledger de movimentações fica para etapa futura.';

-- Seed antes de policies/grants de escrita; sem depender de auth.uid().
insert into public.beneficios (nome, saldo) values
  ('Cesta Padrão', 120),
  ('Cesta Extra', 25),
  ('Kit Gestante', 8);

-- Entregas efetivadas (insert-only). FK composta garante que assistido,
-- família e pessoa são a mesma identidade cadastrada.
create table public.entregas (
  id uuid primary key default gen_random_uuid(),
  assistido_id uuid not null,
  familia_id uuid not null references public.familias (id) on delete restrict,
  pessoa_id uuid not null references public.pessoas (id) on delete restrict,
  beneficio_id uuid not null references public.beneficios (id) on delete restrict,
  origem public.entrega_origem not null default 'atendimento',
  excepcional boolean not null default false,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid not null references public.profiles (id) on delete restrict,
  constraint entregas_assistido_familia_pessoa_fkey
    foreign key (assistido_id, familia_id, pessoa_id)
    references public.assistidos (id, familia_id, pessoa_id)
    on delete restrict
);

create index entregas_assistido_data_idx on public.entregas (assistido_id, criado_em desc);
create index entregas_familia_id_idx on public.entregas (familia_id);
create index entregas_beneficio_id_idx on public.entregas (beneficio_id);
create index entregas_criado_por_idx on public.entregas (criado_por);

create trigger entregas_definir_autoria
before insert or update on public.entregas
for each row execute function private.definir_autoria_registro_insert();

-- Tentativas de atendimento impedidas (insert-only).
create table public.tentativas_bloqueadas (
  id uuid primary key default gen_random_uuid(),
  assistido_id uuid not null,
  familia_id uuid not null references public.familias (id) on delete restrict,
  pessoa_id uuid not null references public.pessoas (id) on delete restrict,
  beneficio_id uuid references public.beneficios (id) on delete restrict,
  motivo public.tentativa_motivo not null,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid not null references public.profiles (id) on delete restrict,
  constraint tentativas_assistido_familia_pessoa_fkey
    foreign key (assistido_id, familia_id, pessoa_id)
    references public.assistidos (id, familia_id, pessoa_id)
    on delete restrict
);

create index tentativas_assistido_data_idx
  on public.tentativas_bloqueadas (assistido_id, criado_em desc);
create index tentativas_motivo_idx on public.tentativas_bloqueadas (motivo);

create trigger tentativas_definir_autoria
before insert or update on public.tentativas_bloqueadas
for each row execute function private.definir_autoria_registro_insert();

-- Grants de tabela: anon sem acesso; authenticated com o mínimo necessário
-- (a proteção real vem das policies RLS + guards das RPCs).
revoke all on table public.beneficios from anon;
revoke all on table public.entregas from anon;
revoke all on table public.tentativas_bloqueadas from anon;
grant select, update on table public.beneficios to authenticated;
grant select, insert on table public.entregas to authenticated;
grant select, insert on table public.tentativas_bloqueadas to authenticated;

-- RLS.
alter table public.beneficios enable row level security;
alter table public.entregas enable row level security;
alter table public.tentativas_bloqueadas enable row level security;

create policy "Equipe ativa consulta beneficios"
on public.beneficios for select to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa atualiza beneficios"
on public.beneficios for update to authenticated
using ((select private.usuario_atual_pode_gerir_familias()))
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta entregas"
on public.entregas for select to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere entregas"
on public.entregas for insert to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta tentativas"
on public.tentativas_bloqueadas for select to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere tentativas"
on public.tentativas_bloqueadas for insert to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

-- RPC transacional de entrega. Reaplica a elegibilidade oficial no servidor e,
-- se liberada, grava a entrega e faz a baixa do saldo na mesma transação.
-- Erros de bloqueio usam SQLSTATEs próprios que o cliente mapeia:
--   SEAC1 = extra completou; SEAC2 = intervalo de 25 dias; SEAC3 = sem estoque.
create function public.registrar_entrega_atendimento(
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

  return query select v_entrega_id, v_beneficio_nome, v_saldo;
end;
$$;

comment on function public.registrar_entrega_atendimento(uuid, boolean, text) is
  'Reaplica a elegibilidade oficial (25 dias / limite extra / estoque) e, se liberada, grava a entrega e baixa o saldo na mesma transação. Liberação excepcional só para administrador com motivo e nunca contorna falta de estoque.';

revoke execute on function public.registrar_entrega_atendimento(uuid, boolean, text) from public;
revoke execute on function public.registrar_entrega_atendimento(uuid, boolean, text) from anon;
revoke execute on function public.registrar_entrega_atendimento(uuid, boolean, text) from authenticated;
grant execute on function public.registrar_entrega_atendimento(uuid, boolean, text) to authenticated;

-- RPC de tentativa bloqueada (registro obrigatório do atendimento impedido).
create function public.registrar_tentativa_bloqueada(
  p_assistido_id uuid,
  p_motivo public.tentativa_motivo,
  p_observacao text default null
)
returns table (
  tentativa_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_familia_id uuid;
  v_pessoa_id uuid;
  v_tipo_cadastro public.assistido_tipo_cadastro;
  v_beneficio_id uuid;
  v_tentativa_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode registrar tentativas.'
      using errcode = '42501';
  end if;

  if p_assistido_id is null then
    raise exception 'O assistido é obrigatório.' using errcode = '22023';
  end if;

  if p_motivo is null then
    raise exception 'O motivo do bloqueio é obrigatório.' using errcode = '22023';
  end if;

  select a.familia_id, a.pessoa_id, a.tipo_cadastro
  into v_familia_id, v_pessoa_id, v_tipo_cadastro
  from public.assistidos as a
  where a.id = p_assistido_id;

  if not found then
    raise exception 'Assistido não encontrado ou sem permissão.' using errcode = 'P0002';
  end if;

  select b.id
  into v_beneficio_id
  from public.beneficios as b
  where b.nome = case v_tipo_cadastro
    when 'definitivo'::public.assistido_tipo_cadastro then 'Cesta Padrão'
    when 'extra'::public.assistido_tipo_cadastro then 'Cesta Extra'
  end;

  insert into public.tentativas_bloqueadas (
    assistido_id, familia_id, pessoa_id, beneficio_id, motivo, observacao
  )
  values (
    p_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id, p_motivo,
    nullif(pg_catalog.btrim(p_observacao), '')
  )
  returning id into v_tentativa_id;

  return query select v_tentativa_id;
end;
$$;

comment on function public.registrar_tentativa_bloqueada(uuid, public.tentativa_motivo, text) is
  'Registra uma tentativa de atendimento impedida (prazo ou estoque) para o assistido informado.';

revoke execute on function public.registrar_tentativa_bloqueada(uuid, public.tentativa_motivo, text) from public;
revoke execute on function public.registrar_tentativa_bloqueada(uuid, public.tentativa_motivo, text) from anon;
revoke execute on function public.registrar_tentativa_bloqueada(uuid, public.tentativa_motivo, text) from authenticated;
grant execute on function public.registrar_tentativa_bloqueada(uuid, public.tentativa_motivo, text) to authenticated;

-- Autoria/timestamps são definidos pelos triggers com auth.uid()/now(); nunca
-- por parâmetro. As RPCs são SECURITY INVOKER: grants e policies já restringem
-- a escrita a administrador ou atendente ativo.
