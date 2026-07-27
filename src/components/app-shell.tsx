import { Bell } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RequireActiveProfile } from "@/lib/auth/auth-guard";
import { getCurrentProfile } from "@/lib/auth/auth-service";
import type { PapelPerfil } from "@/lib/auth/types";

const roleLabels: Record<PapelPerfil, string> = {
  administrador: "Administrador",
  atendente: "Atendente",
  estoque: "Estoque",
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toLocaleUpperCase("pt-BR");
  return (partes[0][0] + partes[partes.length - 1][0]).toLocaleUpperCase("pt-BR");
}

function UsuarioLogado() {
  const [nome, setNome] = useState<string | null>(null);
  const [papel, setPapel] = useState<PapelPerfil | null>(null);

  useEffect(() => {
    let ativo = true;
    void getCurrentProfile().then(({ data }) => {
      if (!ativo || !data) return;
      setNome(data.nome_completo || data.email || null);
      setPapel(data.papel);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const nomeExibido = nome ?? "Carregando…";

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
          {nome ? iniciais(nome) : "…"}
        </AvatarFallback>
      </Avatar>
      <div className="hidden flex-col leading-tight sm:flex">
        <span className="text-xs font-medium text-foreground">{nomeExibido}</span>
        {papel && <span className="text-[10px] text-muted-foreground">{roleLabels[papel]}</span>}
      </div>
    </div>
  );
}

export function AppShell({
  title,
  breadcrumbs,
  actions,
  children,
  requiredRole,
}: {
  title: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  requiredRole?: PapelPerfil;
}) {
  return (
    <RequireActiveProfile requiredRole={requiredRole}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-muted/30">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
              <SidebarTrigger />
              <div className="flex flex-1 items-center gap-2">
                <h1 className="text-base font-semibold text-foreground">{title}</h1>
                {breadcrumbs}
              </div>
              <div className="flex items-center gap-2">
                {actions}
                <Button variant="ghost" size="icon" aria-label="Notificações">
                  <Bell className="h-4 w-4" />
                </Button>
                <UsuarioLogado />
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </RequireActiveProfile>
  );
}
