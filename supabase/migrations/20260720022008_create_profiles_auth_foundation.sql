-- Fundação de autenticação e perfis do SEAC Social.
--
-- Esta migration não cria nem promove o primeiro administrador. Todo usuário
-- novo começa como atendente pendente. O bootstrap inicial deverá ocorrer em
-- etapa posterior, por procedimento administrativo seguro e auditável,
-- executado diretamente em ambiente controlado do Supabase.

create type public.usuario_papel as enum (
  'administrador',
  'atendente',
  'estoque'
);

comment on type public.usuario_papel is
  'Papéis institucionais permitidos para usuários do SEAC Social.';

create type public.usuario_status as enum (
  'pendente',
  'ativo',
  'inativo'
);

comment on type public.usuario_status is
  'Estados permitidos para o acesso institucional ao SEAC Social.';

create schema private;

comment on schema private is
  'Funções internas não expostas pela API de dados.';

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key
    references auth.users (id) on delete cascade,
  nome_completo text not null,
  papel public.usuario_papel not null default 'atendente',
  status public.usuario_status not null default 'pendente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  aprovado_por uuid
    references public.profiles (id) on delete restrict,
  inativado_em timestamptz,
  inativado_por uuid
    references public.profiles (id) on delete restrict
);

comment on table public.profiles is
  'Perfil institucional vinculado de forma individual a auth.users.';
comment on column public.profiles.id is
  'Identificador do usuário em auth.users; não é alterável no fluxo normal.';
comment on column public.profiles.nome_completo is
  'Nome de exibição institucional do usuário.';
comment on column public.profiles.papel is
  'Papel autorizado; nunca é aceito a partir de metadata do frontend.';
comment on column public.profiles.status is
  'Status de acesso; todo novo usuário começa pendente.';
comment on column public.profiles.criado_em is
  'Data e hora de criação do perfil.';
comment on column public.profiles.atualizado_em is
  'Data e hora da última atualização, mantida por trigger.';
comment on column public.profiles.aprovado_em is
  'Data e hora da aprovação administrativa, quando aplicável.';
comment on column public.profiles.aprovado_por is
  'Administrador que aprovou o perfil, quando aplicável.';
comment on column public.profiles.inativado_em is
  'Data e hora da inativação administrativa, quando aplicável.';
comment on column public.profiles.inativado_por is
  'Administrador que inativou o perfil, quando aplicável.';

create index profiles_papel_idx on public.profiles (papel);
create index profiles_status_idx on public.profiles (status);
create index profiles_aprovado_por_idx on public.profiles (aprovado_por);
create index profiles_inativado_por_idx on public.profiles (inativado_por);

create function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

comment on function public.definir_atualizado_em() is
  'Atualiza automaticamente atualizado_em antes de alterações.';

revoke execute on function public.definir_atualizado_em() from public;
revoke execute on function public.definir_atualizado_em() from anon;
revoke execute on function public.definir_atualizado_em() from authenticated;

create trigger profiles_definir_atualizado_em
before update on public.profiles
for each row
execute function public.definir_atualizado_em();

comment on trigger profiles_definir_atualizado_em on public.profiles is
  'Mantém atualizado_em sincronizado em toda atualização do perfil.';

create function private.criar_profile_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    nome_completo,
    papel,
    status
  )
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'nome_completo'), ''),
      nullif(btrim(new.email), ''),
      ''
    ),
    'atendente'::public.usuario_papel,
    'pendente'::public.usuario_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function private.criar_profile_para_novo_usuario() is
  'Cria perfil atendente e pendente sem confiar em papel ou status do metadata.';

revoke execute on function private.criar_profile_para_novo_usuario() from public;
revoke execute on function private.criar_profile_para_novo_usuario() from anon;
revoke execute on function private.criar_profile_para_novo_usuario() from authenticated;

create trigger auth_users_criar_profile
after insert on auth.users
for each row
execute function private.criar_profile_para_novo_usuario();

create function private.usuario_atual_e_administrador_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.papel = 'administrador'::public.usuario_papel
      and profile.status = 'ativo'::public.usuario_status
  );
$$;

comment on function private.usuario_atual_e_administrador_ativo() is
  'Verifica sem parâmetros se o usuário atual é administrador ativo.';

revoke execute on function private.usuario_atual_e_administrador_ativo() from public;
revoke execute on function private.usuario_atual_e_administrador_ativo() from anon;
revoke execute on function private.usuario_atual_e_administrador_ativo() from authenticated;
grant execute on function private.usuario_atual_e_administrador_ativo() to authenticated;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant update (
  nome_completo,
  papel,
  status
) on table public.profiles to authenticated;

create policy "Usuário autenticado consulta o próprio perfil"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Administrador ativo consulta todos os perfis"
on public.profiles
for select
to authenticated
using ((select private.usuario_atual_e_administrador_ativo()));

create policy "Administrador ativo atualiza perfis"
on public.profiles
for update
to authenticated
using ((select private.usuario_atual_e_administrador_ativo()))
with check ((select private.usuario_atual_e_administrador_ativo()));

-- Não existem policies de INSERT ou DELETE. Perfis são criados somente pela
-- trigger de auth.users e não podem ser excluídos pelo fluxo autenticado.
-- Usuários pendentes ou inativos deverão ser rejeitados também pelas policies
-- das tabelas de negócio, que serão criadas em migrations futuras.
-- Decisões pendentes para o fluxo administrativo futuro:
-- 1. criar funções ou triggers seguras para aprovação e inativação, preenchendo
--    datas e responsáveis com auth.uid() e now(), sem aceitar esses valores do
--    frontend;
-- 2. impedir que o último administrador ativo inative ou rebaixe a si próprio;
-- 3. definir a preservação histórica quando um administrador referenciado por
--    aprovado_por ou inativado_por for removido.
