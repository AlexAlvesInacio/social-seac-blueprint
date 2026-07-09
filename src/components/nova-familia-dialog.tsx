import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useFamilias, type FamiliaStatus, type TipoCadastro } from "@/lib/familias-store";
import { registrarAuditoria } from "@/lib/auditoria-store";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

const empty = {
  nome: "", responsavel: "", documento: "", telefone: "", bairro: "",
  endereco: "", numero: "", complemento: "", cidade: "", uf: "", cep: "",
  tipoCadastro: "extra" as TipoCadastro,
  status: "liberado" as FamiliaStatus,
  moradores: "", criancas: "", idosos: "", gestantes: "", pcd: "",
  observacoes: "",
};

export function NovaFamiliaDialog({ open, onOpenChange }: Props) {
  const [form, setForm] = useState(empty);
  const [erros, setErros] = useState<Record<string, string>>({});
  const add = useFamilias((s) => s.add);
  const existsDocumento = useFamilias((s) => s.existsDocumento);
  const navigate = useNavigate();

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const reset = () => { setForm(empty); setErros({}); };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome da família.";
    if (!form.responsavel.trim()) e.responsavel = "Informe o responsável.";
    if (!form.documento.trim()) e.documento = "Informe o CPF ou RG.";
    else if (existsDocumento(form.documento))
      e.documento = "Já existe uma família cadastrada com este documento.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = (irParaDetalhe: boolean) => {
    if (!validar()) return;
    const nova = add({
      nome: form.nome.trim(),
      responsavel: form.responsavel.trim(),
      documento: form.documento.trim(),
      telefone: form.telefone.trim(),
      bairro: form.bairro.trim(),
      endereco: form.endereco.trim() || undefined,
      numero: form.numero.trim() || undefined,
      complemento: form.complemento.trim() || undefined,
      cidade: form.cidade.trim() || undefined,
      uf: form.uf.trim() || undefined,
      cep: form.cep.trim() || undefined,
      tipoCadastro: form.tipoCadastro,
      progressoExtra: form.tipoCadastro === "extra" ? "novo" : null,
      ultimaRetirada: "—",
      proximaData: "—",
      acompanhamento: "em_dia",
      status: form.status,
      moradores: form.moradores ? Number(form.moradores) : undefined,
      criancas: form.criancas ? Number(form.criancas) : undefined,
      idosos: form.idosos ? Number(form.idosos) : undefined,
      gestantes: form.gestantes ? Number(form.gestantes) : undefined,
      pcd: form.pcd ? Number(form.pcd) : undefined,
      observacoes: form.observacoes.trim() || undefined,
    });
    registrarAuditoria({
      usuario: "operador",
      acao: "Família criada",
      modulo: "Famílias",
      registro: `${nova.nome} (${nova.responsavel})`,
      observacao: `Doc. ${nova.documento}`,
    });
    toast.success("Família cadastrada com sucesso.");
    reset();
    onOpenChange(false);
    if (irParaDetalhe) {
      navigate({ to: "/familias/$id", params: { id: String(nova.id) } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova família</DialogTitle>
          <DialogDescription>Preencha os dados abaixo para cadastrar uma nova família.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome da família *" erro={erros.nome}>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Família Silva" />
            </F>
            <F label="Responsável *" erro={erros.responsavel}>
              <Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Nome do responsável" />
            </F>
            <F label="CPF / RG *" erro={erros.documento}>
              <Input value={form.documento} onChange={(e) => set("documento", e.target.value)} placeholder="000.000.000-00" />
            </F>
            <F label="Telefone / WhatsApp">
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(00) 00000-0000" />
            </F>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <F label="Endereço"><Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></F>
            </div>
            <F label="Número"><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} /></F>
            <F label="Complemento"><Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} /></F>
            <F label="Bairro"><Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></F>
            <F label="Cidade"><Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></F>
            <F label="UF"><Input maxLength={2} value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} /></F>
            <F label="CEP"><Input value={form.cep} onChange={(e) => set("cep", e.target.value)} /></F>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <F label="Tipo de cadastro">
              <Select value={form.tipoCadastro} onValueChange={(v) => set("tipoCadastro", v as TipoCadastro)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="extra">Avaliação</SelectItem>
                  <SelectItem value="definitivo">Definitivo</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="Status inicial">
              <Select value={form.status} onValueChange={(v) => set("status", v as FamiliaStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="liberado">Ativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </F>
          </section>

          <section className="grid gap-3 md:grid-cols-5">
            <F label="Moradores"><Input type="number" min={0} value={form.moradores} onChange={(e) => set("moradores", e.target.value)} /></F>
            <F label="Crianças"><Input type="number" min={0} value={form.criancas} onChange={(e) => set("criancas", e.target.value)} /></F>
            <F label="Idosos"><Input type="number" min={0} value={form.idosos} onChange={(e) => set("idosos", e.target.value)} /></F>
            <F label="Gestantes"><Input type="number" min={0} value={form.gestantes} onChange={(e) => set("gestantes", e.target.value)} /></F>
            <F label="PCD"><Input type="number" min={0} value={form.pcd} onChange={(e) => set("pcd", e.target.value)} /></F>
          </section>

          <F label="Observações sociais">
            <Textarea rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </F>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button variant="outline" onClick={() => salvar(true)}>Salvar e abrir detalhes</Button>
          <Button onClick={() => salvar(false)}>Salvar família</Button>
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