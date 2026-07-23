import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCriarAssistidoSupabase } from "@/lib/familias/use-familias-supabase";
import type {
  AssistidoTipoCadastroSupabase,
  PessoaTipoDocumentoSupabase,
} from "@/lib/familias/familias-supabase-types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familiaId: string;
  familiaNome: string;
};

const empty = {
  nome: "",
  documento: "",
  tipoDocumento: "cpf" as PessoaTipoDocumentoSupabase,
  parentesco: "",
  telefone: "",
  nascimento: "",
  tipoCadastro: "extra" as AssistidoTipoCadastroSupabase,
  pcd: false,
  gestante: false,
};

/**
 * Cadastro de assistido em família remota (UUID) via RPC transacional. A RPC
 * cria pessoa, vínculo e assistido, e deriva o benefício do tipo de cadastro —
 * por isso o benefício não é um campo do formulário.
 */
export function AdicionarAssistidoSupabaseDialog({
  open,
  onOpenChange,
  familiaId,
  familiaNome,
}: Props) {
  const [form, setForm] = useState(empty);
  const [erros, setErros] = useState<Record<string, string>>({});
  const criarAssistido = useCriarAssistidoSupabase();

  useEffect(() => {
    if (open) {
      setForm(empty);
      setErros({});
    }
  }, [open]);

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome.";
    if (!form.documento.trim()) e.documento = "CPF/RG é obrigatório.";
    setErros(e);
    if (Object.keys(e).length) return;

    try {
      await criarAssistido.mutateAsync({
        familiaId,
        nome: form.nome,
        tipoDocumento: form.tipoDocumento,
        documento: form.documento,
        tipoCadastro: form.tipoCadastro,
        parentesco: form.parentesco,
        telefone: form.telefone,
        nascimento: form.nascimento,
        pcd: form.pcd,
        gestante: form.gestante,
      });
      toast.success("Assistido adicionado.");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
        setErros({ documento: "Já existe um cadastro com este documento." });
      }
      toast.error(err instanceof Error ? err.message : "Não foi possível adicionar o assistido.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar assistido</DialogTitle>
          <DialogDescription>Vincular novo assistido à família {familiaNome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome do assistido *" erro={erros.nome}>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </F>
            <F label="Parentesco">
              <Input
                value={form.parentesco}
                onChange={(e) => set("parentesco", e.target.value)}
                placeholder="Ex.: Filho(a)"
              />
            </F>
            <F label="Tipo de documento">
              <Select
                value={form.tipoDocumento}
                onValueChange={(v) => set("tipoDocumento", v as PessoaTipoDocumentoSupabase)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="rg">RG</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="CPF / RG *" erro={erros.documento}>
              <Input value={form.documento} onChange={(e) => set("documento", e.target.value)} />
            </F>
            <F label="Telefone">
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </F>
            <F label="Data de nascimento">
              <Input
                type="date"
                value={form.nascimento}
                onChange={(e) => set("nascimento", e.target.value)}
              />
            </F>
          </section>
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Tipo de cadastro">
              <Select
                value={form.tipoCadastro}
                onValueChange={(v) => set("tipoCadastro", v as AssistidoTipoCadastroSupabase)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="definitivo">Definitivo (Cesta Padrão)</SelectItem>
                  <SelectItem value="extra">Avaliação (Cesta Extra)</SelectItem>
                </SelectContent>
              </Select>
            </F>
          </section>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.pcd}
                onCheckedChange={(v) => set("pcd", v)}
                id="pcd-assist-sb"
              />
              <Label htmlFor="pcd-assist-sb" className="text-sm">
                PCD
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.gestante}
                onCheckedChange={(v) => set("gestante", v)}
                id="gestante-assist-sb"
              />
              <Label htmlFor="gestante-assist-sb" className="text-sm">
                Gestante
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={criarAssistido.isPending} onClick={() => void salvar()}>
            {criarAssistido.isPending ? "Salvando..." : "Salvar assistido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, erro, children }: { label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
