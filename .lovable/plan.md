## Refinar /familias — remover coluna Ações, adicionar seleção e barra de ações

Arquivo único: `src/routes/familias.index.tsx` (nenhuma outra tela é tocada).

### Mudanças

1. **Estado local de seleção** — `const [selectedId, setSelectedId] = useState<number | null>(null)`. Seleção única.

2. **Coluna de seleção (checkbox)** — nova primeira coluna estreita (`w-10`) com `<Checkbox>` (`@/components/ui/checkbox`). Marcar troca `selectedId`; clicar em outra desmarca a anterior. Linha selecionada recebe fundo suave (`bg-muted/40`).

3. **Nome da família clicável** — envolver o nome em `<Link to="/familias/$id" params={{ id: String(familia.id) }}>` com estilo de link discreto (hover underline, cor `text-foreground`). Remover a linha `ID: {familia.id}`.

4. **Remover coluna Ações** e remover as duas linhas de botões dentro de cada `<TableRow>`.

5. **Colunas finais visíveis** (10): seleção · Nome · Responsável · CPF/RG · Telefone · Bairro · Tipo de cadastro · Progresso Extra · Acompanhamento · Status. Sem "Última retirada"/"Próxima data permitida" como colunas — texto pequeno já vive dentro de "Acompanhamento" (mantido).

6. **Barra de ações da família selecionada** — renderizada **acima da tabela** (dentro do mesmo Card, antes da `<Table>`, ou como Card próprio logo acima) apenas quando `selectedId !== null`:
   - Texto: `Família selecionada: <Nome>`.
   - Botões: **Ver detalhes** (link para `/familias/$id`), **Ir para atendimento** (link `/atendimento` — desabilitado se `status === "inativo"`), **Avaliar cadastro definitivo** (variant `warning`, só quando `progressoExtra === "3/3"`), **Registrar observação** (variant `ghost`, discreto).
   - Fecha com um botão pequeno "Limpar seleção".

7. **Layout** — manter `min-w-0` já aplicado no shell. Reduzir `min-w` da tabela para `min-w-[900px]` já que não há mais coluna Ações. `overflow-x-auto` no wrapper permanece, garantindo rolagem só dentro do card.

8. **Cards de resumo, badges e mensagem informativa** — sem alteração (grid já responsivo, cores já corretas).

### Fora do escopo
Banco, Supabase, lógica real, outras telas, `AppShell` (já corrigido em turno anterior).