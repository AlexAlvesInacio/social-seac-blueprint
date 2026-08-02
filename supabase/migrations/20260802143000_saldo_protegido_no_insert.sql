-- Fecha o achado SEG-1 da security review geral (issue #78): o saldo podia
-- nascer inflado num INSERT, porque o trigger de proteção criado em
-- 20260725003804 só cobria UPDATE (o corpo compara new.saldo com old.saldo, que
-- nem existe no INSERT). Como a policy de insert checa só *quem* insere, nunca
-- *o quê*, um usuário da equipe de estoque podia criar um item com
-- saldo = 999999 direto pelo PostgREST e, via definir_composicao_beneficio +
-- montar_cesta, converter esse estoque inexistente em saldo real de Cesta
-- Padrão — com uma linha de ledger aparentemente legítima.
--
-- Três camadas, na ordem em que um ataque as encontraria:
--
--   1. o trigger passa a cobrir INSERT: todo registro de catálogo nasce com
--      saldo 0, salvo com o flag transacional das RPCs de movimentação;
--   2. `saldo` sai do conjunto de colunas que o cliente pode inserir. Ele
--      permanece no UPDATE de propósito: as RPCs de movimentação são
--      SECURITY INVOKER e precisam da permissão do próprio chamador — quem
--      barra o UPDATE direto é o trigger, não o grant;
--   3. os benefícios que o motor de regras do atendimento resolve por nome
--      ganham um `codigo` imutável e ficam protegidos contra rename e
--      exclusão. Isso elimina o sombreamento (renomear a "Cesta Extra" real e
--      inserir outra no lugar zerava o contador de retiradas extras de todos
--      os assistidos) sem precisar reescrever as RPCs de atendimento.

-- ============================================================================
-- 1) O trigger de saldo passa a cobrir INSERT
-- ============================================================================

create or replace function private.impedir_alteracao_saldo_direta()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(current_setting('seac.saldo_via_rpc', true), '') = 'on' then
    return new;
  end if;

  -- No INSERT não existe `old`: a regra é que todo registro nasce zerado e só
  -- ganha saldo pelas RPCs, que gravam o ledger na mesma transação.
  if tg_op = 'INSERT' then
    if new.saldo is distinct from 0 then
      raise exception
        'Um novo registro de catálogo nasce com saldo 0; use as funções de movimentação de estoque.'
        using errcode = 'SEAS1';
    end if;
  elsif new.saldo is distinct from old.saldo then
    raise exception
      'O saldo só pode ser alterado pelas funções de movimentação de estoque (para preservar o ledger).'
      using errcode = 'SEAS1';
  end if;

  return new;
end;
$$;

comment on function private.impedir_alteracao_saldo_direta() is
  'Bloqueia INSERT com saldo <> 0 e UPDATE direto de saldo; só permite quando o flag transacional seac.saldo_via_rpc está ligado (setado pelas RPCs de movimentação).';

drop trigger beneficios_saldo_protegido on public.beneficios;
create trigger beneficios_saldo_protegido
before insert or update on public.beneficios
for each row execute function private.impedir_alteracao_saldo_direta();

drop trigger itens_estoque_saldo_protegido on public.itens_estoque;
create trigger itens_estoque_saldo_protegido
before insert or update on public.itens_estoque
for each row execute function private.impedir_alteracao_saldo_direta();

-- ============================================================================
-- 2) `saldo` sai do INSERT do cliente
-- ============================================================================
-- As listas espelham exatamente os payloads de salvarItem/salvarBeneficio em
-- src/lib/cadastros/cadastros-supabase.ts. Colunas de autoria e timestamps não
-- entram: são preenchidas por trigger/default, e trigger não exige permissão.

revoke insert on table public.beneficios from authenticated;
grant insert (nome, tipo, controla_estoque, observacao, ativo)
  on table public.beneficios to authenticated;

revoke insert on table public.itens_estoque from authenticated;
grant insert (nome, categoria, unidade, minimo, valor, observacao, ativo)
  on table public.itens_estoque to authenticated;

-- ============================================================================
-- 3) Benefícios do motor de regras: código imutável, sem rename nem exclusão
-- ============================================================================

alter table public.beneficios
  add column codigo text,
  add constraint beneficios_codigo_key unique (codigo);

comment on column public.beneficios.codigo is
  'Identificador estável dos benefícios que o atendimento resolve por nome (Cesta Padrão/Extra). Imutável, protegido contra exclusão e não gravável pelo cliente; nulo nos benefícios criados pela equipe.';

update public.beneficios set codigo = 'cesta_padrao' where nome = 'Cesta Padrão';
update public.beneficios set codigo = 'cesta_extra' where nome = 'Cesta Extra';
update public.beneficios set codigo = 'kit_gestante' where nome = 'Kit Gestante';

create function private.proteger_beneficio_do_atendimento()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'O benefício "%" é usado pelas regras de atendimento e não pode ser excluído.', old.nome
      using errcode = 'SEAB1';
  end if;

  if new.nome is distinct from old.nome then
    raise exception
      'O benefício "%" é usado pelas regras de atendimento e não pode ser renomeado.', old.nome
      using errcode = 'SEAB1';
  end if;

  if new.codigo is distinct from old.codigo then
    raise exception 'O código de um benefício é imutável.'
      using errcode = 'SEAB1';
  end if;

  return new;
end;
$$;

comment on function private.proteger_beneficio_do_atendimento() is
  'Impede renomear/excluir os benefícios com codigo e alterar o próprio codigo: as RPCs de atendimento resolvem esses benefícios por nome, então o nome é parte do contrato.';

-- O `when` restringe o trigger aos benefícios com codigo — os criados pela
-- equipe continuam livremente editáveis. Como `codigo` não é inserível pelo
-- cliente (grant acima) e o próprio trigger o torna imutável, não há como um
-- benefício comum entrar ou sair desse conjunto pela API.
create trigger beneficios_codigo_protegido
before update or delete on public.beneficios
for each row when (old.codigo is not null)
execute function private.proteger_beneficio_do_atendimento();
