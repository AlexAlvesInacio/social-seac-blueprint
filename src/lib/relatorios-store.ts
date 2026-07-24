// Tipos, catálogo e utilitários de CSV dos relatórios. A geração dos dados vive
// em src/lib/relatorios/relatorios-supabase.ts (lê do Supabase). Este módulo é
// agnóstico de fonte — opera apenas sobre ResultadoRelatorio.

export type TipoRelatorio =
  | "familias"
  | "assistidos"
  | "entregas"
  | "bloqueio_prazo"
  | "bloqueio_estoque"
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

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  if (/[;\n"\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
