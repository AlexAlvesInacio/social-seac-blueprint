/**
 * Contagem de visitas x benefícios no Painel.
 *
 * Até a migration `20260806015315` uma entrega era uma visita, e contar linhas
 * respondia às duas perguntas. Com a entrega multi-benefício isso deixou de
 * valer: uma visita pode gerar Cesta Padrão e Ovo de Páscoa, e o card de
 * "Entregas hoje" passou a marcar 2 para uma única família atendida.
 *
 * - **Visita** mede alcance: quantos atendimentos aconteceram.
 * - **Benefícios** mede o que saiu do estoque, somando `quantidade`.
 */

/** Campos mínimos de uma entrega para as contagens do Painel. */
export type EntregaContavel = {
  assistidoId: string;
  criadoEm: string;
  quantidade: number;
};

/**
 * Chave da visita: mesmo assistido no mesmo instante.
 *
 * A RPC grava todas as entregas da visita na mesma transação e `now()` é estável
 * dentro dela, então o par identifica a visita com exatidão — sem heurística de
 * janela de tempo.
 */
export function chaveDaVisita(entrega: EntregaContavel): string {
  return `${entrega.assistidoId}|${entrega.criadoEm}`;
}

/** Quantas visitas distintas as entregas representam. */
export function contarVisitas(entregas: readonly EntregaContavel[]): number {
  return new Set(entregas.map(chaveDaVisita)).size;
}

/**
 * Quantas unidades de benefício saíram. Soma `quantidade` porque três Ovos de
 * Páscoa numa entrega são três unidades, não uma.
 */
export function contarBeneficios(entregas: readonly EntregaContavel[]): number {
  return entregas.reduce((total, e) => total + (e.quantidade > 0 ? e.quantidade : 0), 0);
}
