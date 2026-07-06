import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/familias/")({
  head: () => ({ meta: [{ title: "Famílias — SEAC Social" }] }),
  component: FamiliasPage,
});

function FamiliasPage() {
  return (
    <AppShell
      title="Famílias"
      actions={
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Novo cadastro
        </Button>
      }
    >
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          <Field label="Nome"><Input placeholder="Buscar por nome" /></Field>
          <Field label="CPF / RG"><Input placeholder="Buscar por CPF ou RG" /></Field>
          <Field label="Telefone"><Input placeholder="(00) 00000-0000" /></Field>
          <Field label="Bairro">
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm">Limpar</Button>
            <Button size="sm" className="gap-2"><Search className="h-4 w-4" /> Buscar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da família</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>CPF / RG</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                  Nenhuma família cadastrada ainda.<br />
                  <Link to="/familias/$id" params={{ id: "exemplo" }} className="mt-2 inline-block text-primary hover:underline">
                    Ver exemplo de detalhe →
                  </Link>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}