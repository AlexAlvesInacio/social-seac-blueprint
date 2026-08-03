-- CPF passa a ser validado, e uma pessoa pode ter RG e CPF ao mesmo tempo.
--
-- Contexto (issue #46 / análise em docs/13_IMPORTACAO_PLANILHA_LEGADA.md): o RG
-- está sendo descontinuado no Brasil e a SEAC vai migrar para o CPF. Durante a
-- transição a mesma pessoa aparece ora com um documento, ora com o outro — e o
-- sistema tinha um único campo com unicidade global. Trocar o documento de uma
-- pessoa apagava o número antigo; cadastrá-la pelo outro número criava uma
-- pessoa duplicada, partindo o histórico de retiradas em dois e derrubando o
-- bloqueio de prazo em silêncio.
--
-- Duas mudanças:
--
--   1. `pessoas.cpf` opcional, único quando preenchido. O `documento` continua
--      sendo a identidade (com `tipo_documento` dizendo o que ele é); o `cpf`
--      convive com ele para que os dois números sejam conhecidos e buscáveis.
--      Quando `tipo_documento = 'cpf'`, o próprio `documento` é o CPF e a coluna
--      não precisa ser repetida.
--   2. Validação de dígito verificador. Decisão do usuário em 2026-08-02:
--      **bloquear** CPF inválido, e não apenas avisar. A saída para documentação
--      irregular continua existindo — cadastra-se com `tipo_documento = 'rg'` ou
--      `'outro'`, que não passam por essa validação.
--
-- O RG segue sem validação de formato: tamanho varia por estado, aceita letra
-- (termina em X em alguns) e há RGs curtos legítimos.

-- ============================================================================
-- Validação de CPF
-- ============================================================================

create function private.cpf_valido(p_valor text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(coalesce(p_valor, ''), '[^0-9]', '', 'g');
  soma integer;
  dig integer;
  pos integer;
begin
  if pg_catalog.length(v) <> 11 then
    return false;
  end if;

  -- Sequências de um dígito só (111.111.111-11 e afins) passam no cálculo,
  -- mas não são CPFs reais.
  if v ~ '^(.)\1{10}$' then
    return false;
  end if;

  for pos in 9..10 loop
    soma := 0;
    for dig in 1..pos loop
      soma := soma + pg_catalog.substr(v, dig, 1)::integer * ((pos + 2) - dig);
    end loop;
    if ((soma * 10) % 11) % 10 <> pg_catalog.substr(v, pos + 1, 1)::integer then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

comment on function private.cpf_valido(text) is
  'Valida os dois dígitos verificadores de um CPF, ignorando pontuação. Recusa sequências de dígito repetido.';

-- ============================================================================
-- Coluna cpf: convive com o documento de identidade
-- ============================================================================

alter table public.pessoas
  add column cpf text,
  add column cpf_normalizado text;

comment on column public.pessoas.cpf is
  'CPF da pessoa quando o documento de identidade é outro (tipo RG). Durante a transição do RG para o CPF, permite conhecer os dois números sem duplicar a pessoa.';

create unique index pessoas_cpf_normalizado_key
  on public.pessoas (cpf_normalizado)
  where cpf_normalizado is not null;

-- ============================================================================
-- Normalização e validação em um único trigger
-- ============================================================================
-- Corpo idêntico ao vigente (extraído com pg_get_functiondef) mais o
-- tratamento do CPF.

create or replace function private.normalizar_documento_pessoa()
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

  -- Quando o documento de identidade é o CPF, ele é o número validado.
  if new.tipo_documento = 'cpf'::public.pessoa_tipo_documento
     and not private.cpf_valido(new.documento_normalizado) then
    raise exception 'CPF inválido: os dígitos verificadores não conferem.'
      using errcode = 'SEACP',
            hint = 'Se a documentação estiver irregular, cadastre como RG ou Outro.';
  end if;

  -- Coluna cpf: opcional, mas se vier preenchida precisa ser um CPF de verdade.
  new.cpf := nullif(btrim(coalesce(new.cpf, '')), '');
  if new.cpf is null then
    new.cpf_normalizado := null;
  else
    new.cpf_normalizado := regexp_replace(new.cpf, '[^0-9]', '', 'g');
    if not private.cpf_valido(new.cpf_normalizado) then
      raise exception 'CPF inválido: os dígitos verificadores não conferem.'
        using errcode = 'SEACP',
              hint = 'Deixe o campo em branco se o CPF não for conhecido.';
    end if;
    -- Evita guardar o mesmo número nos dois lugares.
    if new.tipo_documento = 'cpf'::public.pessoa_tipo_documento
       and new.cpf_normalizado = new.documento_normalizado then
      new.cpf := null;
      new.cpf_normalizado := null;
    end if;
  end if;

  return new;
end;
$$;

comment on function private.normalizar_documento_pessoa() is
  'Normaliza documento e cpf, e valida os dígitos verificadores quando o número declarado é CPF. RG não é validado: formato varia por estado.';

-- ============================================================================
-- O trigger precisa observar as colunas novas
-- ============================================================================
-- A versão vigente dispara em `update of documento, documento_normalizado`.
-- Sem incluir as colunas abaixo, dois furos ficariam abertos:
--
--   * alterar só o `cpf` não dispararia nada — o número entraria sem validação
--     e sem preencher `cpf_normalizado`, que é a chave de unicidade;
--   * mudar `tipo_documento` de 'rg' para 'cpf' não revalidaria o número, e um
--     RG qualquer passaria a ser tratado como CPF sem checagem.

drop trigger pessoas_normalizar_documento on public.pessoas;

create trigger pessoas_normalizar_documento
before insert or update of documento, documento_normalizado, cpf, tipo_documento
on public.pessoas
for each row execute function private.normalizar_documento_pessoa();
