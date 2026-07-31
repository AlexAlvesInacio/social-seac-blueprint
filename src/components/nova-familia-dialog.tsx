import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FamiliasSupabaseWriteQueryError,
  type AssistidoTipoCadastroSupabase,
  type PessoaTipoDocumentoSupabase,
} from "@/lib/familias/familias-supabase-types";
import { useCriarFamiliaSupabase } from "@/lib/familias/use-familias-supabase";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: { nome: string }) => void;
};

type FormState = {
  nome: string;
  responsavel: string;
  tipoDocumento: PessoaTipoDocumentoSupabase;
  documento: string;
  telefone: string;
  bairro: string;
  endereco: string;
  numero: string;
  complemento: string;
  cidade: string;
  uf: string;
  cep: string;
  tipoCadastro: AssistidoTipoCadastroSupabase;
};

const emptyForm: FormState = {
  nome: "",
  responsavel: "",
  tipoDocumento: "cpf",
  documento: "",
  telefone: "",
  bairro: "",
  endereco: "",
  numero: "",
  complemento: "",
  cidade: "",
  uf: "",
  cep: "",
  tipoCadastro: "definitivo",
};

function getSupabaseErrorMessage(error: unknown): string {
  if (!(error instanceof FamiliasSupabaseWriteQueryError)) {
    return "Não foi possível confirmar o cadastro no Supabase. Atualize a lista antes de tentar novamente.";
  }

  switch (error.code) {
    case "23505":
      return "Já existe uma pessoa cadastrada com este documento.";
    case "22023":
      return "Revise os dados informados e tente novamente.";
    case "42501":
      return "Apenas administrador ou atendente ativo pode cadastrar famílias.";
    default:
      return "Não foi possível confirmar o cadastro no Supabase. Atualize a lista antes de tentar novamente.";
  }
}

export function NovaFamiliaDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [acaoPendente, setAcaoPendente] = useState<"salvar" | "abrir" | null>(null);
  const criarFamiliaSupabase = useCriarFamiliaSupabase();
  const navigate = useNavigate();
  const envioRemotoEmAndamento = useRef(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErros((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setErroEnvio(null);
  };

  const reset = () => {
    setForm(emptyForm);
    setErros({});
    setErroEnvio(null);
    setAcaoPendente(null);
    criarFamiliaSupabase.reset();
  };

  const validar = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.nome.trim()) nextErrors.nome = "Informe o nome da família.";
    if (!form.responsavel.trim()) nextErrors.responsavel = "Informe o responsável.";
    if (!form.documento.trim()) nextErrors.documento = "Informe o documento do responsável.";

    setErros(nextErrors);
    setErroEnvio(null);
    return Object.keys(nextErrors).length === 0;
  };

  const concluirCadastro = (id: string, irParaDetalhe: boolean) => {
    reset();
    onOpenChange(false);

    if (irParaDetalhe) {
      navigate({ to: "/familias/$id", params: { id } });
    }
  };

  const salvar = async (irParaDetalhe: boolean) => {
    if (envioRemotoEmAndamento.current || criarFamiliaSupabase.isPending) return;
    if (!validar()) return;

    envioRemotoEmAndamento.current = true;
    setAcaoPendente(irParaDetalhe ? "abrir" : "salvar");

    try {
      const nova = await criarFamiliaSupabase.mutateAsync({
        nomeReferencia: form.nome,
        responsavelNome: form.responsavel,
        responsavelTipoDocumento: form.tipoDocumento,
        responsavelDocumento: form.documento,
        tipoCadastro: form.tipoCadastro,
        responsavelTelefone: form.telefone,
        endereco: form.endereco,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        cep: form.cep,
      });

      toast.success("Família cadastrada com sucesso.");
      onCreated({ nome: form.nome.trim() });
      concluirCadastro(nova.familia_id, irParaDetalhe);
    } catch (error) {
      const message = getSupabaseErrorMessage(error);

      if (error instanceof FamiliasSupabaseWriteQueryError && error.code === "23505") {
        setErros((current) => ({ ...current, documento: message }));
      }

      setErroEnvio(message);
      toast.error(message);
    } finally {
      envioRemotoEmAndamento.current = false;
      setAcaoPendente(null);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && criarFamiliaSupabase.isPending) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        aria-busy={criarFamiliaSupabase.isPending}
        onEscapeKeyDown={(event) => {
          if (criarFamiliaSupabase.isPending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (criarFamiliaSupabase.isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Nova família</DialogTitle>
          <DialogDescription>
            Preencha os dados do cadastro institucional. A família, a pessoa responsável e o vínculo
            principal são criados na mesma operação.
          </DialogDescription>
        </DialogHeader>

        <fieldset
          disabled={criarFamiliaSupabase.isPending}
          className="m-0 grid min-w-0 gap-4 border-0 p-0 py-2"
        >
          <legend className="sr-only">Dados da nova família</legend>

          {erroEnvio && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{erroEnvio}</AlertDescription>
            </Alert>
          )}

          {criarFamiliaSupabase.isPending && (
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Salvando e atualizando a lista…
            </p>
          )}

          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome da família *" erro={erros.nome}>
              <Input
                value={form.nome}
                onChange={(event) => set("nome", event.target.value)}
                placeholder="Ex.: Família Silva"
              />
            </F>
            <F label="Responsável *" erro={erros.responsavel}>
              <Input
                value={form.responsavel}
                onChange={(event) => set("responsavel", event.target.value)}
                placeholder="Nome do responsável"
              />
            </F>
            <F label="Tipo de documento *">
              <Select
                value={form.tipoDocumento}
                onValueChange={(value) =>
                  set("tipoDocumento", value as PessoaTipoDocumentoSupabase)
                }
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
            <F label="Documento *" erro={erros.documento}>
              <Input
                value={form.documento}
                onChange={(event) => set("documento", event.target.value)}
                placeholder="000.000.000-00"
              />
            </F>
            <F label="Telefone / WhatsApp">
              <Input
                value={form.telefone}
                onChange={(event) => set("telefone", event.target.value)}
                placeholder="(00) 00000-0000"
              />
            </F>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <F label="Endereço">
                <Input
                  value={form.endereco}
                  onChange={(event) => set("endereco", event.target.value)}
                />
              </F>
            </div>
            <F label="Número">
              <Input value={form.numero} onChange={(event) => set("numero", event.target.value)} />
            </F>
            <F label="Complemento">
              <Input
                value={form.complemento}
                onChange={(event) => set("complemento", event.target.value)}
              />
            </F>
            <F label="Bairro">
              <Input value={form.bairro} onChange={(event) => set("bairro", event.target.value)} />
            </F>
            <F label="Cidade">
              <Input value={form.cidade} onChange={(event) => set("cidade", event.target.value)} />
            </F>
            <F label="UF">
              <Input
                maxLength={2}
                value={form.uf}
                onChange={(event) => set("uf", event.target.value.toUpperCase())}
              />
            </F>
            <F label="CEP">
              <Input value={form.cep} onChange={(event) => set("cep", event.target.value)} />
            </F>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <F label="Tipo de cadastro do responsável *">
              <Select
                value={form.tipoCadastro}
                onValueChange={(value) =>
                  set("tipoCadastro", value as AssistidoTipoCadastroSupabase)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="definitivo">Definitivo (Cesta Padrão)</SelectItem>
                  <SelectItem value="extra">Extra (Avaliação)</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <p className="self-center rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-1">
              O responsável é cadastrado como <strong>assistido</strong> deste tipo, já apto ao
              atendimento. Status e contagens da família seguem os valores iniciais do banco.
            </p>
          </section>
        </fieldset>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={criarFamiliaSupabase.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            disabled={criarFamiliaSupabase.isPending}
            onClick={() => void salvar(true)}
          >
            {criarFamiliaSupabase.isPending && acaoPendente === "abrir" && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Salvar e abrir detalhes
          </Button>
          <Button disabled={criarFamiliaSupabase.isPending} onClick={() => void salvar(false)}>
            {criarFamiliaSupabase.isPending && acaoPendente === "salvar" && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Salvar
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
