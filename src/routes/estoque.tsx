import { createFileRoute } from "@tanstack/react-router";
import { Plus, Minus, Sliders } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque — SEAC Social" }] }),
  component: EstoquePage,
});

const kpis = [
  { label: "Total de itens", value: "—", hint: "Cadastrados" },
  { label: "Itens com estoque", value: "—", hint: "Saldo > 0" },
  { label: "Itens em estoque baixo", value: "—", hint: "Atenção" },
  { label: "Itens sem estoque", value: "—", hint: "Sem saldo" },
  { label: "Valor total estimado", value: "R$ —", hint: "Custo médio" },
];

function EstoquePage() {
  return (
    <AppShell
      title="Controle de estoque"
      actions={
        <div className="flex gap-2">
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nova entrada</Button>
          <Button size="sm" variant="outline" className="gap-2"><Minus className="h-4 w-4" /> Nova saída</Button>
          <Button size="sm" variant="secondary" className="gap-2"><Sliders className="h-4 w-4" /> Ajuste</Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-2xl font-semibold">{k.value}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <Field label="Item"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select></Field>
          <Field label="Categoria"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem></SelectContent></Select></Field>
          <Field label="Tipo"><Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select></Field>
          <Field label="Período de"><Input type="date" /></Field>
          <Field label="até"><Input type="date" /></Field>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Saldo após</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Data/hora</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}