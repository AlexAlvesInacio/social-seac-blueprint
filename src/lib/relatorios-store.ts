import { useFamilias, type Familia, type Assistido, type Membro } from "@/lib/familias-store";
import { useAtendimentoStore, type Entrega, type TentativaBloqueada } from "@/lib/atendimento-store";
import { useParametros } from "@/lib/config-store";

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
  de?: string;         // YYYY-MM-DD
  ate?: string;        // YYYY-MM-DD
  bairro?: string;
  beneficio?: string;
  item?: string;
  usuario?: string;
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

// Base de estoque espelhada da tela /estoque (mantido em sincronia).
const ESTOQUE_BASE = [
  { item: "Cesta Padrão", categoria: "Benefício montado", unidade: "unidade", saldo: 120, minimo: 30, valorUnit: 85, ultima: "20/05/2025 10:30" },
  { item: "Cesta Extra", categoria: "Benefício montado", unidade: "unidade", saldo: 25, minimo: 20, valorUnit: 60, ultima: "20/05/2025 09:15" },
  { item: "Arroz 5kg", categoria: "Alimento", unidade: "pacote", saldo: 200, minimo: 50, valorUnit: 24, ultima: "19/05/2025 14:20" },
  { item: "Feijão 1kg", categoria: "Alimento", unidade: "pacote", saldo: 80, minimo: 40, valorUnit: 8.5, ultima: "19/05/2025 14:20" },
  { item: "Óleo 900ml", categoria: "Alimento", unidade: "unidade", saldo: 15, minimo: 30, valorUnit: 7.5, ultima: "18/05/2025 16:45" },
  { item: "Macarrão", categoria: "Alimento", unidade: "pacote", saldo: 0, minimo: 20, valorUnit: 4.2, ultima: "18/05/2025 11:00" },
  { item: "Marmita", categoria: "Refeição", unidade: "unidade", saldo: 150, minimo: 50, valorUnit: 12, ultima: "20/05/2025 08:50" },
  { item: "Kit Gestante", categoria: "Benefício", unidade: "unidade", saldo: 8, minimo: 10, valorUnit: 45, ultima: "17/05/2025 13:10" },
];

// Espelho do histórico visual de /recebimentos (mesma fonte usada na tela homologada).
const RECEBIMENTOS_BASE = [
  { dataISO: "2025-05-21", tipo: "Doação", parte: "Supermercado Exemplo", documento: "00.000.000/0001-00", itens: 3, valor: 6250, status: "Registrado", observacao: "" },
  { dataISO: "2025-05-20", tipo: "Compra", parte: "Atacadão Exemplo", documento: "NF 12345", itens: 5, valor: 3850, status: "Registrado", observacao: "" },
  { dataISO: "2025-05-18", tipo: "Investimento", parte: "Recurso interno SEAC", documento: "—", itens: 2, valor: 2500, status: "Registrado", observacao: "" },
  { dataISO: "2025-05-15", tipo: "Doação", parte: "Padaria Bom Pão", documento: "11.111.111/0001-11", itens: 2, valor: 480, status: "Pendente conferência", observacao: "" },
  { dataISO: "2025-05-10", tipo: "Doação", parte: "Família anônima", documento: "—", itens: 1, valor: 120, status: "Cancelado", observacao: "" },
];

function normDoc(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

function fmtBRDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function fmtBRDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Converte "DD/MM/AAAA" ou "DD/MM/AAAA hh:mm" em Date, tolerante a sufixos.
function parseBR(s?: string): Date | null {
  if (!s || s === "—") return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
}

function ultimaRetiradaFamilia(
  familiaId: number,
  familiaFallback: string | undefined,
  assistidos: Assistido[],
  entregas: Entrega[],
): Date | null {
  const docs = new Set(assistidos.filter((a) => a.familiaId === familiaId).map((a) => normDoc(a.documento)));
  let melhor: Date | null = null;
  for (const e of entregas) {
    if (e.familiaId === familiaId || (e.documento && docs.has(normDoc(e.documento)))) {
      const d = new Date(e.dataISO);
      if (!Number.isNaN(d.getTime()) && (!melhor || d > melhor)) melhor = d;
    }
  }
  if (melhor) return melhor;
  return parseBR(familiaFallback);
}

function within(dISO: string | undefined, de?: string, ate?: string): boolean {
  if (!de && !ate) return true;
  if (!dISO) return false;
  const day = dISO.slice(0, 10);
  if (de && day < de) return false;
  if (ate && day > ate) return false;
  return true;
}

function ci(a?: string, b?: string): boolean {
  if (!b) return true;
  return (a ?? "").toLowerCase().includes(b.toLowerCase());
}

function contarMoradores(f: Familia, assistidos: Assistido[], membros: Membro[]): {
  total: number; assistidos: number; criancas: number; adolescentes: number;
  adultos: number; idosos: number; gestantes: number; pcd: number;
} {
  const A = assistidos.filter((a) => a.familiaId === f.id);
  const M = membros.filter((m) => m.familiaId === f.id);
  const docs = new Set<string>();
  const resp = normDoc(f.documento);
  if (resp) docs.add(resp);
  for (const a of A) if (normDoc(a.documento)) docs.add(normDoc(a.documento));
  let extraSemDoc = 0;
  for (const m of M) {
    const d = normDoc(m.documento);
    if (d) docs.add(d); else extraSemDoc++;
  }
  const total = docs.size + extraSemDoc + (resp ? 0 : 1);
  const criancas = M.filter((m) => m.crianca).length + (f.criancas ?? 0 ? Math.max(0, (f.criancas ?? 0) - M.filter((m) => m.crianca).length) : 0);
  const adolescentes = M.filter((m) => m.adolescente).length;
  const idosos = M.filter((m) => m.idoso).length + Math.max(0, (f.idosos ?? 0) - M.filter((m) => m.idoso).length);
  const gestantes = M.filter((m) => m.gestante).length + Math.max(0, (f.gestantes ?? 0) - M.filter((m) => m.gestante).length);
  const pcd = M.filter((m) => m.pcd).length + A.filter((a) => a.pcd).length + Math.max(0, (f.pcd ?? 0) - (M.filter((m) => m.pcd).length + A.filter((a) => a.pcd).length));
  const adultos = Math.max(0, total - criancas - adolescentes - idosos);
  return { total, assistidos: A.length, criancas, adolescentes, adultos, idosos, gestantes, pcd };
}

function labelAcompanhamento(a: Familia["acompanhamento"]): string {
  switch (a) {
    case "em_dia": return "Em dia";
    case "atencao_45": return "Atenção 45 dias";
    case "atencao_60": return "Atenção 60 dias";
    case "sem_retirada_90": return "Sem retirada 90 dias";
    case "inativo": return "Inativo";
    default: return "—";
  }
}

export function gerarRelatorio(
  tipo: TipoRelatorio,
  filtros: FiltrosRelatorio = {},
  usuario = "Administrador",
): ResultadoRelatorio {
  const { familias, assistidos, membros } = useFamilias.getState();
  const { entregas, bloqueios, saldo } = useAtendimentoStore.getState();
  const params = useParametros.getState().params;
  const titulo = TIPOS_RELATORIO.find((t) => t.tipo === tipo)?.titulo ?? tipo;
  const dataHoraGeracao = new Date().toISOString();

  let colunas: string[] = [];
  let linhas: (string | number)[][] = [];

  const familiaPorId = (id?: number) => familias.find((f) => f.id === id);

  if (tipo === "familias") {
    colunas = [
      "ID", "Nome da família", "Responsável", "Documento", "Telefone", "Bairro",
      "Cidade", "UF", "Tipo de cadastro", "Moradores", "Assistidos",
      "Crianças", "Adolescentes", "Adultos", "Idosos", "Gestantes", "PCD",
      "Acompanhamento", "Status",
    ];
    linhas = familias
      .filter((f) => ci(f.bairro, filtros.bairro))
      .filter((f) => !filtros.status || filtros.status === "all" || f.status === filtros.status)
      .map((f) => {
        const c = contarMoradores(f, assistidos, membros);
        return [
          f.id, f.nome, f.responsavel, f.documento, f.telefone ?? "", f.bairro ?? "",
          f.cidade ?? "", f.uf ?? "", f.tipoCadastro === "definitivo" ? "Definitivo" : "Extra",
          c.total, c.assistidos, c.criancas, c.adolescentes, c.adultos, c.idosos, c.gestantes, c.pcd,
          labelAcompanhamento(f.acompanhamento), f.status,
        ];
      });
  } else if (tipo === "assistidos") {
    colunas = [
      "ID", "Nome", "Documento", "Telefone", "Família", "Responsável",
      "Tipo de cadastro", "Benefício", "Progresso Extra", "Última retirada",
      "Próxima data permitida", "Status", "PCD",
    ];
    linhas = assistidos
      .filter((a) => !filtros.beneficio || filtros.beneficio === "all" || a.beneficio === filtros.beneficio)
      .filter((a) => !filtros.status || filtros.status === "all" || a.status === filtros.status)
      .filter((a) => {
        const f = familiaPorId(a.familiaId);
        return ci(f?.bairro, filtros.bairro);
      })
      .map((a) => {
        const f = familiaPorId(a.familiaId);
        const doc = normDoc(a.documento);
        const entregasA = entregas.filter((e) => normDoc(e.documento) === doc);
        const ultima = entregasA[0]?.dataISO;
        const extras = entregasA.filter((e) => e.beneficio === "Cesta Extra").length;
        let proxima = "—";
        if (ultima) {
          const p = new Date(ultima);
          p.setDate(p.getDate() + params.intervaloMinimoDias);
          proxima = fmtBRDate(p.toISOString());
        }
        return [
          a.id, a.nome, a.documento, a.telefone ?? "", f?.nome ?? "", f?.responsavel ?? "",
          a.tipoCadastro === "definitivo" ? "Definitivo" : "Extra", a.beneficio,
          a.tipoCadastro === "extra" ? `${Math.min(extras, params.limiteExtra)}/${params.limiteExtra}` : "—",
          ultima ? fmtBRDate(ultima) : "—", proxima, a.status, a.pcd ? "Sim" : "Não",
        ];
      });
  } else if (tipo === "entregas") {
    colunas = ["Data/hora", "Assistido", "Documento", "Família", "Benefício entregue", "Tipo de entrega", "Usuário responsável", "Status"];
    linhas = entregas
      .filter((e) => within(e.dataISO, filtros.de, filtros.ate))
      .filter((e) => !filtros.beneficio || filtros.beneficio === "all" || e.beneficio === filtros.beneficio)
      .filter((e) => !filtros.usuario || filtros.usuario === "all" || e.usuario === filtros.usuario)
      .filter((e) => {
        const f = familiaPorId(e.familiaId);
        return ci(f?.bairro, filtros.bairro);
      })
      .map((e) => [
        fmtBRDateTime(e.dataISO), e.nome, e.documento, e.familia, e.beneficio,
        e.excepcional ? "Liberação excepcional" : (e.origem === "pre_cadastro" ? "Pré-cadastro" : "Padrão"),
        e.usuario, "Registrada",
      ]);
  } else if (tipo === "bloqueio_prazo" || tipo === "bloqueio_estoque") {
    const motivo: "prazo" | "estoque" = tipo === "bloqueio_prazo" ? "prazo" : "estoque";
    const base = bloqueios.filter((b) => b.motivo === motivo);
    if (motivo === "prazo") {
      colunas = ["Data/hora", "Assistido", "Documento", "Família", "Motivo do bloqueio", "Última retirada", "Próxima data permitida", "Dias faltantes", "Usuário", "Detalhes"];
      linhas = base
        .filter((b) => within(b.dataISO, filtros.de, filtros.ate))
        .filter((b) => !filtros.usuario || filtros.usuario === "all" || b.usuario === filtros.usuario)
        .map((b) => {
          const doc = normDoc(b.documento);
          const ultima = entregas.find((e) => normDoc(e.documento) === doc)?.dataISO;
          let proxima = "—"; let faltam: number | string = "—";
          if (ultima) {
            const p = new Date(ultima);
            p.setDate(p.getDate() + params.intervaloMinimoDias);
            proxima = fmtBRDate(p.toISOString());
            faltam = Math.max(0, Math.ceil((p.getTime() - new Date(b.dataISO).getTime()) / 86400000));
          }
          return [fmtBRDateTime(b.dataISO), b.nome, b.documento, b.familia, "Prazo mínimo de 25 dias", ultima ? fmtBRDate(ultima) : "—", proxima, faltam, b.usuario, b.observacao ?? ""];
        });
    } else {
      colunas = ["Data/hora", "Assistido", "Documento", "Família", "Benefício solicitado", "Item sem estoque", "Saldo disponível", "Usuário", "Detalhes"];
      linhas = base
        .filter((b) => within(b.dataISO, filtros.de, filtros.ate))
        .filter((b) => !filtros.usuario || filtros.usuario === "all" || b.usuario === filtros.usuario)
        .map((b) => {
          const beneficio = (b.observacao?.match(/Cesta [A-Za-zÁÉÍÓÚâê]+/)?.[0]) ?? "Cesta Padrão";
          return [fmtBRDateTime(b.dataISO), b.nome, b.documento, b.familia, beneficio, beneficio, saldo[beneficio] ?? 0, b.usuario, b.observacao ?? ""];
        });
    }
  } else if (tipo === "atencao_45" || tipo === "contato_90") {
    const limiteDias = tipo === "atencao_45" ? params.alertaLiberadoSemRetiradaDias : params.inatividadeContatoDias;
    colunas = ["Família", "Responsável", "Documento", "Telefone", "Bairro", "Última retirada", "Dias sem retirada", "Acompanhamento", "Status"];
    const hoje = new Date();
    linhas = familias
      .filter((f) => ci(f.bairro, filtros.bairro))
      .map((f) => {
        const ult = ultimaRetiradaFamilia(f.id, f.ultimaRetirada, assistidos, entregas);
        const dias = ult ? Math.floor((hoje.getTime() - ult.getTime()) / 86400000) : null;
        return { f, ult, dias };
      })
      .filter((r) => r.dias !== null && r.dias >= limiteDias)
      .map(({ f, ult, dias }) => [
        f.nome, f.responsavel, f.documento, f.telefone ?? "", f.bairro ?? "",
        ult ? fmtBRDate(ult.toISOString()) : "—", dias ?? "—",
        labelAcompanhamento(f.acompanhamento), f.status,
      ]);
  } else if (tipo === "estoque") {
    colunas = ["Item", "Categoria", "Unidade", "Saldo atual", "Estoque mínimo", "Status", "Valor médio estimado", "Valor total estimado", "Última movimentação"];
    linhas = ESTOQUE_BASE
      .filter((s) => !filtros.item || filtros.item === "all" || s.item === filtros.item)
      .map((s) => {
        const saldoAtual = saldo[s.item] ?? s.saldo;
        const status = saldoAtual <= 0 ? "Sem estoque" : saldoAtual < s.minimo * 0.5 ? "Estoque baixo" : saldoAtual < s.minimo ? "Atenção" : "Em estoque";
        return [s.item, s.categoria, s.unidade, saldoAtual, s.minimo, status, fmtBRL(s.valorUnit), fmtBRL(saldoAtual * s.valorUnit), s.ultima];
      })
      .filter((row) => !filtros.status || filtros.status === "all" || row[5] === filtros.status);
  } else if (tipo === "recebimentos") {
    colunas = ["Data", "Tipo", "Doador / fornecedor", "Documento ou referência", "Quantidade de itens", "Valor total estimado", "Status", "Observação"];
    linhas = RECEBIMENTOS_BASE
      .filter((r) => within(r.dataISO, filtros.de, filtros.ate))
      .filter((r) => !filtros.status || filtros.status === "all" || r.status === filtros.status)
      .map((r) => [fmtBRDate(r.dataISO), r.tipo, r.parte, r.documento, r.itens, fmtBRL(r.valor), r.status, r.observacao]);
  } else if (tipo === "liberacoes") {
    colunas = ["Data/hora", "Assistido", "Documento", "Família", "Benefício", "Motivo da liberação", "Observação obrigatória", "Usuário administrador", "Status"];
    linhas = entregas
      .filter((e) => e.excepcional)
      .filter((e) => within(e.dataISO, filtros.de, filtros.ate))
      .filter((e) => !filtros.beneficio || filtros.beneficio === "all" || e.beneficio === filtros.beneficio)
      .filter((e) => !filtros.usuario || filtros.usuario === "all" || e.usuario === filtros.usuario)
      .map((e) => [fmtBRDateTime(e.dataISO), e.nome, e.documento, e.familia, e.beneficio, e.observacao ?? "—", e.observacao ?? "—", e.usuario, "Liberada"]);
  }

  return {
    tipo,
    tituloRelatorio: titulo,
    colunas,
    linhas,
    totalRegistros: linhas.length,
    dataHoraGeracao,
    usuarioGerador: usuario,
    filtrosAplicados: filtros,
  };
}

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  if (/[;\n"\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function relatorioParaCSV(res: ResultadoRelatorio): string {
  const linhas = [res.colunas.map(csvEscape).join(";")];
  for (const r of res.linhas) linhas.push(r.map(csvEscape).join(";"));
  return "\uFEFF" + linhas.join("\r\n");
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