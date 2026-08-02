-- Transferência de pessoa entre famílias ativas (issue #50, parte 2).
--
-- Até aqui o cadastro recusava com SEAP1 quando a pessoa já era membro ativo de
-- outra família: reutilizar a pessoa noutra família seria transferência, e
-- transferência não existia. Esta migration cria a operação.
--
-- Regras aprovadas com o usuário em 2026-08-02:
--
--   1. Prazo de 25 dias e limite de Cestas Extra acompanham a PESSOA — já
--      resolvido na migration 20260802180000, que é pré-requisito desta. Sem
--      ela, transferir zeraria os dois contadores.
--   2. O vínculo de assistido da origem é inativado; no destino a pessoa entra
--      apenas como MEMBRO. Continuar recebendo benefício exige um cadastro novo
--      de assistido, avaliado na família de destino.
--   3. Transferir quem é responsável principal da origem é recusado, para não
--      deixar uma família sem responsável. É preciso designar outro antes.
--   4. Só administrador ativo, com motivo obrigatório. O motivo é gravado na
--      auditoria pela própria RPC — e não pelo cliente — para que não exista
--      transferência sem justificativa registrada, mesmo se a tela falhar entre
--      uma chamada e outra.

create function public.transferir_pessoa_entre_familias(
  p_pessoa_id uuid,
  p_familia_destino_id uuid,
  p_motivo text,
  p_parentesco text default null
)
returns table (
  membro_id uuid,
  familia_origem_id uuid,
  familia_origem_nome text,
  familia_destino_nome text,
  assistido_inativado boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_parentesco text := nullif(pg_catalog.btrim(coalesce(p_parentesco, '')), '');
  v_pessoa_nome text;
  v_origem_id uuid;
  v_origem_nome text;
  v_destino_nome text;
  v_membro_origem_id uuid;
  v_responsavel boolean;
  v_outros_membros integer;
  v_membro_destino_id uuid;
  v_assistido_id uuid;
begin
  if v_usuario_id is null or not private.usuario_atual_e_administrador_ativo() then
    raise exception 'Apenas administrador ativo pode transferir uma pessoa entre famílias.'
      using errcode = '42501';
  end if;

  if v_motivo = '' then
    raise exception 'O motivo da transferência é obrigatório.' using errcode = '22023';
  end if;

  select p.nome into v_pessoa_nome from public.pessoas as p where p.id = p_pessoa_id;
  if not found then
    raise exception 'Pessoa não encontrada.' using errcode = 'P0002';
  end if;

  -- Vínculo ativo de origem: sem ele não é transferência, é cadastro comum.
  select m.id, m.familia_id, m.responsavel_principal
  into v_membro_origem_id, v_origem_id, v_responsavel
  from public.membros_familiares as m
  where m.pessoa_id = p_pessoa_id
    and m.status = 'ativo'::public.membro_familiar_status;

  if not found then
    raise exception 'Esta pessoa não é membro ativo de nenhuma família; use o cadastro comum.'
      using errcode = 'SEAT1';
  end if;

  if v_origem_id = p_familia_destino_id then
    raise exception 'A família de destino é a mesma de origem.' using errcode = '22023';
  end if;

  select f.nome_referencia into v_origem_nome
  from public.familias as f where f.id = v_origem_id;

  select f.nome_referencia into v_destino_nome
  from public.familias as f where f.id = p_familia_destino_id;
  if not found then
    raise exception 'Família de destino não encontrada.' using errcode = 'P0002';
  end if;

  -- Regra 3: a origem não pode ficar sem responsável principal.
  if v_responsavel then
    select count(*) into v_outros_membros
    from public.membros_familiares as m
    where m.familia_id = v_origem_id
      and m.status = 'ativo'::public.membro_familiar_status
      and m.id <> v_membro_origem_id;

    raise exception
      'A pessoa é responsável principal da família "%" (% outro(s) membro(s) ativo(s)). Defina outro responsável antes de transferir.',
      v_origem_nome, v_outros_membros
      using errcode = 'SEAT2';
  end if;

  -- Regra 2: o vínculo de assistido não acompanha a transferência.
  update public.assistidos
  set status = 'inativo'::public.assistido_status
  where pessoa_id = p_pessoa_id
    and status = 'ativo'::public.assistido_status
  returning id into v_assistido_id;

  update public.membros_familiares
  set status = 'inativo'::public.membro_familiar_status
  where id = v_membro_origem_id;

  -- A pessoa pode já ter passado por esta família antes: a unicidade é
  -- (familia_id, pessoa_id), então reativa-se o vínculo em vez de inserir.
  insert into public.membros_familiares (familia_id, pessoa_id, parentesco)
  values (p_familia_destino_id, p_pessoa_id, v_parentesco)
  on conflict (familia_id, pessoa_id) do update
    set status = 'ativo'::public.membro_familiar_status,
        parentesco = coalesce(excluded.parentesco, public.membros_familiares.parentesco),
        responsavel_principal = false
  returning id into v_membro_destino_id;

  insert into public.auditoria_eventos (acao, modulo, registro, observacao, contexto)
  values (
    'Transferência entre famílias',
    'familias',
    v_pessoa_nome,
    v_motivo,
    pg_catalog.jsonb_build_object(
      'pessoa_id', p_pessoa_id,
      'familia_origem_id', v_origem_id,
      'familia_origem', v_origem_nome,
      'familia_destino_id', p_familia_destino_id,
      'familia_destino', v_destino_nome,
      'assistido_inativado', v_assistido_id is not null
    )
  );

  return query select
    v_membro_destino_id, v_origem_id, v_origem_nome, v_destino_nome,
    v_assistido_id is not null;
end;
$$;

comment on function public.transferir_pessoa_entre_familias(uuid, uuid, text, text) is
  'Transfere uma pessoa para outra família: inativa o vínculo de membro e o de assistido na origem, ativa o membro no destino e registra a auditoria com o motivo. Só administrador ativo; recusa quem é responsável principal da origem (SEAT2).';

revoke execute on function public.transferir_pessoa_entre_familias(uuid, uuid, text, text) from public;
revoke execute on function public.transferir_pessoa_entre_familias(uuid, uuid, text, text) from anon;
grant execute on function public.transferir_pessoa_entre_familias(uuid, uuid, text, text) to authenticated;
