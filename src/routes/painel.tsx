import { createFileRoute } from "@tanstack/react-router";
import { Users, UserRound, Package, Truck, Calendar } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Painel — SEAC Social" }] }),
  component: PainelPage,
});

const stats = [
  { icon: Users, label: "Famílias cadastradas", value: "—", hint: "Total" },
  { icon: UserRound, label: "Assistidos ativos", value: "—", hint: "Ativos" },
  { icon: Package, label: "Cestas em estoque", value: "—", hint: "Unidades" },
  { icon: Truck, label: "Entregas hoje", value: "—", hint: "Hoje" },
  { icon: Calendar, label: "Entregas no mês", value: "—", hint: "Este mês" },
];

function PainelPage() {
  return (
    <AppShell title="Painel">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-semibold leading-none">{s.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{s.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas entregas</CardTitle>
            <span className="text-xs text-primary">Ver todas</span>
          </CardHeader>
          <CardContent>
            <EmptyList text="Nenhuma entrega registrada ainda." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas movimentações</CardTitle>
            <span className="text-xs text-primary">Ver todas</span>
          </CardHeader>
          <CardContent>
            <EmptyList text="Nenhuma movimentação registrada ainda." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Alertas de estoque baixo</CardTitle>
            <span className="text-xs text-primary">Ver todos</span>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    Sem alertas no momento.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function EmptyList({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Badge variant="secondary">Sem dados</Badge>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}