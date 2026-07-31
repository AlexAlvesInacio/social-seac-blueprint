import { createFileRoute } from "@tanstack/react-router";
import {
  Package,
  Ruler,
  FolderTree,
  Gift,
  HeartHandshake,
  Truck,
  Settings2,
  Plus,
  Pencil,
  Trash2,
  PowerOff,
  Power,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useItens,
  useBeneficios,
  type Item,
  type Beneficio,
  type Status,
} from "@/lib/config-store";
import {
  CadastrosSupabaseError,
  useCategoriasSupabase,
  useDefinirStatusCadastro,
  useDoadoresSupabase,
  useExcluirCadastro,
  useFornecedoresSupabase,
  useSalvarCategoria,
  useSalvarDoador,
  useSalvarFornecedor,
  useSalvarUnidade,
  useUnidadesSupabase,
  type CategoriaCadastro,
  type DoadorCadastro,
  type DoadorTipo,
  type FornecedorCadastro,
  type UnidadeCadastro,
} from "@/lib/cadastros/cadastros-supabase";
import {
  CONFIGURACOES_PADRAO,
  useAtualizarConfiguracoes,
  useConfiguracoes,
  type Configuracoes,
} from "@/lib/configuracoes/configuracoes-supabase";
import { registrarAuditoria } from "@/lib/auditoria/auditoria-supabase";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — SEAC Social" }] }),
  component: ConfigPage,
});

const USUARIO_ATUAL = "admin@seac.social";

const tabs = [
  { value: "itens", label: "Itens", desc: "Cadastro de itens", icon: Package },
  { value: "unidades", label: "Unidades", desc: "Medidas e unidades", icon: Ruler },
  { value: "categorias", label: "Categorias", desc: "Grupos de itens", icon: FolderTree },
  { value: "beneficios", label: "Benefícios", desc: "Tipos de benefícios", icon: Gift },
  { value: "doadores", label: "Doadores", desc: "Pessoas e organizações", icon: HeartHandshake },
  { value: "fornecedores", label: "Fornecedores", desc: "Fornecedores", icon: Truck },
  { value: "parametros", label: "Parâmetros", desc: "Regras e parâmetros", icon: Settings2 },
];

/* ---------- helpers ---------- */

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function StatusBadge({ status }: { status: Status }) {
  return status === "ativo" ? (
    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
      Ativo
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inativo
    </Badge>
  );
}

function F({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function validateDoc(doc?: string): string | undefined {
  if (!doc) return undefined;
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 0) return undefined;
  if (digits.length !== 11 && digits.length !== 14)
    return "Documento deve ser CPF (11) ou CNPJ (14 dígitos)";
  return undefined;
}

function mensagemErroCadastro(error: unknown, fallback: string): string {
  return error instanceof CadastrosSupabaseError ? error.message : fallback;
}

function CadastroEstado({
  carregando,
  mensagemErro,
  onTentarNovamente,
}: {
  carregando: boolean;
  mensagemErro: string;
  onTentarNovamente: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {carregando ? "Carregando cadastros do Supabase..." : mensagemErro}
        </p>
        {!carregando && (
          <Button type="button" size="sm" variant="outline" onClick={onTentarNovamente}>
            Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- generic row actions ---------- */

type RowActionsProps = {
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onDeleteBlocked?: () => void;
  status: Status;
  hasVinculo: boolean;
};

function RowActions({
  onEdit,
  onToggleStatus,
  onDelete,
  onDeleteBlocked,
  status,
  hasVinculo,
}: RowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  function openDelete() {
    if (hasVinculo) onDeleteBlocked?.();
    setConfirmOpen(true);
  }
  return (
    <div className="flex justify-end gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} title="Editar">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={onToggleStatus}
        title={status === "ativo" ? "Inativar" : "Reativar"}
      >
        {status === "ativo" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={openDelete}
        title="Excluir"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasVinculo ? "Não é possível excluir" : "Confirmar exclusão"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hasVinculo
                ? "Este cadastro possui vínculo com movimentações ou histórico. Não é possível excluir. Você pode inativar o cadastro."
                : "Deseja realmente excluir este cadastro? Esta ação não poderá ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {hasVinculo ? (
              <AlertDialogAction onClick={() => setConfirmOpen(false)}>Entendi</AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    onDelete();
                    setConfirmOpen(false);
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- ITENS ---------- */

function ItemForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Item | null;
}) {
  const upsert = useItens((s) => s.upsert);
  const rows = useItens((s) => s.rows);
  const categorias = useCategoriasSupabase().data ?? [];
  const unidades = useUnidadesSupabase().data ?? [];

  const [form, setForm] = useState<Item>(
    () =>
      editing ?? {
        codigo: "",
        nome: "",
        categoria: "",
        unidade: "",
        estoqueMinimo: 0,
        status: "ativo",
        observacao: "",
      },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(
        editing ?? {
          codigo: "",
          nome: "",
          categoria: "",
          unidade: "",
          estoqueMinimo: 0,
          status: "ativo",
          observacao: "",
        },
      );
      setErrors({});
    }
  }, [open, editing]);

  function save() {
    const e: Record<string, string> = {};
    if (!form.codigo.trim()) e.codigo = "Código obrigatório";
    else if (!editing && rows.some((r) => r.codigo === form.codigo.trim()))
      e.codigo = "Código já existe";
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.categoria) e.categoria = "Categoria obrigatória";
    if (!form.unidade) e.unidade = "Unidade obrigatória";
    if (form.estoqueMinimo < 0) e.estoqueMinimo = "Não pode ser negativo";
    setErrors(e);
    if (Object.keys(e).length) return;

    upsert({ ...form, codigo: form.codigo.trim(), nome: form.nome.trim() });
    registrarAuditoria({
      usuario: USUARIO_ATUAL,
      acao: editing ? "Item editado" : "Item criado",
      modulo: "Configurações › Itens",
      registro: `${form.codigo} — ${form.nome}`,
    });
    toast.success(editing ? "Item atualizado" : "Item cadastrado");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar item" : "Novo item"}</SheetTitle>
          <SheetDescription>Item usado no estoque ou em benefícios montados.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 py-4">
          <F label="Código" error={errors.codigo}>
            <Input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              disabled={!!editing}
              placeholder="0011"
            />
          </F>
          <F label="Nome do item" error={errors.nome}>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Arroz 5kg"
            />
          </F>
          <F label="Categoria" error={errors.categoria}>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm({ ...form, categoria: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categorias
                  .filter((c) => c.status === "ativo")
                  .map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Unidade padrão" error={errors.unidade}>
            <Select value={form.unidade} onValueChange={(v) => setForm({ ...form, unidade: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {unidades
                  .filter((u) => u.status === "ativo")
                  .map((u) => (
                    <SelectItem key={u.codigo} value={u.codigo}>
                      {u.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Estoque mínimo" error={errors.estoqueMinimo}>
            <Input
              type="number"
              min={0}
              value={form.estoqueMinimo}
              onChange={(e) => setForm({ ...form, estoqueMinimo: Number(e.target.value) })}
            />
          </F>
          <F label="Descrição / observação">
            <Textarea
              value={form.observacao ?? ""}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </F>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
              <div className="text-xs text-muted-foreground">
                {form.status === "ativo" ? "Ativo" : "Inativo"}
              </div>
            </div>
            <Switch
              checked={form.status === "ativo"}
              onCheckedChange={(v) => setForm({ ...form, status: v ? "ativo" : "inativo" })}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ItensTab() {
  const rows = useItens((s) => s.rows);
  const remove = useItens((s) => s.remove);
  const setStatus = useItens((s) => s.setStatus);
  const categorias = useCategoriasSupabase().data ?? [];
  const unidades = useUnidadesSupabase().data ?? [];

  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const bm =
          !busca || r.nome.toLowerCase().includes(busca.toLowerCase()) || r.codigo.includes(busca);
        const cm = filtroCat === "all" || r.categoria === filtroCat;
        return bm && cm;
      }),
    [rows, busca, filtroCat],
  );

  const catName = (c: string) => categorias.find((x) => x.codigo === c)?.nome ?? c;
  const uniName = (u: string) => unidades.find((x) => x.codigo === u)?.nome ?? u;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Buscar item</Label>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={filtroCat} onValueChange={setFiltroCat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo item
          </Button>
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
            {filtered.map((r) => (
              <TableRow key={r.codigo}>
                <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{catName(r.categoria)}</TableCell>
                <TableCell>{uniName(r.unidade)}</TableCell>
                <TableCell>{r.estoqueMinimo}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell>
                  <RowActions
                    status={r.status}
                    hasVinculo={false}
                    onEdit={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                    onToggleStatus={() => {
                      const ns: Status = r.status === "ativo" ? "inativo" : "ativo";
                      setStatus(r.codigo, ns);
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: ns === "ativo" ? "Item reativado" : "Item inativado",
                        modulo: "Configurações › Itens",
                        registro: `${r.codigo} — ${r.nome}`,
                      });
                      toast.success(ns === "ativo" ? "Item reativado" : "Item inativado");
                    }}
                    onDelete={() => {
                      remove(r.codigo);
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: "Item excluído",
                        modulo: "Configurações › Itens",
                        registro: `${r.codigo} — ${r.nome}`,
                      });
                      toast.success("Item excluído");
                    }}
                    onDeleteBlocked={() => {
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: "Tentativa de exclusão bloqueada",
                        modulo: "Configurações › Itens",
                        registro: `${r.codigo} — ${r.nome}`,
                        observacao: "Registro possui vínculo com movimentações ou histórico",
                      });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum item encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <ItemForm open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

/* ---------- UNIDADES ---------- */

type UnidadeFormState = {
  codigo: string;
  nome: string;
  sigla: string;
  usadaEstoque: boolean;
  status: Status;
};

const UNIDADE_FORM_VAZIO: UnidadeFormState = {
  codigo: "",
  nome: "",
  sigla: "",
  usadaEstoque: true,
  status: "ativo",
};

function UnidadeForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: UnidadeCadastro | null;
}) {
  const salvarUnidade = useSalvarUnidade();
  const rows = useUnidadesSupabase().data ?? [];
  const [form, setForm] = useState<UnidadeFormState>(UNIDADE_FORM_VAZIO);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setForm(editing ?? UNIDADE_FORM_VAZIO);
      setErrors({});
    }
  }, [open, editing]);

  async function save() {
    const e: Record<string, string> = {};
    if (!form.codigo.trim()) e.codigo = "Código obrigatório";
    else if (!editing && rows.some((r) => r.codigo === form.codigo.trim()))
      e.codigo = "Código já existe";
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.sigla.trim()) e.sigla = "Sigla obrigatória";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await salvarUnidade.mutateAsync({ ...form, id: editing?.id });
    } catch (err) {
      const mensagem = mensagemErroCadastro(err, "Não foi possível salvar a unidade.");
      if (err instanceof CadastrosSupabaseError && err.code === "23505")
        setErrors({ codigo: mensagem });
      toast.error(mensagem);
      return;
    }
    registrarAuditoria({
      usuario: USUARIO_ATUAL,
      acao: editing ? "Unidade editada" : "Unidade criada",
      modulo: "Configurações › Unidades",
      registro: `${form.codigo} — ${form.nome}`,
    });
    toast.success(editing ? "Unidade atualizada" : "Unidade cadastrada");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar unidade" : "Nova unidade"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 py-4">
          <F label="Código" error={errors.codigo}>
            <Input
              value={form.codigo}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            />
          </F>
          <F label="Nome da unidade" error={errors.nome}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </F>
          <F label="Sigla" error={errors.sigla}>
            <Input
              value={form.sigla}
              onChange={(e) => setForm({ ...form, sigla: e.target.value })}
            />
          </F>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Usada em estoque</div>
            </div>
            <Switch
              checked={form.usadaEstoque}
              onCheckedChange={(v) => setForm({ ...form, usadaEstoque: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
              <div className="text-xs text-muted-foreground">
                {form.status === "ativo" ? "Ativo" : "Inativo"}
              </div>
            </div>
            <Switch
              checked={form.status === "ativo"}
              onCheckedChange={(v) => setForm({ ...form, status: v ? "ativo" : "inativo" })}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={salvarUnidade.isPending} onClick={() => void save()}>
            {salvarUnidade.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function UnidadesTab() {
  const { data, isPending, isError, refetch } = useUnidadesSupabase();
  const definirStatus = useDefinirStatusCadastro("unidades");
  const excluir = useExcluirCadastro("unidades");
  const itens = useItens((s) => s.rows);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UnidadeCadastro | null>(null);

  const rows = data ?? [];
  const usedIn = (codigo: string) => itens.some((i) => i.unidade === codigo);

  if (isPending || isError) {
    return (
      <CadastroEstado
        carregando={isPending}
        mensagemErro="Não foi possível carregar as unidades."
        onTentarNovamente={() => void refetch()}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex justify-end">
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova unidade
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome da unidade</TableHead>
              <TableHead>Sigla</TableHead>
              <TableHead>Usada em estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.sigla}</TableCell>
                <TableCell>{r.usadaEstoque ? "Sim" : "Não"}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell>
                  <RowActions
                    status={r.status}
                    hasVinculo={usedIn(r.codigo)}
                    onEdit={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                    onToggleStatus={() => {
                      const ns: Status = r.status === "ativo" ? "inativo" : "ativo";
                      definirStatus.mutate(
                        { id: r.id, status: ns },
                        {
                          onSuccess: () => {
                            registrarAuditoria({
                              usuario: USUARIO_ATUAL,
                              acao: ns === "ativo" ? "Unidade reativada" : "Unidade inativada",
                              modulo: "Configurações › Unidades",
                              registro: `${r.codigo} — ${r.nome}`,
                            });
                            toast.success(
                              ns === "ativo" ? "Unidade reativada" : "Unidade inativada",
                            );
                          },
                          onError: (err) =>
                            toast.error(
                              mensagemErroCadastro(
                                err,
                                "Não foi possível alterar o status da unidade.",
                              ),
                            ),
                        },
                      );
                    }}
                    onDelete={() => {
                      excluir.mutate(
                        { id: r.id },
                        {
                          onSuccess: () => {
                            registrarAuditoria({
                              usuario: USUARIO_ATUAL,
                              acao: "Unidade excluída",
                              modulo: "Configurações › Unidades",
                              registro: `${r.codigo} — ${r.nome}`,
                            });
                            toast.success("Unidade excluída");
                          },
                          onError: (err) =>
                            toast.error(
                              mensagemErroCadastro(err, "Não foi possível excluir a unidade."),
                            ),
                        },
                      );
                    }}
                    onDeleteBlocked={() => {
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: "Tentativa de exclusão bloqueada",
                        modulo: "Configurações › Unidades",
                        registro: `${r.codigo} — ${r.nome}`,
                        observacao: "Unidade está em uso por itens cadastrados",
                      });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <UnidadeForm open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

/* ---------- CATEGORIAS ---------- */

type CategoriaFormState = {
  codigo: string;
  nome: string;
  descricao: string;
  status: Status;
};

const CATEGORIA_FORM_VAZIO: CategoriaFormState = {
  codigo: "",
  nome: "",
  descricao: "",
  status: "ativo",
};

function CategoriaForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CategoriaCadastro | null;
}) {
  const salvarCategoria = useSalvarCategoria();
  const rows = useCategoriasSupabase().data ?? [];
  const [form, setForm] = useState<CategoriaFormState>(CATEGORIA_FORM_VAZIO);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setForm(editing ?? CATEGORIA_FORM_VAZIO);
      setErrors({});
    }
  }, [open, editing]);

  async function save() {
    const e: Record<string, string> = {};
    if (!form.codigo.trim()) e.codigo = "Código obrigatório";
    else if (!editing && rows.some((r) => r.codigo === form.codigo.trim()))
      e.codigo = "Código já existe";
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await salvarCategoria.mutateAsync({ ...form, id: editing?.id });
    } catch (err) {
      const mensagem = mensagemErroCadastro(err, "Não foi possível salvar a categoria.");
      if (err instanceof CadastrosSupabaseError && err.code === "23505")
        setErrors({ codigo: mensagem });
      toast.error(mensagem);
      return;
    }
    registrarAuditoria({
      usuario: USUARIO_ATUAL,
      acao: editing ? "Categoria editada" : "Categoria criada",
      modulo: "Configurações › Categorias",
      registro: `${form.codigo} — ${form.nome}`,
    });
    toast.success(editing ? "Categoria atualizada" : "Categoria cadastrada");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar categoria" : "Nova categoria"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 py-4">
          <F label="Código" error={errors.codigo}>
            <Input
              value={form.codigo}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            />
          </F>
          <F label="Nome da categoria" error={errors.nome}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </F>
          <F label="Descrição">
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </F>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
            </div>
            <Switch
              checked={form.status === "ativo"}
              onCheckedChange={(v) => setForm({ ...form, status: v ? "ativo" : "inativo" })}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={salvarCategoria.isPending} onClick={() => void save()}>
            {salvarCategoria.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CategoriasTab() {
  const { data, isPending, isError, refetch } = useCategoriasSupabase();
  const definirStatus = useDefinirStatusCadastro("categorias");
  const excluir = useExcluirCadastro("categorias");
  const itens = useItens((s) => s.rows);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoriaCadastro | null>(null);

  const rows = data ?? [];
  const usedIn = (codigo: string) => itens.some((i) => i.categoria === codigo);

  if (isPending || isError) {
    return (
      <CadastroEstado
        carregando={isPending}
        mensagemErro="Não foi possível carregar as categorias."
        onTentarNovamente={() => void refetch()}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex justify-end">
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome da categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.descricao}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell>
                  <RowActions
                    status={r.status}
                    hasVinculo={usedIn(r.codigo)}
                    onEdit={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                    onToggleStatus={() => {
                      const ns: Status = r.status === "ativo" ? "inativo" : "ativo";
                      definirStatus.mutate(
                        { id: r.id, status: ns },
                        {
                          onSuccess: () => {
                            registrarAuditoria({
                              usuario: USUARIO_ATUAL,
                              acao: ns === "ativo" ? "Categoria reativada" : "Categoria inativada",
                              modulo: "Configurações › Categorias",
                              registro: `${r.codigo} — ${r.nome}`,
                            });
                            toast.success(
                              ns === "ativo" ? "Categoria reativada" : "Categoria inativada",
                            );
                          },
                          onError: (err) =>
                            toast.error(
                              mensagemErroCadastro(
                                err,
                                "Não foi possível alterar o status da categoria.",
                              ),
                            ),
                        },
                      );
                    }}
                    onDelete={() => {
                      excluir.mutate(
                        { id: r.id },
                        {
                          onSuccess: () => {
                            registrarAuditoria({
                              usuario: USUARIO_ATUAL,
                              acao: "Categoria excluída",
                              modulo: "Configurações › Categorias",
                              registro: `${r.codigo} — ${r.nome}`,
                            });
                            toast.success("Categoria excluída");
                          },
                          onError: (err) =>
                            toast.error(
                              mensagemErroCadastro(err, "Não foi possível excluir a categoria."),
                            ),
                        },
                      );
                    }}
                    onDeleteBlocked={() => {
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: "Tentativa de exclusão bloqueada",
                        modulo: "Configurações › Categorias",
                        registro: `${r.codigo} — ${r.nome}`,
                        observacao: "Categoria em uso por itens cadastrados",
                      });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CategoriaForm open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

/* ---------- BENEFÍCIOS ---------- */

const TIPOS_BENEFICIO = [
  "Cadastro definitivo",
  "Cadastro em avaliação",
  "Benefício específico",
  "Ação social",
];

function BeneficioForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Beneficio | null;
}) {
  const upsert = useBeneficios((s) => s.upsert);
  const rows = useBeneficios((s) => s.rows);
  const [form, setForm] = useState<Beneficio>(
    () =>
      editing ?? {
        codigo: "",
        nome: "",
        tipo: "",
        controlaEstoque: true,
        status: "ativo",
        observacao: "",
      },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setForm(
        editing ?? {
          codigo: "",
          nome: "",
          tipo: "",
          controlaEstoque: true,
          status: "ativo",
          observacao: "",
        },
      );
      setErrors({});
    }
  }, [open, editing]);

  function save() {
    const e: Record<string, string> = {};
    if (!form.codigo.trim()) e.codigo = "Código obrigatório";
    else if (!editing && rows.some((r) => r.codigo === form.codigo.trim()))
      e.codigo = "Código já existe";
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.tipo) e.tipo = "Tipo obrigatório";
    setErrors(e);
    if (Object.keys(e).length) return;
    upsert({ ...form, codigo: form.codigo.trim() });
    registrarAuditoria({
      usuario: USUARIO_ATUAL,
      acao: editing ? "Benefício editado" : "Benefício criado",
      modulo: "Configurações › Benefícios",
      registro: `${form.codigo} — ${form.nome}`,
    });
    toast.success(editing ? "Benefício atualizado" : "Benefício cadastrado");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar benefício" : "Novo benefício"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 py-4">
          <F label="Código" error={errors.codigo}>
            <Input
              value={form.codigo}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            />
          </F>
          <F label="Nome do benefício" error={errors.nome}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </F>
          <F label="Tipo do benefício" error={errors.tipo}>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_BENEFICIO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Controla estoque</div>
            </div>
            <Switch
              checked={form.controlaEstoque}
              onCheckedChange={(v) => setForm({ ...form, controlaEstoque: v })}
            />
          </div>
          <F label="Observação">
            <Textarea
              value={form.observacao ?? ""}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </F>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
            </div>
            <Switch
              checked={form.status === "ativo"}
              onCheckedChange={(v) => setForm({ ...form, status: v ? "ativo" : "inativo" })}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function BeneficiosTab() {
  const rows = useBeneficios((s) => s.rows);
  const remove = useBeneficios((s) => s.remove);
  const setStatus = useBeneficios((s) => s.setStatus);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Beneficio | null>(null);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex justify-end">
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo benefício
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome do benefício</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Controla estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.codigo}>
                <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.tipo}</TableCell>
                <TableCell>{r.controlaEstoque ? "Sim" : "Não"}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell>
                  <RowActions
                    status={r.status}
                    hasVinculo={false}
                    onEdit={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                    onToggleStatus={() => {
                      const ns: Status = r.status === "ativo" ? "inativo" : "ativo";
                      setStatus(r.codigo, ns);
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: ns === "ativo" ? "Benefício reativado" : "Benefício inativado",
                        modulo: "Configurações › Benefícios",
                        registro: `${r.codigo} — ${r.nome}`,
                      });
                    }}
                    onDelete={() => {
                      remove(r.codigo);
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: "Benefício excluído",
                        modulo: "Configurações › Benefícios",
                        registro: `${r.codigo} — ${r.nome}`,
                      });
                    }}
                    onDeleteBlocked={() => {
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: "Tentativa de exclusão bloqueada",
                        modulo: "Configurações › Benefícios",
                        registro: `${r.codigo} — ${r.nome}`,
                        observacao: "Benefício possui vínculo com entregas ou estoque",
                      });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <BeneficioForm open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

/* ---------- DOADORES ---------- */

type DoadorFormState = {
  nome: string;
  tipo: DoadorTipo;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  observacao: string;
  status: Status;
};

const DOADOR_FORM_VAZIO: DoadorFormState = {
  nome: "",
  tipo: "Empresa",
  documento: "",
  telefone: "",
  email: "",
  endereco: "",
  observacao: "",
  status: "ativo",
};

function DoadorForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: DoadorCadastro | null;
}) {
  const salvarDoador = useSalvarDoador();
  const [form, setForm] = useState<DoadorFormState>(DOADOR_FORM_VAZIO);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setForm(editing ?? DOADOR_FORM_VAZIO);
      setErrors({});
    }
  }, [open, editing]);

  async function save() {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    const de =
      form.documento && form.documento !== "Não informado"
        ? validateDoc(form.documento)
        : undefined;
    if (de) e.documento = de;
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await salvarDoador.mutateAsync({ ...form, id: editing?.id });
    } catch (err) {
      toast.error(mensagemErroCadastro(err, "Não foi possível salvar o doador."));
      return;
    }
    registrarAuditoria({
      usuario: USUARIO_ATUAL,
      acao: editing ? "Doador editado" : "Doador criado",
      modulo: "Configurações › Doadores",
      registro: form.nome,
    });
    toast.success(editing ? "Doador atualizado" : "Doador cadastrado");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar doador" : "Novo doador"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 py-4">
          <F label="Nome" error={errors.nome}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </F>
          <F label="Tipo">
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm({ ...form, tipo: v as DoadorTipo })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pessoa física">Pessoa física</SelectItem>
                <SelectItem value="Empresa">Empresa</SelectItem>
                <SelectItem value="Anônimo">Anônimo</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Documento (CPF ou CNPJ)" error={errors.documento}>
            <Input
              value={form.documento}
              onChange={(e) => setForm({ ...form, documento: e.target.value })}
            />
          </F>
          <F label="Telefone">
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </F>
          <F label="E-mail">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </F>
          <F label="Endereço">
            <Input
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            />
          </F>
          <F label="Observação">
            <Textarea
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </F>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
            </div>
            <Switch
              checked={form.status === "ativo"}
              onCheckedChange={(v) => setForm({ ...form, status: v ? "ativo" : "inativo" })}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={salvarDoador.isPending} onClick={() => void save()}>
            {salvarDoador.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DoadoresTab() {
  const { data, isPending, isError, refetch } = useDoadoresSupabase();
  const definirStatus = useDefinirStatusCadastro("doadores");
  const excluir = useExcluirCadastro("doadores");
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DoadorCadastro | null>(null);

  const rows = data ?? [];
  const filtered = rows.filter((r) => !busca || r.nome.toLowerCase().includes(busca.toLowerCase()));

  if (isPending || isError) {
    return (
      <CadastroEstado
        carregando={isPending}
        mensagemErro="Não foi possível carregar os doadores."
        onTentarNovamente={() => void refetch()}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Buscar doador</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" />
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo doador
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Última doação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.tipo}</TableCell>
                <TableCell className="font-mono text-xs">{r.documento || "—"}</TableCell>
                <TableCell>{r.telefone || "—"}</TableCell>
                <TableCell>
                  {r.ultimaDoacao ? new Date(r.ultimaDoacao).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell>
                  <RowActions
                    status={r.status}
                    hasVinculo={!!r.ultimaDoacao}
                    onEdit={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                    onToggleStatus={() => {
                      const ns: Status = r.status === "ativo" ? "inativo" : "ativo";
                      definirStatus.mutate(
                        { id: r.id, status: ns },
                        {
                          onSuccess: () => {
                            registrarAuditoria({
                              usuario: USUARIO_ATUAL,
                              acao: ns === "ativo" ? "Doador reativado" : "Doador inativado",
                              modulo: "Configurações › Doadores",
                              registro: r.nome,
                            });
                            toast.success(ns === "ativo" ? "Doador reativado" : "Doador inativado");
                          },
                          onError: (err) =>
                            toast.error(
                              mensagemErroCadastro(
                                err,
                                "Não foi possível alterar o status do doador.",
                              ),
                            ),
                        },
                      );
                    }}
                    onDelete={() => {
                      excluir.mutate(
                        { id: r.id },
                        {
                          onSuccess: () => {
                            registrarAuditoria({
                              usuario: USUARIO_ATUAL,
                              acao: "Doador excluído",
                              modulo: "Configurações › Doadores",
                              registro: r.nome,
                            });
                            toast.success("Doador excluído");
                          },
                          onError: (err) =>
                            toast.error(
                              mensagemErroCadastro(err, "Não foi possível excluir o doador."),
                            ),
                        },
                      );
                    }}
                    onDeleteBlocked={() => {
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: "Tentativa de exclusão bloqueada",
                        modulo: "Configurações › Doadores",
                        registro: r.nome,
                        observacao: "Doador possui doações registradas",
                      });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <DoadorForm open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

/* ---------- FORNECEDORES ---------- */

type FornecedorFormState = {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  categoria: string;
  observacao: string;
  status: Status;
};

const FORNECEDOR_FORM_VAZIO: FornecedorFormState = {
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  categoria: "Alimentos",
  observacao: "",
  status: "ativo",
};

function FornecedorForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: FornecedorCadastro | null;
}) {
  const salvarFornecedor = useSalvarFornecedor();
  const [form, setForm] = useState<FornecedorFormState>(FORNECEDOR_FORM_VAZIO);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setForm(editing ?? FORNECEDOR_FORM_VAZIO);
      setErrors({});
    }
  }, [open, editing]);

  async function save() {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    const de = validateDoc(form.documento);
    if (de) e.documento = de;
    if (!form.categoria.trim()) e.categoria = "Categoria obrigatória";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await salvarFornecedor.mutateAsync({ ...form, id: editing?.id });
    } catch (err) {
      toast.error(mensagemErroCadastro(err, "Não foi possível salvar o fornecedor."));
      return;
    }
    registrarAuditoria({
      usuario: USUARIO_ATUAL,
      acao: editing ? "Fornecedor editado" : "Fornecedor criado",
      modulo: "Configurações › Fornecedores",
      registro: form.nome,
    });
    toast.success(editing ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 py-4">
          <F label="Nome" error={errors.nome}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </F>
          <F label="CNPJ / Documento" error={errors.documento}>
            <Input
              value={form.documento}
              onChange={(e) => setForm({ ...form, documento: e.target.value })}
            />
          </F>
          <F label="Telefone">
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </F>
          <F label="E-mail">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </F>
          <F label="Categoria" error={errors.categoria}>
            <Input
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            />
          </F>
          <F label="Observação">
            <Textarea
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </F>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Status</div>
            </div>
            <Switch
              checked={form.status === "ativo"}
              onCheckedChange={(v) => setForm({ ...form, status: v ? "ativo" : "inativo" })}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={salvarFornecedor.isPending} onClick={() => void save()}>
            {salvarFornecedor.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FornecedoresTab() {
  const { data, isPending, isError, refetch } = useFornecedoresSupabase();
  const definirStatus = useDefinirStatusCadastro("fornecedores");
  const excluir = useExcluirCadastro("fornecedores");
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FornecedorCadastro | null>(null);

  const rows = data ?? [];
  const filtered = rows.filter((r) => !busca || r.nome.toLowerCase().includes(busca.toLowerCase()));

  if (isPending || isError) {
    return (
      <CadastroEstado
        carregando={isPending}
        mensagemErro="Não foi possível carregar os fornecedores."
        onTentarNovamente={() => void refetch()}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Buscar fornecedor</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" />
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo fornecedor
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ/Documento</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="font-mono text-xs">{r.documento || "—"}</TableCell>
                <TableCell>{r.telefone || "—"}</TableCell>
                <TableCell>{r.categoria}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell>
                  <RowActions
                    status={r.status}
                    hasVinculo={false}
                    onEdit={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                    onToggleStatus={() => {
                      const ns: Status = r.status === "ativo" ? "inativo" : "ativo";
                      definirStatus.mutate(
                        { id: r.id, status: ns },
                        {
                          onSuccess: () => {
                            registrarAuditoria({
                              usuario: USUARIO_ATUAL,
                              acao:
                                ns === "ativo" ? "Fornecedor reativado" : "Fornecedor inativado",
                              modulo: "Configurações › Fornecedores",
                              registro: r.nome,
                            });
                            toast.success(
                              ns === "ativo" ? "Fornecedor reativado" : "Fornecedor inativado",
                            );
                          },
                          onError: (err) =>
                            toast.error(
                              mensagemErroCadastro(
                                err,
                                "Não foi possível alterar o status do fornecedor.",
                              ),
                            ),
                        },
                      );
                    }}
                    onDelete={() => {
                      excluir.mutate(
                        { id: r.id },
                        {
                          onSuccess: () => {
                            registrarAuditoria({
                              usuario: USUARIO_ATUAL,
                              acao: "Fornecedor excluído",
                              modulo: "Configurações › Fornecedores",
                              registro: r.nome,
                            });
                            toast.success("Fornecedor excluído");
                          },
                          onError: (err) =>
                            toast.error(
                              mensagemErroCadastro(err, "Não foi possível excluir o fornecedor."),
                            ),
                        },
                      );
                    }}
                    onDeleteBlocked={() => {
                      registrarAuditoria({
                        usuario: USUARIO_ATUAL,
                        acao: "Tentativa de exclusão bloqueada",
                        modulo: "Configurações › Fornecedores",
                        registro: r.nome,
                        observacao: "Fornecedor possui recebimentos registrados",
                      });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <FornecedorForm open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

/* ---------- PARÂMETROS ---------- */

function ParametrosTab() {
  const { data } = useConfiguracoes();
  const saved = data ?? CONFIGURACOES_PADRAO;
  const atualizar = useAtualizarConfiguracoes();
  const [form, setForm] = useState<Configuracoes>(saved);
  useEffect(() => setForm(saved), [saved]);

  async function salvar() {
    try {
      await atualizar.mutateAsync(form);
      // diff para auditoria por parâmetro (após persistir com sucesso)
      (Object.keys(form) as (keyof Configuracoes)[]).forEach((k) => {
        if (form[k] !== saved[k]) {
          registrarAuditoria({
            acao: "Parâmetro alterado",
            modulo: "Configurações › Parâmetros",
            registro: String(k),
            observacao: `De "${String(saved[k])}" para "${String(form[k])}"`,
          });
        }
      });
      toast.success("Parâmetros salvos com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar os parâmetros.");
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Regras e parâmetros do sistema</h3>
          <p className="text-xs text-muted-foreground">
            Valores usados pelas regras de atendimento, estoque e auditoria.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ParamNum
            label="Prazo mínimo para nova retirada"
            unidade="dias"
            value={form.intervaloMinimoDias}
            onChange={(v) => setForm({ ...form, intervaloMinimoDias: v })}
            descricao="Antes desse prazo, a entrega fica bloqueada, exceto liberação excepcional por Administrador."
          />
          <ParamNum
            label="Alerta após liberação sem retirada"
            unidade="dias"
            value={form.alertaLiberadoSemRetiradaDias}
            onChange={(v) => setForm({ ...form, alertaLiberadoSemRetiradaDias: v })}
            descricao="A partir desse prazo, o cadastro continua liberado, mas aparece como atenção/acompanhamento."
          />
          <ParamNum
            label="Contato necessário por inatividade"
            unidade="dias"
            value={form.inatividadeContatoDias}
            onChange={(v) => setForm({ ...form, inatividadeContatoDias: v })}
            descricao="A partir desse prazo, sinalizar contato necessário. Não bloquear automaticamente e não tornar inativo automaticamente."
          />
          <ParamNum
            label="Limite de Cesta Extra (retiradas)"
            value={form.limiteExtra}
            onChange={(v) => setForm({ ...form, limiteExtra: v })}
          />
          <ParamText
            label="Após limite de retiradas extras"
            value={form.aposLimiteExtra}
            onChange={(v) => setForm({ ...form, aposLimiteExtra: v })}
          />
          <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
            <div className="pr-3">
              <div className="text-sm font-medium">Liberação excepcional</div>
              <div className="text-xs text-muted-foreground">Quem pode liberar fora das regras</div>
            </div>
            <Select
              value={form.liberacaoExcepcional}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  liberacaoExcepcional: v as Configuracoes["liberacaoExcepcional"],
                })
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Apenas Administrador</SelectItem>
                <SelectItem value="admin_atendente">Administrador e Atendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ParamSwitch
            label="Bloqueio por falta de estoque"
            value={form.bloqueioSemEstoque}
            onChange={(v) => setForm({ ...form, bloqueioSemEstoque: v })}
          />
          <ParamSwitch
            label="Observação obrigatória na liberação excepcional"
            value={form.observacaoObrigatoriaLiberacao}
            onChange={(v) => setForm({ ...form, observacaoObrigatoriaLiberacao: v })}
          />
          <ParamSwitch
            label="Registrar auditoria de alterações"
            value={form.auditoriaAtiva}
            onChange={(v) => setForm({ ...form, auditoriaAtiva: v })}
          />
          <ParamSwitch
            label="Baixa automática no estoque após entrega"
            value={form.baixaAutomatica}
            onChange={(v) => setForm({ ...form, baixaAutomatica: v })}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={atualizar.isPending} onClick={() => void salvar()}>
            {atualizar.isPending ? "Salvando..." : "Salvar parâmetros"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ParamNum({
  label,
  value,
  onChange,
  unidade,
  descricao,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unidade?: string;
  descricao?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="pr-3 text-sm font-medium">{label}</div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            className="w-24"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {unidade && <span className="text-xs text-muted-foreground">{unidade}</span>}
        </div>
      </div>
      {descricao && <p className="mt-2 text-xs text-muted-foreground">{descricao}</p>}
    </div>
  );
}
function ParamText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
      <div className="pr-3 text-sm font-medium">{label}</div>
      <Input className="w-64" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function ParamSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
      <div className="pr-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{value ? "Sim" : "Não"}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

/* ---------- PAGE ---------- */

function ConfigPage() {
  const mounted = useMounted();
  return (
    <AppShell title="Configurações">
      <Tabs defaultValue="itens">
        <TabsList className="h-auto flex-wrap gap-2 bg-transparent p-0">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="flex-col items-start gap-0.5 border border-border bg-card p-3 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <t.icon className="h-4 w-4" /> {t.label}
              </div>
              <span className="text-[10px] text-muted-foreground">{t.desc}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {mounted ? (
          <>
            <TabsContent value="itens" className="mt-4">
              <ItensTab />
            </TabsContent>
            <TabsContent value="unidades" className="mt-4">
              <UnidadesTab />
            </TabsContent>
            <TabsContent value="categorias" className="mt-4">
              <CategoriasTab />
            </TabsContent>
            <TabsContent value="beneficios" className="mt-4">
              <BeneficiosTab />
            </TabsContent>
            <TabsContent value="doadores" className="mt-4">
              <DoadoresTab />
            </TabsContent>
            <TabsContent value="fornecedores" className="mt-4">
              <FornecedoresTab />
            </TabsContent>
            <TabsContent value="parametros" className="mt-4">
              <ParametrosTab />
            </TabsContent>
          </>
        ) : (
          <div className="mt-4 h-64 animate-pulse rounded-md bg-muted/30" />
        )}
      </Tabs>
    </AppShell>
  );
}
