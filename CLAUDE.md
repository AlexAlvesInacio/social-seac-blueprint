# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Responda sempre em **português do Brasil** — toda comunicação com o usuário, explicações,
descrições de commits/PRs e comentários no código. O código-fonte e a documentação deste
projeto são em português; mantenha esse padrão em qualquer conteúdo que você produzir.

## What this is

SEAC Social — an app for a Brazilian social charity (SEAC — Sopa, Esperança, Amor e Caridade)
to manage assisted families, eligibility screening, benefit delivery (food baskets), stock, and
audit history. Domain language is **Portuguese**: entities, routes, DB columns, and business terms
are Portuguese (`familias`, `assistidos`, `atendimento`, `estoque`, `recebimentos`) — match this,
don't anglicize. UI copy is Portuguese.

## Commands

Package manager is **Bun** (not npm/yarn/pnpm).

```sh
bun run dev        # vite dev server
bun run build      # production build (nitro → Cloudflare target by default)
bun run lint       # eslint .
bun run format     # prettier --write .
```

Before finishing a code change, run `bun run lint`, `bun run build` and `bunx tsc --noEmit`
(the typecheck is clean as of 2026-07-31 — keep it at 0 errors). There is a test suite
(`bun run test`, via the native `bun test` runner) covering pure logic: atendimento rules,
relatórios logic, faixa etária, and the famílias mapper (`src/lib/**/*.test.ts`) — run it when you
touch that logic. **Component tests** run in the same command: happy-dom is registered globally by
`src/test-setup.ts` (wired through `[test] preload` in `bunfig.toml`), with `@testing-library/react`
and `user-event`. Write them as `*.test.tsx` beside the component and mock its hooks with
`mock.module`. Supabase/integration tests are still not set up; don't claim those were run.

Supabase (local dev CLI available via `bunx supabase`):
```sh
bunx supabase migration new <name>   # create a timestamped migration in supabase/migrations/
bunx supabase db push                # apply migrations to the linked project
```
Environment: copy `.env.example` → `.env.local` and fill `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Only public frontend keys go here — **never** put `service_role` or any
secret key in the frontend or repo. When env vars are absent the Supabase client is `null` and the
build still succeeds (see `src/lib/supabase/client.ts`).

## Architecture

**Stack:** React 19 + TypeScript, TanStack Start (SSR) + Router + React Query, Vite 8, Tailwind v4,
shadcn/ui (new-york style) over Radix, Zustand, Supabase, Recharts, Zod + react-hook-form.

**SSR entry chain:** `src/start.ts` (request middleware wrapping errors) → `src/server.ts`
(fetch handler that normalizes h3-swallowed 500s into a rendered error page) → `src/router.tsx`
(creates the router + a React Query `QueryClient` passed as router context). Vite config extends
`@lovable.dev/vite-tanstack-config` — that preset already wires TanStack Start, React, Tailwind,
tsconfig paths, nitro, env injection, and the `@/` alias. **Do not** re-add those plugins.

**Routing:** file-based in `src/routes/` (see `src/routes/README.md`). `__root.tsx` is the only
shell — preserve its `<Outlet />`. `routeTree.gen.ts` is auto-generated; never edit by hand. Dynamic
segments use bare `$` (`familias.$id.tsx` → `/familias/:id`). Pages wrap content in `<AppShell>`
(`src/components/app-shell.tsx`), which gates access via `<RequireActiveProfile requiredRole?>`.

**Data sources (migration nearly complete):** The operational modules (familias, assistidos,
atendimento, estoque, recebimentos, painel, relatórios, auditoria) read/write **Supabase** through
the domain service layer below. Famílias became Supabase-only on 2026-07-30 (`familias-store.ts`
and `atendimento-store.ts` were deleted). Auxiliary registries (unidades, categorias,
doadores, fornecedores, plus the Itens/Benefícios catalog tabs over `itens_estoque`/`beneficios`)
live in Supabase via `src/lib/cadastros/cadastros-supabase.ts` (2026-07-30); `config-store.ts` was
deleted. Convention: `itens_estoque.categoria`/`unidade` store the registry **nome** ("Alimentos",
"Pacote"). One legacy **Zustand/localStorage store** remains: `src/lib/relatorios-store.ts` (report
definitions/pure logic, partly reused by `relatorios-supabase.ts`). Check `docs/07_STATUS_IMPLEMENTACAO.md` before
asserting any feature's status.

**Domain service layer (target pattern, see `src/lib/familias/`):** UI never touches Supabase
directly. Layers: React Query hook (`use-familias-supabase.ts`) → repository
(`familias-repository.ts`, typed CRUD returning a `{ data, error }` result union) → mapper
(`familias-mapper.ts`, DB rows → domain read models) → Supabase types (`familias-supabase-types.ts`).
Repositories return typed errors, never throw to the UI; hooks translate errors into thrown query
errors. Auth follows the same shape in `src/lib/auth/` (`auth-service.ts`, `auth-guard.tsx`,
`user-admin-service.ts`).

**Database (`supabase/migrations/`):** every exposed table has RLS. Writes go through
`SECURITY INVOKER` PostgreSQL RPC functions (e.g. `criar_familia_com_responsavel`,
`criar_assistido`) that are transactional and rely on existing grants/policies + helper predicates
(`private.usuario_atual_pode_gerir_familias()`) for authorization — they do not bypass RLS. Authorship
(`criado_por` = `auth.uid()`) and timestamps are set by triggers, never accepted as params. Auth
identity/roles live in `profiles`: roles `administrador | atendente | estoque`, status
`pendente | ativo | inativo` (role and status are separate columns — don't conflate them).

## Business rules — non-negotiable

The delivery/eligibility logic is authoritative in code at
`src/lib/atendimento-regras.ts` → `verificarElegibilidadeAtendimento(assistido, estoque)`, returning
one scenario: `liberado_padrao | liberado_extra | bloqueio_25dias | bloqueio_estoque | extra_completou`.
The "Regras e fluxo" accordion in the UI is explanatory only and does not drive behavior.

Key rules (full source: `REGRAS_ATENDIMENTO_SEAC.md`, `PROJECT_KNOWLEDGE.md`):
- Minimum **25 days** between withdrawals; block otherwise, showing next allowed date + days left.
- Only an **administrador** can grant an exceptional early release, and only with a mandatory reason.
- **Stock shortage always blocks** delivery — never overridable by exceptional release.
- Definitive registration → Cesta Padrão; extra/under-evaluation → Cesta Extra, max **3** withdrawals,
  and the system never auto-converts extra → definitive.
- Every attempt (delivered, blocked, exceptional, pre-registration) must generate history; important
  actions generate audit records. A confirmed delivery triggers an automatic stock write-down
  ("Baixa automática" / origin "Entrega realizada").

## Conventions & constraints

- **Path alias:** `@/` → `src/`. shadcn aliases: `@/components/ui`, `@/lib`, `@/hooks`, `@/lib/utils` (`cn`).
- **Commits** (only when explicitly authorized): `feat: | fix: | docs: | refactor: | test: | chore:`.
- **Lovable-connected repo:** commits to the connected branch sync to Lovable. Never force-push, rebase,
  amend, or squash already-pushed history. Keep the branch compilable in small increments.
- ESLint bans importing `server-only`; use `*.server.ts` or `@tanstack/react-start/server-only` instead.
- Bun enforces a 24h supply-chain delay on new packages (`bunfig.toml`); confirm with the user before
  adding any `minimumReleaseAgeExcludes` entry.
- Do not delete a legacy Zustand store before its Supabase replacement is homologated.

## Official doc reading order (from AGENTS.md)

1. `AGENTS.md` → 2. `PROJECT_KNOWLEDGE.md` → 3. `REGRAS_ATENDIMENTO_SEAC.md` →
4. `docs/02_REGRAS_NEGOCIO.md` → 5. `docs/07_STATUS_IMPLEMENTACAO.md` → 6. the architecture/security/flow
doc for the module in scope (`docs/01_ARQUITETURA.md`, `docs/03_MODELAGEM_SUPABASE.md`,
`docs/05_SEGURANCA.md`, `docs/11_FUNDACAO_SUPABASE.md`) → 7. the module's current code.
`REGRAS_ATENDIMENTO_SEAC.md` is the official source for atendimento; other homologated rules live in
`docs/REGRAS_APROVADAS_SEAC_SOCIAL.md`. Record divergences — never resolve them by assumption.
