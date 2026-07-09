import { createFileRoute } from "@tanstack/react-router";
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
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/atendimento")({
  head: () => ({ meta: [{ title: "Atendimento — SEAC Social" }] }),
  component: AtendimentoPage,
});

/* ---------- Mock lookup (demo, sem backend) ---------- */

type Situacao =
  | { kind: "extra_liberado"; progresso: 1 | 2 }
  | { kind: "extra_completou" }
  | { kind: "padrao_liberado" }
  | { kind: "bloqueio25" }
  | { kind: "sem_estoque" };

type Assistido = {
  nome: string;
  documento: string;
  telefone: string;
  familia: string;
  endereco: string;
  ultimaRetirada: string;
  proximaData: string;
  situacao: Situacao;
};

const MOCK_ASSISTIDOS: Assistido[] = [
  {
    nome: "João da Silva",
    documento: "987.654.321-00",
    telefone: "(11) 97654-3210",
    familia: "Família da Silva",
    endereco: "Rua das Flores, 123 — São João",
    ultimaRetirada: "16/05/2025",
    proximaData: "10/06/2025",
    situacao: { kind: "padrao_liberado" },
  },
  {
    nome: "Maria da Silva",
    documento: "321.654.987-00",
    telefone: "(11) 91234-5678",
    familia: "Família da Silva",
    endereco: "Rua das Flores, 123 — São João",
    ultimaRetirada: "20/05/2025",
    proximaData: "14/06/2025",
    situacao: { kind: "extra_liberado", progresso: 2 },
  },
  {
    nome: "Pedro Henrique Lima",
    documento: "222.333.444-55",
    telefone: "(11) 99876-1234",
    familia: "Família Lima",
    endereco: "Av. Brasil, 900 — Centro",
    ultimaRetirada: "05/06/2025",
    proximaData: "30/06/2025",
    situacao: { kind: "bloqueio25" },
  },
  {
    nome: "Ana Paula Rodrigues",
    documento: "333.444.555-66",
    telefone: "(11) 98888-2222",
    familia: "Família Rodrigues",
    endereco: "Rua das Palmeiras, 77 — Jardim",
    ultimaRetirada: "20/04/2025",
    proximaData: "15/05/2025",
    situacao: { kind: "sem_estoque" },
  },
];

/* ---------- Page ---------- */

function AtendimentoPage() {
  // Perfil simulado apenas para exibir a ação restrita a Administrador.
  const isAdmin = true;

  const [query, setQuery] = useState("");
  type SearchResult =
    | { status: "idle" }
    | { status: "invalid" }
    | { status: "found"; assistido: Assistido }
    | { status: "not_found" };
  const [result, setResult] = useState<SearchResult>({ status: "idle" });

  const normalize = (s: string) => s.toLowerCase().trim();
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setResult({ status: "invalid" });
      return;
    }
    const qNorm = normalize(q);
    const qDigits = onlyDigits(q);
    const match = MOCK_ASSISTIDOS.find((a) => {
      const nameHit = normalize(a.nome).includes(qNorm);
      const docHit =
        qDigits.length >= 3 && onlyDigits(a.documento).includes(qDigits);
      const telHit =
        qDigits.length >= 3 && onlyDigits(a.telefone).includes(qDigits);
      return nameHit || docHit || telHit;
    });
    setResult(match ? { status: "found", assistido: match } : { status: "not_found" });
  };

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
        {result.status === "found" && (
          <ResultadoAssistido assistido={result.assistido} isAdmin={isAdmin} />
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

function ResultadoAssistido({ assistido, isAdmin }: { assistido: Assistido; isAdmin: boolean }) {
  const s = assistido.situacao;
  const tipo: "padrao" | "extra" =
    s.kind === "padrao_liberado" || s.kind === "bloqueio25" ? "padrao" : "extra";
  const progresso =
    s.kind === "extra_liberado" ? s.progresso : s.kind === "extra_completou" ? 3 : undefined;

  const beneficio: "Cesta Padrão" | "Cesta Extra" = tipo === "padrao" ? "Cesta Padrão" : "Cesta Extra";

  return (
    <ScenarioLayout
      person={<PersonCard assistido={assistido} tipo={tipo} progresso={progresso} />}
      action={
        s.kind === "padrao_liberado" ? (
          <LiberadoAction assistido={assistido} beneficio="Cesta Padrão" />
        ) : s.kind === "extra_liberado" ? (
          <LiberadoAction assistido={assistido} beneficio="Cesta Extra" progresso={s.progresso} />
        ) : s.kind === "extra_completou" ? (
          <LiberadoAction assistido={assistido} beneficio={beneficio} progresso={3} />
        ) : s.kind === "bloqueio25" ? (
          <Bloqueio25Action assistido={assistido} isAdmin={isAdmin} />
        ) : (
          <SemEstoqueAction assistido={assistido} />
        )
      }
    />
  );
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
}: {
  assistido: Assistido;
  tipo: "padrao" | "extra";
  progresso?: number;
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

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Info label="Documento" value={assistido.documento} />
          <Info label="Família" value={assistido.familia} />
          <Info label="Telefone" value={assistido.telefone} />
          <Info label="Endereço" value={assistido.endereco} />
          <Info label="Última retirada" value={assistido.ultimaRetirada} />
          <Info label="Próxima data permitida" value={assistido.proximaData} />
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

  const confirmar = () => {
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

function Bloqueio25Action({ assistido, isAdmin }: { assistido: Assistido; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  const liberar = () => {
    if (motivo.trim().length < 5) {
      toast.error("Informe o motivo da liberação excepcional.");
      return;
    }
    toast.success(`Liberação excepcional registrada para ${assistido.nome}.`);
    setOpen(false);
    setMotivo("");
  };

  return (
    <>
      <StatusCard
        variant="warn"
        icon={<Clock className="h-5 w-5" />}
        title="Bloqueado antes dos 25 dias"
        text={`Próxima data permitida em ${assistido.proximaData}.`}
        action={
          <div className="space-y-2">
            <div className="rounded-md border border-amber-200 bg-background p-3 text-sm">
              <p className="text-xs text-muted-foreground">Motivo do bloqueio</p>
              <p className="font-medium text-foreground">Intervalo mínimo de 25 dias não completado.</p>
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
  const registrar = () =>
    toast.success(`Tentativa bloqueada registrada para ${assistido.nome}.`, {
      description: "Motivo: falta de estoque. Registro adicionado ao histórico da família.",
    });

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