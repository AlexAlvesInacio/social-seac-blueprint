-- Fatia final da consolidação dos cadastros auxiliares (docs/07): as abas
-- Itens e Benefícios da tela de Configurações passam a editar as tabelas
-- reais itens_estoque/beneficios, aposentando a duplicação no config-store
-- (localStorage). Este script:
--   1. adiciona os campos de cadastro que só existiam no protótipo
--      (observacao em itens; tipo/observacao em benefícios);
--   2. normaliza categoria/unidade dos seeds para os nomes oficiais dos
--      cadastros auxiliares (tabelas categorias/unidades);
--   3. preenche o tipo dos benefícios semeados;
--   4. habilita insert (equipe de estoque) e delete (só admin) — a exclusão
--      de registros com vínculo continua bloqueada pelas FKs "on delete
--      restrict" de movimentações, composição, entregas e recebimentos.

-- ============================================================================
-- 1) Campos de cadastro
-- ============================================================================

alter table public.itens_estoque
  add column observacao text;

alter table public.beneficios
  add column tipo text,
  add column observacao text;

comment on column public.beneficios.tipo is
  'Classificação de cadastro do benefício (ex.: Cadastro definitivo, Cadastro em avaliação); informativa, não participa das regras de entrega.';

-- ============================================================================
-- 2) Normalização de categoria/unidade dos seeds para os nomes oficiais
-- ============================================================================

update public.itens_estoque set categoria = 'Alimentos' where categoria = 'Alimento';
update public.itens_estoque set unidade = 'Pacote' where unidade = 'pacote';
update public.itens_estoque set unidade = 'Unidade' where unidade = 'unidade';

-- ============================================================================
-- 3) Tipo dos benefícios semeados
-- ============================================================================

update public.beneficios set tipo = 'Cadastro definitivo'
  where nome = 'Cesta Padrão' and tipo is null;
update public.beneficios set tipo = 'Cadastro em avaliação'
  where nome = 'Cesta Extra' and tipo is null;
update public.beneficios set tipo = 'Benefício específico'
  where nome = 'Kit Gestante' and tipo is null;

-- ============================================================================
-- 4) Grants + policies de insert/delete
-- ============================================================================

grant insert on table public.beneficios to authenticated;
grant delete on table public.beneficios to authenticated;
grant delete on table public.itens_estoque to authenticated;

create policy "Equipe de estoque insere beneficios" on public.beneficios
  for insert to authenticated
  with check ((select private.usuario_atual_pode_gerir_estoque()));

create policy "Administrador exclui beneficios" on public.beneficios
  for delete to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador exclui itens" on public.itens_estoque
  for delete to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()));
