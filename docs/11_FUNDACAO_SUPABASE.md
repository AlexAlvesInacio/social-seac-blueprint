# Fundação Supabase — SEAC Social

## Objetivo

Esta etapa prepara a integração técnica com o Supabase sem migrar os módulos de
Famílias, Atendimento, Estoque, Recebimentos ou Relatórios. As telas, rotas,
stores locais e regras de negócio homologadas permanecem inalteradas.

## Variáveis de ambiente

O cliente usa exclusivamente estas variáveis do Vite:

- `VITE_SUPABASE_URL`: URL pública do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: chave pública de frontend (`anon` legada ou chave
  publicável compatível).

Copie `.env.example` para `.env.local` e preencha os valores do seu projeto:

```sh
cp .env.example .env.local
```

O arquivo `.env.local` é ignorado pelo Git. Quando as variáveis não estão
definidas, o cliente não é inicializado, uma mensagem clara é exibida no
console de desenvolvimento e o build continua funcionando. Uma chamada ao
serviço de autenticação sem configuração lança um erro explícito.

## Perfis iniciais

Os papéis centrais definidos são:

- `administrador`
- `atendente`
- `estoque`

Os status permitidos são:

- `pendente`
- `ativo`
- `inativo`

A interface `Perfil` contém `id`, `nome`, `email`, `telefone` opcional,
`papel`, `status`, `created_at` e `updated_at`. Nenhum perfil fictício foi
adicionado. Esta tipagem é a base futura do banco; os stores e comportamentos
atuais continuam preservados nesta etapa.

## Arquivos da fundação

- `src/lib/supabase/client.ts`: cliente central e validação da configuração.
- `src/lib/auth/types.ts`: tipos centrais de perfil, papel e status.
- `src/lib/auth/auth-service.ts`: operações tipadas de login, logout, sessão,
  usuário atual e redefinição de senha.
- `.env.example`: modelo sem valores reais.

## Ainda não implementado

- Integração da tela `/auth` com o novo serviço.
- Cadastro público de usuários.
- Tabelas, migrações, triggers, políticas RLS e vínculo entre `auth.users` e
  perfis.
- Controle de acesso efetivo por papel e status.
- Migração dos dados dos stores locais.
- Migração dos módulos de Famílias, Atendimento, Estoque, Recebimentos e
  Relatórios.

## Próximos passos

1. Projetar a tabela de perfis e suas políticas RLS.
2. Criar migrações versionadas e gerar os tipos TypeScript do banco.
3. Definir o fluxo administrativo de ativação de usuários.
4. Integrar `/auth` e validar sessão sem remover o fluxo atual antes da
   homologação.
5. Migrar os módulos gradualmente, com validação das regras já aprovadas.

## Segurança

- Nunca colocar URL ou chave real no código-fonte ou na documentação.
- Nunca usar chave `service_role` ou secret key no frontend. Essas chaves
  ignoram RLS e devem existir somente em ambientes de backend controlados.
- A variável `VITE_SUPABASE_ANON_KEY` é incorporada ao bundle do navegador e,
  portanto, deve receber apenas uma chave pública de frontend.
- Habilitar RLS em todas as tabelas expostas e aplicar políticas de menor
  privilégio antes de consumir dados reais.
- Não usar metadados editáveis pelo usuário para decisões de autorização.
- Manter arquivos `.env` reais fora do Git e rotacionar qualquer chave que seja
  exposta indevidamente.
