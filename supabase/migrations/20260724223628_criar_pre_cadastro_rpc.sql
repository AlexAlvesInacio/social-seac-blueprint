-- Pré-cadastro de assistido a partir do atendimento (regras REGRAS_ATENDIMENTO_SEAC.md
-- §3/§4/§6): quando a busca não encontra ninguém, permite criar um assistido novo
-- (tipo "extra") e, opcionalmente, já entregar uma Cesta Extra.
--
-- Restrição de schema: assistidos exige familia_id + membro_familiar_id (NOT NULL,
-- FK composta) — não existe assistido avulso. Por isso o pré-cadastro cria uma
-- FAMÍLIA IMPLÍCITA (o próprio pré-cadastrado como responsável), conforme
-- docs/02_REGRAS_NEGOCIO.md (o pré-cadastro pode criar uma nova família). Tudo numa
-- transação; qualquer exceção reverte todos os INSERTs.
--
-- Variante com entrega (p_entregar = true): grava a entrega com origem
-- 'pre_cadastro', baixa o saldo da Cesta Extra e registra a baixa no ledger — igual
-- ao fluxo de atendimento (migrations 20260724220332/20260724221323). Se faltar
-- estoque, o pré-cadastro é criado assim mesmo, a entrega é pulada e registra-se
-- uma tentativa por estoque (docs/02: falta de estoque impede a entrega, não o
-- registro coerente).
--
--   status ∈ { criado, criado_e_entregue, criado_sem_estoque }
--   entrega_id / saldo_resultante -> preenchidos quando entregue
--   tentativa_id                  -> preenchido quando 'criado_sem_estoque'
--
-- A 1ª entrega de pré-cadastro (Cesta Extra) conta como 1/3 no limite de extras,
-- pois a contagem de extras em registrar_entrega_atendimento não filtra por origem.

create function public.criar_pre_cadastro(
  p_nome text,
  p_tipo_documento public.pessoa_tipo_documento,
  p_documento text,
  p_telefone text default null,
  p_nascimento date default null,
  p_pcd boolean default false,
  p_entregar boolean default false,
  p_observacao text default null
)
returns table (
  status text,
  familia_id uuid,
  assistido_id uuid,
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
  v_nome text := pg_catalog.btrim(p_nome);
  v_documento text := pg_catalog.btrim(p_documento);
  v_observacao text := nullif(pg_catalog.btrim(p_observacao), '');
  v_pessoa_id uuid;
  v_familia_id uuid;
  v_membro_id uuid;
  v_assistido_id uuid;
  v_beneficio_id uuid;
  v_saldo integer;
  v_controla boolean;
  v_entrega_id uuid;
  v_tentativa_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_pode_gerir_familias() then
    raise exception 'Apenas administrador ou atendente ativo pode criar pré-cadastro.'
      using errcode = '42501';
  end if;

  if v_nome is null or v_nome = '' then
    raise exception 'O nome é obrigatório.' using errcode = '22023';
  end if;
  if p_tipo_documento is null then
    raise exception 'O tipo de documento é obrigatório.' using errcode = '22023';
  end if;
  if v_documento is null or v_documento = '' then
    raise exception 'O documento é obrigatório.' using errcode = '22023';
  end if;

  -- Pessoa (o trigger pessoas_normalizar_documento normaliza antes do ON CONFLICT).
  insert into public.pessoas (nome, tipo_documento, documento, telefone, nascimento, pcd)
  values (
    v_nome, p_tipo_documento, v_documento,
    nullif(pg_catalog.btrim(p_telefone), ''), p_nascimento, coalesce(p_pcd, false)
  )
  on conflict on constraint pessoas_documento_normalizado_key do nothing
  returning id into v_pessoa_id;

  if v_pessoa_id is null then
    raise exception 'Já existe uma pessoa cadastrada com este documento.'
      using
        errcode = '23505',
        detail = 'O pré-cadastro foi cancelado sem alterar pessoa, família ou assistido.',
        hint = 'A reutilização de pessoa/família existente permanece fora do escopo desta RPC.';
  end if;

  -- Família implícita (o próprio pré-cadastrado como referência e responsável).
  insert into public.familias (nome_referencia, status, acompanhamento)
  values (v_nome, 'liberado'::public.familia_status, 'em_dia'::public.familia_acompanhamento)
  returning id into v_familia_id;

  insert into public.membros_familiares (
    familia_id, pessoa_id, parentesco, responsavel_principal, status
  )
  values (
    v_familia_id, v_pessoa_id, 'Responsável', true, 'ativo'::public.membro_familiar_status
  )
  returning id into v_membro_id;

  insert into public.assistidos (
    familia_id, pessoa_id, membro_familiar_id, tipo_cadastro, beneficio, status
  )
  values (
    v_familia_id, v_pessoa_id, v_membro_id,
    'extra'::public.assistido_tipo_cadastro, 'Cesta Extra', 'ativo'::public.assistido_status
  )
  returning id into v_assistido_id;

  -- Só o pré-cadastro.
  if not coalesce(p_entregar, false) then
    return query select
      'criado'::text, v_familia_id, v_assistido_id,
      null::uuid, null::text, null::integer, null::uuid;
    return;
  end if;

  -- Pré-cadastro + entrega de Cesta Extra.
  select b.id, b.saldo, b.controla_estoque
  into v_beneficio_id, v_saldo, v_controla
  from public.beneficios as b
  where b.nome = 'Cesta Extra'
  for update;

  if not found then
    raise exception 'Benefício "Cesta Extra" não cadastrado.' using errcode = 'P0002';
  end if;

  -- Sem estoque: pré-cadastro permanece criado; entrega é pulada; registra tentativa.
  if v_controla and v_saldo <= 0 then
    insert into public.tentativas_bloqueadas (
      assistido_id, familia_id, pessoa_id, beneficio_id, motivo, observacao
    )
    values (
      v_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
      'estoque'::public.tentativa_motivo, v_observacao
    )
    returning id into v_tentativa_id;
    return query select
      'criado_sem_estoque'::text, v_familia_id, v_assistido_id,
      null::uuid, 'Cesta Extra'::text, v_saldo, v_tentativa_id;
    return;
  end if;

  insert into public.entregas (
    assistido_id, familia_id, pessoa_id, beneficio_id, origem, excepcional, observacao
  )
  values (
    v_assistido_id, v_familia_id, v_pessoa_id, v_beneficio_id,
    'pre_cadastro'::public.entrega_origem, false, v_observacao
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
    -1, v_saldo, 'Baixa automática', 'Entrega de pré-cadastro', v_entrega_id
  );

  return query select
    'criado_e_entregue'::text, v_familia_id, v_assistido_id,
    v_entrega_id, 'Cesta Extra'::text, v_saldo, null::uuid;
end;
$$;

comment on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text
) is
  'Cria pré-cadastro (família implícita + pessoa + membro responsável + assistido extra) e, se p_entregar, entrega Cesta Extra (origem pre_cadastro) com baixa e ledger; sem estoque, cria o pré-cadastro e registra tentativa. Transacional.';

revoke execute on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text
) from public;
revoke execute on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text
) from anon;
revoke execute on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text
) from authenticated;
grant execute on function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text
) to authenticated;
