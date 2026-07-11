import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Search,
  CheckCircle2,
  Clock,
  PackageX,
  ShieldAlert,
  UserPlus,
  UserCheck,
  UserCog,
  Info as InfoIcon,
  ShoppingBasket,
  ArrowRight,
  SearchX,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  verificarElegibilidadeAtendimento,
  formatBR,
  type AssistidoRegra,
  type EstoqueBeneficio,
  type Elegibilidade,
} from "@/lib/atendimento-regras";
import { useParametros } from "@/lib/config-store";
import { registrarAuditoria } from "@/lib/auditoria-store";
import { useFamilias } from "@/lib/familias-store";
import { useAtendimentoStore, type BeneficioNome } from "@/lib/atendimento-store";

export const Route = createFileRoute("/atendimento")({
  head: () => ({ meta: [{ title: "Atendimento — SEAC Social" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    assistido: typeof s.assistido === "string" ? s.assistido : undefined,
  }),
  component: AtendimentoPage,
});

/* ---------- Modelo local ----------
 * A busca usa cadastros reais (useFamilias) + histórico de entregas
 * (useAtendimentoStore) para montar o objeto que a regra oficial consome.
 */

type Assistido = AssistidoRegra & {
  assistidoId: string;
  familiaId: number;
};

function normDoc(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/* ---------- Page ---------- */

function AtendimentoPage() {
  // Perfil simulado apenas para exibir a ação restrita a Administrador.
  const isAdmin = true;
  const params = useParametros((s) => s.params);
  const familias = useFamilias((s) => s.familias);
  const assistidosAll = useFamilias((s) => s.assistidos);
  const membrosAll = useFamilias((s) => s.membros);
  const ultimaEntrega = useAtendimentoStore((s) => s.ultimaEntrega);
  const contarExtras = useAtendimentoStore((s) => s.contarExtras);
  const saldoMap = useAtendimentoStore((s) => s.saldo);
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  type SearchResult =
    | { status: "idle" }
    | { status: "invalid" }
    | { status: "found"; assistido: Assistido }
    | { status: "family_only"; familiaId: number; nome: string; responsavel: string; documento: string; telefone?: string; bairro?: string }
    | { status: "member_only"; familiaId: number; familiaNome: string; nome: string; documento?: string; parentesco: string }
    | { status: "not_found" };
  const [result, setResult] = useState<SearchResult>({ status: "idle" });

  const normalize = (s: string) => s.toLowerCase().trim();
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  const buildAssistido = (raw: (typeof assistidosAll)[number]): Assistido | null => {
    const familia = familias.find((f) => f.id === raw.familiaId);
    if (!familia) return null;
    const enderecoParts = [
      [familia.endereco, familia.numero].filter(Boolean).join(", "),
      familia.bairro,
    ].filter(Boolean);
    const ult = ultimaEntrega(raw.documento);
    return {
      assistidoId: raw.id,
      familiaId: raw.familiaId,
      nome: raw.nome,
      documento: raw.documento,
      telefone: raw.telefone ?? familia.telefone ?? "",
      familia: familia.nome,
      endereco: enderecoParts.join(" — ") || "—",
      tipoCadastro: raw.tipoCadastro,
      ultimaRetiradaISO: ult ? ult.dataISO.slice(0, 10) : null,
      retiradasExtras: contarExtras(raw.documento),
    };
  };

  const executarBusca = (raw: string): SearchResult => {
    const q = raw.trim();
    if (q.length < 3) return { status: "invalid" };
    const qNorm = normalize(q);
    const qDigits = onlyDigits(q);
    const ativos = assistidosAll.filter((a) => a.status === "ativo");
    const match = ativos.find((a) => {
      const nameHit = normalize(a.nome).includes(qNorm);
      const docHit =
        qDigits.length >= 3 && onlyDigits(a.documento).includes(qDigits);
      const telHit =
        qDigits.length >= 3 &&
        onlyDigits(a.telefone ?? "").includes(qDigits);
      return nameHit || docHit || telHit;
    });
    if (match) {
      const built = buildAssistido(match);
      if (built) return { status: "found", assistido: built };
    }
    // Sem assistido → checar responsável de família.
    const fam = familias.find((f) => {
      const nameHit = normalize(f.responsavel).includes(qNorm) || normalize(f.nome).includes(qNorm);
      const docHit = qDigits.length >= 3 && onlyDigits(f.documento).includes(qDigits);
      const telHit = qDigits.length >= 3 && onlyDigits(f.telefone ?? "").includes(qDigits);
      return nameHit || docHit || telHit;
    });
    if (fam) {
      return {
        status: "family_only",
        familiaId: fam.id,
        nome: fam.nome,
        responsavel: fam.responsavel,
        documento: fam.documento,
        telefone: fam.telefone,
        bairro: fam.bairro,
      };
    }
    // Sem família → checar membro familiar.
    const membro = membrosAll.find((m) => {
      const nameHit = normalize(m.nome).includes(qNorm);
      const docHit = qDigits.length >= 3 && !!m.documento && onlyDigits(m.documento).includes(qDigits);
      const telHit = qDigits.length >= 3 && !!m.telefone && onlyDigits(m.telefone).includes(qDigits);
      return nameHit || docHit || telHit;
    });
    if (membro) {
      const famM = familias.find((f) => f.id === membro.familiaId);
      return {
        status: "member_only",
        familiaId: membro.familiaId,
        familiaNome: famM?.nome ?? "—",
        nome: membro.nome,
        documento: membro.documento,
        parentesco: membro.parentesco,
      };
    }
    return { status: "not_found" };
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(executarBusca(query));
  };

  // Pré-seleção via ?assistido=<documento> (vindo de /familias/:id).
  useEffect(() => {
    if (!search.assistido) return;
    const doc = search.assistido;
    setQuery(doc);
    setResult(executarBusca(doc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.assistido, assistidosAll.length, familias.length]);

  // Recalcula quando saldo/entregas mudarem, mantendo o assistido exibido.
  useEffect(() => {
    if (result.status !== "found") return;
    const doc = result.assistido.documento;
    const raw = assistidosAll.find((a) => normDoc(a.documento) === normDoc(doc));
    if (!raw) return;
    const rebuilt = buildAssistido(raw);
    if (rebuilt) setResult({ status: "found", assistido: rebuilt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saldoMap]);

  return (
    <AppShell title="Atendimento — Busca e entrega">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setResult({ status: "idle" });
                }}
                placeholder="Buscar por CPF, RG, nome ou telefone"
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="gap-2">
                <Search className="h-4 w-4" /> Buscar
              </Button>
            </div>
          </form>
          <p
            className={
              "mt-2 text-xs " +
              (result.status === "invalid"
                ? "text-destructive"
                : "text-muted-foreground")
            }
          >
            Digite pelo menos 3 caracteres para buscar.
          </p>
        </CardContent>
      </Card>

      <div className="mt-4">
        {(result.status === "idle" || result.status === "invalid") && <EmptyState />}
        {result.status === "not_found" && <NaoEncontradoState />}
        {result.status === "family_only" && (
          <FamilySemAssistidoState
            familiaId={result.familiaId}
            nome={result.nome}
            responsavel={result.responsavel}
            documento={result.documento}
            telefone={result.telefone}
            bairro={result.bairro}
            onAdicionar={() => {
              registrarAuditoria({
                usuario: "operador",
                acao: "Encaminhado para cadastro de assistido (responsável)",
                modulo: "Atendimento",
                registro: `${result.nome} — ${result.responsavel}`,
              });
              navigate({ to: "/familias/$id", params: { id: String(result.familiaId) } });
            }}
          />
        )}
        {result.status === "member_only" && (
          <MembroSemAssistidoState
            familiaId={result.familiaId}
            familiaNome={result.familiaNome}
            nome={result.nome}
            documento={result.documento}
            parentesco={result.parentesco}
            onCadastrar={() => {
              registrarAuditoria({
                usuario: "operador",
                acao: "Membro familiar encaminhado para cadastro como assistido",
                modulo: "Atendimento",
                registro: `${result.familiaNome} — ${result.nome}`,
              });
              navigate({ to: "/familias/$id", params: { id: String(result.familiaId) } });
            }}
          />
        )}
        {result.status === "found" && (
          <ResultadoAssistido assistido={result.assistido} isAdmin={isAdmin} params={params} />
        )}
      </div>

      <Accordion type="single" collapsible className="mt-6">
        <AccordionItem value="regras" className="rounded-md border border-border bg-background px-4">
          <AccordionTrigger className="text-sm">Regras e fluxo (referência)</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 pb-2 lg:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Regras importantes</p>
                <ul className="mt-2 space-y-1 text-sm text-foreground/85">
                  <li>• <span className="font-medium">Cesta Extra</span>: para assistidos novos, pré-cadastrados ou em avaliação.</li>
                  <li>• <span className="font-medium">Cesta Padrão</span>: para assistidos com cadastro definitivo/aprovado.</li>
                  <li>• Intervalo mínimo de 25 dias vale para ambas.</li>
                  <li>• Após 3 retiradas extras, coordenação avalia efetivação.</li>
                  <li>• Liberação excepcional apenas admin, com observação obrigatória, e não vale para falta de estoque.</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Fluxo da Cesta Extra</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground/85">
                  <FlowStep icon={<UserPlus className="h-4 w-4" />} label="Novo / sem cadastro definitivo" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <FlowStep icon={<ShoppingBasket className="h-4 w-4" />} label="Recebe Cesta Extra" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <FlowStep icon={<Clock className="h-4 w-4" />} label="Até 3 retiradas" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <FlowStep icon={<UserCog className="h-4 w-4" />} label="Avaliar cadastro" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <FlowStep icon={<CheckCircle2 className="h-4 w-4" />} label="Se aprovado, Cesta Padrão" />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </AppShell>
  );
}

/* ---------- Resultado ---------- */

function ResultadoAssistido({
  assistido,
  isAdmin,
  params,
}: {
  assistido: Assistido;
  isAdmin: boolean;
  params: ReturnType<typeof useParametros.getState>["params"];
}) {
  // Aplica a lógica central de regras oficiais (REGRAS_ATENDIMENTO_SEAC.md).
  const saldoPadrao = useAtendimentoStore((s) => s.saldo["Cesta Padrão"] ?? 0);
  const saldoExtra = useAtendimentoStore((s) => s.saldo["Cesta Extra"] ?? 0);
  const estoque: EstoqueBeneficio = { cestaPadrao: saldoPadrao, cestaExtra: saldoExtra };
  const el = verificarElegibilidadeAtendimento(assistido, estoque, undefined, {
    intervaloMinimoDias: params.intervaloMinimoDias,
    limiteExtra: params.limiteExtra,
  });
  const tipo: "padrao" | "extra" =
    assistido.tipoCadastro === "definitivo" ? "padrao" : "extra";
  const progressoAtual =
    el.cenario === "liberado_extra"
      ? el.progresso
      : assistido.tipoCadastro === "extra"
        ? (Math.min(3, assistido.retiradasExtras) as 1 | 2 | 3)
        : undefined;
  const proximaData =
    el.cenario === "bloqueio_25dias"
      ? formatBR(el.proximaDataISO)
      : assistido.ultimaRetiradaISO
        ? formatBR(
            new Date(
              new Date(assistido.ultimaRetiradaISO + "T00:00:00").getTime() +
                params.intervaloMinimoDias * 24 * 60 * 60 * 1000,
            )
              .toISOString()
              .slice(0, 10),
          )
        : "—";

  // Acompanhamento por inatividade (não bloqueia entrega).
  const diasDesdeUltima = assistido.ultimaRetiradaISO
    ? Math.floor(
        (Date.now() -
          new Date(assistido.ultimaRetiradaISO + "T00:00:00").getTime()) /
          86400000,
      )
    : null;
  const acompanhamento: "em_dia" | "atencao_45" | "contato_90" =
    diasDesdeUltima === null
      ? "em_dia"
      : diasDesdeUltima >= params.inatividadeContatoDias
        ? "contato_90"
        : diasDesdeUltima >= params.alertaLiberadoSemRetiradaDias
          ? "atencao_45"
          : "em_dia";

  return (
    <ScenarioLayout
      person={
        <PersonCard
          assistido={assistido}
          tipo={tipo}
          progresso={progressoAtual}
          ultimaRetirada={formatBR(assistido.ultimaRetiradaISO)}
          proximaData={proximaData}
          acompanhamento={acompanhamento}
          params={params}
        />
      }
      action={renderAcao(el, assistido, isAdmin, proximaData, params)}
    />
  );
}

function renderAcao(
  el: Elegibilidade,
  assistido: Assistido,
  isAdmin: boolean,
  proximaData: string,
  params: ReturnType<typeof useParametros.getState>["params"],
) {
  switch (el.cenario) {
    case "liberado_padrao":
      return <LiberadoAction assistido={assistido} beneficio="Cesta Padrão" />;
    case "liberado_extra":
      return (
        <LiberadoAction
          assistido={assistido}
          beneficio="Cesta Extra"
          progresso={el.progresso === 3 ? 2 : el.progresso}
        />
      );
    case "extra_completou":
      return (
        <LiberadoAction
          assistido={assistido}
          beneficio="Cesta Extra"
          progresso={3}
        />
      );
    case "bloqueio_25dias":
      return (
        <Bloqueio25Action
          assistido={assistido}
          isAdmin={isAdmin}
          proximaData={proximaData}
          diasRestantes={el.diasRestantes}
          intervaloMinimoDias={params.intervaloMinimoDias}
        />
      );
    case "bloqueio_estoque":
      return <SemEstoqueAction assistido={assistido} />;
  }
}

function ScenarioLayout({ person, action }: { person: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {person}
      {action}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Nenhuma busca realizada</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Informe CPF, RG, nome ou telefone para localizar o assistido e verificar a elegibilidade da entrega.
        </p>
      </CardContent>
    </Card>
  );
}

function NaoEncontradoState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <SearchX className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
              <p className="text-sm font-medium">Nenhum assistido encontrado para os dados informados.</p>
            <p className="text-xs text-muted-foreground">
                É possível criar um pré-cadastro e, se necessário, entregar a primeira Cesta Extra.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => toast.success("Pré-cadastro iniciado.")}
          >
            <UserPlus className="h-4 w-4" /> Criar pré-cadastro
          </Button>
          <Button
            className="gap-2"
            onClick={() =>
              toast.success("Pré-cadastro criado e Cesta Extra entregue.")
            }
          >
            <ShoppingBasket className="h-4 w-4" /> Criar pré-cadastro e entregar Cesta Extra
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Person card ---------- */

function PersonCard({
  assistido,
  tipo,
  progresso,
  ultimaRetirada,
  proximaData,
  acompanhamento,
  params,
}: {
  assistido: Assistido;
  tipo: "padrao" | "extra";
  progresso?: number;
  ultimaRetirada: string;
  proximaData: string;
  acompanhamento: "em_dia" | "atencao_45" | "contato_90";
  params: ReturnType<typeof useParametros.getState>["params"];
}) {
  const isExtra = tipo === "extra";
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-xs font-medium uppercase text-muted-foreground">Resultado da busca</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <UserCheck className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-semibold">{assistido.nome}</p>
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Ativo</Badge>
            </div>
          </div>
          {isExtra ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
              Cesta Extra (em avaliação)
            </Badge>
          ) : (
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Cadastro definitivo
            </Badge>
          )}
        </div>

        {acompanhamento !== "em_dia" && (
          <div
            className={
              "mt-3 rounded-md border p-3 text-xs " +
              (acompanhamento === "contato_90"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-amber-300 bg-amber-50 text-amber-800")
            }
          >
            {acompanhamento === "contato_90"
              ? `Contato necessário por inatividade — sem retirada há ${params.inatividadeContatoDias} dias ou mais.`
              : `Atenção: sem retirada há ${params.alertaLiberadoSemRetiradaDias} dias ou mais.`}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Info label="Documento" value={assistido.documento} />
          <Info label="Família" value={assistido.familia} />
          <Info label="Telefone" value={assistido.telefone} />
          <Info label="Endereço" value={assistido.endereco} />
          <Info label="Última retirada" value={ultimaRetirada} />
          <Info label="Próxima data permitida" value={proximaData} />
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium uppercase text-muted-foreground">Situação do cadastro</p>
          {isExtra ? (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-start gap-2">
                <UserCog className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Cadastro Extra / em avaliação</p>
                  <p className="text-xs text-amber-700">
                    Assistido realizando retiradas extras antes da avaliação definitiva.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                  Progresso das retiradas extras — {progresso ?? 0}/3
                </p>
                <ExtraProgress current={progresso ?? 0} />
              </div>
              <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-800">
                Após a 3ª retirada extra, o assistido deverá ser avaliado para cadastro definitivo e terá direito à Cesta Padrão no próximo mês.
              </p>
            </div>
          ) : (
            <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <UserCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-primary">Cadastro definitivo</p>
                  <p className="text-xs text-foreground/75">
                    Assistido aprovado. Recebe <span className="font-medium">Cesta Padrão</span> mensalmente.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Actions ---------- */

function LiberadoAction({
  assistido,
  beneficio,
  progresso,
}: {
  assistido: Assistido;
  beneficio: "Cesta Padrão" | "Cesta Extra";
  progresso?: number;
}) {
  const completou = progresso === 3;
  const [open, setOpen] = useState(false);
  const registrarEntrega = useAtendimentoStore((s) => s.registrarEntrega);
  const saldoAtual = useAtendimentoStore((s) => s.saldo[beneficio] ?? 0);

  const confirmar = () => {
    if (saldoAtual <= 0) {
      toast.error("Sem saldo em estoque para este benefício.");
      return;
    }
    registrarEntrega({
      assistidoId: assistido.assistidoId,
      familiaId: assistido.familiaId,
      documento: assistido.documento,
      nome: assistido.nome,
      familia: assistido.familia,
      beneficio: beneficio as BeneficioNome,
      usuario: "Administrador",
      origem: "atendimento",
    });
    registrarAuditoria({
      usuario: "Administrador",
      acao: "Entrega realizada",
      modulo: "Atendimento",
      registro: `${assistido.nome} — ${beneficio}`,
    });
    registrarAuditoria({
      usuario: "Sistema",
      acao: "Baixa automática",
      modulo: "Estoque",
      registro: `${beneficio} (−1)`,
      observacao: `Vinculada a ${assistido.nome} — ${assistido.familia}`,
    });
    toast.success(`${beneficio} entregue para ${assistido.nome}.`, {
      description:
        "Registrado: assistido, família, benefício, data/hora, usuário responsável, tipo de entrega, baixa no estoque e histórico da família.",
    });
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <StatusCard
        variant="ok"
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Assistido liberado"
        text="Pode retirar a cesta hoje."
        action={
          <div className="space-y-3">
            <TipoBeneficio nome={beneficio} />
            <Button
              size="lg"
              className="w-full gap-2"
              disabled={completou}
              onClick={() => setOpen(true)}
            >
              <ShoppingBasket className="h-4 w-4" />
              {completou ? "Aguardar avaliação da coordenação" : `Entregar ${beneficio}`}
            </Button>
            <p className="rounded-md bg-primary/5 p-2 text-xs text-foreground/70">
              {beneficio === "Cesta Padrão"
                ? "Entrega mensal. Próxima data permitida respeita o intervalo mínimo de 25 dias."
                : "Após completar 3 retiradas extras, o assistido deve ser avaliado para cadastro definitivo."}
            </p>
          </div>
        }
      />

      {completou && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <InfoIcon className="mt-0.5 h-4 w-4 text-primary" />
            <p className="text-foreground/85">
              Assistido completou <span className="font-medium">3 retiradas extras</span>. Encaminhar para avaliação do cadastro definitivo.
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2 border-primary/40 text-primary">
            <UserCheck className="h-4 w-4" /> Avaliar cadastro definitivo
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar entrega — {beneficio}</DialogTitle>
            <DialogDescription>
              A entrega registrará automaticamente as informações abaixo e dará baixa no estoque.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground/85">
            <li>• Assistido: <span className="font-medium">{assistido.nome}</span></li>
            <li>• Família: <span className="font-medium">{assistido.familia}</span></li>
            <li>• Benefício: <span className="font-medium">{beneficio}</span></li>
            <li>• Data/hora: <span className="font-medium">agora</span></li>
            <li>• Usuário responsável: <span className="font-medium">Administrador</span></li>
            <li>• Tipo de entrega: <span className="font-medium">Retirada no local</span></li>
            <li>• Baixa automática no estoque</li>
            <li>• Registro no histórico da família</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={confirmar}>Confirmar entrega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Bloqueio25Action({
  assistido,
  isAdmin,
  proximaData,
  diasRestantes,
  intervaloMinimoDias,
}: {
  assistido: Assistido;
  isAdmin: boolean;
  proximaData: string;
  diasRestantes: number;
  intervaloMinimoDias: number;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const registrarBloqueio = useAtendimentoStore((s) => s.registrarBloqueio);
  const registrarEntrega = useAtendimentoStore((s) => s.registrarEntrega);
  const saldoPadrao = useAtendimentoStore((s) => s.saldo["Cesta Padrão"] ?? 0);
  const saldoExtra = useAtendimentoStore((s) => s.saldo["Cesta Extra"] ?? 0);

  useEffect(() => {
    registrarBloqueio({
      documento: assistido.documento,
      nome: assistido.nome,
      familia: assistido.familia,
      motivo: "prazo",
      observacao: `Faltam ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"} — próxima ${proximaData}.`,
      usuario: "Administrador",
    });
    registrarAuditoria({
      usuario: "Administrador",
      acao: "Tentativa bloqueada por prazo",
      modulo: "Atendimento",
      registro: assistido.nome,
      observacao: `Faltam ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"} — próxima ${proximaData}.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liberar = () => {
    if (motivo.trim().length < 5) {
      toast.error("Informe o motivo da liberação excepcional.");
      return;
    }
    const beneficio: BeneficioNome =
      assistido.tipoCadastro === "definitivo" ? "Cesta Padrão" : "Cesta Extra";
    const saldo = beneficio === "Cesta Padrão" ? saldoPadrao : saldoExtra;
    if (saldo <= 0) {
      toast.error("Sem saldo em estoque — liberação excepcional não permitida.");
      return;
    }
    registrarEntrega({
      assistidoId: assistido.assistidoId,
      familiaId: assistido.familiaId,
      documento: assistido.documento,
      nome: assistido.nome,
      familia: assistido.familia,
      beneficio,
      usuario: "Administrador",
      observacao: motivo.trim(),
      excepcional: true,
      origem: "atendimento",
    });
    registrarAuditoria({
      usuario: "Administrador",
      acao: "Liberação excepcional",
      modulo: "Atendimento",
      registro: assistido.nome,
      observacao: motivo.trim(),
    });
    toast.success(`Liberação excepcional registrada para ${assistido.nome}.`);
    setOpen(false);
    setMotivo("");
  };

  // Registra a tentativa bloqueada por prazo na abertura da tela do bloqueio.
  // Feita uma única vez (dentro do próprio componente montado).
  // Auditoria acumula os eventos consultáveis em /auditoria.
  return (
    <>
      <StatusCard
        variant="warn"
        icon={<Clock className="h-5 w-5" />}
        title="Bloqueado antes do prazo mínimo"
        text={`Próxima data permitida em ${proximaData} — faltam ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}.`}
        action={
          <div className="space-y-2">
            <div className="rounded-md border border-amber-200 bg-background p-3 text-sm">
              <p className="text-xs text-muted-foreground">Motivo do bloqueio</p>
              <p className="font-medium text-foreground">
                Intervalo mínimo de {intervaloMinimoDias} dias não completado.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Vale para Cesta Extra e Cesta Padrão.</p>
            </div>
            {isAdmin && (
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setOpen(true)}
              >
                <ShieldAlert className="h-4 w-4" /> Liberar excepcionalmente
              </Button>
            )}
            <p className="text-[11px] text-amber-700">
              Ação restrita a perfil <span className="font-medium">Administrador</span>. Exige observação obrigatória.
            </p>
          </div>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberação excepcional</DialogTitle>
            <DialogDescription>
              Informe o motivo da liberação antes dos 25 dias. Esta ação ficará registrada no histórico da família.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (obrigatório)</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva a justificativa para a liberação excepcional…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={liberar}>Confirmar liberação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SemEstoqueAction({ assistido }: { assistido: Assistido }) {
  const registrarBloqueio = useAtendimentoStore((s) => s.registrarBloqueio);
  const registrar = () => {
    registrarBloqueio({
      documento: assistido.documento,
      nome: assistido.nome,
      familia: assistido.familia,
      motivo: "estoque",
      usuario: "Administrador",
    });
    registrarAuditoria({
      usuario: "Administrador",
      acao: "Tentativa bloqueada por estoque",
      modulo: "Atendimento",
      registro: assistido.nome,
    });
    toast.success(`Tentativa bloqueada registrada para ${assistido.nome}.`, {
      description: "Motivo: falta de estoque. Registro adicionado ao histórico da família.",
    });
  };

  return (
    <StatusCard
      variant="danger"
      icon={<PackageX className="h-5 w-5" />}
      title="Bloqueio por falta de estoque"
      text="Não é possível liberar entrega sem saldo em estoque."
      action={
        <div className="space-y-2">
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2 border-destructive/40 text-destructive"
            onClick={registrar}
          >
            <ShieldAlert className="h-4 w-4" /> Registrar tentativa bloqueada
          </Button>
          <p className="text-[11px] text-destructive/80">
            Sem saldo em estoque, <span className="font-medium">não é permitida</span> liberação excepcional. Apenas registrar a tentativa.
          </p>
        </div>
      }
    />
  );
}

function TipoBeneficio({ nome }: { nome: string }) {
  return (
    <div className="rounded-md border border-primary/20 bg-background p-3 text-sm">
      <p className="text-xs text-muted-foreground">Tipo de benefício disponível</p>
      <p className="font-semibold text-foreground">{nome}</p>
    </div>
  );
}

/* ---------- helpers ---------- */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ExtraProgress({ current }: { current: number }) {
  const steps = [1, 2, 3];
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      {steps.map((n, i) => {
        const done = n <= current;
        return (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium " +
                  (done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground")
                }
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span className="text-[10px] text-muted-foreground">{n}ª retirada</span>
            </div>
            {i < steps.length - 1 && (
              <div className={"h-0.5 flex-1 " + (n < current ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FlowStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatusCard({
  variant, icon, title, text, action,
}: {
  variant: "ok" | "warn" | "danger";
  icon: React.ReactNode;
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  const colors = {
    ok: "border-primary/30 bg-primary/5 text-primary",
    warn: "border-amber-300 bg-amber-50 text-amber-700",
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
  }[variant];
  return (
    <Card className={colors + " border"}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 font-medium">{icon} {title}</div>
        <p className="mt-1 text-sm text-foreground/80">{text}</p>
        <div className="mt-3">{action}</div>
      </CardContent>
    </Card>
  );
}