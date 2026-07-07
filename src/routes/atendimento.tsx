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
  UserX,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/atendimento")({
  head: () => ({ meta: [{ title: "Atendimento — SEAC Social" }] }),
  component: AtendimentoPage,
});

function AtendimentoPage() {
  return (
    <AppShell title="Atendimento — Busca e entrega">
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por CPF, RG, nome ou telefone" className="pl-9" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Digite pelo menos 3 caracteres para buscar.</p>
        </CardContent>
      </Card>

      <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Demonstração visual:</span> selecione abaixo um cenário possível após a busca. Só um cenário acontece por vez em uso real.
      </div>

      <Tabs defaultValue="empty" className="mt-3">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="empty">Sem busca</TabsTrigger>
          <TabsTrigger value="padrao">Definitivo — Cesta Padrão</TabsTrigger>
          <TabsTrigger value="extra">Extra — em avaliação</TabsTrigger>
          <TabsTrigger value="bloqueio25">Bloqueado 25 dias</TabsTrigger>
          <TabsTrigger value="semEstoque">Sem estoque</TabsTrigger>
          <TabsTrigger value="naoEncontrado">Não encontrado</TabsTrigger>
        </TabsList>

        <TabsContent value="empty" className="mt-4">
          <EmptyState />
        </TabsContent>

        <TabsContent value="padrao" className="mt-4">
          <ScenarioLayout
            person={<PersonCard tipo="padrao" />}
            action={<PadraoAction />}
          />
        </TabsContent>

        <TabsContent value="extra" className="mt-4">
          <Tabs defaultValue="2">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Progresso simulado:</span>
              <TabsList className="h-8 bg-muted/50 p-0.5">
                <TabsTrigger value="1" className="text-xs">1/3</TabsTrigger>
                <TabsTrigger value="2" className="text-xs">2/3</TabsTrigger>
                <TabsTrigger value="3" className="text-xs">3/3</TabsTrigger>
              </TabsList>
            </div>
            {[1, 2, 3].map((n) => (
              <TabsContent key={n} value={String(n)}>
                <ScenarioLayout
                  person={<PersonCard tipo="extra" progresso={n} />}
                  action={<ExtraAction progresso={n} />}
                />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        <TabsContent value="bloqueio25" className="mt-4">
          <ScenarioLayout
            person={<PersonCard tipo="padrao" />}
            action={<Bloqueio25Action />}
          />
        </TabsContent>

        <TabsContent value="semEstoque" className="mt-4">
          <ScenarioLayout
            person={<PersonCard tipo="extra" progresso={1} />}
            action={<SemEstoqueAction />}
          />
        </TabsContent>

        <TabsContent value="naoEncontrado" className="mt-4">
          <NaoEncontradoState />
        </TabsContent>
      </Tabs>

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

/* ---------- Scenarios ---------- */

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
          Informe CPF, RG, nome ou telefone acima para localizar o assistido e verificar a elegibilidade da entrega.
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
            <p className="text-sm font-medium">Nenhum assistido encontrado para este documento.</p>
            <p className="text-xs text-muted-foreground">
              É possível criar um pré-cadastro e, se necessário, já entregar a primeira Cesta Extra.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" /> Criar pré-cadastro
          </Button>
          <Button className="gap-2">
            <ShoppingBasket className="h-4 w-4" /> Criar pré-cadastro e entregar Cesta Extra
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Person card ---------- */

function PersonCard({ tipo, progresso }: { tipo: "padrao" | "extra"; progresso?: number }) {
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
              <p className="text-lg font-semibold">João dos Santos</p>
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
          <Info label="Documento" value="987.654.321-00" />
          <Info label="Família" value="Família da Silva" />
          <Info label="Telefone" value="(11) 97654-3210" />
          <Info label="Endereço" value="Rua das Flores, 123 — São João" />
          <Info label="Última retirada" value="16/05/2025" />
          <Info label="Próxima data permitida" value="10/06/2025" />
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
                    Recebendo <span className="font-medium">Cesta Extra</span> enquanto o cadastro definitivo não é aprovado.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                  Progresso das retiradas extras — {progresso ?? 0}/3
                </p>
                <ExtraProgress current={progresso ?? 0} />
              </div>
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

function PadraoAction() {
  return (
    <StatusCard
      variant="ok"
      icon={<CheckCircle2 className="h-5 w-5" />}
      title="Assistido liberado — Cesta Padrão"
      text="Pode retirar a Cesta Padrão hoje."
      action={
        <div className="space-y-3">
          <TipoBeneficio nome="Cesta Padrão" />
          <Button size="lg" className="w-full gap-2">
            <ShoppingBasket className="h-4 w-4" /> Entregar Cesta Padrão
          </Button>
          <p className="rounded-md bg-primary/5 p-2 text-xs text-foreground/70">
            Entrega mensal. Próxima data permitida respeita o intervalo mínimo de 25 dias.
          </p>
        </div>
      }
    />
  );
}

function ExtraAction({ progresso }: { progresso: number }) {
  const completou = progresso >= 3;
  return (
    <div className="space-y-4">
      <StatusCard
        variant="ok"
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Assistido liberado — Cesta Extra"
        text={`Progresso atual: ${progresso}/3 retiradas extras.`}
        action={
          <div className="space-y-3">
            <TipoBeneficio nome="Cesta Extra" />
            <Button size="lg" className="w-full gap-2" disabled={completou}>
              <ShoppingBasket className="h-4 w-4" />
              {completou ? "Aguardar avaliação da coordenação" : "Entregar Cesta Extra"}
            </Button>
            <p className="rounded-md bg-primary/5 p-2 text-xs text-foreground/70">
              Após completar 3 retiradas extras consecutivas, o assistido deve ser avaliado pela coordenação para cadastro definitivo. Se aprovado, passa a receber <span className="font-medium">Cesta Padrão</span> no próximo mês.
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
    </div>
  );
}

function Bloqueio25Action() {
  return (
    <StatusCard
      variant="warn"
      icon={<Clock className="h-5 w-5" />}
      title="Bloqueado antes dos 25 dias"
      text="Próxima data permitida em 10/06/2025."
      action={
        <div className="space-y-2">
          <div className="rounded-md border border-amber-200 bg-background p-3 text-sm">
            <p className="text-xs text-muted-foreground">Motivo do bloqueio</p>
            <p className="font-medium text-foreground">Intervalo mínimo de 25 dias não completado.</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Vale para Cesta Extra e Cesta Padrão.</p>
          </div>
          <Button size="lg" variant="outline" className="w-full gap-2">
            <ShieldAlert className="h-4 w-4" /> Liberar excepcionalmente
          </Button>
          <p className="text-[11px] text-amber-700">
            Ação restrita a perfil <span className="font-medium">Administrador</span>. Exige observação obrigatória.
          </p>
        </div>
      }
    />
  );
}

function SemEstoqueAction() {
  return (
    <StatusCard
      variant="danger"
      icon={<PackageX className="h-5 w-5" />}
      title="Bloqueio por falta de estoque"
      text="Não é possível liberar entrega sem saldo em estoque."
      action={
        <div className="space-y-2">
          <Button size="lg" variant="outline" className="w-full gap-2 border-destructive/40 text-destructive">
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