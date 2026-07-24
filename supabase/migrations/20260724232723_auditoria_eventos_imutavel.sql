-- Trilha de auditoria imutável (docs/03_MODELAGEM_SUPABASE.md: auditoria_eventos,
-- append-only, exclusão proibida a operacionais). Substitui o protótipo em
-- localStorage (auditoria-store), que era mutável/apagável pela UN.
--
-- Modelo: o app emite o evento; o banco garante a imutabilidade — só há grant de
-- SELECT e INSERT (sem UPDATE/DELETE), então nem administrador remove/edita eventos
-- pela aplicação. Autoria (criado_por = auth.uid()) e timestamp são do trigger.

create table public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  acao text not null,
  modulo text not null,
  registro text,
  observacao text,
  contexto jsonb,
  criado_em timestamptz not null default now(),
  criado_por uuid not null references public.profiles (id) on delete restrict,
  constraint auditoria_eventos_acao_obrigatoria_check check (btrim(acao) <> ''),
  constraint auditoria_eventos_modulo_obrigatorio_check check (btrim(modulo) <> '')
);

comment on table public.auditoria_eventos is
  'Trilha de auditoria append-only: ação/módulo/registro afetado + autor e timestamp. Imutável (sem UPDATE/DELETE).';

create index auditoria_eventos_data_idx on public.auditoria_eventos (criado_em desc);
create index auditoria_eventos_modulo_idx on public.auditoria_eventos (modulo);
create index auditoria_eventos_autor_idx on public.auditoria_eventos (criado_por);

create trigger auditoria_eventos_definir_autoria
before insert or update on public.auditoria_eventos
for each row execute function private.definir_autoria_registro_insert();

-- Grants: SELECT + INSERT apenas. A ausência de UPDATE/DELETE é o que torna a
-- trilha imutável para os papéis operacionais.
revoke all on table public.auditoria_eventos from anon;
grant select, insert on table public.auditoria_eventos to authenticated;

alter table public.auditoria_eventos enable row level security;

create policy "Equipe ativa consulta auditoria" on public.auditoria_eventos
  for select to authenticated
  using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere auditoria" on public.auditoria_eventos
  for insert to authenticated
  with check ((select private.usuario_atual_pode_gerir_familias()));
