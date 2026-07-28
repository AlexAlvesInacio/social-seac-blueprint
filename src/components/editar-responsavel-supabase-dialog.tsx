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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAtualizarResponsavelSupabase } from "@/lib/familias/use-familias-supabase";
import type {
  FamiliaSupabaseReadModel,
  PessoaTipoDocumentoSupabase,
} from "@/lib/familias/familias-supabase-types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familia: FamiliaSupabaseReadModel;
};

/**
 * Edição dos dados do responsável principal (nome, tipo/número do documento e
 * telefone) via RPC atualizar_responsavel_familia. Este é o único ponto que permite
 * corrigir o CPF/RG do responsável; a edição de membro trava o documento.
 */
export function EditarResponsavelSupabaseDialog({ open, onOpenChange, familia }: Props) {
  const atualizar = useAtualizarResponsavelSupabase();
  const resp = familia.responsavelPrincipal;
  const [form, setForm] = useState({
    nome: "",
    tipoDocumento: "cpf" as PessoaTipoDocumentoSupabase,
    documento: "",
    telefone: "",
  });
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({
        nome: resp?.nome ?? familia.responsavel ?? "",
        tipoDocumento: resp?.tipoDocumento ?? "cpf",
        documento: resp?.documento ?? familia.documento ?? "",
        telefone: resp?.telefone ?? familia.telefone ?? "",
      });
      setErros({});
    }
  }, [open, resp, familia]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome do responsável.";
    if (!form.documento.trim()) e.documento = "Documento é obrigatório.";
    setErros(e);
    if (Object.keys(e).length) return;

    try {
      await atualizar.mutateAsync({
        familiaId: familia.id,
        nome: form.nome,
        tipoDocumento: form.tipoDocumento,
        documento: form.documento,
        telefone: form.telefone,
      });
      toast.success("Responsável atualizado.");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
        setErros({ documento: "Já existe uma pessoa com este documento." });
      }
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o responsável.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar responsável</DialogTitle>
          <DialogDescription>Dados do responsável principal de {familia.nome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 md:grid-cols-2">
          <F label="Nome *" erro={erros.nome}>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </F>
          <F label="Telefone">
            <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
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
          <F label="Documento (CPF/RG) *" erro={erros.documento}>
            <Input value={form.documento} onChange={(e) => set("documento", e.target.value)} />
          </F>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={atualizar.isPending} onClick={() => void salvar()}>
            {atualizar.isPending ? "Salvando..." : "Salvar"}
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
