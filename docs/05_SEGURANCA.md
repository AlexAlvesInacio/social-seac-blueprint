# Segurança e privacidade

## Dados tratados

O sistema trata nomes, CPF/RG/outros documentos, telefone, email, nascimento,
endereço, parentesco, histórico de assistência e registros de operação. Pode
tratar dados sensíveis ou de maior risco, como PCD, saúde, gestação e
observações sociais.

## Autenticação, papéis e status

Supabase Auth será a fonte de identidade. Papéis previstos:

- `administrador`
- `atendente`
- `estoque`

Status previstos:

- `pendente`
- `ativo`
- `inativo`

Papel e status devem ficar em dados institucionais protegidos, não em metadados
editáveis pelo próprio usuário.

## Proteção de rotas e RLS

Proteção visual de rota não é autorização suficiente. Todas as tabelas expostas
devem ter RLS e políticas de menor privilégio. Administrador acessa funções
administrativas; atendente acessa cadastros e atendimento; estoque acessa
estoque e recebimentos. Exceções precisam ser explícitas e auditadas.

## Chaves e variáveis de ambiente

- Valores reais ficam em `.env.local` ou secrets da plataforma.
- Variáveis `VITE_*` são públicas no bundle e só podem conter URL e chave
  pública/publicável.
- É proibido usar `service_role` ou secret key no frontend.
- Segredos nunca entram em código, Markdown, commits, logs ou capturas.

## Auditoria imutável

Eventos devem ser append-only para usuários comuns. Correções são novos eventos,
não edição silenciosa. A limpeza local existente é incompatível com a auditoria
de produção e deverá ser substituída durante a migração.

## Backup e continuidade

- Definir frequência, retenção, criptografia e responsáveis por backup.
- Testar restauração periodicamente.
- Registrar plano para indisponibilidade durante atendimento.
- Versionar migrations e validar recuperação antes da publicação.

## LGPD

- Definir finalidade e base legal para cada conjunto de dados.
- Coletar apenas o necessário e limitar acesso por função.
- Informar retenção, correção, anonimização e descarte.
- Evitar dados sensíveis em observações livres quando não forem necessários.
- Registrar incidentes e procedimento de resposta.

## Cuidados com localStorage

O localStorage não é adequado como fonte de verdade de dados pessoais em
produção: é acessível ao JavaScript da origem, não oferece autorização central,
backup ou auditoria confiável e permanece no dispositivo. O uso atual é apenas
local/demonstrativo e deve ser substituído gradualmente.

