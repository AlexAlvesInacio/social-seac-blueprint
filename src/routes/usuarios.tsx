import { createFileRoute } from "@tanstack/react-router";
import { UserCheck, UserCog, UserX } from "lucide-react";
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
import { getCurrentProfile } from "@/lib/auth/auth-service";
import type { PapelPerfil, Perfil, StatusPerfil } from "@/lib/auth/types";
import {
  approveUser,
  changeUserRole,
  deactivateUser,
  listProfiles,
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

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

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
  const [roleDrafts, setRoleDrafts] = useState<Record<string, PapelPerfil>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        profile.id.toLocaleLowerCase("pt-BR").includes(normalizedSearch);

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

  function handleDeactivate(profile: Perfil) {
    if (profile.id === currentProfileId || profile.status !== "ativo") return;

    const confirmed = window.confirm(`Inativar o acesso de ${profile.nome_completo}?`);
    if (!confirmed) return;

    void runAction(`deactivate:${profile.id}`, "Usuário inativado com sucesso.", () =>
      deactivateUser(profile.id),
    );
  }

  function handleRoleChange(profile: Perfil) {
    if (profile.id === currentProfileId || profile.status !== "ativo") return;

    const nextRole = roleDrafts[profile.id] ?? profile.papel;
    if (nextRole === profile.papel) return;

    void runAction(`role:${profile.id}`, "Papel alterado com sucesso.", () =>
      changeUserRole(profile.id, nextRole),
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Apenas administradores ativos podem consultar e gerenciar usuários.
      </p>

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
              placeholder="Nome ou identificação"
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
                <TableHead>Identificação</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Aprovado em</TableHead>
                <TableHead>Inativado em</TableHead>
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
                  const selectedRole = roleDrafts[profile.id] ?? profile.papel;
                  const isActing = activeAction?.endsWith(profile.id) ?? false;

                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.nome_completo}</TableCell>
                      <TableCell>
                        <span
                          className="font-mono text-xs"
                          title="E-mail não disponível em profiles"
                        >
                          {profile.id}
                        </span>
                      </TableCell>
                      <TableCell>{roleLabels[profile.papel]}</TableCell>
                      <TableCell>
                        <Badge variant={profile.status === "ativo" ? "default" : "secondary"}>
                          {statusLabels[profile.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(profile.criado_em)}</TableCell>
                      <TableCell>{formatDate(profile.aprovado_em)}</TableCell>
                      <TableCell>{formatDate(profile.inativado_em)}</TableCell>
                      <TableCell>
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

                        {profile.status === "ativo" && (
                          <div className="flex min-w-72 flex-wrap items-center gap-2">
                            <Select
                              value={selectedRole}
                              disabled={isSelf || isActing}
                              onValueChange={(value) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [profile.id]: value as PapelPerfil,
                                }))
                              }
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="administrador">Administrador</SelectItem>
                                <SelectItem value="atendente">Atendente</SelectItem>
                                <SelectItem value="estoque">Estoque</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              disabled={isSelf || isActing || selectedRole === profile.papel}
                              onClick={() => handleRoleChange(profile)}
                            >
                              <UserCog className="h-4 w-4" />
                              Salvar papel
                            </Button>
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
                            {isSelf && (
                              <span className="text-xs text-muted-foreground">Sua conta</span>
                            )}
                          </div>
                        )}

                        {profile.status === "inativo" && (
                          <span className="text-xs text-muted-foreground">Somente consulta</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        O e-mail administrativo não está disponível em profiles. Até existir uma coluna segura ou
        função/view controlada, o identificador do perfil é exibido como referência.
      </p>
    </>
  );
}
