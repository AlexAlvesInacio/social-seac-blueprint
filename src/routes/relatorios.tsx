import { createFileRoute } from "@tanstack/react-router";
import { Users, UserRound, Truck, Package, HeartHandshake, KeyRound, Download, Clock, PackageX, AlertTriangle, PhoneCall } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — SEAC Social" }] }),
  component: RelatoriosPage,
});

const reports = [
  { icon: Users, title: "Famílias", desc: "Cadastros e situação das famílias." },
  { icon: UserRound, title: "Assistidos", desc: "Lista de assistidos e benefícios." },
  { icon: Truck, title: "Entregas", desc: "Entregas realizadas no período." },
  { icon: Clock, title: "Retiradas bloqueadas por prazo", desc: "Tentativas antes do prazo mínimo." },
  { icon: PackageX, title: "Retiradas bloqueadas por estoque", desc: "Tentativas sem saldo disponível." },
  { icon: AlertTriangle, title: "Famílias em atenção 45 dias+", desc: "Liberadas e sem retirada recente." },
  { icon: PhoneCall, title: "Famílias com contato necessário 90 dias+", desc: "Inatividade prolongada." },
  { icon: Package, title: "Estoque", desc: "Entradas, saídas e saldo." },
  { icon: HeartHandshake, title: "Doações / recebimentos", desc: "Doações recebidas e origem." },
  { icon: KeyRound, title: "Liberações excepcionais", desc: "Liberações fora do padrão." },
];

function RelatoriosPage() {
  return (
    <AppShell title="Relatórios">
      <p className="mb-3 text-sm text-muted-foreground">Selecione o tipo de relatório ou aplique filtros para gerar.</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((r) => (
          <Card key={r.title} className="cursor-pointer transition-colors hover:border-primary">
            <CardContent className="p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><r.icon className="h-4 w-4" /></div>
              <p className="mt-3 text-sm font-semibold">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          <F label="Período de"><Input type="date" /></F>
          <F label="até"><Input type="date" /></F>
          <F label="Bairro"><Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select></F>
          <F label="Benefício"><Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select></F>
          <F label="Item"><Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select></F>
          <F label="Usuário"><Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select></F>
          <div className="md:col-span-6 flex flex-wrap justify-between gap-2 pt-2">
            <Button variant="outline">Limpar filtros</Button>
            <div className="flex gap-2">
              <Button variant="outline">PDF</Button>
              <Button variant="outline">Excel</Button>
              <Button variant="outline">CSV</Button>
              <Button className="gap-2"><Download className="h-4 w-4" /> Gerar relatório</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}