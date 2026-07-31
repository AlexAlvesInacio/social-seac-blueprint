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
  jamais entra no frontend ou no repositório).

## Publicação

1. Garantir `main` verde: `bun run lint`, `bun run build`, `bun run test`.
2. Aplicar migrations pendentes: `bunx supabase db push`.
3. Validar o checklist manual (`CHECKLIST_PUBLICACAO_SEAC_SOCIAL.md`)
   no ambiente de homologação.
4. Publicar (Lovable Publish ou `npx nitro deploy --prebuilt`). **[validar]**

## Backup

O que precisa de backup é somente o banco (o código vive no GitHub e o
frontend é reconstruível a partir dele).

### Backup lógico manual (Supabase CLI)

```sh
# Schema + dados (roles/policies incluídos no schema do projeto)
bunx supabase db dump -f backup_schema_$(date +%Y%m%d).sql
bunx supabase db dump --data-only -f backup_dados_$(date +%Y%m%d).sql
```

- Executar antes de qualquer migration destrutiva e antes da publicação.
- Guardar os arquivos fora da máquina de desenvolvimento (drive
  institucional da SEAC). Conteúdo tem dados pessoais de famílias
  (LGPD): armazenar cifrado e com acesso restrito. **[validar]**

### Backup automático (painel Supabase)

- Conferir no painel do projeto (Database → Backups) a política de
  backups automáticos do plano contratado e a retenção. **[validar]**

## Restauração

1. Criar um projeto/banco de teste (nunca restaurar por cima da
   produção sem confirmação explícita).
2. Aplicar o dump de schema e depois o de dados:

```sh
psql "$DATABASE_URL_DE_TESTE" -f backup_schema_YYYYMMDD.sql
psql "$DATABASE_URL_DE_TESTE" -f backup_dados_YYYYMMDD.sql
```

3. Apontar um `.env.local` de teste para o banco restaurado e validar
   os fluxos críticos (login, detalhe de família, atendimento).
4. Registrar a data do teste de restauração aqui. **[validar — o
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
