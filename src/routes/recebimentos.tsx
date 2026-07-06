import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/recebimentos")({
  head: () => ({ meta: [{ title: "Recebimentos — SEAC Social" }] }),
  component: RecebimentosPage,
});

function RecebimentosPage() {
  return (
    <AppShell title="Recebimentos">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <Tabs defaultValue="doacao">
              <TabsList>
                <TabsTrigger value="doacao">Doação</TabsTrigger>
                <TabsTrigger value="compra">Compra</TabsTrigger>
                <TabsTrigger value="investimento">Investimento</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Data"><Input type="date" /></Field>
              <Field label="Origem / tipo"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="doacao">Doação</SelectItem></SelectContent></Select></Field>
              <Field label="Doador ou fornecedor"><Input placeholder="Nome do doador ou fornecedor" /></Field>
              <Field label="Item"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem></SelectContent></Select></Field>
              <Field label="Quantidade"><Input type="number" placeholder="0" /></Field>
              <Field label="Unidade"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="un">UN</SelectItem></SelectContent></Select></Field>
              <Field label="Valor estimado / total (R$)"><Input placeholder="0,00" /></Field>
              <Field label="Comprovante / anexo"><Input type="file" /></Field>
            </div>
            <Field label="Observação"><Textarea placeholder="Observação opcional" /></Field>

            <div className="flex gap-2">
              <Button className="gap-2">Salvar recebimento</Button>
              <Button variant="outline">Limpar</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold">Histórico de recebimentos</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Doador / fornecedor</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Valor (R$)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">Nenhum recebimento registrado.</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}