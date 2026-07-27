-- Expõe o e-mail do usuário em profiles (a "coluna segura" que faltava). O e-mail
-- vive em auth.users, que o frontend não lê; copiamos para profiles no cadastro
-- (trigger) e fazemos o backfill dos perfis já existentes.

alter table public.profiles add column email text;

comment on column public.profiles.email is
  'E-mail do usuário, copiado de auth.users no cadastro (para exibição na gestão de usuários).';

-- Recria o trigger para gravar também o e-mail ao criar o perfil.
create or replace function private.criar_profile_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    nome_completo,
    email,
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
    nullif(btrim(new.email), ''),
    'atendente'::public.usuario_papel,
    'pendente'::public.usuario_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Backfill dos perfis existentes (a migration roda como superusuário e lê auth.users).
update public.profiles as p
set email = u.email
from auth.users as u
where u.id = p.id
  and (p.email is null or p.email = '');
