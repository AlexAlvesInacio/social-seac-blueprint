// Tipos, catálogo e utilitários de CSV dos relatórios. A geração dos dados vive
// em src/lib/relatorios/relatorios-supabase.ts (lê do Supabase). Este módulo é
// agnóstico de fonte — opera apenas sobre ResultadoRelatorio.

export type TipoRelatorio =
  | "familias"
  | "assistidos"
  | "entregas"
  | "bloqueio_prazo"
  | "bloqueio_estoque"
  | "bloqueio_extra"
  | "atencao_45"
  | "contato_90"
  | "estoque"
  | "recebimentos"
  | "liberacoes";

export type FiltrosRelatorio = {
  de?: string; // YYYY-MM-DD
  ate?: string; // YYYY-MM-DD
  bairro?: string;
  beneficio?: string;
  status?: string;
};

export type ResultadoRelatorio = {
  tipo: TipoRelatorio;
  tituloRelatorio: string;
  colunas: string[];
  linhas: (string | number)[][];
  totalRegistros: number;
  dataHoraGeracao: string;
  usuarioGerador: string;
  filtrosAplicados: FiltrosRelatorio;
};

export const TIPOS_RELATORIO: { tipo: TipoRelatorio; titulo: string }[] = [
  { tipo: "familias", titulo: "Famílias" },
  { tipo: "assistidos", titulo: "Assistidos" },
  { tipo: "entregas", titulo: "Entregas" },
  { tipo: "bloqueio_prazo", titulo: "Retiradas bloqueadas por prazo" },
  { tipo: "bloqueio_estoque", titulo: "Retiradas bloqueadas por estoque" },
  { tipo: "bloqueio_extra", titulo: "Retiradas bloqueadas por limite de extras" },
  { tipo: "atencao_45", titulo: "Famílias em atenção 45 dias+" },
  { tipo: "contato_90", titulo: "Famílias com contato necessário 90 dias+" },
  { tipo: "estoque", titulo: "Estoque" },
  { tipo: "recebimentos", titulo: "Doações / recebimentos" },
  { tipo: "liberacoes", titulo: "Liberações excepcionais" },
];

export function fmtBRDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function fmtBRDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * CPF/CNPJ com máscara quando o valor é só dígitos (11/14). A máscara também
 * evita que o Excel converta o documento em número no CSV (notação científica
 * e perda de zeros à esquerda). Valores já formatados ou de outro tamanho
 * ficam como estão.
 */
export function fmtDocumento(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d !== doc) return doc;
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

/** Telefone com máscara quando o valor é só dígitos (10/11 com DDD). */
export function fmtTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (d !== tel) return tel;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

/**
 * Prefixos que fazem Excel/Calc avaliar a célula como fórmula em vez de texto
 * (CWE-1236). Um nome de família ou observação começando com um deles é
 * inserido por quem cadastra e executado na máquina de quem exporta.
 */
const PREFIXO_FORMULA = /^[=+\-@\t\r]/;

function csvEscape(v: string | number): string {
  // Números vêm do próprio sistema (saldos, contagens, dias) e devem continuar
  // numéricos na planilha — inclusive os negativos.
  if (typeof v === "number") return String(v);

  const s = String(v ?? "");
  // O apóstrofo força a planilha a tratar a célula como texto. Só entra nas
  // células que começariam uma fórmula, então nenhum dado legítimo do sistema
  // (nomes, datas, "R$ …", o travessão de vazio) é afetado.
  const seguro = PREFIXO_FORMULA.test(s) ? `'${s}` : s;
  if (/[;\n"\r]/.test(seguro)) return `"${seguro.replace(/"/g, '""')}"`;
  return seguro;
}

export function relatorioParaCSV(res: ResultadoRelatorio): string {
  const linhas = [res.colunas.map(csvEscape).join(";")];
  for (const r of res.linhas) linhas.push(r.map(csvEscape).join(";"));
  return "﻿" + linhas.join("\r\n");
}

export function nomeArquivoCSV(tipo: TipoRelatorio): string {
  const d = new Date();
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `seac-social-relatorio-${tipo}-${dia}.csv`;
}

export function downloadCSV(res: ResultadoRelatorio) {
  const blob = new Blob([relatorioParaCSV(res)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoCSV(res.tipo);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
