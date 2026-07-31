export type FaixaEtaria = "crianca" | "adolescente" | "adulto" | "idoso";

/** Idade em anos completos a partir de uma data ISO (YYYY-MM-DD). */
export function calcularIdade(nascimento?: string): number | null {
  if (!nascimento) return null;
  const d = new Date(nascimento);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  if (d.getTime() > hoje.getTime()) return null;
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}

/**
 * Regras oficiais SEAC Social:
 * - Criança: 0 a 12 anos
 * - Adolescente: 13 a 17 anos
 * - Adulto: 18 a 59 anos
 * - Idoso: 60 anos ou mais
 */
export function calcularFaixaEtaria(nascimento?: string): FaixaEtaria | null {
  const idade = calcularIdade(nascimento);
  if (idade === null) return null;
  if (idade <= 12) return "crianca";
  if (idade <= 17) return "adolescente";
  if (idade < 60) return "adulto";
  return "idoso";
}

export function rotuloFaixaEtaria(faixa: FaixaEtaria | null): string {
  switch (faixa) {
    case "crianca":
      return "Criança";
    case "adolescente":
      return "Adolescente";
    case "adulto":
      return "Adulto";
    case "idoso":
      return "Idoso";
    default:
      return "—";
  }
}
