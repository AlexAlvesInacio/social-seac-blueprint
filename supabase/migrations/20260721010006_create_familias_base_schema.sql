-- Estrutura base de famílias e pessoas do SEAC Social.
--
-- Esta migration cria somente o modelo relacional, suas restrições, auditoria
-- técnica e políticas de acesso. Não migra dados locais, não cria seeds e não
-- integra Atendimento, Estoque ou Relatórios.

create type public.familia_status as enum (
  'liberado',
  'bloqueado',
  'inativo',
  'avaliar'
);

create type public.familia_acompanhamento as enum (
  'em_dia',
  'atencao_45',
  'atencao_60',
  'sem_retirada_90',
  'inativo'
);

create type public.pessoa_tipo_documento as enum (
  'cpf',
  'rg',
  'outro'
);

create type public.membro_familiar_status as enum (
  'ativo',
  'inativo'
);

create type public.assistido_tipo_cadastro as enum (
  'definitivo',
  'extra'
);

create type public.assistido_status as enum (
  'ativo',
  'inativo',
  'bloqueado'
);

create type public.observacao_social_tipo as enum (
  'social',
  'atendimento',
  'documento',
  'endereco',
  'saude_pcd',
  'outro'
);

comment on type public.familia_status is
  'Situação operacional do núcleo familiar.';
comment on type public.familia_acompanhamento is
  'Classificação informativa de acompanhamento; não inativa automaticamente.';
comment on type public.pessoa_tipo_documento is
  'Tipos de documento aceitos nesta fase.';
comment on type public.membro_familiar_status is
  'Situação do vínculo entre pessoa e família.';
comment on type public.assistido_tipo_cadastro is
  'Cadastro definitivo ou extra/em avaliação do assistido.';
comment on type public.assistido_status is
  'Situação operacional do assistido.';
comment on type public.observacao_social_tipo is
  'Categorias permitidas para observações sociais.';

create table public.familias (
  id uuid primary key default gen_random_uuid(),
  nome_referencia text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  status public.familia_status not null default 'liberado',
  acompanhamento public.familia_acompanhamento not null default 'em_dia',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid not null
    references public.profiles (id) on delete restrict,
  atualizado_por uuid not null
    references public.profiles (id) on delete restrict,
  constraint familias_nome_referencia_valido_check
    check (nome_referencia is null or btrim(nome_referencia) <> ''),
  constraint familias_uf_valida_check
    check (uf is null or char_length(btrim(uf)) = 2)
);

create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_documento public.pessoa_tipo_documento not null,
  documento text not null,
  documento_normalizado text not null,
  telefone text,
  nascimento date,
  pcd boolean not null default false,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid not null
    references public.profiles (id) on delete restrict,
  atualizado_por uuid not null
    references public.profiles (id) on delete restrict,
  constraint pessoas_nome_obrigatorio_check check (btrim(nome) <> ''),
  constraint pessoas_documento_obrigatorio_check check (btrim(documento) <> ''),
  constraint pessoas_documento_normalizado_obrigatorio_check
    check (btrim(documento_normalizado) <> ''),
  constraint pessoas_documento_normalizado_key unique (documento_normalizado)
);

create table public.membros_familiares (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null
    references public.familias (id) on delete restrict,
  pessoa_id uuid not null
    references public.pessoas (id) on delete restrict,
  parentesco text,
  responsavel_principal boolean not null default false,
  gestante boolean not null default false,
  status public.membro_familiar_status not null default 'ativo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid not null
    references public.profiles (id) on delete restrict,
  atualizado_por uuid not null
    references public.profiles (id) on delete restrict,
  constraint membros_familiares_familia_pessoa_key
    unique (familia_id, pessoa_id),
  constraint membros_familiares_identidade_familia_pessoa_key
    unique (id, familia_id, pessoa_id),
  constraint membros_familiares_parentesco_valido_check
    check (parentesco is null or btrim(parentesco) <> '')
);

create table public.assistidos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  pessoa_id uuid not null,
  membro_familiar_id uuid not null,
  tipo_cadastro public.assistido_tipo_cadastro not null,
  beneficio text,
  status public.assistido_status not null default 'ativo',
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid not null
    references public.profiles (id) on delete restrict,
  atualizado_por uuid not null
    references public.profiles (id) on delete restrict,
  constraint assistidos_membro_familia_pessoa_fkey
    foreign key (membro_familiar_id, familia_id, pessoa_id)
    references public.membros_familiares (id, familia_id, pessoa_id)
    on delete restrict,
  constraint assistidos_identidade_familia_pessoa_key
    unique (id, familia_id, pessoa_id),
  constraint assistidos_beneficio_valido_check
    check (beneficio is null or btrim(beneficio) <> '')
);

comment on column public.assistidos.membro_familiar_id is
  'Obrigatório para garantir que todo assistido seja a mesma pessoa vinculada à mesma família; ser membro não concede automaticamente o direito a benefício.';

create table public.observacoes_sociais (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null
    references public.familias (id) on delete restrict,
  pessoa_id uuid
    references public.pessoas (id) on delete restrict,
  assistido_id uuid,
  tipo public.observacao_social_tipo not null,
  texto text not null,
  criado_em timestamptz not null default now(),
  criado_por uuid not null
    references public.profiles (id) on delete restrict,
  constraint observacoes_sociais_assistido_familia_pessoa_fkey
    foreign key (assistido_id, familia_id, pessoa_id)
    references public.assistidos (id, familia_id, pessoa_id)
    on delete restrict,
  constraint observacoes_sociais_texto_obrigatorio_check
    check (btrim(texto) <> ''),
  constraint observacoes_sociais_assistido_exige_pessoa_check
    check (assistido_id is null or pessoa_id is not null)
);

comment on table public.familias is
  'Núcleos familiares acompanhados pelo SEAC Social.';
comment on table public.pessoas is
  'Identidades únicas das pessoas cadastradas; documento é obrigatório nesta fase.';
comment on table public.membros_familiares is
  'Vínculos de pessoas com famílias, incluindo o responsável principal.';
comment on table public.assistidos is
  'Extensão do membro familiar habilitado ao atendimento e a benefícios.';
comment on table public.observacoes_sociais is
  'Registros sociais sensíveis vinculados à família e, opcionalmente, à pessoa e ao assistido.';

create unique index membros_familiares_pessoa_ativa_key
on public.membros_familiares (pessoa_id)
where status = 'ativo'::public.membro_familiar_status;

create unique index membros_familiares_responsavel_principal_ativo_key
on public.membros_familiares (familia_id)
where responsavel_principal
  and status = 'ativo'::public.membro_familiar_status;

create unique index assistidos_pessoa_ativa_key
on public.assistidos (pessoa_id)
where status = 'ativo'::public.assistido_status;

create index familias_status_idx on public.familias (status);
create index familias_acompanhamento_idx on public.familias (acompanhamento);
create index familias_nome_referencia_idx on public.familias (nome_referencia);
create index familias_bairro_idx on public.familias (bairro);
create index familias_criado_por_idx on public.familias (criado_por);
create index familias_atualizado_por_idx on public.familias (atualizado_por);

create index pessoas_nome_idx on public.pessoas (nome);
create index pessoas_tipo_documento_idx on public.pessoas (tipo_documento);
create index pessoas_pcd_idx on public.pessoas (pcd);
create index pessoas_criado_por_idx on public.pessoas (criado_por);
create index pessoas_atualizado_por_idx on public.pessoas (atualizado_por);

create index membros_familiares_familia_id_idx
on public.membros_familiares (familia_id);
create index membros_familiares_pessoa_id_idx
on public.membros_familiares (pessoa_id);
create index membros_familiares_status_idx
on public.membros_familiares (status);
create index membros_familiares_criado_por_idx
on public.membros_familiares (criado_por);
create index membros_familiares_atualizado_por_idx
on public.membros_familiares (atualizado_por);

create index assistidos_familia_id_idx on public.assistidos (familia_id);
create index assistidos_membro_familiar_id_idx
on public.assistidos (membro_familiar_id);
create index assistidos_status_idx on public.assistidos (status);
create index assistidos_tipo_cadastro_idx on public.assistidos (tipo_cadastro);
create index assistidos_criado_por_idx on public.assistidos (criado_por);
create index assistidos_atualizado_por_idx on public.assistidos (atualizado_por);

create index observacoes_sociais_familia_criado_em_idx
on public.observacoes_sociais (familia_id, criado_em desc);
create index observacoes_sociais_pessoa_id_idx
on public.observacoes_sociais (pessoa_id);
create index observacoes_sociais_assistido_id_idx
on public.observacoes_sociais (assistido_id);
create index observacoes_sociais_tipo_idx
on public.observacoes_sociais (tipo);
create index observacoes_sociais_criado_por_idx
on public.observacoes_sociais (criado_por);

create function private.normalizar_documento_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.documento := btrim(new.documento);
  new.documento_normalizado := upper(
    regexp_replace(new.documento, '[^[:alnum:]]', '', 'g')
  );

  if new.documento_normalizado = '' then
    raise exception 'Documento deve conter ao menos um caractere alfanumérico.';
  end if;

  return new;
end;
$$;

comment on function private.normalizar_documento_pessoa() is
  'Deriva o documento normalizado no banco e não confia no valor enviado pelo cliente.';

revoke execute on function private.normalizar_documento_pessoa() from public;
revoke execute on function private.normalizar_documento_pessoa() from anon;
revoke execute on function private.normalizar_documento_pessoa() from authenticated;

create trigger pessoas_normalizar_documento
before insert or update of documento, documento_normalizado
on public.pessoas
for each row
execute function private.normalizar_documento_pessoa();

create function private.definir_auditoria_registro()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Usuário autenticado é obrigatório para alterar dados do domínio.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.criado_por := v_usuario_id;
  else
    if new.id is distinct from old.id then
      raise exception 'O identificador do registro não pode ser alterado.';
    end if;

    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  end if;

  new.atualizado_em := now();
  new.atualizado_por := v_usuario_id;
  return new;
end;
$$;

comment on function private.definir_auditoria_registro() is
  'Mantém autoria e timestamps pelo usuário autenticado, ignorando valores de auditoria enviados pelo cliente.';

revoke execute on function private.definir_auditoria_registro() from public;
revoke execute on function private.definir_auditoria_registro() from anon;
revoke execute on function private.definir_auditoria_registro() from authenticated;

create function private.definir_autoria_observacao_social()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Usuário autenticado é obrigatório para registrar observação social.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.criado_por := v_usuario_id;
  else
    if new.id is distinct from old.id then
      raise exception 'O identificador da observação não pode ser alterado.';
    end if;

    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  end if;

  return new;
end;
$$;

comment on function private.definir_autoria_observacao_social() is
  'Registra e preserva data e autoria da observação sem confiar em valores enviados pelo cliente.';

revoke execute on function private.definir_autoria_observacao_social() from public;
revoke execute on function private.definir_autoria_observacao_social() from anon;
revoke execute on function private.definir_autoria_observacao_social() from authenticated;

create trigger familias_definir_auditoria
before insert or update on public.familias
for each row
execute function private.definir_auditoria_registro();

create trigger pessoas_definir_auditoria
before insert or update on public.pessoas
for each row
execute function private.definir_auditoria_registro();

create trigger membros_familiares_definir_auditoria
before insert or update on public.membros_familiares
for each row
execute function private.definir_auditoria_registro();

create trigger assistidos_definir_auditoria
before insert or update on public.assistidos
for each row
execute function private.definir_auditoria_registro();

create trigger observacoes_sociais_definir_autoria
before insert or update on public.observacoes_sociais
for each row
execute function private.definir_autoria_observacao_social();

create function private.usuario_atual_pode_gerir_familias()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.status = 'ativo'::public.usuario_status
        and profile.papel in (
          'administrador'::public.usuario_papel,
          'atendente'::public.usuario_papel
        )
    );
$$;

comment on function private.usuario_atual_pode_gerir_familias() is
  'Autoriza somente administrador ou atendente com perfil ativo; estoque, pendente, inativo e anon são recusados.';

revoke execute on function private.usuario_atual_pode_gerir_familias() from public;
revoke execute on function private.usuario_atual_pode_gerir_familias() from anon;
revoke execute on function private.usuario_atual_pode_gerir_familias() from authenticated;
grant execute on function private.usuario_atual_pode_gerir_familias() to authenticated;

alter table public.familias enable row level security;
alter table public.pessoas enable row level security;
alter table public.membros_familiares enable row level security;
alter table public.assistidos enable row level security;
alter table public.observacoes_sociais enable row level security;

revoke all on table public.familias from anon;
revoke all on table public.pessoas from anon;
revoke all on table public.membros_familiares from anon;
revoke all on table public.assistidos from anon;
revoke all on table public.observacoes_sociais from anon;

revoke all on table public.familias from authenticated;
revoke all on table public.pessoas from authenticated;
revoke all on table public.membros_familiares from authenticated;
revoke all on table public.assistidos from authenticated;
revoke all on table public.observacoes_sociais from authenticated;

grant select, insert, update on table public.familias to authenticated;
grant select, insert, update on table public.pessoas to authenticated;
grant select, insert, update on table public.membros_familiares to authenticated;
grant select, insert, update on table public.assistidos to authenticated;
grant select, insert, update on table public.observacoes_sociais to authenticated;

create policy "Equipe ativa consulta famílias"
on public.familias
for select
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere famílias"
on public.familias
for insert
to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa atualiza famílias"
on public.familias
for update
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()))
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta pessoas"
on public.pessoas
for select
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere pessoas"
on public.pessoas
for insert
to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa atualiza pessoas"
on public.pessoas
for update
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()))
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta membros familiares"
on public.membros_familiares
for select
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere membros familiares"
on public.membros_familiares
for insert
to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa atualiza membros familiares"
on public.membros_familiares
for update
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()))
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta assistidos"
on public.assistidos
for select
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere assistidos"
on public.assistidos
for insert
to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa atualiza assistidos"
on public.assistidos
for update
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()))
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa consulta observações sociais"
on public.observacoes_sociais
for select
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa insere observações sociais"
on public.observacoes_sociais
for insert
to authenticated
with check ((select private.usuario_atual_pode_gerir_familias()));

create policy "Equipe ativa atualiza observações sociais"
on public.observacoes_sociais
for update
to authenticated
using ((select private.usuario_atual_pode_gerir_familias()))
with check ((select private.usuario_atual_pode_gerir_familias()));

-- A unicidade parcial em membros_familiares impede que uma pessoa pertença a
-- mais de uma família ativa e impede mais de um responsável principal ativo na
-- mesma família. A criação do responsável principal e da família deverá ser
-- coordenada em uma operação transacional quando o frontend for integrado; não
-- existe automação ou seed nesta migration.
--
-- tipo_cadastro existe somente em assistidos. Estado de acompanhamento não
-- bloqueia nem inativa automaticamente uma família. As observações sociais são
-- protegidas por RLS e não possuem acesso para anon ou para o papel estoque.
