import { createFileRoute } from "@tanstack/react-router";
import { Search, CheckCircle2, Clock, PackageX, ShieldAlert } from "lucide-react";
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
            <div className="mt-3 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div>
                <p className="text-lg font-semibold">Assistido (exemplo)</p>
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Ativo</Badge>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="Documento" value="—" />
              <Info label="Família" value="—" />
              <Info label="Telefone" value="—" />
              <Info label="Endereço" value="—" />
              <Info label="Última retirada" value="—" />
              <Info label="Próxima data permitida" value="—" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <StatusCard
            variant="ok"
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="1. Assistido liberado"
            text="Pode retirar a cesta hoje."
            action={<Button size="lg" className="w-full">Entregar cesta</Button>}
          />
          <StatusCard
            variant="warn"
            icon={<Clock className="h-5 w-5" />}
            title="2. Bloqueado antes dos 25 dias"
            text="Próxima data permitida em breve."
            action={<Button size="lg" variant="outline" className="w-full gap-2"><ShieldAlert className="h-4 w-4" /> Liberar excepcionalmente</Button>}
          />
          <StatusCard
            variant="danger"
            icon={<PackageX className="h-5 w-5" />}
            title="3. Bloqueio por falta de estoque"
            text="Não é possível realizar a entrega no momento."
            action={<Button size="lg" variant="ghost" className="w-full" disabled>Entender bloqueio</Button>}
          />
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        A liberação excepcional só pode ser realizada por usuários com perfil <span className="font-medium text-foreground">Administrador</span>.
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