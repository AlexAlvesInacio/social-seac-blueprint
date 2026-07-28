-- Edição de membro familiar (dados da pessoa + vínculo), exceto documento.
--
-- Homologação #43: não havia como corrigir os dados de um membro após o cadastro
-- (nascimento, telefone, parentesco, PCD, gestante, nome). Esta RPC atualiza a
-- PESSOA (nome, telefone, nascimento, pcd) e o VÍNCULO (parentesco, gestante) na
-- mesma transação. O documento NÃO é alterado (identidade única). Administrador ou
-- atendente ativo. SECURITY INVOKER: passa pelas policies "Equipe ativa atualiza
-- pessoas" e "Equipe ativa atualiza membros familiares".

create function public.atualizar_membro_familiar(
  p_membro_familiar_id uuid,
  p_nome text,
  p_parentesco text default null,
  p_telefone text default null,
  p_nascimento date default null,
  p_pcd boolean default false,
  p_gestante boolean default false
)
returns table (
  membro_familiar_id uuid,
  familia_id uuid,
  pessoa_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_nome text := pg_catalog.btrim(p_nome);
  v_pessoa_id uuid;
  v_familia_id uuid;
begin
  if v_usuario_id is null
    or not private.usuario_atual_pode_gerir_familias()
  then
    raise exception 'Apenas administrador ou atendente ativo pode editar membros.'
      using errcode = '42501';
  end if;

  if v_nome = '' then
    raise exception 'O nome é obrigatório.'
      using errcode = '22023';
  end if;

  select m.pessoa_id, m.familia_id
  into v_pessoa_id, v_familia_id
  from public.membros_familiares as m
  where m.id = p_membro_familiar_id;

  if not found then
    raise exception 'Membro não encontrado.'
      using errcode = 'P0002';
  end if;

  update public.pessoas as p
  set
    nome = v_nome,
    telefone = nullif(pg_catalog.btrim(p_telefone), ''),
    nascimento = p_nascimento,
    pcd = coalesce(p_pcd, false)
  where p.id = v_pessoa_id;

  update public.membros_familiares as m
  set
    parentesco = nullif(pg_catalog.btrim(p_parentesco), ''),
    gestante = coalesce(p_gestante, false)
  where m.id = p_membro_familiar_id;

  return query
  select p_membro_familiar_id, v_familia_id, v_pessoa_id;
end;
$$;

comment on function public.atualizar_membro_familiar(uuid, text, text, text, date, boolean, boolean) is
  'Edita nome/telefone/nascimento/PCD da pessoa e parentesco/gestante do vínculo de um membro. Não altera o documento. Administrador ou atendente ativo.';

revoke execute on function public.atualizar_membro_familiar(uuid, text, text, text, date, boolean, boolean) from public;
revoke execute on function public.atualizar_membro_familiar(uuid, text, text, text, date, boolean, boolean) from anon;
revoke execute on function public.atualizar_membro_familiar(uuid, text, text, text, date, boolean, boolean) from authenticated;
grant execute on function public.atualizar_membro_familiar(uuid, text, text, text, date, boolean, boolean) to authenticated;
