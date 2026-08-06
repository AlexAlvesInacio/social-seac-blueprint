// Motor de relatórios sobre o Supabase. Gera ResultadoRelatorio (colunas +
// linhas) sob demanda, lendo do repositório. O download de CSV é feito pelo util
// agnóstico em relatorios-store.ts.

import { getConfiguracoes } from "@/lib/configuracoes/configuracoes-supabase";
import { listarBeneficiosNoSupabase } from "@/lib/estoque/estoque-repository";
import { statusEstoque } from "@/lib/estoque/status-estoque";
import {
  listFamiliasFromSupabase,
  listarEntregasRecentesNoSupabase,
  listarRecebimentosNoSupabase,
  listarTentativasBloqueadasNoSupabase,
} from "@/lib/familias/familias-repository";
import type {
  BeneficioEstoque,
  EntregaPainel,
  FamiliaSupabaseReadModel,
  Recebimento,
  RecebimentoOrigem,
  RecebimentoStatus,
  TentativaBloqueadaPainel,
} from "@/lib/familias/familias-supabase-types";
import type { FamiliasSupabaseReadResult } from "@/lib/familias/familias-supabase-types";
import {
  fmtBRDate,
  fmtBRDateTime,
  fmtDocumento,
  fmtTelefone,
  fmtBRL,
  type FiltrosRelatorio,
  type ResultadoRelatorio,
  type TipoRelatorio,
  TIPOS_RELATORIO,
} from "@/lib/relatorios-store";

const JANELA_DIAS = 3650;
const LIMITE = 5000;

function unwrap<T>(result: FamiliasSupabaseReadResult<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function within(iso: string | undefined, de?: string, ate?: string): boolean {
  if (!de && !ate) return true;
  if (!iso) return false;
  const dia = iso.slice(0, 10);
  if (de && dia < de) return false;
  if (ate && dia > ate) return false;
  return true;
}

function ci(a: string | undefined, b?: string): boolean {
  if (!b) return true;
  return (a ?? "").toLowerCase().includes(b.toLowerCase());
}

function labelAcompanhamento(a: string): string {
  switch (a) {
    case "em_dia":
      return "Em dia";
    case "atencao_45":
      return "Atenção 45 dias";
    case "atencao_60":
      return "Atenção 60 dias";
    case "sem_retirada_90":
      return "Sem retirada 90 dias";
    case "inativo":
      return "Inativo";
    default:
      return "—";
  }
}

const ORIGEM_LABEL: Record<RecebimentoOrigem, string> = {
  doacao: "Doação",
  compra: "Compra",
  investimento: "Investimento",
  ajuste: "Ajuste",
};
const STATUS_RECEB_LABEL: Record<RecebimentoStatus, string> = {
  registrado: "Registrado",
  pendente: "Pendente conferência",
  cancelado: "Cancelado",
};

function titulo(tipo: TipoRelatorio): string {
  return TIPOS_RELATORIO.find((t) => t.tipo === tipo)?.titulo ?? tipo;
}

/** Última entrega (Date) por familiaId e por assistidoId + nº de Cesta Extra por assistido. */
function indexarEntregas(entregas: EntregaPainel[]) {
  const ultimaPorFamilia = new Map<string, Date>();
  const ultimaPorAssistido = new Map<string, Date>();
  const extrasPorAssistido = new Map<string, number>();
  for (const e of entregas) {
    const d = new Date(e.criadoEm);
    if (Number.isNaN(d.getTime())) continue;
    const uf = ultimaPorFamilia.get(e.familiaId);
    if (!uf || d > uf) ultimaPorFamilia.set(e.familiaId, d);
    const ua = ultimaPorAssistido.get(e.assistidoId);
    if (!ua || d > ua) ultimaPorAssistido.set(e.assistidoId, d);
    if (e.beneficioNome === "Cesta Extra") {
      extrasPorAssistido.set(e.assistidoId, (extrasPorAssistido.get(e.assistidoId) ?? 0) + 1);
    }
  }
  return { ultimaPorFamilia, ultimaPorAssistido, extrasPorAssistido };
}

function diasDesde(d: Date | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function addDias(d: Date, dias: number): string {
  const c = new Date(d);
  c.setDate(c.getDate() + dias);
  return fmtBRDate(c.toISOString());
}

type Bloco = { colunas: string[]; linhas: (string | number)[][] };

async function familiasBloco(f: FiltrosRelatorio): Promise<Bloco> {
  const familias = unwrap(await listFamiliasFromSupabase());
  const colunas = [
    "Nome",
    "Responsável",
    "Documento",
    "Telefone",
    "Bairro",
    "Cidade",
    "UF",
    "Moradores",
    "Assistidos",
    "Crianças",
    "Adolescentes",
    "Adultos",
    "Idosos",
    "Gestantes",
    "PCD",
    "Acompanhamento",
    "Status",
  ];
  const linhas = familias
    .filter((fam) => ci(fam.bairro, f.bairro) && (!f.status || fam.status === f.status))
    .map((fam) => {
      const m = fam.membros;
      const criancas = m.filter((x) => x.crianca).length;
      const adolescentes = m.filter((x) => x.adolescente).length;
      const idosos = m.filter((x) => x.idoso).length;
      const adultos = Math.max(0, m.length - criancas - adolescentes - idosos);
      return [
        fam.nome,
        fam.responsavel,
        fmtDocumento(fam.documento),
        fmtTelefone(fam.telefone),
        fam.bairro,
        fam.cidade ?? "",
        fam.uf ?? "",
        m.length,
        fam.assistidos.length,
        criancas,
        adolescentes,
        adultos,
        idosos,
        m.filter((x) => x.gestante).length,
        m.filter((x) => x.pcd).length,
        labelAcompanhamento(fam.acompanhamento),
        fam.status,
      ];
    });
  return { colunas, linhas };
}

async function assistidosBloco(f: FiltrosRelatorio): Promise<Bloco> {
  const [familias, entregas] = await Promise.all([
    listFamiliasFromSupabase().then(unwrap),
    listarEntregasRecentesNoSupabase(JANELA_DIAS, LIMITE).then(unwrap),
  ]);
  const params = await getConfiguracoes();
  const idx = indexarEntregas(entregas);
  const colunas = [
    "Nome",
    "Documento",
    "Telefone",
    "Família",
    "Responsável",
    "Tipo de cadastro",
    "Benefício",
    "Progresso extra",
    "Última retirada",
    "Próxima data permitida",
    "Status",
    "PCD",
  ];
  const linhas: (string | number)[][] = [];
  for (const fam of familias) {
    if (!ci(fam.bairro, f.bairro)) continue;
    for (const a of fam.assistidos) {
      if (f.beneficio && a.beneficio !== f.beneficio) continue;
      if (f.status && a.status !== f.status) continue;
      const ultima = idx.ultimaPorAssistido.get(a.id);
      const extras = idx.extrasPorAssistido.get(a.id) ?? 0;
      linhas.push([
        a.nome,
        fmtDocumento(a.documento),
        fmtTelefone(a.telefone ?? ""),
        fam.nome,
        fam.responsavel,
        a.tipoCadastro === "definitivo" ? "Definitivo" : "Extra",
        a.beneficio ?? "",
        a.tipoCadastro === "extra" ? `${Math.min(3, extras)}/3` : "—",
        ultima ? fmtBRDate(ultima.toISOString()) : "—",
        ultima ? addDias(ultima, params.intervaloMinimoDias) : "—",
        a.status,
        a.pcd ? "Sim" : "Não",
      ]);
    }
  }
  return { colunas, linhas };
}

async function entregasBloco(f: FiltrosRelatorio, somenteExcepcionais: boolean): Promise<Bloco> {
  const entregas = unwrap(await listarEntregasRecentesNoSupabase(JANELA_DIAS, LIMITE));
  const filtradas = entregas.filter(
    (e) =>
      (!somenteExcepcionais || e.excepcional) &&
      within(e.criadoEm, f.de, f.ate) &&
      ci(e.beneficioNome, f.beneficio) &&
      ci(e.familiaBairro, f.bairro),
  );
  if (somenteExcepcionais) {
    return {
      colunas: ["Data/hora", "Assistido", "Documento", "Família", "Benefício", "Motivo/Observação"],
      linhas: filtradas.map((e) => [
        fmtBRDateTime(e.criadoEm),
        e.assistidoNome,
        fmtDocumento(e.documento ?? ""),
        e.familiaNome,
        e.beneficioNome,
        e.observacao ?? "",
      ]),
    };
  }
  return {
    colunas: ["Data/hora", "Assistido", "Documento", "Família", "Benefício", "Tipo"],
    linhas: filtradas.map((e) => [
      fmtBRDateTime(e.criadoEm),
      e.assistidoNome,
      fmtDocumento(e.documento ?? ""),
      e.familiaNome,
      e.beneficioNome,
      e.excepcional ? "Liberação excepcional" : "Padrão",
    ]),
  };
}

async function tentativasBloco(
  f: FiltrosRelatorio,
  motivo: "prazo" | "estoque" | "extra",
): Promise<Bloco> {
  const tentativas = unwrap(await listarTentativasBloqueadasNoSupabase(JANELA_DIAS, LIMITE));
  const linhas = tentativas
    .filter((t) => t.motivo === motivo && within(t.criadoEm, f.de, f.ate))
    .map((t) => [
      fmtBRDateTime(t.criadoEm),
      t.assistidoNome,
      fmtDocumento(t.documento ?? ""),
      t.familiaNome,
      t.beneficioNome,
      t.observacao ?? "",
    ]);
  return {
    colunas: ["Data/hora", "Assistido", "Documento", "Família", "Benefício", "Detalhes"],
    linhas,
  };
}

async function acompanhamentoBloco(f: FiltrosRelatorio, chaves: string[]): Promise<Bloco> {
  const [familias, entregas] = await Promise.all([
    listFamiliasFromSupabase().then(unwrap),
    listarEntregasRecentesNoSupabase(JANELA_DIAS, LIMITE).then(unwrap),
  ]);
  const idx = indexarEntregas(entregas);
  const colunas = [
    "Família",
    "Responsável",
    "Documento",
    "Telefone",
    "Bairro",
    "Última retirada",
    "Dias sem retirada",
    "Acompanhamento",
    "Status",
  ];
  const linhas = familias
    .filter((fam) => chaves.includes(fam.acompanhamento) && ci(fam.bairro, f.bairro))
    .map((fam) => {
      const ultima = idx.ultimaPorFamilia.get(fam.id);
      const dias = diasDesde(ultima);
      return [
        fam.nome,
        fam.responsavel,
        fmtDocumento(fam.documento),
        fmtTelefone(fam.telefone),
        fam.bairro,
        ultima ? fmtBRDate(ultima.toISOString()) : "—",
        dias !== null ? dias : "—",
        labelAcompanhamento(fam.acompanhamento),
        fam.status,
      ];
    });
  return { colunas, linhas };
}

async function estoqueBloco(f: FiltrosRelatorio): Promise<Bloco> {
  const beneficios: BeneficioEstoque[] = unwrap(await listarBeneficiosNoSupabase());
  const linhas = beneficios
    .map((b) => ({ b, status: statusEstoque(b.saldo, b.minimo) }))
    .filter((x) => !f.status || x.status === f.status)
    .map(({ b, status }) => [b.nome, b.saldo, b.minimo, status]);
  return { colunas: ["Item", "Saldo atual", "Estoque mínimo", "Status"], linhas };
}

async function recebimentosBloco(f: FiltrosRelatorio): Promise<Bloco> {
  const recebimentos: Recebimento[] = unwrap(await listarRecebimentosNoSupabase());
  const linhas = recebimentos
    .filter(
      (r) =>
        within(r.data, f.de, f.ate) && (!f.status || STATUS_RECEB_LABEL[r.status] === f.status),
    )
    .map((r) => [
      fmtBRDate(r.data),
      ORIGEM_LABEL[r.origem],
      r.parte,
      fmtDocumento(r.documento ?? ""),
      r.itensCount,
      fmtBRL(r.valor),
      STATUS_RECEB_LABEL[r.status],
      r.observacao ?? "",
    ]);
  return {
    colunas: [
      "Data",
      "Tipo",
      "Doador/fornecedor",
      "Documento",
      "Itens",
      "Valor total",
      "Status",
      "Observação",
    ],
    linhas,
  };
}

async function blocoPorTipo(tipo: TipoRelatorio, f: FiltrosRelatorio): Promise<Bloco> {
  switch (tipo) {
    case "familias":
      return familiasBloco(f);
    case "assistidos":
      return assistidosBloco(f);
    case "entregas":
      return entregasBloco(f, false);
    case "liberacoes":
      return entregasBloco(f, true);
    case "bloqueio_prazo":
      return tentativasBloco(f, "prazo");
    case "bloqueio_estoque":
      return tentativasBloco(f, "estoque");
    case "bloqueio_extra":
      return tentativasBloco(f, "extra");
    case "atencao_45":
      return acompanhamentoBloco(f, ["atencao_45", "atencao_60"]);
    case "contato_90":
      return acompanhamentoBloco(f, ["sem_retirada_90"]);
    case "estoque":
      return estoqueBloco(f);
    case "recebimentos":
      return recebimentosBloco(f);
  }
}

export async function gerarRelatorioSupabase(
  tipo: TipoRelatorio,
  filtros: FiltrosRelatorio = {},
  usuario = "Administrador",
): Promise<ResultadoRelatorio> {
  const { colunas, linhas } = await blocoPorTipo(tipo, filtros);
  return {
    tipo,
    tituloRelatorio: titulo(tipo),
    colunas,
    linhas,
    totalRegistros: linhas.length,
    dataHoraGeracao: new Date().toISOString(),
    usuarioGerador: usuario,
    filtrosAplicados: filtros,
  };
}
