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
import { useAtualizarMembro } from "@/lib/familias/use-familias-supabase";
import type { MembroFamiliarSupabaseReadModel } from "@/lib/familias/familias-supabase-types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  membro: MembroFamiliarSupabaseReadModel | null;
};

/**
 * Edição de um membro familiar (dados da pessoa + vínculo), exceto o documento
 * (identidade única). Atualiza nome/telefone/nascimento/PCD da pessoa e
 * parentesco/gestante do vínculo via RPC transacional.
 */
export function EditarMembroSupabaseDialog({ open, onOpenChange, membro }: Props) {
  const atualizar = useAtualizarMembro();
  const [form, setForm] = useState({
    nome: "",
    parentesco: "",
    telefone: "",
    nascimento: "",
    pcd: false,
    gestante: false,
  });
  const [erroNome, setErroNome] = useState<string | null>(null);

  useEffect(() => {
    if (open && membro) {
      setForm({
        nome: membro.nome ?? "",
        parentesco: membro.parentesco ?? "",
        telefone: membro.telefone ?? "",
        nascimento: membro.nascimento ?? "",
        pcd: membro.pcd,
        gestante: membro.gestante,
      });
      setErroNome(null);
    }
  }, [open, membro]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!membro) return;
    if (!form.nome.trim()) {
      setErroNome("Informe o nome.");
      return;
    }
    try {
      await atualizar.mutateAsync({
        membroFamiliarId: membro.id,
        nome: form.nome,
        parentesco: form.parentesco,
        telefone: form.telefone,
        nascimento: form.nascimento,
        pcd: form.pcd,
        gestante: form.gestante,
      });
      toast.success("Membro atualizado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o membro.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar membro familiar</DialogTitle>
          <DialogDescription>
            {membro ? `${membro.nome} — documento ${membro.documento}` : "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome *" erro={erroNome ?? undefined}>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </F>
            <F label="Parentesco">
              <Input
                value={form.parentesco}
                onChange={(e) => set("parentesco", e.target.value)}
                placeholder="Filho, cônjuge, mãe..."
              />
            </F>
            <F label="Documento (não editável)">
              <Input value={membro?.documento ?? ""} disabled readOnly />
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
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.pcd}
                onCheckedChange={(v) => set("pcd", v)}
                id="pcd-editar-membro"
              />
              <Label htmlFor="pcd-editar-membro" className="text-sm">
                PCD
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.gestante}
                onCheckedChange={(v) => set("gestante", v)}
                id="gestante-editar-membro"
              />
              <Label htmlFor="gestante-editar-membro" className="text-sm">
                Gestante
              </Label>
            </div>
          </div>
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
