# Homologação — SEAC Social

Documento oficial de controle da homologação do sistema SEAC Social.
Serve como fonte de verdade sobre o que já foi aprovado, o que está em
validação e o que ainda precisa ser resolvido antes da publicação.

> Não alterar layout visual, menu lateral, topo, paleta, logo, fluxos já
> funcionando, dados de teste existentes ou regras já aplicadas em
> Atendimento, Família, Estoque e Auditoria sem antes atualizar este
> documento.

---

## Telas homologadas

### 1. `/auth` — Homologada visualmente
- Layout 50/50.
- Lado esquerdo: formulário de login.
- Lado direito: identidade visual SEAC.
- Imagem institucional SEAC como referência visual.
- Slogan: “Sopa, Esperança, Amor e Caridade em ação.”
- Texto institucional: “Organizando o cuidado, fortalecendo famílias e
  levando solidariedade com respeito.”
- Paleta visual SEAC aplicada.
- Bloco “Status de acesso” removido.

### 2. `/configuracoes` — Homologada funcionalmente
- Abas: Itens, Unidades, Categorias, Benefícios, Doadores, Fornecedores,
  Parâmetros.
- CRUD funcional nas abas principais.
- Inativar e excluir são ações distintas.
- Excluir remove o registro apenas quando não houver vínculo.
- Com vínculo, exclusão é bloqueada e o operador é orientado a inativar.
- Filtros funcionando.
- Ações relevantes registradas na auditoria.

Parâmetros oficiais:
- Prazo mínimo para nova retirada: **25 dias**
- Alerta após liberação sem retirada: **45 dias**
- Contato necessário por inatividade: **90 dias**
- Limite de Cesta Extra: **3 retiradas**
- Após limite de retirada extra: **Avaliar cadastro definitivo**
- Liberação excepcional: **Apenas Administrador**
- Observação obrigatória na liberação excepcional: **Sim**
- Bloqueio por falta de estoque: **Sim**
- Baixa automática no estoque após entrega: **Sim**
- Registrar auditoria de alterações: **Sim**

### 3. `/familias` — Em homologação avançada
- Criação de nova família funcionando.
- Detalhe da família carrega pelo ID da URL.
- Ao clicar em uma família, a família correta é aberta.
- Responsável da família conta como morador.
- Moradores = responsável + assistidos + membros familiares, sem
  duplicidade por documento.
- Assistido é quem pode receber benefício.
- Membro familiar compõe a família, mas não necessariamente recebe
  benefício.
- Cards de contagem refletem os dados reais da família.
- Abas aprovadas: Assistidos vinculados, Membros vinculados, Histórico de
  entregas, Tentativas bloqueadas, Observações sociais.
- Observações sociais funcionam.
- Histórico de entrega aparece na família após atendimento.
- Botões funcionais: Editar família, Adicionar assistido, Adicionar membro
  familiar, Registrar observação, Ir para atendimento.

### 4. `/atendimento` — Em homologação funcional
- Estado inicial: “Nenhuma busca realizada”.
- Busca por CPF, RG, nome ou telefone.
- Localiza assistidos vinculados a famílias.
- Ao buscar membro familiar que não é assistido, exibir contexto claro em
  vez de tratar como “não encontrado”.
- Confirmar entrega:
  - registra a entrega,
  - baixa o estoque automaticamente,
  - atualiza o histórico da família,
  - atualiza as movimentações de estoque,
  - registra na auditoria.
- Após entrega, nova tentativa antes de 25 dias é bloqueada.
- Bloqueio por prazo mostra próxima data permitida.
- Tentativa bloqueada por prazo é registrada na auditoria.
- Cesta Extra tem limite de 3 retiradas.
- Após 3 retiradas extras, sinalizar avaliação para cadastro definitivo.
- Liberação excepcional apenas para Administrador e exige observação.
- Falta de estoque não permite liberação excepcional.

### 5. `/estoque` — Em homologação funcional
- Controle de saldos atuais.
- Aba de movimentações.
- Entrega realizada no atendimento gera baixa automática.
- Cada movimentação registra: data/hora, item/benefício, tipo de
  movimentação, quantidade, saldo após, usuário, origem e observação.
- Estoque reflete entregas reais.

### 6. `/auditoria` — Em homologação funcional
- Registra eventos relevantes do sistema:
  - Entrega realizada
  - Baixa automática
  - Tentativa bloqueada por prazo
  - Tentativa bloqueada por estoque
  - Liberação excepcional
  - Família criada
  - Família atualizada
  - Assistido adicionado à família
  - Membro familiar adicionado
  - Observação registrada
  - Alterações de parâmetros
  - Exclusão bloqueada por vínculo
- Filtros por período, usuário, tipo de ação e módulo.

### 7. `/relatorios` — Em homologação funcional
- Somente leitura: nenhum relatório altera dados do sistema.
- Cards de tipos de relatório: Famílias, Assistidos, Entregas, Retiradas
  bloqueadas por prazo, Retiradas bloqueadas por estoque, Famílias em
  atenção 45 dias+, Famílias com contato necessário 90 dias+, Estoque,
  Doações / recebimentos, Liberações excepcionais.
- Fonte oficial dos dados: mesmos stores já usados em Famílias,
  Atendimento, Estoque e Auditoria (`useFamilias`, `useAtendimentoStore`,
  `useParametros`) via motor central `src/lib/relatorios-store.ts` →
  `gerarRelatorio(tipo, filtros)`.
- Filtros combinados: período, bairro, benefício, item, usuário, status.
  Botão "Limpar filtros" preserva o resultado já gerado.
- Geração explícita: nada é gerado ao abrir a tela; usuário clica em um
  card e depois em "Gerar relatório".
- Exportação oficial: **CSV** (UTF-8 com BOM, separador `;`, cabeçalhos
  em português, datas em dd/mm/aaaa) — compatível com Excel e Power BI.
- Exportação PDF e Excel nativo: pendentes de implementação futura;
  botões avisam o usuário e não quebram.
- Auditoria: cada geração e cada exportação CSV gera evento na tela
  `/auditoria` (ação "Relatório gerado" / "Relatório exportado CSV",
  módulo "Relatórios", com filtros aplicados e total de registros).

---

## Pendências de validação

Ver detalhe em [PENDENCIAS_PUBLICACAO_SEAC_SOCIAL.md](./PENDENCIAS_PUBLICACAO_SEAC_SOCIAL.md).

Resumo:
1. Pré-cadastro pelo atendimento (com e sem entrega de Cesta Extra).
2. Liberação excepcional (perfil, observação, auditoria, bloqueio por
   falta de estoque).
3. Relatórios com dados reais e exportação PDF/Excel/CSV.
4. Painel com indicadores reais.
5. Recebimentos — definir se apenas registram origem ou também geram
   entrada de estoque.
6. Publicação — persistência real, banco/Supabase, permissões,
   Administrador, segurança básica, ausência de dados críticos apenas
   em mock/localStorage.

---

## Regra de trabalho

A partir desta etapa, toda nova alteração deve respeitar as telas e
regras homologadas. Antes de alterar uma tela já aprovada, verificar este
documento. Se uma regra aprovada for alterada, registrar o motivo e
atualizar este documento.