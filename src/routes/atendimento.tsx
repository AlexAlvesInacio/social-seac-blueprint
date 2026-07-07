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
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                Cesta Extra (em avaliação)
              </Badge>
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
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-start gap-2">
                  <UserCog className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Cadastro Extra / em avaliação</p>
                    <p className="text-xs text-amber-700">
                      Este assistido está recebendo <span className="font-medium">Cesta Extra</span> enquanto o cadastro definitivo não é aprovado.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">Progresso das retiradas extras</p>
                  <ExtraProgress current={2} />
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
                  <InfoIcon className="mt-0.5 h-4 w-4 text-primary" />
                  <p>
                    Após a 3ª retirada extra, o assistido deverá ser avaliado para cadastro definitivo e terá direito à <span className="font-medium">Cesta Padrão</span> no próximo mês.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <StatusCard
            variant="ok"
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="1. Assistido liberado"
            text="Pode retirar a cesta hoje."
            action={
              <div className="space-y-3">
                <div className="rounded-md border border-primary/20 bg-background p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Tipo de benefício disponível</p>
                  <p className="font-semibold text-foreground">Cesta Extra</p>
                </div>
                <Button size="lg" className="w-full gap-2">
                  <ShoppingBasket className="h-4 w-4" /> Entregar Cesta Extra
                </Button>
                <p className="rounded-md bg-primary/5 p-2 text-xs text-foreground/70">
                  Será entregue a <span className="font-medium">Cesta Extra</span>. Após a 3ª retirada extra, o assistido poderá ser avaliado para <span className="font-medium">Cesta Padrão</span>.
                </p>
              </div>
            }
          />
          <StatusCard
            variant="warn"
            icon={<Clock className="h-5 w-5" />}
            title="2. Bloqueado antes dos 25 dias"
            text="Próxima data permitida em 10/06/2025."
            action={
              <div className="space-y-2">
                <div className="rounded-md border border-amber-200 bg-background p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Motivo do bloqueio</p>
                  <p className="font-medium text-foreground">Aguardando completar o intervalo mínimo de 25 dias.</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Vale para Cesta Extra e Cesta Padrão.</p>
                </div>
                <Button size="lg" variant="outline" className="w-full gap-2">
                  <ShieldAlert className="h-4 w-4" /> Liberar excepcionalmente
                </Button>
                <p className="text-[11px] text-amber-700">
                  A liberação excepcional é permitida apenas para usuários com perfil <span className="font-medium">Administrador</span> e exige observação obrigatória.
                </p>
              </div>
            }
          />
          <StatusCard
            variant="danger"
            icon={<PackageX className="h-5 w-5" />}
            title="3. Bloqueio por falta de estoque"
            text="Não é possível liberar entrega sem saldo de Cesta em estoque."
            action={
              <div className="space-y-2">
                <Button size="lg" variant="outline" className="w-full gap-2 border-destructive/40 text-destructive">
                  <ShieldAlert className="h-4 w-4" /> Registrar tentativa bloqueada
                </Button>
                <p className="text-[11px] text-destructive/80">
                  Sem saldo em estoque, não é permitida liberação excepcional. Apenas registrar a tentativa.
                </p>
              </div>
            }
          />
        </div>
      </div>

      {/* Sem cadastro encontrado */}
      <Card className="mt-4 border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Nenhum assistido encontrado para este documento.</p>
              <p className="text-xs text-muted-foreground">
                É possível criar um pré-cadastro e, se necessário, já entregar a primeira Cesta Extra.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">Criar pré-cadastro</Button>
            <Button className="gap-2">
              <ShoppingBasket className="h-4 w-4" /> Criar pré-cadastro e entregar Cesta Extra
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerta 3ª retirada extra */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <div className="flex items-start gap-2">
          <InfoIcon className="mt-0.5 h-4 w-4 text-primary" />
          <p className="text-foreground/85">
            Assistido completou <span className="font-medium">3 retiradas extras</span>. Avaliar cadastro definitivo para liberar <span className="font-medium">Cesta Padrão</span> no próximo mês.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2 border-primary/40 text-primary">
          <UserCheck className="h-4 w-4" /> Avaliar cadastro definitivo
        </Button>
      </div>

      <div className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        A liberação excepcional só pode ser realizada por usuários com perfil <span className="font-medium text-foreground">Administrador</span>, com observação obrigatória.
      </div>

      {/* Regras e fluxo */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Regras importantes</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground/85">
              <li>• <span className="font-medium">Cesta Extra</span>: para assistidos novos, pré-cadastrados ou com cadastro em avaliação.</li>
              <li>• <span className="font-medium">Cesta Padrão</span>: para assistidos com cadastro definitivo/aprovado.</li>
              <li>• Intervalo mínimo de 25 dias vale para ambas as cestas.</li>
              <li>• Após 3 retiradas extras, o cadastro deve ser avaliado para efetivação.</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Fluxo da Cesta Extra</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground/85">
              <FlowStep icon={<UserPlus className="h-4 w-4" />} label="Assistido novo ou sem cadastro definitivo" />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <FlowStep icon={<ShoppingBasket className="h-4 w-4" />} label="Recebe Cesta Extra" />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <FlowStep icon={<Clock className="h-4 w-4" />} label="Até 3 retiradas acompanhadas" />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <FlowStep icon={<UserCog className="h-4 w-4" />} label="Após 3ª, avaliar cadastro" />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <FlowStep icon={<CheckCircle2 className="h-4 w-4" />} label="Se aprovado, Cesta Padrão no próximo mês" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

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