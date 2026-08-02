-- Fecha o achado SEG-4 da security review (issue #86): 15 tabelas ainda tinham
-- os privilégios padrão do Supabase para `authenticated`.
--
-- O Supabase configura `alter default privileges ... grant all on tables to
-- anon, authenticated, service_role`: toda tabela nasce com privilégio total, e
-- cabe à migration revogar. As migrations iniciais (profiles, famílias) faziam
-- isso para os dois papéis; da `20260723233626` em diante passaram a revogar só
-- de `anon`, deixando `DELETE`, `TRUNCATE`, `UPDATE`, `REFERENCES` e `TRIGGER`
-- concedidos a `authenticated` em 15 tabelas — inclusive `auditoria_eventos`,
-- que o projeto documenta como imutável, e `entregas`.
--
-- Hoje nada disso é explorável pela API: DELETE/UPDATE sem policy morrem na
-- RLS, o PostgREST não expõe TRUNCATE e `authenticated` não tem CREATE no
-- schema. O problema é que a segurança dessas tabelas passa a depender de uma
-- camada só. Basta alguém adicionar uma policy permissiva de UPDATE em
-- `auditoria_eventos`, supondo que os grants a protegem, para o histórico
-- virar editável.
--
-- ============================================================================
-- Como cada linha abaixo foi decidida
-- ============================================================================
-- Cruzando duas fontes, porque só uma delas deixa buracos:
--
--   1. acesso direto do frontend via PostgREST (`.from(...)` em src/);
--   2. DML dentro de funções `SECURITY INVOKER`, que rodam com o privilégio de
--      QUEM CHAMA. Esta é a fonte silenciosa: revogar um privilégio que só uma
--      RPC usa não quebra nada nos testes e derruba a operação em produção.
--
-- Duas sutilezas que mudaram o resultado:
--
--   * `select ... for update` exige privilégio de UPDATE, não só de SELECT. As
--     RPCs travam linhas de `beneficios` e `itens_estoque` assim. Somado ao
--     `update ... set saldo`, é o que obriga UPDATE em nível de tabela nessas
--     duas — quem impede o UPDATE indevido de saldo é o trigger da 20260802143000,
--     não o grant.
--   * `insert ... returning id` exige SELECT sobre as colunas retornadas. É o
--     único motivo de `movimentacoes_itens` precisar de SELECT: nenhuma tela lê
--     essa tabela.
--
-- Colunas de autoria e timestamp não aparecem em nenhuma lista: são gravadas
-- por triggers BEFORE, e trigger não exige privilégio de quem chama.

-- ============================================================================
-- Catálogos auxiliares — CRUD completo pela tela de Configurações
-- ============================================================================

revoke all on table public.unidades from authenticated;
grant select, insert, update, delete on table public.unidades to authenticated;

revoke all on table public.categorias from authenticated;
grant select, insert, update, delete on table public.categorias to authenticated;

revoke all on table public.doadores from authenticated;
grant select, insert, update, delete on table public.doadores to authenticated;

revoke all on table public.fornecedores from authenticated;
grant select, insert, update, delete on table public.fornecedores to authenticated;

-- ============================================================================
-- Catálogo de estoque — INSERT continua restrito por coluna
-- ============================================================================
-- O `revoke all` apagaria os grants por coluna criados na 20260802143000, que
-- mantêm `saldo` fora do alcance do cliente no INSERT. Recriados idênticos.

revoke all on table public.beneficios from authenticated;
grant select, update, delete on table public.beneficios to authenticated;
grant insert (nome, tipo, controla_estoque, observacao, ativo)
  on table public.beneficios to authenticated;

revoke all on table public.itens_estoque from authenticated;
grant select, update, delete on table public.itens_estoque to authenticated;
grant insert (nome, categoria, unidade, minimo, valor, observacao, ativo)
  on table public.itens_estoque to authenticated;

-- composicao_beneficio: definir_composicao_beneficio faz delete + insert com
-- `on conflict do update`, então precisa dos quatro.
revoke all on table public.composicao_beneficio from authenticated;
grant select, insert, update, delete on table public.composicao_beneficio to authenticated;

-- ============================================================================
-- Ledgers e histórico — append-only
-- ============================================================================
-- Sem UPDATE nem DELETE: são registros históricos. O SELECT das duas tabelas de
-- movimentação é exigido pelos `returning id` das RPCs, além da tela de estoque
-- no caso de movimentacoes_estoque.

revoke all on table public.movimentacoes_estoque from authenticated;
grant select, insert on table public.movimentacoes_estoque to authenticated;

revoke all on table public.movimentacoes_itens from authenticated;
grant select, insert on table public.movimentacoes_itens to authenticated;

revoke all on table public.entregas from authenticated;
grant select, insert on table public.entregas to authenticated;

revoke all on table public.tentativas_bloqueadas from authenticated;
grant select, insert on table public.tentativas_bloqueadas to authenticated;

-- auditoria_eventos: a imutabilidade passa a ser garantida também pelos grants,
-- e não só pela ausência de policy de UPDATE/DELETE.
revoke all on table public.auditoria_eventos from authenticated;
grant select, insert on table public.auditoria_eventos to authenticated;

-- ============================================================================
-- Recebimentos
-- ============================================================================
-- UPDATE mantido em `recebimentos` de propósito: não encontrei consumidor no
-- frontend nem em função, mas a coluna `status` é lida pela tela e o grant
-- existe desde a 20260724010959, o que sugere um fluxo de conferência
-- planejado. Remover privilégio de algo que talvez exista é o lado arriscado
-- do erro; se confirmarmos que o fluxo não existe, sai numa migration própria.

revoke all on table public.recebimentos from authenticated;
grant select, insert, update on table public.recebimentos to authenticated;

revoke all on table public.recebimento_itens from authenticated;
grant select, insert on table public.recebimento_itens to authenticated;

-- ============================================================================
-- Configurações — linha única semeada por migration
-- ============================================================================

revoke all on table public.configuracoes from authenticated;
grant select, update on table public.configuracoes to authenticated;

-- ============================================================================
-- Impede a reincidência: tabelas futuras não nascem abertas
-- ============================================================================
-- Sem isto, a próxima tabela criada volta a herdar `grant all` e o buraco
-- reaparece — foi exatamente assim que estas 15 chegaram aqui.
--
-- O modo de falha inverte de silencioso para barulhento: uma tabela nova passa
-- a nascer sem grant nenhum, e a aplicação reclama no primeiro acesso, durante
-- o desenvolvimento. Toda migration que criar tabela precisa conceder
-- explicitamente o que aquela tabela usa.
--
-- Afeta apenas objetos criados pelo papel `postgres` (o que roda as
-- migrations); o conjunto equivalente definido por `supabase_admin` não é
-- alcançável a partir daqui.

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
