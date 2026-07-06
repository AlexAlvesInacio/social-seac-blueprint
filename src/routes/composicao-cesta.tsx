import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/composicao-cesta")({
  head: () => ({ meta: [{ title: "Composição por benefício — SEAC Social" }] }),
  component: ComposicaoPage,
});

function ComposicaoPage() {
  return (
    <AppShell title="Composição por benefício">
      <Card>
        <CardContent className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Defina os itens e quantidades que compõem cada benefício.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Benefício</Label>
              <Select><SelectTrigger><SelectValue placeholder="Selecione o benefício" /></SelectTrigger>
                <SelectContent><SelectItem value="cb">Cesta Básica</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Custo estimado (R$)</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Nenhum item na composição. Selecione um benefício e adicione itens.</TableCell></TableRow>
            </TableBody>
          </Table>

          <div className="flex justify-between">
            <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Adicionar item</Button>
            <Button>Salvar composição</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="text-sm font-semibold">Montagem de cestas / benefícios</p>
            <p className="text-xs text-muted-foreground">Informe a quantidade e visualize o consumo dos itens e o impacto no estoque.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Benefício</Label>
              <Select><SelectTrigger><SelectValue placeholder="Selecione o benefício" /></SelectTrigger><SelectContent><SelectItem value="cb">Cesta Básica</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Quantidade a montar</Label><Input type="number" placeholder="Ex.: 30" /></div>
            <div className="flex items-end"><Button className="w-full">Montar preview</Button></div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Itens que serão consumidos</p>
              <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Unidade</TableHead><TableHead>Qtd. total</TableHead></TableRow></TableHeader>
                <TableBody><TableRow><TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">Selecione um benefício.</TableCell></TableRow></TableBody></Table>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Impacto no estoque</p>
              <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Saldo atual</TableHead><TableHead>Saldo após</TableHead></TableRow></TableHeader>
                <TableBody><TableRow><TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">—</TableCell></TableRow></TableBody></Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}