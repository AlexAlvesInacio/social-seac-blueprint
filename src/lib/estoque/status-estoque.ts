/**
 * Status de saldo, compartilhado por benefícios (cestas prontas) e itens de estoque.
 *
 * A mesma regra estava copiada em `routes/estoque.tsx`, `routes/painel.tsx` e
 * `relatorios/relatorios-supabase.ts`; qualquer ajuste precisava ser feito nos três.
 */

export type StatusEstoque = "Em estoque" | "Atenção" | "Estoque baixo" | "Sem estoque";

/**
 * Classifica um saldo em relação ao seu mínimo.
 *
 * Mínimo 0 significa "sem mínimo definido": o saldo só é criticado quando zera.
 */
export function statusEstoque(saldo: number, minimo: number): StatusEstoque {
  if (saldo <= 0) return "Sem estoque";
  if (minimo > 0 && saldo < minimo * 0.5) return "Estoque baixo";
  if (minimo > 0 && saldo < minimo) return "Atenção";
  return "Em estoque";
}

/** Status que merecem destaque nas telas e no filtro `?foco=alertas`. */
export const STATUS_ALERTA: ReadonlySet<StatusEstoque> = new Set<StatusEstoque>([
  "Atenção",
  "Estoque baixo",
  "Sem estoque",
]);

export function emAlerta(saldo: number, minimo: number): boolean {
  return STATUS_ALERTA.has(statusEstoque(saldo, minimo));
}
