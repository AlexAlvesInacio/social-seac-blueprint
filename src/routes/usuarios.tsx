import { createFileRoute } from "@tanstack/react-router";
import { Pencil, UserCheck, UserPlus, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCurrentProfile } from "@/lib/auth/auth-service";
import type { PapelPerfil, Perfil, StatusPerfil } from "@/lib/auth/types";
import {
  approveUser,
  changeUserName,
  changeUserRole,
  criarUsuario,
  deactivateUser,
  listProfiles,
  reactivateUser,
} from "@/lib/auth/user-admin-service";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — SEAC Social" }] }),
  component: UsuariosPage,
});

const roleLabels: Record<PapelPerfil, string> = {
  administrador: "Administrador",
  atendente: "Atendente",
  estoque: "Estoque",
};

const statusLabels: Record<StatusPerfil, string> = {
  pendente: "Pendente",
  ativo: "Ativo",
  inativo: "Inativo",
};

function UsuariosPage() {
  return (
    <AppShell title="Gestão de usuários" requiredRole="administrador">
      <UsuariosContent />
    </AppShell>
  );
}

function UsuariosContent() {
  const [profiles, setProfiles] = useState<Perfil[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<PapelPerfil | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusPerfil | "all">("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ nome: string; email: string; papel: PapelPerfil }>(
    { nome: "", email: "", papel: "atendente" },
  );
  const [inviting, setInviting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Perfil | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editPapel, setEditPapel] = useState<PapelPerfil>("atendente");
  const [editing, setEditing] = useState(false);

  const loadProfiles = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setErrorMessage(null);

    try {
      const [currentProfileResult, profilesResult] = await Promise.all([
        getCurrentProfile(),
        listProfiles(),
      ]);

      if (currentProfileResult.error || !currentProfileResult.data) {
        setErrorMessage("Não foi possível identificar o administrador atual.");
        return;
      }

      if (profilesResult.error) {
        setErrorMessage("Não foi possível carregar os usuários. Tente novamente.");
        return;
      }

      setCurrentProfileId(currentProfileResult.data.id);
      setProfiles(profilesResult.data ?? []);
    } catch {
      setErrorMessage("Não foi possível carregar os usuários. Tente novamente.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    return profiles.filter((profile) => {
      const matchesRole = roleFilter === "all" || profile.papel === roleFilter;
      const matchesStatus = statusFilter === "all" || profile.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        profile.nome_completo.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        (profile.email ?? "").toLocaleLowerCase("pt-BR").includes(normalizedSearch);

      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [profiles, roleFilter, search, statusFilter]);

  async function runAction(
    actionKey: string,
    successText: string,
    action: () => Promise<{ error: { message: string } | null }>,
  ) {
    setActiveAction(actionKey);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await action();

      if (error) {
        setErrorMessage(error.message || "A operação não pôde ser concluída.");
        return;
      }

      setSuccessMessage(successText);
      await loadProfiles(false);
    } catch {
      setErrorMessage("A operação não pôde ser concluída. Tente novamente.");
    } finally {
      setActiveAction(null);
    }
  }

  function handleApprove(profile: Perfil) {
    void runAction(`approve:${profile.id}`, "Usuário aprovado com sucesso.", () =>
      approveUser(profile.id),
    );
  }

  function handleOpenEdit(profile: Perfil) {
    setEditTarget(profile);
    setEditNome(profile.nome_completo);
    setEditPapel(profile.papel);
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;

    const nome = editNome.trim();
    if (!nome) {
      setErrorMessage("Informe o nome do usuário.");
      return;
    }

    const isSelf = editTarget.id === currentProfileId;
    const podeMudarPapel = editTarget.status === "ativo" && !isSelf;

    setEditing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (nome !== editTarget.nome_completo) {
        const { error } = await changeUserName(editTarget.id, nome);
        if (error) {
          setErrorMessage(error.message || "Não foi possível salvar o nome.");
          return;
        }
      }

      if (podeMudarPapel && editPapel !== editTarget.papel) {
        const { error } = await changeUserRole(editTarget.id, editPapel);
        if (error) {
          setErrorMessage(error.message || "Não foi possível salvar o papel.");
          return;
        }
      }

      setSuccessMessage("Usuário atualizado com sucesso.");
      setEditOpen(false);
      setEditTarget(null);
      await loadProfiles(false);
    } catch {
      setErrorMessage("A operação não pôde ser concluída. Tente novamente.");
    } finally {
      setEditing(false);
    }
  }

  function handleDeactivate(profile: Perfil) {
    if (profile.id === currentProfileId || profile.status !== "ativo") return;

    const confirmed = window.confirm(`Inativar o acesso de ${profile.nome_completo}?`);
    if (!confirmed) return;

    void runAction(`deactivate:${profile.id}`, "Usuário inativado com sucesso.", () =>
      deactivateUser(profile.id),
    );
  }

  function handleReactivate(profile: Perfil) {
    if (profile.status !== "inativo") return;

    void runAction(`reactivate:${profile.id}`, "Usuário reativado com sucesso.", () =>
      reactivateUser(profile.id),
    );
  }

  async function handleInvite() {
    if (!inviteForm.nome.trim() || !inviteForm.email.trim()) {
      setErrorMessage("Informe nome e e-mail para incluir o usuário.");
      return;
    }
    setInviting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { error } = await criarUsuario({
        nome: inviteForm.nome.trim(),
        email: inviteForm.email.trim(),
        papel: inviteForm.papel,
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setSuccessMessage(
        'Usuário criado e ativo. Ele deve usar "Esqueci a senha" na tela de login para definir a senha no primeiro acesso.',
      );
      setInviteOpen(false);
      setInviteForm({ nome: "", email: "", papel: "atendente" });
      await loadProfiles(false);
    } catch {
      setErrorMessage("Não foi possível enviar o convite. Tente novamente.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Apenas administradores ativos podem consultar e gerenciar usuários.
        </p>
        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> Incluir usuário
        </Button>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Incluir usuário</DialogTitle>
            <DialogDescription>
              O usuário é criado já ativo com o papel escolhido. No primeiro acesso, ele define a
              senha usando “Esqueci a senha” na tela de login.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input
                value={inviteForm.nome}
                onChange={(e) => setInviteForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail *</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Papel</Label>
              <Select
                value={inviteForm.papel}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, papel: v as PapelPerfil }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="atendente">Atendente</SelectItem>
                  <SelectItem value="estoque">Estoque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancelar
            </Button>
            <Button onClick={() => void handleInvite()} disabled={inviting}>
              {inviting ? "Incluindo…" : "Incluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              Altere o nome e o papel do usuário. O papel só pode ser alterado com o usuário ativo.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const isSelf = editTarget?.id === currentProfileId;
            const podeMudarPapel = editTarget?.status === "ativo" && !isSelf;
            return (
              <div className="grid gap-3 py-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <Input value={editTarget?.email ?? "—"} disabled readOnly />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome *</Label>
                  <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Papel</Label>
                  <Select
                    value={editPapel}
                    disabled={!podeMudarPapel}
                    onValueChange={(v) => setEditPapel(v as PapelPerfil)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="administrador">Administrador</SelectItem>
                      <SelectItem value="atendente">Atendente</SelectItem>
                      <SelectItem value="estoque">Estoque</SelectItem>
                    </SelectContent>
                  </Select>
                  {!podeMudarPapel && (
                    <p className="text-xs text-muted-foreground">
                      {isSelf
                        ? "Você não pode alterar o próprio papel."
                        : "O papel só pode ser alterado com o usuário ativo."}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editing}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={editing}>
              {editing ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Papel</Label>
            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as PapelPerfil | "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="administrador">Administrador</SelectItem>
                <SelectItem value="atendente">Atendente</SelectItem>
                <SelectItem value="estoque">Estoque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusPerfil | "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <Input
              placeholder="Nome ou e-mail"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-3 space-y-2" aria-live="polite">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {successMessage && (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}
      </div>

      <Card className="mt-3">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-72">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    Carregando usuários…
                  </TableCell>
                </TableRow>
              ) : filteredProfiles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfiles.map((profile) => {
                  const isSelf = profile.id === currentProfileId;
                  const isActing = activeAction?.endsWith(profile.id) ?? false;

                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.nome_completo}</TableCell>
                      <TableCell className="text-sm">{profile.email ?? "—"}</TableCell>
                      <TableCell>{roleLabels[profile.papel]}</TableCell>
                      <TableCell>
                        <Badge variant={profile.status === "ativo" ? "default" : "secondary"}>
                          {statusLabels[profile.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {profile.status === "pendente" && (
                            <Button
                              size="sm"
                              className="gap-2"
                              disabled={isActing}
                              onClick={() => handleApprove(profile)}
                            >
                              <UserCheck className="h-4 w-4" />
                              Aprovar
                            </Button>
                          )}

                          {profile.status !== "pendente" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              disabled={isActing}
                              onClick={() => handleOpenEdit(profile)}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                          )}

                          {profile.status === "ativo" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              disabled={isSelf || isActing}
                              onClick={() => handleDeactivate(profile)}
                            >
                              <UserX className="h-4 w-4" />
                              Inativar
                            </Button>
                          )}

                          {profile.status === "inativo" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              disabled={isActing}
                              onClick={() => handleReactivate(profile)}
                            >
                              <UserCheck className="h-4 w-4" />
                              Reativar
                            </Button>
                          )}

                          {isSelf && profile.status === "ativo" && (
                            <span className="text-xs text-muted-foreground">Sua conta</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
