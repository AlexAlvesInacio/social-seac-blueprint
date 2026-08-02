-- Verificação de restauração — SEAC Social
--
-- Uma restauração só está testada quando se prova que os objetos de segurança
-- voltaram. Um dump que restaura as tabelas mas perde políticas de RLS deixa o
-- banco aparentemente íntegro e completamente aberto — é o modo de falha que
-- este script existe para pegar.
--
-- Como usar:
--   1. rodar no banco de ORIGEM e salvar a saída;
--   2. rodar no banco RESTAURADO e salvar a saída;
--   3. comparar os dois arquivos (`diff origem.txt restaurado.txt`).
--      Diferença em qualquer bloco de 1 a 6 reprova a restauração.
--
-- Rodar com:
--   psql "$CONNECTION_STRING" -f supabase/verificacao_restauracao.sql > saida.txt

\pset pager off
\pset footer off

-- ============================================================================
-- 1) Tabelas expostas sem RLS — DEVE vir vazio
-- ============================================================================
-- Toda tabela do schema public é alcançável pelo PostgREST. Sem RLS, qualquer
-- usuário autenticado lê e escreve tudo.

\echo '=== 1) Tabelas public sem RLS (esperado: nenhuma linha) ==='
select c.relname as tabela
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;

-- ============================================================================
-- 2) Políticas de RLS por tabela
-- ============================================================================
-- O total por tabela precisa bater exatamente com a origem. Uma policy a menos
-- pode significar uma escrita que deixou de ser barrada.

\echo ''
\echo '=== 2) Políticas por tabela ==='
select tablename as tabela, count(*) as politicas
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

-- ============================================================================
-- 3) Privilégios concedidos a anon — DEVE vir vazio
-- ============================================================================
-- O papel anon é o visitante não autenticado. Nenhuma tabela do domínio deve
-- conceder nada a ele.

\echo ''
\echo '=== 3) Grants para anon em public (esperado: nenhuma linha) ==='
select table_name as tabela, privilege_type as privilegio
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
order by table_name, privilege_type;

-- ============================================================================
-- 4) Funções e seu modo de segurança
-- ============================================================================
-- Uma função que volta como SECURITY DEFINER sem `search_path` fixo é um vetor
-- de escalada. A coluna `config` precisa mostrar search_path nas definer.

\echo ''
\echo '=== 4) Funções em public e private ==='
select n.nspname as schema,
       p.proname as funcao,
       case when p.prosecdef then 'definer' else 'invoker' end as modo,
       coalesce(array_to_string(p.proconfig, ','), '-') as config
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.proname;

-- ============================================================================
-- 5) Triggers
-- ============================================================================
-- Os triggers carregam regras que o schema sozinho não expressa: autoria,
-- imutabilidade do saldo, entregas só via RPC. Perder um é perder a regra.

\echo ''
\echo '=== 5) Triggers das tabelas public ==='
select c.relname as tabela, t.tgname as trigger
from pg_trigger as t
join pg_class as c on c.oid = t.tgrelid
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;

-- ============================================================================
-- 6) Constraints de integridade do domínio
-- ============================================================================

\echo ''
\echo '=== 6) Check constraints e unicidade ==='
select c.relname as tabela, con.conname as constraint_nome, con.contype as tipo
from pg_constraint as con
join pg_class as c on c.oid = con.conrelid
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and con.contype in ('c', 'u')
order by c.relname, con.conname;

-- ============================================================================
-- 7) Volume por tabela — só faz sentido em restauração COM dados
-- ============================================================================
-- Numa restauração só de schema, tudo vem zero e isso é esperado. Numa
-- restauração com dados, os números precisam bater com a origem.

\echo ''
\echo '=== 7) Linhas por tabela ==='
select relname as tabela, n_live_tup as linhas_aprox
from pg_stat_user_tables
where schemaname = 'public'
order by relname;
