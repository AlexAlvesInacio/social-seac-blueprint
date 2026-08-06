/**
 * A família herda o nome do responsável, então para ele os dois nomes são o
 * mesmo — repetir não informa nada. Só mostramos a família quando ela difere.
 */
export function descricaoAssistido(nome: string | undefined, familiaNome: string): string {
  if (!nome) return "—";
  const normalizar = (v: string) => v.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
  if (normalizar(nome) === normalizar(familiaNome)) return nome;
  return `${nome} — família ${familiaNome}`;
}
