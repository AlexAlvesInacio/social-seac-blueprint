-- Auditoria de estoque e atendimento, decidido com o usuário em 2026-08-06.
--
-- A tela de Auditoria mostrava só o que as telas de cadastro emitem pelo cliente
-- (`registrarAuditoria` em Configurações, Relatórios, Famílias e nas avaliações de
-- assistido). Movimentação de estoque, montagem, recebimento, entrega e tentativa
-- bloqueada **não geravam evento nenhum** — o usuário deu entrada num item, deu
-- saída numa cesta e a tela ficou vazia. A tela funcionava; não havia o que mostrar.
--
-- Duas escolhas de desenho:
--
-- 1. **Trigger, não chamada nas RPCs.** Auditar por AFTER INSERT nas tabelas de
--    fato (os dois ledgers, entregas, tentativas, recebimentos) cobre todo caminho
--    de escrita de uma vez, inclusive os que ainda não existem, e não exige
--    reescrever o corpo de seis RPCs — cada reescrita seria uma chance de
--    corromper regra de negócio já homologada.
--
-- 2. **`security definer` no gravador.** A policy de INSERT em `auditoria_eventos`
--    exige `usuario_atual_pode_gerir_familias()` (administrador + atendente), mas
--    quem movimenta estoque pode ser o papel `estoque`. Auditar pelo caminho normal
--    faria a movimentação dele falhar na trilha e derrubar a operação inteira. O
--    gravador roda como definer e o guard de quem pode movimentar continua sendo
--    das RPCs, não da auditoria.
--
-- A trilha continua imutável: seguem sem UPDATE/DELETE para os papéis operacionais.

-- ---------------------------------------------------------------------------
-- Gravador único
-- ---------------------------------------------------------------------------

create or replace function private.auditar_evento(
  p_acao text,
  p_modulo text,
  p_registro text default null,
  p_observacao text default null,
  p_contexto jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
begin
  -- Sem usuário identificado não há autoria possível, e `criado_por` é NOT NULL.
  -- Silenciar aqui é deliberado: auditoria nunca pode derrubar a operação que a
  -- originou. Sem isso, uma carga histórica ou um job sem sessão quebraria a
  -- entrega inteira por causa da trilha.
  if v_usuario is null then
    return;
  end if;

  if not exists (select 1 from public.profiles as p where p.id = v_usuario) then
    return;
  end if;

  insert into public.auditoria_eventos (acao, modulo, registro, observacao, contexto, criado_por)
  values (p_acao, p_modulo, p_registro, p_observacao, p_contexto, v_usuario);
end;
$$;

comment on function private.auditar_evento(text, text, text, text, jsonb) is
  'Grava evento na trilha imutável. SECURITY DEFINER para que o papel estoque também consiga auditar; não audita quando não há usuário identificado, para nunca derrubar a operação de origem.';

revoke all on function private.auditar_evento(text, text, text, text, jsonb) from public;
revoke all on function private.auditar_evento(text, text, text, text, jsonb) from anon;
revoke all on function private.auditar_evento(text, text, text, text, jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- Estoque: ledger de benefícios
-- ---------------------------------------------------------------------------

create or replace function private.auditar_movimentacao_estoque()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_beneficio text;
begin
  select b.nome into v_beneficio from public.beneficios as b where b.id = new.beneficio_id;

  perform private.auditar_evento(
    case
      when new.entrega_id is not null then 'Baixa automática por entrega'
      when new.motivo = 'Montagem de cesta' then 'Cestas montadas'
      else 'Movimentação de benefício: ' || new.tipo::text
    end,
    'Estoque › Benefícios',
    v_beneficio,
    new.motivo,
    pg_catalog.jsonb_build_object(
      'tipo', new.tipo,
      'quantidade', new.quantidade,
      'saldo_resultante', new.saldo_resultante,
      'beneficio_id', new.beneficio_id,
      'observacao', new.observacao
    )
  );
  return null;
end;
$$;

drop trigger if exists movimentacoes_estoque_auditar on public.movimentacoes_estoque;
create trigger movimentacoes_estoque_auditar
after insert on public.movimentacoes_estoque
for each row execute function private.auditar_movimentacao_estoque();

-- ---------------------------------------------------------------------------
-- Estoque: ledger de itens
-- ---------------------------------------------------------------------------

create or replace function private.auditar_movimentacao_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item text;
  v_unidade text;
begin
  select i.nome, i.unidade into v_item, v_unidade
  from public.itens_estoque as i
  where i.id = new.item_id;

  perform private.auditar_evento(
    case
      when new.motivo = 'Montagem de cesta' then 'Consumo de item na montagem'
      when new.motivo = 'Entrada por recebimento' then 'Entrada de item por recebimento'
      else 'Movimentação de item: ' || new.tipo::text
    end,
    'Estoque › Itens',
    v_item,
    new.motivo,
    pg_catalog.jsonb_build_object(
      'tipo', new.tipo,
      'quantidade', new.quantidade,
      'saldo_resultante', new.saldo_resultante,
      'unidade', v_unidade,
      'item_id', new.item_id,
      'observacao', new.observacao
    )
  );
  return null;
end;
$$;

drop trigger if exists movimentacoes_itens_auditar on public.movimentacoes_itens;
create trigger movimentacoes_itens_auditar
after insert on public.movimentacoes_itens
for each row execute function private.auditar_movimentacao_item();

-- ---------------------------------------------------------------------------
-- Atendimento: entregas
-- ---------------------------------------------------------------------------

create or replace function private.auditar_entrega()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa text;
  v_beneficio text;
begin
  select p.nome into v_pessoa from public.pessoas as p where p.id = new.pessoa_id;
  select b.nome into v_beneficio from public.beneficios as b where b.id = new.beneficio_id;

  perform private.auditar_evento(
    case
      when new.excepcional then 'Entrega com liberação excepcional'
      when new.origem = 'pre_cadastro'::public.entrega_origem then 'Entrega em pré-cadastro'
      else 'Entrega registrada'
    end,
    'Atendimento › Entregas',
    v_pessoa,
    new.observacao,
    pg_catalog.jsonb_build_object(
      'beneficio', v_beneficio,
      'quantidade', new.quantidade,
      'excepcional', new.excepcional,
      'origem', new.origem,
      'assistido_id', new.assistido_id,
      'familia_id', new.familia_id,
      'autorizado_por', new.autorizado_por
    )
  );
  return null;
end;
$$;

drop trigger if exists entregas_auditar on public.entregas;
create trigger entregas_auditar
after insert on public.entregas
for each row execute function private.auditar_entrega();

-- ---------------------------------------------------------------------------
-- Atendimento: tentativas bloqueadas
-- ---------------------------------------------------------------------------

create or replace function private.auditar_tentativa_bloqueada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa text;
  v_beneficio text;
begin
  select p.nome into v_pessoa from public.pessoas as p where p.id = new.pessoa_id;
  select b.nome into v_beneficio from public.beneficios as b where b.id = new.beneficio_id;

  perform private.auditar_evento(
    'Tentativa bloqueada: ' || new.motivo::text,
    'Atendimento › Bloqueios',
    v_pessoa,
    new.observacao,
    pg_catalog.jsonb_build_object(
      'motivo', new.motivo,
      'beneficio', v_beneficio,
      'assistido_id', new.assistido_id,
      'familia_id', new.familia_id
    )
  );
  return null;
end;
$$;

drop trigger if exists tentativas_bloqueadas_auditar on public.tentativas_bloqueadas;
create trigger tentativas_bloqueadas_auditar
after insert on public.tentativas_bloqueadas
for each row execute function private.auditar_tentativa_bloqueada();

-- ---------------------------------------------------------------------------
-- Recebimentos
-- ---------------------------------------------------------------------------

create or replace function private.auditar_recebimento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.auditar_evento(
    'Recebimento registrado',
    'Recebimentos',
    new.parte,
    new.observacao,
    pg_catalog.jsonb_build_object(
      'origem', new.origem,
      'data', new.data,
      'valor', new.valor,
      'documento', new.documento
    )
  );
  return null;
end;
$$;

drop trigger if exists recebimentos_auditar on public.recebimentos;
create trigger recebimentos_auditar
after insert on public.recebimentos
for each row execute function private.auditar_recebimento();
