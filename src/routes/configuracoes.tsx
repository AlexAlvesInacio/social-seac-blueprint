import { createFileRoute } from "@tanstack/react-router";
import { Package, Ruler, FolderTree, Gift, HeartHandshake, Truck, Settings2, Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — SEAC Social" }] }),
  component: ConfigPage,
});

const tabs = [
  { value: "itens", label: "Itens", desc: "Cadastro de itens", icon: Package },
  { value: "unidades", label: "Unidades", desc: "Medidas e unidades", icon: Ruler },
  { value: "categorias", label: "Categorias", desc: "Grupos de itens", icon: FolderTree },
  { value: "beneficios", label: "Benefícios", desc: "Tipos de benefícios", icon: Gift },
  { value: "doadores", label: "Doadores", desc: "Pessoas e organizações", icon: HeartHandshake },
  { value: "fornecedores", label: "Fornecedores", desc: "Fornecedores", icon: Truck },
  { value: "parametros", label: "Parâmetros", desc: "Regras e parâmetros", icon: Settings2 },
];

const itens = [
  ["0001", "Arroz 5kg", "Alimentos", "pacote", "50"],
  ["0002", "Feijão 1kg", "Alimentos", "pacote", "40"],
  ["0003", "Óleo 900ml", "Alimentos", "unidade", "30"],
  ["0004", "Macarrão", "Alimentos", "pacote", "20"],
  ["0005", "Açúcar 1kg", "Alimentos", "pacote", "20"],
  ["0006", "Café 500g", "Alimentos", "pacote", "15"],
  ["0007", "Leite em pó", "Alimentos", "unidade", "20"],
  ["0008", "Cesta Padrão", "Benefício montado", "unidade", "30"],
  ["0009", "Cesta Extra", "Benefício montado", "unidade", "20"],
  ["0010", "Kit Gestante", "Benefício", "unidade", "10"],
];

const unidades = [
  ["UN", "Unidade", "un."],
  ["PCT", "Pacote", "pct."],
  ["KG", "Quilo", "kg"],
  ["LT", "Litro", "lt"],
  ["CX", "Caixa", "cx"],
  ["FD", "Fardo", "fd"],
];

const categorias = [
  ["ALI", "Alimentos", "Itens de alimentação usados em cestas"],
  ["BEB", "Bebidas", "Leite, sucos e bebidas em geral"],
  ["BEN", "Benefício montado", "Cesta Padrão, Cesta Extra e kits"],
  ["HIG", "Higiene", "Produtos de higiene pessoal"],
  ["REF", "Refeição", "Itens usados em ações de comida de rua"],
  ["OUT", "Outros", "Itens diversos"],
];

const beneficios = [
  ["BEN001", "Cesta Padrão", "Cadastro definitivo"],
  ["BEN002", "Cesta Extra", "Cadastro em avaliação"],
  ["BEN003", "Kit Gestante", "Benefício específico"],
  ["BEN004", "Comida de Rua", "Ação social"],
];

const doadores = [
  ["Supermercado Exemplo", "Empresa", "00.000.000/0001-00", "(11) 99999-0000", "21/05/2025"],
  ["Família Anônima", "Pessoa física", "Não informado", "—", "10/05/2025"],
  ["Padaria Bom Pão", "Empresa", "11.111.111/0001-11", "(11) 98888-1111", "15/05/2025"],
];

const fornecedores = [
  ["Atacadão Exemplo", "22.222.222/0001-22", "(11) 97777-2222", "Alimentos"],
  ["Mercado Bom Preço", "33.333.333/0001-33", "(11) 96666-3333", "Alimentos"],
  ["Distribuidora Solidária", "44.444.444/0001-44", "(11) 95555-4444", "Diversos"],
];

const parametros: { label: string; value: string; type?: "switch" | "text"; on?: boolean }[] = [
  { label: "Intervalo mínimo entre retiradas", value: "25 dias" },
  { label: "Janela de acompanhamento", value: "25 a 30 dias" },
  { label: "Limite de Cesta Extra", value: "3 retiradas" },
  { label: "Após 3 retiradas extras", value: "Avaliar cadastro definitivo" },
  { label: "Inatividade para contato", value: "90 dias" },
  { label: "Bloqueio por falta de estoque", value: "Sim", type: "switch", on: true },
  { label: "Liberação excepcional", value: "Apenas Administrador" },
  { label: "Observação obrigatória na liberação excepcional", value: "Sim", type: "switch", on: true },
  { label: "Registrar auditoria de alterações", value: "Sim", type: "switch", on: true },
  { label: "Baixa automática no estoque após entrega", value: "Sim", type: "switch", on: true },
];

function StatusBadge({ label = "Ativo" }: { label?: string }) {
  return <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">{label}</Badge>;
}

function RowActions() {
  return (
    <div className="flex justify-end gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function ItemFormSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Novo item</Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Novo item</SheetTitle>
          <SheetDescription>Cadastre um item usado no estoque ou em benefícios montados.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 py-4">
          <F label="Código"><Input placeholder="0011" /></F>
          <F label="Nome do item"><Input placeholder="Ex.: Arroz 5kg" /></F>
          <F label="Categoria">
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => <SelectItem key={c[0]} value={c[0]}>{c[1]}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Unidade padrão">
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => <SelectItem key={u[0]} value={u[0]}>{u[1]}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Estoque mínimo"><Input type="number" placeholder="0" /></F>
          <F label="Custo médio estimado"><Input placeholder="R$ 0,00" /></F>
          <F label="Descrição"><Textarea placeholder="Observações internas" /></F>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
              <div className="text-xs text-muted-foreground">Ativo / Inativo</div>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline">Cancelar</Button>
          <Button>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ConfigPage() {
  return (
    <AppShell title="Configurações">
      <Tabs defaultValue="itens">
        <TabsList className="h-auto flex-wrap gap-2 bg-transparent p-0">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-col items-start gap-0.5 border border-border bg-card p-3 data-[state=active]:border-primary data-[state=active]:bg-primary/5">
              <div className="flex items-center gap-2 text-sm font-medium"><t.icon className="h-4 w-4" /> {t.label}</div>
              <span className="text-[10px] text-muted-foreground">{t.desc}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="itens" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Buscar item</Label><Input placeholder="Buscar" /></div>
                  <div><Label className="text-xs text-muted-foreground">Categoria</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {categorias.map((c) => <SelectItem key={c[0]} value={c[0]}>{c[1]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <ItemFormSheet />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade padrão</TableHead>
                    <TableHead>Estoque mínimo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((r) => (
                    <TableRow key={r[0]}>
                      <TableCell className="font-mono text-xs">{r[0]}</TableCell>
                      <TableCell className="font-medium">{r[1]}</TableCell>
                      <TableCell>{r[2]}</TableCell>
                      <TableCell>{r[3]}</TableCell>
                      <TableCell>{r[4]}</TableCell>
                      <TableCell><StatusBadge /></TableCell>
                      <TableCell><RowActions /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unidades" className="mt-4">
          <Card><CardContent className="p-4">
            <div className="mb-3 flex justify-end"><Button className="gap-2"><Plus className="h-4 w-4" /> Nova unidade</Button></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Nome da unidade</TableHead><TableHead>Sigla</TableHead>
                <TableHead>Usada em estoque</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {unidades.map((r) => (
                  <TableRow key={r[0]}>
                    <TableCell className="font-mono text-xs">{r[0]}</TableCell>
                    <TableCell className="font-medium">{r[1]}</TableCell>
                    <TableCell>{r[2]}</TableCell>
                    <TableCell>Sim</TableCell>
                    <TableCell><StatusBadge /></TableCell>
                    <TableCell><RowActions /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
          <Card><CardContent className="p-4">
            <div className="mb-3 flex justify-end"><Button className="gap-2"><Plus className="h-4 w-4" /> Nova categoria</Button></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Nome da categoria</TableHead><TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {categorias.map((r) => (
                  <TableRow key={r[0]}>
                    <TableCell className="font-mono text-xs">{r[0]}</TableCell>
                    <TableCell className="font-medium">{r[1]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r[2]}</TableCell>
                    <TableCell><StatusBadge /></TableCell>
                    <TableCell><RowActions /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="beneficios" className="mt-4">
          <Card><CardContent className="p-4">
            <div className="mb-3 flex justify-end"><Button className="gap-2"><Plus className="h-4 w-4" /> Novo benefício</Button></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Nome do benefício</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Controla estoque</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {beneficios.map((r) => (
                  <TableRow key={r[0]}>
                    <TableCell className="font-mono text-xs">{r[0]}</TableCell>
                    <TableCell className="font-medium">{r[1]}</TableCell>
                    <TableCell>{r[2]}</TableCell>
                    <TableCell>Sim</TableCell>
                    <TableCell><StatusBadge /></TableCell>
                    <TableCell><RowActions /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="doadores" className="mt-4">
          <Card><CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div><Label className="text-xs text-muted-foreground">Buscar doador</Label><Input placeholder="Buscar" /></div>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo doador</Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead><TableHead>Última doação</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {doadores.map((r) => (
                  <TableRow key={r[0]}>
                    <TableCell className="font-medium">{r[0]}</TableCell>
                    <TableCell>{r[1]}</TableCell>
                    <TableCell className="font-mono text-xs">{r[2]}</TableCell>
                    <TableCell>{r[3]}</TableCell>
                    <TableCell>{r[4]}</TableCell>
                    <TableCell><StatusBadge /></TableCell>
                    <TableCell><RowActions /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fornecedores" className="mt-4">
          <Card><CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div><Label className="text-xs text-muted-foreground">Buscar fornecedor</Label><Input placeholder="Buscar" /></div>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo fornecedor</Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead><TableHead>CNPJ/Documento</TableHead><TableHead>Telefone</TableHead>
                <TableHead>Categoria</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fornecedores.map((r) => (
                  <TableRow key={r[0]}>
                    <TableCell className="font-medium">{r[0]}</TableCell>
                    <TableCell className="font-mono text-xs">{r[1]}</TableCell>
                    <TableCell>{r[2]}</TableCell>
                    <TableCell>{r[3]}</TableCell>
                    <TableCell><StatusBadge /></TableCell>
                    <TableCell><RowActions /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="parametros" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold">Regras e parâmetros do sistema</h3>
                <p className="text-xs text-muted-foreground">Valores usados pelas regras de atendimento, estoque e auditoria.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {parametros.map((p) => (
                  <div key={p.label} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                    <div className="pr-3">
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.value}</div>
                    </div>
                    {p.type === "switch" ? (
                      <Switch defaultChecked={p.on} />
                    ) : (
                      <Badge variant="outline" className="whitespace-nowrap">{p.value}</Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button>Salvar parâmetros</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}