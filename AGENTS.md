<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Instruções específicas — SEAC Social

### Ordem oficial de leitura

1. `AGENTS.md`
2. `PROJECT_KNOWLEDGE.md`
3. `REGRAS_ATENDIMENTO_SEAC.md`
4. `docs/02_REGRAS_NEGOCIO.md`
5. `docs/07_STATUS_IMPLEMENTACAO.md`
6. Documento de arquitetura, segurança, fluxo ou módulo relacionado à tarefa
7. Código atual do módulo antes de qualquer alteração

`REGRAS_ATENDIMENTO_SEAC.md` é a fonte oficial específica para atendimento e
entrega. `docs/REGRAS_APROVADAS_SEAC_SOCIAL.md` preserva as regras homologadas
dos demais domínios. Divergências devem ser registradas, nunca resolvidas por
suposição.

### Fluxo de trabalho e Git

- Branch atual de desenvolvimento desta fundação: `feature/fundacao-supabase`.
- Alterar somente arquivos pertencentes ao escopo aprovado.
- Gerenciador oficial: **Bun**.
- Antes de finalizar uma alteração de código, executar `bun run lint` e
  `bun run build`. Lint pode ser somente diagnóstico quando o escopo assim
  determinar.
- Nunca executar force push.
- Nunca fazer rebase, amend ou squash de histórico já sincronizado com Lovable.
- Nunca incluir segredos, tokens, senhas ou chaves privadas no repositório.
- Nunca usar `service_role` ou secret key no frontend.

### Padrão de commits

- `feat:` nova funcionalidade
- `fix:` correção
- `docs:` documentação
- `refactor:` reorganização sem mudança funcional
- `test:` testes
- `chore:` manutenção

Não criar commit, push ou Pull Request sem autorização explícita para a tarefa.
