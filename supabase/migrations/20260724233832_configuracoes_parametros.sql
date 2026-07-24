-- Parâmetros de configuração no banco (docs/03: configuracoes). Substitui o
-- protótipo em localStorage (config-store, useParametros) por uma linha única
-- autoritativa. Os limites numéricos (intervalo de 25 dias e limite de extras)
-- passam a ser lidos pela RPC de atendimento — deixam de ser constantes no código.
--
-- As regras não-negociáveis (estoque sempre bloqueia; liberação excepcional só por
-- administrador; observação obrigatória) permanecem fixas no servidor; os flags
-- correspondentes ficam persistidos por transparência, mas NÃO enfraquecem o
-- enforcement.

-- ============================================================================
-- Tabela (linha única) + seed
-- ============================================================================

create table public.configuracoes (
  id integer primary key default 1,
  intervalo_minimo_dias integer not null default 25,
  alerta_liberado_sem_retirada_dias integer not null default 45,
  limite_extra integer not null default 3,
  apos_limite_extra text not null default 'Avaliar cadastro definitivo',
  inatividade_contato_dias integer not null default 90,
  liberacao_excepcional text not null default 'admin',
  bloqueio_sem_estoque boolean not null default true,
  observacao_obrigatoria_liberacao boolean not null default true,
  auditoria_ativa boolean not null default true,
  baixa_automatica boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id) on delete restrict,
  atualizado_por uuid references public.profiles (id) on delete restrict,
  constraint configuracoes_singleton_check check (id = 1),
  constraint configuracoes_intervalo_positivo_check check (intervalo_minimo_dias > 0),
  constraint configuracoes_limite_extra_positivo_check check (limite_extra > 0),
  constraint configuracoes_liberacao_check
    check (liberacao_excepcional in ('admin', 'admin_atendente'))
);

comment on table public.configuracoes is
  'Parâmetros de regra do sistema (linha única, id=1). intervalo_minimo_dias e limite_extra são autoritativos no atendimento.';

insert into public.configuracoes (id) values (1);

-- Gatilho de auditoria (após o seed; preenche atualizado_por em cada alteração).
create trigger configuracoes_definir_auditoria
before insert or update on public.configuracoes
for each row execute function private.definir_auditoria_registro();

-- ============================================================================
-- Grants + RLS: todos consultam; só administrador altera.
-- ============================================================================

revoke all on table public.configuracoes from anon;
grant select, update on table public.configuracoes to authenticated;

alter table public.configuracoes enable row level security;

create policy "Equipe ativa consulta configuracoes" on public.configuracoes
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Administrador altera configuracoes" on public.configuracoes
  for update to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()))
  with check ((select private.usuario_atual_e_administrador_ativo()));

-- ============================================================================
-- RPC de entrega: lê intervalo/limite da configuração (autoritativo).
-- Reaplica registrar_entrega_atendimento (CREATE OR REPLACE, mesmo retorno);
-- única mudança em relação a 20260724221323: v_intervalo/v_limite_extra deixam de
-- ser constantes e são carregados de public.configuracoes (fallback 25/3).
-- ============================================================================

create or replace function public.registrar_entrega_atendimento(
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
  v_intervalo integer := 25;
  v_limite_extra integer := 3;
  v_observacao text := nullif(pg_catalog.btrim(p_observacao), '');
  v_entrega_id uuid;
  v_tentativa_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode registrar entregas.'
      using errcode = '42501';
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

  -- 2) Intervalo mínimo — liberável apenas por administrador com motivo.
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
