# Deploy na Vercel

Procedimento para publicar o SEAC Social na Vercel (issues #48 e #49). Escrito em
2026-08-06, a partir da configuração real do projeto.

## O que **não** precisa mudar no código

A tentação é fixar `preset: "vercel"` no `vite.config.ts`. **Não faça isso.**

O `vite.config.ts` usa `@lovable.dev/vite-tanstack-config`, que embute o nitro. A
documentação do próprio pacote (`dist/index.d.ts`) diz:

> nitro runs on every production build, defaulting to the `cloudflare-module`
> preset — zero-config target auto-detection (`NITRO_PRESET`,
> Vercel/Netlify/Cloudflare Pages) still wins, so a self-deploy auto-targets its
> own platform.

Ou seja: **dentro da Vercel o nitro detecta a plataforma sozinho** e gera a saída no
formato dela (Build Output API v3, em `.vercel/output`). Fixar o preset à mão não só
é desnecessário como atrapalha: o mesmo documento avisa que, dentro de um build do
Lovable, preset e layout de saída são forçados para Cloudflare de qualquer forma.
Hardcodar `vercel` quebraria o build do Lovable sem ganhar nada.

Se algum dia for preciso forçar, o caminho é a variável de ambiente `NITRO_PRESET`
na Vercel — não o arquivo de configuração.

## Configuração do projeto na Vercel

| Campo | Valor |
| --- | --- |
| Framework Preset | **Other** |
| Install Command | *(deixe o padrão)* — a Vercel detecta o `bun.lock` e usa `bun install` |
| Build Command | `bun run build` |
| Output Directory | *(deixe vazio)* — o nitro escreve em `.vercel/output`, que a Vercel lê sozinha |
| Node.js Version | 22.x |

Não há `vercel.json` no repositório, e é proposital: tudo acima é detecção
automática, e um arquivo de configuração a mais seria uma fonte de divergência.

## Variáveis de ambiente

Só duas, e as duas são **públicas**:

```
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
```

Cadastre nos três ambientes (Production, Preview, Development).

Dois pontos que não são óbvios:

- O prefixo `VITE_` faz o valor ser **embutido no bundle** que qualquer visitante
  baixa. Isso é esperado — quem protege os dados é a RLS do Supabase, não o segredo
  da chave. Por isso `service_role`, `sb_secret_…` e a senha do banco **nunca** entram
  aqui: elas dariam acesso irrestrito, ignorando toda a RLS.
- Como são embutidas no build, mudá-las exige **novo deploy**. Alterar a variável no
  painel não muda o site já publicado.

Se as variáveis faltarem, o build ainda passa: `src/lib/supabase/client.ts` deixa o
cliente como `null`. O site sobe e falha no login, sem erro de build — vale conferir
antes de considerar o deploy bem-sucedido.

## Supabase: autorizar o domínio (passo que costuma ser esquecido)

`solicitarRecuperacaoSenha` (`src/lib/auth/auth-service.ts:65`) monta o link de
recuperação como `${window.location.origin}/definir-senha`. Se o domínio não estiver
autorizado, o Supabase recusa o redirecionamento e **ninguém consegue definir a
própria senha** — o que trava a criação dos usuários reais da issue #49.

Em Supabase → Authentication → URL Configuration:

- **Site URL**: o domínio de produção (ex.: `https://seac-social.vercel.app` ou o
  domínio próprio, se houver).
- **Redirect URLs**: acrescente
  - `https://<dominio-de-producao>/definir-senha`
  - `https://<dominio-de-producao>/**` — cobre as demais rotas
  - `https://*-<escopo>.vercel.app/**` se quiser que os deploys de *preview*
    também funcionem. **Pense antes**: preview aponta para o mesmo banco de
    produção, com dados reais de 1.018 famílias.

## Cabeçalhos de segurança

`public/_headers` é convenção do **Cloudflare**. Na Vercel ele é ignorado — o arquivo
continuaria no repositório dando a impressão de proteção que não existiria.

Por isso os cabeçalhos passaram a ser aplicados em `src/server.ts`, no handler que
toda resposta atravessa. Assim eles acompanham a aplicação, não a plataforma:

```
X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
Permissions-Policy, Strict-Transport-Security
```

**Cobertura:** o handler responde pelo HTML e pelas rotas do servidor. Arquivos
estáticos (`/assets/*`, o logo) são servidos direto pela CDN e **não** passam por ele.
No Cloudflare o `_headers` cobre também os estáticos — por isso o arquivo continua no
repositório. Se um dia quiser a mesma cobertura na Vercel, o caminho é `vercel.json`
com `headers`; não foi feito agora porque não confirmei se a Vercel aplica esse bloco
quando o build usa o Build Output API, e configuração que talvez não funcione é pior
do que configuração nenhuma. Teste antes de confiar.

Content-Security-Policy segue fora, pelo motivo de sempre: CSP em app SSR quebra
fácil e precisa de teste tela a tela.

## Conferência depois do primeiro deploy

1. **O site sobe** e a tela de login aparece.
2. **O login funciona** — se falhar, quase sempre é variável de ambiente ausente.
3. **Recuperação de senha** chega por e-mail e o link abre `/definir-senha` sem erro
   de redirecionamento. É o teste que valida o passo do Supabase acima.
4. **Cabeçalhos**: `curl -sD - -o /dev/null https://<dominio>/auth | grep -i x-frame`
   deve devolver `DENY`.
5. **Uma tela de cada módulo** — Painel, Famílias, Estoque, Atendimento — para
   confirmar que a SSR e a leitura do Supabase funcionam em produção.
6. **Auditoria**: registrar uma movimentação de estoque e ver o evento aparecer.

## Relação com o Cloudflare / Lovable

Publicar na Vercel **não desliga** nada: o repositório continua conectado ao Lovable,
e o build do Lovable continua saindo para Cloudflare, porque lá o preset é forçado.
São dois destinos a partir do mesmo código.

Se a intenção for aposentar o Cloudflare, isso é decisão à parte — e aí o `_headers`
e o `.wrangler/` saem do repositório junto.
