# Runbook de operação — SEAC Social

Procedimentos operacionais para publicação, backup e recuperação.
Itens marcados como **[validar]** ainda não foram executados de ponta a
ponta — ao validar, remover a marca e registrar a data.

## Ambiente

- **Frontend:** TanStack Start (SSR) buildado com `bun run build`
  (target Cloudflare via nitro). Repositório conectado ao Lovable —
  commits na branch conectada sincronizam automaticamente.
- **Banco:** Supabase (projeto vinculado via `bunx supabase`).
  Migrations versionadas em `supabase/migrations/`.
- **Variáveis de ambiente:** `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` (somente chaves públicas; `service_role`
  jamais entra no frontend ou no repositório). Detalhe na seção abaixo.

## Variáveis de ambiente e segredos

### O que vai no frontend

Só existem duas, e as duas são **públicas por natureza** — elas são
embutidas no bundle que qualquer visitante baixa. Isso é esperado: quem
protege os dados é a RLS do Supabase, não o sigilo da chave.

| Variável | Formato | Onde configurar |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://<projeto>.supabase.co` | Ambiente do deploy |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` (formato novo do Supabase) | Ambiente do deploy |

O prefixo `VITE_` é o que autoriza o Vite a embutir o valor no bundle.
Qualquer variável **sem** esse prefixo não chega ao cliente — é assim que
o limite é imposto, e não por convenção.

Em desenvolvimento: copiar `.env.example` para `.env.local` e preencher.
`.env.local` está no `.gitignore` (`.env.*` com exceção do
`.env.example`) e nunca deve ser versionado.

No deploy (Cloudflare/Lovable): definir as duas no painel de variáveis do
ambiente antes do primeiro build — o valor é resolvido em tempo de build,
então mudar a variável exige **rebuild**, não só restart. **[validar]**

Sem as variáveis o cliente Supabase fica `null` e o build ainda passa
(`src/lib/supabase/client.ts`); a aplicação sobe e mostra "Não foi
possível consultar o Supabase" nas telas. Um deploy sem env não quebra o
build — ele quebra silenciosamente em produção, então confira.

### O que nunca pode ir para o frontend

`service_role`, `sb_secret_…`, senha do banco, string de conexão direta.
Essas credenciais ignoram a RLS: vazar uma delas expõe todos os dados
pessoais das famílias. As Edge Functions (`criar-usuario`,
`atualizar-nome-usuario`) precisam da `service_role`, mas a leem de
`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`, que o próprio Supabase
injeta no ambiente da function — a chave não passa pelo repositório nem
pelo build do frontend.

### Como conferir que nada vazou

Auditoria feita em 2026-08-02 (issue #48) e reproduzível a qualquer
momento, depois de um `bun run build`:

```sh
# 1. Nenhum padrão de segredo no bundle que vai ao navegador
grep -rloE "sb_secret_|eyJhbGciOi|SUPABASE_SERVICE|-----BEGIN" .output/public

# 2. Nenhuma service_role embutida no bundle do servidor
grep -rloE "sb_secret_|SUPABASE_SERVICE_ROLE_KEY" .output/server

# 3. Nenhum segredo no histórico do git
git log --all -p | grep -iE "sb_secret_|service_role\s*=|SUPABASE_SERVICE_ROLE_KEY\s*="
```

Os três devem sair vazios. Ocorrências de `service_role` como **texto**
em comentário ou em mensagem de aviso da biblioteca do Supabase são
esperadas e inofensivas — o que importa é não haver o valor da chave.

Resultado da auditoria de 2026-08-02: os três limpos. No bundle do
cliente aparecem apenas a URL e a chave publishable, como esperado.

### Rotação de chave

A chave publishable pode ser rotacionada no painel do Supabase sem
downtime do banco: gerar a nova, atualizar a variável no ambiente do
deploy, **rebuildar** e publicar. A `service_role` é rotacionada no mesmo
painel e não exige mudança no frontend — só reiniciar as Edge Functions.
**[validar]**

## Publicação

1. Garantir `main` verde: `bun run lint`, `bun run build`, `bun run test`.
2. Aplicar migrations pendentes: `bunx supabase db push`.
3. Validar o checklist manual (`CHECKLIST_PUBLICACAO_SEAC_SOCIAL.md`)
   no ambiente de homologação.
4. Publicar (Lovable Publish ou `npx nitro deploy --prebuilt`). **[validar]**

## Backup

O que precisa de backup é somente o banco (o código vive no GitHub e o
frontend é reconstruível a partir dele).

### Pré-requisito — leia antes de tentar

`bunx supabase db dump` **não roda sem Docker**: a CLI executa o
`pg_dump` dentro de um contêiner. Numa máquina sem Docker o comando
falha com `LegacyDockerRunError`, verificado em 2026-08-02 neste
ambiente WSL. O runbook anterior apresentava o comando como pronto para
uso; não estava.

Há dois caminhos, e basta um:

- **Docker Desktop instalado** → a CLI funciona como documentado abaixo.
- **`postgresql-client` instalado** → usar `pg_dump` direto, sem Docker.
  A versão do cliente precisa ser **>= a do servidor** (hoje PostgreSQL
  17.6 no Supabase). Um `pg_dump` 16 recusa dumpar um servidor 17 —
  conferir com `pg_dump --version` antes de confiar no backup.

A string de conexão está no painel do Supabase em Settings → Database.
Ela contém a senha do banco: nunca colar em commit, issue ou log.

### Backup lógico manual

Com Docker (Supabase CLI):

```sh
bunx supabase db dump -f backup_schema_$(date +%Y%m%d).sql
bunx supabase db dump --data-only -f backup_dados_$(date +%Y%m%d).sql
```

Sem Docker (`pg_dump` direto):

```sh
pg_dump "$CONNECTION_STRING" --schema-only --no-owner \
  --schema=public --schema=private \
  -f backup_schema_$(date +%Y%m%d).sql
pg_dump "$CONNECTION_STRING" --data-only --no-owner \
  --schema=public \
  -f backup_dados_$(date +%Y%m%d).sql
```

**Nunca usar `--no-privileges` aqui.** A flag remove todos os `GRANT` e
`REVOKE` do dump — e é neles que mora metade do modelo de autorização
deste projeto (a outra metade são as policies). Medido em 2026-08-02 no
banco de produção: com a flag, 0 grants e 0 revokes no arquivo; sem ela,
98 grants e 34 revokes. Restaurar o primeiro produz um banco que parece
íntegro e onde a aplicação não consegue ler nada.

O `--schema=private` também é obrigatório: os predicados de autorização
(`private.usuario_atual_pode_gerir_familias()` e companhia) vivem nesse
schema, e sem eles as policies não funcionam.

- Executar antes de qualquer migration destrutiva e antes da publicação.
- Guardar os arquivos fora da máquina de desenvolvimento (drive
  institucional da SEAC). Conteúdo tem dados pessoais de famílias
  (LGPD): armazenar cifrado e com acesso restrito. **[validar]**

### Backup automático (painel Supabase)

- Conferir no painel do projeto (Database → Backups) a política de
  backups automáticos do plano contratado e a retenção. **[validar]**
- Esta é a rede de proteção principal enquanto o backup manual não
  estiver rodando com regularidade: o backup automático do provedor não
  depende de ninguém lembrar de executá-lo.

## Restauração

1. Criar um projeto/banco de teste (nunca restaurar por cima da
   produção sem confirmação explícita).
2. Aplicar o dump de schema e depois o de dados:

```sh
psql "$DATABASE_URL_DE_TESTE" -f backup_schema_YYYYMMDD.sql
psql "$DATABASE_URL_DE_TESTE" -f backup_dados_YYYYMMDD.sql
```

3. **Verificar os objetos de segurança** — este é o passo que decide se
   a restauração passou:

```sh
psql "$CONNECTION_STRING_ORIGEM"    -f supabase/verificacao_restauracao.sql > origem.txt
psql "$DATABASE_URL_DE_TESTE"       -f supabase/verificacao_restauracao.sql > restaurado.txt
diff origem.txt restaurado.txt
```

O script compara tabelas sem RLS, políticas por tabela, grants para
`anon`, funções com seu modo de segurança, triggers, constraints e
volume por tabela. **Qualquer diferença reprova a restauração.**

O modo de falha que isso pega: um dump que restaura as tabelas mas perde
as políticas de RLS deixa o banco aparentemente íntegro e completamente
aberto. Conferir só se "os dados voltaram" não detecta isso.

4. Apontar um `.env.local` de teste para o banco restaurado e validar
   os fluxos críticos (login, detalhe de família, atendimento).
5. Registrar a data do teste de restauração aqui. **[validar — o
   aceite do Sprint 6 exige restauração testada]**

## Incidentes comuns

- **Tela mostra "Não foi possível consultar o Supabase":** verificar
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no ambiente publicado e
  o status do projeto Supabase; as telas têm "Tentar novamente".
- **Migration aplicada só em parte dos ambientes:** `bunx supabase
  migration list` mostra o estado; `db push` aplica as pendentes.
- **Regressão após publicação:** o repositório é Lovable-connected —
  nunca force-push; reverter via PR de revert no GitHub.

## Auditoria e LGPD

- `auditoria_eventos` é append-only (sem UPDATE/DELETE) — não há
  procedimento de "limpeza" de auditoria; é intencional.
- Dados pessoais (pessoas, famílias, observações sociais) ficam apenas
  no Supabase com RLS; dumps de backup herdam essa sensibilidade.
