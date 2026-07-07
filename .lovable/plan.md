## Correção de layout e responsividade — /familias

### Causa do overflow
A tabela usa `min-w-[1400px]` dentro de um `<main class="flex-1">` sem `min-w-0`. Isso força o conteúdo principal a ficar mais largo que o viewport, gerando rolagem horizontal na página inteira e escondendo colunas atrás da sidebar.

### Mudanças

**1. `src/components/app-shell.tsx`** — 1 linha
- Adicionar `min-w-0` à coluna `flex-1` do layout, para que filhos largos não estourem a viewport. Correção de higiene de layout; não altera visualmente outras telas.

**2. `src/routes/familias.index.tsx`**

Cards de resumo (topo)
- Ajustar grid para escalonar melhor: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` e garantir que os cards quebrem quando não couberem.

Tabela — reduzir colunas visíveis
- Remover as colunas dedicadas **Última retirada** e **Próxima data permitida**.
- Incorporar esses dados como texto pequeno (`text-xs text-muted-foreground`) abaixo do bairro ou dentro da célula "Acompanhamento": ex. "Última: 16/05 · Próxima: 10/06 (Faltam 18 dias)".
- Colunas finais visíveis: Nome, Responsável, CPF/RG, Telefone, Bairro, Tipo, Progresso Extra, Acompanhamento, Status, Ações.

Rolagem
- Envolver a `<Table>` em `<div class="overflow-x-auto">` dentro do card e reduzir `min-w` para `min-w-[1100px]`, de forma que a rolagem horizontal (quando necessária) fique **dentro do card**, não na página.
- Usar `whitespace-nowrap` em células como CPF/RG e Telefone para evitar quebra excessiva.

Coluna Ações — enxugar
- Manter sempre: **Ver detalhes** + **Ir para atendimento** (em linha, `whitespace-nowrap`).
- Quando `progressoExtra === "3/3"`: adicionar **Avaliar cadastro definitivo** (variant `warning`).
- **Família inativa**: manter só **Ver detalhes**; **Ir para atendimento** fica desabilitado (cinza, `disabled`, sem `asChild`/`Link`).
- Remover **Registrar observação** da linha (por enquanto, conforme instrução — não incluir em "Mais ações" agora para reduzir poluição visual).

Badges — normalizar
- Definitivo / Cesta Padrão → verde (default).
- Extra / em avaliação → laranja (variant `warning`, no lugar de `outline`).
- Em dia → verde.
- Atenção 60 dias → laranja.
- Sem retirada 90 dias+ → vermelho (destructive) — apenas informativo, texto continua neutro.
- Bloqueado → vermelho.
- Inativo → cinza (outline muted).
- Status "avaliar" (progresso 3/3): mostrar badge laranja **Avaliar definitivo** na coluna Status (substitui o "Liberado" atual quando 3/3), mantendo o botão de ação laranja em Ações.

Mensagem informativa
- Manter o parágrafo: "Acompanhamento é apenas informativo. Não bloqueia entregas, não torna a família inativa automaticamente e não gera tarefa de contato."

### Fora do escopo
- Nenhuma alteração em banco, Supabase, lógica real ou outras telas do sistema.