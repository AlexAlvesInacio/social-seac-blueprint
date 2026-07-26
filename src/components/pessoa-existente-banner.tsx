import { Button } from "@/components/ui/button";
import { usePessoaPorDocumento } from "@/lib/familias/use-familias-supabase";
import type { PessoaExistente } from "@/lib/familias/familias-supabase-types";

type Props = {
  documento: string;
  /** pessoaId atualmente selecionado para reuso (""=nenhum). */
  pessoaIdSelecionado: string;
  onReutilizar: (pessoa: PessoaExistente) => void;
  onLimpar: () => void;
};

/**
 * Detecta uma pessoa já cadastrada pelo documento e oferece reutilizá-la, evitando
 * o erro de documento duplicado. Se a pessoa já é membro ativo de outra família,
 * avisa que seria transferência (fora de escopo) e não oferece o reuso.
 */
export function PessoaExistenteBanner({
  documento,
  pessoaIdSelecionado,
  onReutilizar,
  onLimpar,
}: Props) {
  const { data: pessoa } = usePessoaPorDocumento(documento);
  if (!pessoa) return null;

  if (pessoa.familiaAtivaId) {
    return (
      <div className="rounded-md border border-warning/40 bg-warning/5 p-2 text-xs text-foreground">
        <strong>{pessoa.nome}</strong> já é membro ativo da família{" "}
        <strong>{pessoa.familiaAtivaNome || "—"}</strong>. Reuso indisponível — seria uma
        transferência entre famílias (etapa futura).
      </div>
    );
  }

  const selecionada = pessoaIdSelecionado === pessoa.pessoaId;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-xs">
      <span>
        {selecionada ? "Reutilizando: " : "Pessoa já cadastrada: "}
        <strong>{pessoa.nome}</strong>
        {pessoa.telefone ? ` · ${pessoa.telefone}` : ""}
      </span>
      {selecionada ? (
        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onLimpar}>
          Desfazer
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => onReutilizar(pessoa)}
        >
          Reutilizar
        </Button>
      )}
    </div>
  );
}
