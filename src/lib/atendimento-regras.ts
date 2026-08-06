/**
 * Regras oficiais de atendimento — SEAC Social.
 * Fonte: REGRAS_ATENDIMENTO_SEAC.md e Project Knowledge.
 *
 * Esta é a lógica central usada pela tela /atendimento para decidir
 * automaticamente o cenário exibido (liberado, bloqueado por prazo,
 * bloqueado por estoque, extra em avaliação, extra completou 3).
 */

export const INTERVALO_MINIMO_DIAS = 25;
export const LIMITE_RETIRADAS_EXTRA = 3;

export type TipoCadastro = "definitivo" | "extra";

export type AssistidoRegra = {
  nome: string;
  documento: string;
  telefone: string;
  familia: string;
  endereco: string;
  tipoCadastro: TipoCadastro;
  /** ISO date (YYYY-MM-DD) da última retirada, ou null se nunca retirou. */
  ultimaRetiradaISO: string | null;
  /** Retiradas extras já realizadas (0 a 3). Usado só quando tipoCadastro = "extra". */
  retiradasExtras: number;
};

export type EstoqueBeneficio = {
  cestaPadrao: number;
  cestaExtra: number;
};

export type Elegibilidade =
  | { cenario: "liberado_padrao"; beneficio: "Cesta Padrão" }
  | {
      cenario: "liberado_extra";
      beneficio: "Cesta Extra";
      progresso: 1 | 2 | 3;
    }
  | {
      cenario: "bloqueio_25dias";
      beneficio: "Cesta Padrão" | "Cesta Extra";
      proximaDataISO: string;
      diasRestantes: number;
    }
  | {
      cenario: "bloqueio_estoque";
      beneficio: "Cesta Padrão" | "Cesta Extra";
    }
  | { cenario: "extra_completou"; beneficio: "Cesta Extra" };

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00").getTime();
  const b = new Date(toISO + "T00:00:00").getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Função central de elegibilidade.
 * Recebe o assistido e o estoque atual dos benefícios e devolve o cenário
 * que a tela deve renderizar, aplicando as regras oficiais.
 */
export function verificarElegibilidadeAtendimento(
  assistido: AssistidoRegra,
  estoque: EstoqueBeneficio,
  hojeISO: string = new Date().toISOString().slice(0, 10),
  overrides?: { intervaloMinimoDias?: number; limiteExtra?: number },
): Elegibilidade {
  const intervaloMinimo = overrides?.intervaloMinimoDias ?? INTERVALO_MINIMO_DIAS;
  const limiteExtra = overrides?.limiteExtra ?? LIMITE_RETIRADAS_EXTRA;
  const beneficio: "Cesta Padrão" | "Cesta Extra" =
    assistido.tipoCadastro === "definitivo" ? "Cesta Padrão" : "Cesta Extra";

  // 1) Extra que já completou 3 retiradas: aguardar avaliação, não entrega.
  if (assistido.tipoCadastro === "extra" && assistido.retiradasExtras >= limiteExtra) {
    return { cenario: "extra_completou", beneficio: "Cesta Extra" };
  }

  // 2) Regra dos 25 dias.
  if (assistido.ultimaRetiradaISO) {
    const proximaDataISO = addDays(assistido.ultimaRetiradaISO, intervaloMinimo);
    const diasRestantes = diffDays(hojeISO, proximaDataISO);
    if (diasRestantes > 0) {
      return {
        cenario: "bloqueio_25dias",
        beneficio,
        proximaDataISO,
        diasRestantes,
      };
    }
  }

  // 3) Estoque.
  const saldo = beneficio === "Cesta Padrão" ? estoque.cestaPadrao : estoque.cestaExtra;
  if (saldo <= 0) {
    return { cenario: "bloqueio_estoque", beneficio };
  }

  // 4) Liberado.
  if (assistido.tipoCadastro === "definitivo") {
    return { cenario: "liberado_padrao", beneficio: "Cesta Padrão" };
  }
  const progresso = Math.min(limiteExtra, assistido.retiradasExtras + 1) as 1 | 2 | 3;
  return { cenario: "liberado_extra", beneficio: "Cesta Extra", progresso };
}

/** Quantidade que uma família leva de um benefício adicional sem autorização. */
export const QUANTIDADE_PADRAO_POR_FAMILIA = 1;

/** Mínimo de caracteres da justificativa de quantidade acima do padrão. */
export const JUSTIFICATIVA_MINIMA = 5;

export type BeneficioAdicionalSolicitado = {
  quantidade: number;
  justificativa: string;
};

export type MotivoRecusaAdicional =
  | "quantidade_invalida"
  | "exige_administrador"
  | "exige_justificativa";

/**
 * Valida um benefício adicional marcado na entrega.
 *
 * Regra homologada em 2026-08-06: 1 por família é o padrão; acima disso exige
 * administrador e justificativa — mesmo desenho da liberação excepcional de
 * prazo. O enforcement real é da RPC; isto evita perder a entrega inteira por
 * um pedido que o servidor recusaria.
 */
export function recusaDoBeneficioAdicional(
  pedido: BeneficioAdicionalSolicitado,
  ehAdministrador: boolean,
): MotivoRecusaAdicional | null {
  if (!Number.isInteger(pedido.quantidade) || pedido.quantidade < 1) {
    return "quantidade_invalida";
  }
  if (pedido.quantidade === QUANTIDADE_PADRAO_POR_FAMILIA) return null;
  if (!ehAdministrador) return "exige_administrador";
  if (pedido.justificativa.trim().length < JUSTIFICATIVA_MINIMA) return "exige_justificativa";
  return null;
}

/** Utilitário para formatar YYYY-MM-DD em DD/MM/AAAA. */
export function formatBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
