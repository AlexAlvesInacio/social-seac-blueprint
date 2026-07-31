-- Cadastros auxiliares no banco (docs/07: consolidação do config-store).
-- Cria unidades, categorias, doadores e fornecedores, hoje persistidos apenas
-- em localStorage na tela de Configurações. Itens e benefícios ficam de fora:
-- já existem como itens_estoque/beneficios e serão religados em fatia própria.
--
-- Unidades e categorias recebem seed com os valores oficiais do protótipo
-- (referência real de operação). Doadores e fornecedores NÃO recebem seed —
-- os dados do protótipo eram exemplos fictícios.

-- ============================================================================
-- Unidades de medida
-- ============================================================================

create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  sigla text not null,
  usada_estoque boolean not null default true,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id) on delete restrict,
  atualizado_por uuid references public.profiles (id) on delete restrict,
  constraint unidades_codigo_key unique (codigo),
  constraint unidades_codigo_obrigatorio_check check (btrim(codigo) <> ''),
  constraint unidades_nome_obrigatorio_check check (btrim(nome) <> ''),
  constraint unidades_sigla_obrigatoria_check check (btrim(sigla) <> '')
);

comment on table public.unidades is
  'Cadastro auxiliar de unidades de medida usadas por itens e movimentações.';

insert into public.unidades (codigo, nome, sigla) values
  ('UN', 'Unidade', 'un.'),
  ('PCT', 'Pacote', 'pct.'),
  ('KG', 'Quilo', 'kg'),
  ('LT', 'Litro', 'lt'),
  ('CX', 'Caixa', 'cx'),
  ('FD', 'Fardo', 'fd');

-- ============================================================================
-- Categorias de itens
-- ============================================================================

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id) on delete restrict,
  atualizado_por uuid references public.profiles (id) on delete restrict,
  constraint categorias_codigo_key unique (codigo),
  constraint categorias_codigo_obrigatorio_check check (btrim(codigo) <> ''),
  constraint categorias_nome_obrigatorio_check check (btrim(nome) <> '')
);

comment on table public.categorias is
  'Cadastro auxiliar de categorias (grupos) de itens de estoque.';

insert into public.categorias (codigo, nome, descricao) values
  ('ALI', 'Alimentos', 'Itens de alimentação usados em cestas'),
  ('BEB', 'Bebidas', 'Leite, sucos e bebidas em geral'),
  ('BEN', 'Benefício montado', 'Cesta Padrão, Cesta Extra e kits'),
  ('HIG', 'Higiene', 'Produtos de higiene pessoal'),
  ('REF', 'Refeição', 'Itens usados em ações de comida de rua'),
  ('OUT', 'Outros', 'Itens diversos');

-- ============================================================================
-- Doadores
-- ============================================================================

create table public.doadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'Empresa',
  documento text,
  telefone text,
  email text,
  endereco text,
  observacao text,
  ultima_doacao date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id) on delete restrict,
  atualizado_por uuid references public.profiles (id) on delete restrict,
  constraint doadores_nome_obrigatorio_check check (btrim(nome) <> ''),
  constraint doadores_tipo_check
    check (tipo in ('Pessoa física', 'Empresa', 'Anônimo'))
);

comment on table public.doadores is
  'Cadastro auxiliar de doadores. ultima_doacao é informativa; o vínculo com recebimentos fica para fatia futura.';

-- ============================================================================
-- Fornecedores
-- ============================================================================

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  telefone text,
  email text,
  categoria text not null,
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.profiles (id) on delete restrict,
  atualizado_por uuid references public.profiles (id) on delete restrict,
  constraint fornecedores_nome_obrigatorio_check check (btrim(nome) <> ''),
  constraint fornecedores_categoria_obrigatoria_check check (btrim(categoria) <> '')
);

comment on table public.fornecedores is
  'Cadastro auxiliar de fornecedores. O vínculo com recebimentos fica para fatia futura.';

-- ============================================================================
-- Gatilhos de auditoria (após os seeds; preenchem criado_por/atualizado_por)
-- ============================================================================

create trigger unidades_definir_auditoria
before insert or update on public.unidades
for each row execute function private.definir_auditoria_registro();

create trigger categorias_definir_auditoria
before insert or update on public.categorias
for each row execute function private.definir_auditoria_registro();

create trigger doadores_definir_auditoria
before insert or update on public.doadores
for each row execute function private.definir_auditoria_registro();

create trigger fornecedores_definir_auditoria
before insert or update on public.fornecedores
for each row execute function private.definir_auditoria_registro();

-- ============================================================================
-- Grants + RLS: equipe de estoque consulta; só administrador altera.
-- A exclusão existe porque cadastros auxiliares sem vínculo podem ser
-- removidos; com vínculo, a orientação da tela é inativar.
-- ============================================================================

revoke all on table public.unidades from anon;
revoke all on table public.categorias from anon;
revoke all on table public.doadores from anon;
revoke all on table public.fornecedores from anon;

grant select, insert, update, delete on table public.unidades to authenticated;
grant select, insert, update, delete on table public.categorias to authenticated;
grant select, insert, update, delete on table public.doadores to authenticated;
grant select, insert, update, delete on table public.fornecedores to authenticated;

alter table public.unidades enable row level security;
alter table public.categorias enable row level security;
alter table public.doadores enable row level security;
alter table public.fornecedores enable row level security;

create policy "Equipe de estoque consulta unidades" on public.unidades
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_estoque()));

create policy "Administrador insere unidades" on public.unidades
  for insert to authenticated
  with check ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador altera unidades" on public.unidades
  for update to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()))
  with check ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador exclui unidades" on public.unidades
  for delete to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()));

create policy "Equipe de estoque consulta categorias" on public.categorias
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_estoque()));

create policy "Administrador insere categorias" on public.categorias
  for insert to authenticated
  with check ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador altera categorias" on public.categorias
  for update to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()))
  with check ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador exclui categorias" on public.categorias
  for delete to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()));

create policy "Equipe de estoque consulta doadores" on public.doadores
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_estoque()));

create policy "Administrador insere doadores" on public.doadores
  for insert to authenticated
  with check ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador altera doadores" on public.doadores
  for update to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()))
  with check ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador exclui doadores" on public.doadores
  for delete to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()));

create policy "Equipe de estoque consulta fornecedores" on public.fornecedores
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_estoque()));

create policy "Administrador insere fornecedores" on public.fornecedores
  for insert to authenticated
  with check ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador altera fornecedores" on public.fornecedores
  for update to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()))
  with check ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador exclui fornecedores" on public.fornecedores
  for delete to authenticated
  using ((select private.usuario_atual_e_administrador_ativo()));
