# Fluxos operacionais

## Como ler este documento

Cada seção identifica o estado real do fluxo:

- **Atual/local:** comportamento comprovado hoje no frontend e nos stores.
- **Alvo Supabase:** comportamento futuro desejado, ainda não implementado,
  salvo indicação expressa em contrário.

Nenhuma descrição de fluxo-alvo significa que autenticação, banco, RLS ou
persistência remota estejam concluídos.

## Login

**Atual/local:** protótipo visual; o formulário navega ao painel sem validar
credenciais e não protege rotas.

**Alvo Supabase — ainda não implementado:**

1. Usuário informa email e senha.
2. Supabase Auth valida credenciais.
3. Sistema carrega o perfil institucional.
4. Perfil ativo segue para o painel; pendente ou inativo recebe bloqueio claro.

## Aprovação de usuário

**Atual/local:** tela visual sem usuários persistidos nem autorização real.

**Alvo Supabase — ainda não implementado:**

1. Usuário autenticado surge como pendente.
2. Administrador revisa identidade e necessidade de acesso.
3. Administrador define papel e ativa o perfil.
4. Alteração gera auditoria.

## Cadastro de família

**Atual/local:** criação em Zustand/localStorage. Não há banco ou RLS.

**Alvo Supabase — ainda não implementado:** manter o mesmo fluxo com serviço
tipado e persistência remota.

1. Atendente pesquisa documento para evitar duplicidade.
2. Informa responsável, contato, endereço e composição inicial.
3. Sistema valida campos e cria a família.
4. Criação gera auditoria.

## Cadastro de assistido

**Atual/local:** inclusão em store local a partir do detalhe da família.

**Alvo Supabase — ainda não implementado:**

1. Atendente abre uma família existente.
2. Pesquisa o documento em toda a base.
3. Informa dados, tipo de cadastro e benefício.
4. Sistema vincula o assistido à família e audita.

## Cadastro de membro

**Atual/local:** inclusão, vínculo e cálculo de faixa etária no store local.

**Alvo Supabase — ainda não implementado:**

1. Atendente abre a família.
2. Verifica duplicidade e informa dados e parentesco.
3. Sistema calcula faixa etária quando possível.
4. Ser membro não concede automaticamente direito a benefício.

## Atendimento por documento

**Atual/local:** busca dados dos stores locais. Sem cadastro encontrado, os
botões de pré-cadastro apenas exibem mensagens e não persistem dados.

1. Atendente pesquisa CPF, RG, nome ou telefone.
2. Sistema localiza assistido ativo e sua família.
3. Sistema recupera última entrega e retiradas extras.
4. Sistema executa a elegibilidade.

**Alvo Supabase — ainda não implementado:** consultar dados autorizados no
banco, mantendo os mesmos estados de tela e a mesma função/regra de domínio.

## Pré-cadastro

**Atual/local:** a criação de família pelo diálogo próprio funciona no store
local, e a inclusão de assistido funciona dentro de família existente. Porém,
as ações de pré-cadastro oferecidas diretamente após busca sem resultado apenas
mostram mensagens; não criam família, assistido, entrega ou histórico.

**Alvo Supabase — ainda não implementado:**

1. Preservar o documento pesquisado e identificar o tipo: nova família ou novo
   assistido.
2. Gravar dados cadastrais mínimos da família e/ou pessoa.
3. Registrar data/hora, usuário, motivo/contexto e vínculos aplicáveis.
4. Sem entrega, registrar “Pré-cadastro criado”.
5. Com estoque e entrega válida, registrar “Pré-cadastro criado com entrega de
   Cesta Extra”, a entrega, a baixa automática e a auditoria.

## Elegibilidade

**Atual/local:** implementada pela função central com dados dos stores locais.

1. Verificar limite de três Cestas Extras.
2. Verificar intervalo mínimo de 25 dias.
3. Verificar saldo do benefício.
4. Retornar liberação ou motivo exato do bloqueio.

Os resultados oficiais são `liberado_padrao`, `liberado_extra`,
`bloqueio_25dias`, `bloqueio_estoque` e `extra_completou`. O accordion “Regras
e fluxo” é somente explicativo e não executa essas decisões.

**Alvo Supabase:** preservar a mesma regra com dados remotos e proteção contra
concorrência; ainda não implementado.

## Entrega

**Atual/local:** entrega elegível persiste no store local e reduz o saldo local
do benefício. Não existe transação de banco.

1. Atendente confere pessoa e benefício.
2. Confirma a entrega elegível.
3. Sistema registra entrega e baixa automática.
4. Sistema registra auditoria e atualiza histórico.

## Bloqueio

**Atual/local:** bloqueios por prazo e estoque podem ser gravados no store local.

1. Sistema identifica prazo ou estoque insuficiente.
2. Interface informa o motivo e, no prazo, a próxima data.
3. Operador registra a tentativa bloqueada.
4. Nenhuma baixa de estoque é realizada.

## Liberação excepcional

**Atual/local:** funciona no store local, mas o perfil administrador é simulado.

1. Bloqueio é exclusivamente por prazo.
2. Administrador informa motivo obrigatório.
3. Sistema confirma que há estoque.
4. Entrega excepcional, baixa e auditoria são registradas.

## Baixa de estoque

**Atual/local:** a entrega confirmada reduz o saldo local do benefício. As
entradas, saídas e os ajustes dos diálogos de Estoque não persistem.

1. Entrega ou operação autorizada solicita movimentação.
2. Sistema valida saldo e quantidade.
3. Registra movimentação do tipo **“Baixa automática”**, com origem **“Entrega
   realizada”**, vinculada à entrega.
4. Atualiza saldo de forma transacional.

**Alvo Supabase — ainda não implementado:** executar entrega, movimento,
auditoria e saldo na mesma operação transacional.

## Recebimentos

**Atual/local:** protótipo visual com dados estáticos; salvar não persiste nem
gera entrada de estoque.

**Alvo Supabase — ainda não implementado:**

1. Operador informa origem e parte relacionada.
2. Adiciona itens, quantidades e valores.
3. Confirma o recebimento.
4. Sistema cria entradas de estoque vinculadas e auditoria.

## Relatórios

**Atual/local:** tabelas e CSV são gerados a partir de stores e bases estáticas.

**Alvo Supabase — ainda não implementado:**

1. Usuário seleciona tipo e filtros.
2. Serviço consulta apenas dados autorizados.
3. Sistema apresenta total e linhas.
4. Exportação registra auditoria.

## Auditoria

**Atual/local:** eventos persistem em Zustand/localStorage e podem ser apagados;
não constituem auditoria imutável de produção.

**Alvo Supabase — ainda não implementado:**

1. Operação relevante produz evento.
2. Evento registra usuário, instante, ação, módulo e alvo.
3. Justificativa é incluída quando exigida.
4. Usuários comuns podem consultar conforme papel, mas não alterar eventos.
