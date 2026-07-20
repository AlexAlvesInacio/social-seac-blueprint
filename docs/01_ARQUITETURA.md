# Arquitetura — SEAC Social

## Arquitetura atual

O frontend é uma aplicação React/TypeScript com TanStack Start e rotas baseadas
em arquivos. Componentes consomem diretamente stores Zustand. O middleware
`persist` grava dados no localStorage. Algumas telas usam coleções estáticas e
estado React apenas durante a sessão.

A fundação Supabase contém cliente central e serviço inicial de autenticação,
mas nenhum fluxo funcional os utiliza. A tela `/auth` navega diretamente ao
painel, sem validar credenciais ou proteger rotas.

## Arquitetura alvo

1. A interface captura intenções e renderiza estados.
2. Serviços de domínio validam entradas e coordenam operações.
3. O cliente Supabase realiza autenticação e acessa a API de dados.
4. PostgreSQL aplica integridade, relacionamentos e transações.
5. RLS aplica autorização por identidade e papel.
6. Eventos críticos são registrados em auditoria persistente.

## Camadas

### Interface

Rotas, componentes e formulários. Não deve conter chaves privilegiadas nem
duplicar regras críticas que pertencem ao domínio ou ao banco.

### Serviços

Camada TypeScript tipada para autenticação e domínios. Deve converter modelos,
normalizar erros e manter a interface desacoplada do mecanismo de persistência.

### Banco

PostgreSQL no Supabase, com chaves, restrições, índices, timestamps, políticas
RLS e funções transacionais apenas quando justificadas.

## Supabase e autenticação

Supabase Auth será responsável por identidade e sessão. `profiles` manterá os
dados institucionais e o papel aprovado. Usuários pendentes ou inativos não
terão acesso operacional. Rotas e interface podem melhorar a experiência, mas
a autorização efetiva deve existir nas políticas do banco.

## PostgreSQL, Storage e RLS

- PostgreSQL será a fonte de verdade dos módulos migrados.
- Storage será usado somente quando anexos entrarem no escopo, com buckets e
  políticas próprias.
- Toda tabela exposta terá RLS habilitada e políticas de menor privilégio.
- Papel não será confiado a metadado editável pelo usuário.
- `service_role` e secret keys nunca serão enviados ao navegador.

## Auditoria

A auditoria alvo é append-only para usuários comuns. Eventos devem incluir
autor, instante, ação, módulo, registro afetado e justificativa quando exigida.
Limpeza ou alteração de eventos não deve estar disponível na operação comum.

## Fluxo de dados alvo

Interface → serviço tipado → cliente Supabase → RLS/PostgreSQL → resultado
tipado → atualização da interface. Entregas devem registrar histórico,
movimentação e auditoria na mesma operação transacional.

## Substituição gradual do localStorage

1. Inventariar contrato e regras de cada store.
2. Criar schema, RLS, tipos e serviço do módulo.
3. Ler do Supabase atrás de uma interface estável.
4. Validar equivalência com o comportamento homologado.
5. Migrar escrita e dados necessários.
6. Remover a persistência local somente após homologação explícita.

Famílias deve preceder Atendimento; Estoque deve estar consistente antes de
ativar entregas remotas. Não haverá migração simultânea de todos os módulos.

## Cuidados com Lovable e Git

- Preservar a estrutura TanStack e o `<Outlet />` da rota raiz.
- Não editar `src/routeTree.gen.ts` manualmente.
- Manter a branch compilável e mudanças pequenas.
- Não fazer force push, rebase, amend ou squash de commits já sincronizados.
- Commits enviados à branch conectada aparecem no Lovable.

