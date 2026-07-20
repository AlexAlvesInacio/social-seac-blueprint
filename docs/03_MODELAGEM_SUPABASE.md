# Modelagem proposta para Supabase

Este documento é conceitual. Não contém SQL nem representa migrations já
aplicadas. Todas as tabelas expostas deverão ter RLS.

## Convenções gerais

Chaves primárias preferencialmente UUID, timestamps `created_at` e `updated_at`,
FKs explícitas, documentos normalizados para pesquisa e exclusão física evitada
quando houver histórico. Índices devem acompanhar FKs, buscas e filtros reais.

## Tabelas

### profiles

- Objetivo: perfil institucional ligado ao usuário autenticado.
- PK: `id`, correspondente a `auth.users.id`.
- Campos: nome, email, telefone, papel, status e timestamps.
- Relações: autor de eventos e operações.
- Restrições: papel administrador/atendente/estoque; status pendente/ativo/inativo.
- Índices: papel, status, email normalizado.
- Sensíveis: contato e identidade.
- Exclusão: preferir inativação; preservar referências históricas.

### familias

- Objetivo: núcleo familiar acompanhado.
- PK: `id` UUID.
- Campos: nome, responsável, documento normalizado, contatos, endereço, tipo,
  acompanhamento, status e timestamps.
- Relações: assistidos, membros, observações e entregas.
- Restrições: responsável e tipo obrigatórios; documento único quando informado.
- Índices: documento, nome, telefone, bairro, status.
- Sensíveis: identificação, contato e endereço.
- Exclusão: inativar quando houver vínculos.

### assistidos

- Objetivo: pessoas autorizadas a receber benefício.
- PK: `id` UUID; FK `familia_id`.
- Campos: nome, documento, telefone, nascimento, tipo, benefício, status, PCD.
- Relações: família, entregas e bloqueios.
- Restrições: documento único quando informado; família obrigatória.
- Índices: família, documento, nome, telefone, status.
- Sensíveis: identificação, nascimento e PCD.
- Exclusão: inativar com histórico.

### membros_familiares

- Objetivo: composição familiar sem pressupor direito a benefício.
- PK: `id` UUID; FK `familia_id`; FK opcional `assistido_id`.
- Campos: nome, parentesco, documento, contato, nascimento e marcadores sociais.
- Restrições/índices: família e documento; impedir duplicidade aplicável.
- Sensíveis: identificação, idade, gestação, saúde/PCD.
- Exclusão: preservar ou anonimizar conforme vínculos e política LGPD.

### observacoes_sociais

- Objetivo: registrar acompanhamento da família.
- PK: `id`; FKs família e autor.
- Campos: tipo, texto e timestamp.
- Índices: família e data decrescente.
- Sensíveis: conteúdo social e de saúde.
- Exclusão: acesso restrito; política formal de retenção.

### beneficios

- Objetivo: catálogo de benefícios entregáveis.
- PK: `id`; campos código, nome, tipo, controle de estoque e status.
- Relações: entregas, composição e estoque.
- Restrições: código e nome únicos.
- Índices: status e nome.
- Sensíveis: não.
- Exclusão: inativar quando usado.

### itens_estoque

- Objetivo: catálogo e saldo controlado de itens/benefícios.
- PK: `id`; campos código, nome, categoria, unidade, mínimo, valor e status.
- Relações: movimentações e itens de recebimento.
- Restrições: código único; quantidades não negativas quando aplicável.
- Índices: nome, categoria e status.
- Sensíveis: valores podem exigir acesso restrito.
- Exclusão: inativar com movimentações.

### movimentacoes_estoque

- Objetivo: razão de entradas, saídas, ajustes e baixas automáticas.
- PK: `id`; FKs item, entrega/recebimento opcionais e usuário.
- Campos: tipo, quantidade, saldo resultante, origem, motivo e timestamp.
- Restrições: quantidade positiva; tipo/origem válidos; operação transacional.
- Índices: item+data, tipo, entrega e recebimento.
- Sensíveis: autoria e valores operacionais.
- Exclusão: não excluir na operação comum; corrigir por nova movimentação.

### entregas

- Objetivo: benefício efetivamente entregue.
- PK: `id`; FKs assistido, família, benefício e usuário.
- Campos: data, origem, observação e indicador excepcional.
- Restrições: vínculos obrigatórios e idempotência da confirmação.
- Índices: assistido+data, família, benefício e usuário.
- Sensíveis: histórico de assistência.
- Exclusão: não excluir; estorno deve ser evento explícito.

### tentativas_bloqueadas

- Objetivo: registrar atendimento impedido.
- PK: `id`; FKs assistido/família quando conhecidos e usuário.
- Campos: motivo prazo/estoque, benefício, observação e timestamp.
- Índices: assistido, motivo e data.
- Sensíveis: histórico de atendimento.
- Exclusão: retenção equivalente à auditoria operacional.

### recebimentos

- Objetivo: registrar doação, compra, investimento ou ajuste recebido.
- PK: `id`; FK usuário; campos data, origem, parte, documento, valor e status.
- Relações: itens e movimentações.
- Restrições: origem/status válidos.
- Índices: data, origem, parte e status.
- Sensíveis: documentos, contatos e valores.
- Exclusão: cancelar, não apagar, quando já movimentado.

### recebimento_itens

- Objetivo: itens contidos em um recebimento.
- PK: `id`; FKs recebimento e item.
- Campos: quantidade, unidade, valor unitário e total.
- Restrições: quantidade positiva; unicidade opcional por recebimento+item.
- Índices: recebimento e item.
- Sensíveis: valores.
- Exclusão: acompanha recebimento apenas antes da efetivação; depois, estorno.

### auditoria_eventos

- Objetivo: trilha imutável de ações relevantes.
- PK: `id`; FK usuário; campos ação, módulo, registro, observação, contexto e data.
- Índices: data, usuário, módulo e ação.
- Sensíveis: pode conter identificadores; evitar payload excessivo.
- Exclusão: proibida para usuários operacionais; retenção administrativa formal.

### configuracoes

- Objetivo: parâmetros versionáveis do sistema.
- PK: chave estável ou `id`; campos valor tipado, descrição e autor da alteração.
- Restrições: validação por parâmetro; somente administrador altera.
- Índices: chave única.
- Sensíveis: nunca armazenar segredos destinados a cofre de secrets.
- Exclusão: preferir versionamento/inativação.

