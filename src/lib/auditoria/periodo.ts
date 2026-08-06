/**
 * Período da tela de Auditoria.
 *
 * A tela baixava os 500 eventos mais recentes de todos os tempos e filtrava em
 * memória. Enquanto a trilha só tinha eventos de cadastro isso cobria meses; com
 * estoque e entrega auditados (migration `20260806225547`) passou a cobrir dias, e
 * o que excedia ficava **invisível sem aviso**. O recorte agora é por tempo, feito
 * no servidor.
 *
 * O fuso é a armadilha do módulo. O banco guarda `timestamptz` e o usuário escolhe
 * uma data no calendário, que é local. Comparar texto de data com o ISO em UTC
 * erra o dia: 22:33 de 05/08 em Brasília é 01:33 de 06/08 em UTC. Por isso as
 * datas viram **instantes** aqui, uma única vez, antes de ir para a consulta.
 */

/** Data local em YYYY-MM-DD — o mesmo dia que a tabela exibe na coluna Data/hora. */
export function dataLocalISO(referencia: Date | string): string | null {
  const d = referencia instanceof Date ? referencia : new Date(referencia);
  if (Number.isNaN(d.getTime())) return null;
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Data local de hoje, para o valor inicial do filtro. */
export function hojeLocalISO(agora: Date = new Date()): string {
  return dataLocalISO(agora) ?? "";
}

/** Data local de `dias` atrás, para o valor inicial do filtro. */
export function diasAtrasLocalISO(dias: number, agora: Date = new Date()): string {
  const d = new Date(agora);
  d.setDate(d.getDate() - dias);
  return dataLocalISO(d) ?? "";
}

export interface LimitesDoPeriodo {
  /** Início do dia `de`, em ISO. Inclusivo. */
  desde: string | null;
  /** Início do dia seguinte a `ate`, em ISO. **Exclusivo**. */
  antesDe: string | null;
}

/**
 * Converte as datas escolhidas no calendário (locais) nos instantes que a consulta
 * usa. O limite superior é o início do dia seguinte e **exclusivo**: assim um
 * evento às 23:59:59 do último dia entra, sem depender de precisão de milissegundo.
 */
export function limitesDoPeriodo(de: string, ate: string): LimitesDoPeriodo {
  return { desde: inicioDoDiaLocal(de, 0), antesDe: inicioDoDiaLocal(ate, 1) };
}

function inicioDoDiaLocal(data: string, somarDias: number): string | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!partes) return null;
  const [, ano, mes, dia] = partes;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia) + somarDias);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
