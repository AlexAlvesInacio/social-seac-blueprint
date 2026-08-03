-- Carga histórica de entregas: importa retiradas passadas com a data real.
--
-- Contexto em docs/13_IMPORTACAO_PLANILHA_LEGADA.md. A planilha da SEAC tem
-- 4.252 retiradas de 2026 com data. Importá-las faz a regra dos 25 dias valer
-- desde o primeiro atendimento no sistema: 657 pessoas retiraram nos últimos 25
-- dias e devem continuar bloqueadas.
--
-- `registrar_entrega_atendimento` não serve, por três motivos:
--   * recusaria retiradas com menos de 25 dias entre si — justamente as que
--     precisamos importar;
--   * debitaria o estoque, e o saldo atual já reflete essas saídas;
--   * gravaria a data de hoje, não a do registro antigo.
--
-- Daí uma RPC própria, restrita a administrador, que não aplica regra nenhuma e
-- não toca no estoque. É ferramenta de migração, não de operação.

-- ============================================================================
-- 1) Chave de origem: distingue e torna a reimportação idempotente
-- ============================================================================
-- Guarda o campo UNICO da planilha (`RG-sequência-ano`, ex.: 130132482-1-2026).
-- Serve para dois fins: separar no histórico o que veio da planilha do que foi
-- atendido pelo sistema, e permitir rodar a importação de novo sem duplicar —
-- o que importa porque a primeira execução vai gerar rejeitados a corrigir.
--
-- Preferido a um valor novo no enum `entrega_origem` porque um `alter type add
-- value` não pode ser usado na mesma transação em que é criado, o que
-- impediria testar a carga antes de aplicar.

alter table public.entregas add column origem_externa text;

comment on column public.entregas.origem_externa is
  'Chave do registro na fonte externa (campo UNICO da planilha legada). Nula em entregas registradas pelo próprio sistema.';

create unique index entregas_origem_externa_key
  on public.entregas (origem_externa)
  where origem_externa is not null;

-- ============================================================================
-- 2) O trigger de autoria passa a aceitar data histórica
-- ============================================================================
-- Corpo idêntico ao vigente; muda só o ramo de INSERT.

CREATE OR REPLACE FUNCTION private.definir_autoria_registro_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Usuário autenticado é obrigatório para registrar a operação.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- Na carga histórica a data vem do registro antigo, não do relógio. O flag
    -- só é ligado por carregar_entrega_historica, que exige administrador; e a
    -- data precisa ser passada, senão cai no comportamento normal.
    if coalesce(current_setting('seac.carga_historica', true), '') = 'on'
       and new.criado_em is not null
       and new.criado_em <= now() then
      null;  -- preserva new.criado_em como veio
    else
      new.criado_em := now();
    end if;
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
$function$

;

comment on function private.definir_autoria_registro_insert() is
  'Carimba autoria e data na criação. Na carga histórica (flag seac.carga_historica) preserva a data informada, desde que não seja futura.';

-- ============================================================================
-- 3) A RPC de carga
-- ============================================================================

create function public.carregar_entrega_historica(
  p_assistido_id uuid,
  p_beneficio_nome text,
  p_data timestamptz,
  p_origem_externa text,
  p_observacao text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_familia_id uuid;
  v_pessoa_id uuid;
  v_beneficio_id uuid;
  v_chave text := nullif(pg_catalog.btrim(coalesce(p_origem_externa, '')), '');
  v_entrega_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_e_administrador_ativo() then
    raise exception 'Apenas administrador ativo pode carregar entregas históricas.'
      using errcode = '42501';
  end if;

  if v_chave is null then
    raise exception 'A chave de origem é obrigatória: sem ela a reimportação duplicaria as entregas.'
      using errcode = '22023';
  end if;

  if p_data is null or p_data > now() then
    raise exception 'A data da entrega histórica é obrigatória e não pode ser futura.'
      using errcode = '22023';
  end if;

  -- Já importada: devolve o id existente em vez de duplicar. É o que torna a
  -- importação repetível depois de corrigir os rejeitados.
  select e.id into v_entrega_id
  from public.entregas as e where e.origem_externa = v_chave;
  if found then
    return v_entrega_id;
  end if;

  select a.familia_id, a.pessoa_id into v_familia_id, v_pessoa_id
  from public.assistidos as a where a.id = p_assistido_id;
  if not found then
    raise exception 'Assistido não encontrado.' using errcode = 'P0002';
  end if;

  select b.id into v_beneficio_id
  from public.beneficios as b where b.nome = p_beneficio_nome;
  if not found then
    raise exception 'Benefício "%" não cadastrado.', p_beneficio_nome using errcode = 'P0002';
  end if;

  -- Os dois flags: um libera o trigger que exige entrega via RPC de
  -- atendimento, o outro preserva a data informada.
  perform set_config('seac.atendimento_via_rpc', 'on', true);
  perform set_config('seac.carga_historica', 'on', true);

  insert into public.entregas (
    assistido_id, familia_id, pessoa_id, beneficio_id,
    origem, excepcional, observacao, criado_em, origem_externa
  )
  values (
    p_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
    'atendimento'::public.entrega_origem, false,
    nullif(pg_catalog.btrim(coalesce(p_observacao, '')), ''),
    p_data, v_chave
  )
  returning id into v_entrega_id;

  -- Desliga já: `set_config` com is_local vale até o fim da transação, e a
  -- carga roda em lote. Sem isto, qualquer inserção posterior na mesma
  -- transação ainda poderia gravar data informada em vez da de agora.
  perform set_config('seac.carga_historica', 'off', true);

  return v_entrega_id;
end;
$$;

comment on function public.carregar_entrega_historica(uuid, text, timestamptz, text, text) is
  'Importa uma entrega passada com a data original, sem aplicar as regras de atendimento e sem movimentar estoque. Só administrador. Idempotente pela chave de origem.';

revoke execute on function public.carregar_entrega_historica(uuid, text, timestamptz, text, text) from public;
revoke execute on function public.carregar_entrega_historica(uuid, text, timestamptz, text, text) from anon;
grant execute on function public.carregar_entrega_historica(uuid, text, timestamptz, text, text) to authenticated;
