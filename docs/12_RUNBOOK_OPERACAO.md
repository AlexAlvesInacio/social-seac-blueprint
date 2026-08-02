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

## Carga inicial do estoque (dados reais)

Procedimento para trocar os números de protótipo pelos reais da SEAC
(issue #46). Vale também para qualquer inventário físico posterior.

### Por que não é um `update` no banco

Desde a migration `20260802143000`, `saldo` só muda pelas RPCs de
movimentação: um `update` direto é recusado com `SEAS1`, e um `insert`
com saldo diferente de zero também. Isso é proposital — é o que garante
que todo saldo tenha uma linha de ledger correspondente.

Logo, a carga inicial **não** é uma migration de `update`. É uma
operação de estoque como qualquer outra, feita pela aplicação, por um
administrador identificado. O efeito colateral é bom: o ledger nasce
coerente com o saldo desde o primeiro dia, e a auditoria mostra quem
lançou o quê.

### O tipo de movimentação certo é "Ajuste"

As três opções não são equivalentes:

| Tipo | O que o campo de quantidade significa |
| --- | --- |
| Entrada | quantidade **somada** ao saldo |
| Saída | quantidade **subtraída** do saldo |
| **Ajuste** | **novo saldo alvo** (absoluto) |

Para inventário use **Ajuste**: informa-se a quantidade contada na
prateleira e o sistema calcula sozinho a diferença, registrando o delta
no ledger. Com Entrada seria preciso calcular a diferença na mão, e
qualquer erro de conta vira divergência permanente.

### Passo a passo

1. **Contar fisicamente** o que existe, item a item, e anotar. A
   contagem é a fonte da verdade — não parta dos números do sistema.
2. **Conferir o catálogo** em Configurações → Itens. Item que a SEAC usa
   e não está lá precisa ser criado antes; ele nasce com saldo 0 (o
   trigger não aceita outra coisa) e recebe o saldo no passo seguinte.
   Item que não é mais usado deve ser **inativado**, nunca excluído —
   excluir quebraria o histórico de movimentações que aponta para ele.
3. **Lançar o ajuste** de cada item em Estoque → Ajuste, preenchendo
   "Novo saldo" com o valor contado e, no motivo, algo que identifique a
   operação: `Inventário inicial AAAA-MM-DD`. O motivo aparece no ledger
   e é o que permite, meses depois, separar a carga inicial do
   movimento do dia a dia.
4. **Repetir para os benefícios** (cestas montadas prontas em estoque),
   se houver.
5. **Conferir no Painel** que os totais batem com a contagem.

### Sobre os dados de homologação

Antes da carga, decidir o que fazer com o que foi criado durante os
testes — famílias, entregas, movimentações. Duas observações:

- **Nada disso deve ser apagado sem conferência.** Se alguma família de
  verdade já foi cadastrada durante a homologação, apagar destrói
  registro real de uma pessoa assistida.
- Entregas, tentativas e movimentações **não podem** ser apagadas pela
  aplicação (sem `DELETE` para `authenticated` desde a `20260802170000`);
  são histórico. Se for mesmo necessário zerar, é operação de banco,
  feita com backup na mão e decisão registrada.

O caminho mais limpo, quando o volume de teste é grande, costuma ser
começar com um projeto Supabase novo em vez de limpar o atual.

## Cabeçalhos de segurança

`public/_headers` define os cabeçalhos que o Cloudflare aplica a todas as
respostas: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy` e HSTS. O nitro acrescenta a regra de cache de
`/assets/*` ao gerar `.output/public/_headers`; os dois blocos convivem.

Dois pontos a verificar depois da primeira publicação:

- **`X-Frame-Options: DENY` impede que o site seja embutido em iframe.**
  Se a pré-visualização do Lovable (ou qualquer ferramenta) precisar
  embutir a aplicação publicada, isso vai parar de funcionar. A saída é
  trocar por um `Content-Security-Policy: frame-ancestors` liberando o
  domínio específico — não voltar para `SAMEORIGIN`, que não ajuda entre
  origens diferentes. **[validar]**
- **HSTS sem `includeSubDomains`, de propósito.** Estender a outros
  subdomínios do mesmo domínio os obrigaria a ter HTTPS válido, e não
  sabemos o que mais existe ali. Ampliar só com essa conferência feita.

Não há `Content-Security-Policy`: CSP em app SSR quebra fácil (estilos e
scripts inline do TanStack Start) e precisa de teste tela a tela.

## Publicação

1. Garantir `main` verde: `bun run lint`, `bun run build`, `bun run test`.
2. Aplicar migrations pendentes — **no WSL, sempre com `--db-url`**
   apontando para o pooler (ver "Incidentes comuns"):

```sh
bunx supabase db push \
  --db-url "postgresql://postgres.<project-ref>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

   Conferir depois com `bunx supabase migration list --db-url "…"`: toda
   migration precisa ter `local` **e** `remote` preenchidos.
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
- **`db push` "roda" mas nada chega ao banco (WSL).** Sintoma: o comando
  termina, aparentemente sem aplicar nada, ou falha com
  `LegacyDbConnectError: failed to connect to postgres`. Diagnosticado em
  2026-08-02: o host direto `db.<ref>.supabase.co` resolve **somente em
  IPv6** (`2600:1f1e:…`), e o WSL não tem rota IPv6 para a internet. O
  pooler (`aws-1-sa-east-1.pooler.supabase.com`) tem IPv4, então a
  solução é forçar a conexão por ele:

```sh
bunx supabase db push \
  --db-url "postgresql://postgres.<project-ref>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

  A senha é lida do `~/.pgpass`, então não precisa ir na URL. Para
  confirmar o diagnóstico numa máquina nova:
  `getent ahostsv4 db.<ref>.supabase.co` — se vier vazio, é este caso.

  **Este modo de falha é perigoso porque é silencioso**: em 2026-08-02
  duas migrations de segurança ficaram só no repositório enquanto a
  produção seguia vulnerável, e a suposição de que tinham sido aplicadas
  durou até alguém consultar o banco. Depois de todo push, confira o
  estado real com `migration list` ou pelo próprio banco.
- **Migration aplicada só em parte dos ambientes:** `bunx supabase
  migration list --db-url "…"` mostra o estado; `db push` aplica as
  pendentes.
- **Regressão após publicação:** o repositório é Lovable-connected —
  nunca force-push; reverter via PR de revert no GitHub.

## Auditoria e LGPD

- `auditoria_eventos` é append-only (sem UPDATE/DELETE) — não há
  procedimento de "limpeza" de auditoria; é intencional.
- Dados pessoais (pessoas, famílias, observações sociais) ficam apenas
  no Supabase com RLS; dumps de backup herdam essa sensibilidade.
