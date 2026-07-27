import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserRound,
  HandHeart,
  Package,
  PackagePlus,
  Boxes,
  Settings,
  UserCog,
  BarChart3,
  ShieldCheck,
  House,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getCurrentProfile } from "@/lib/auth/auth-service";

const operacional = [
  { title: "Painel", url: "/painel", icon: LayoutDashboard },
  { title: "Famílias", url: "/familias", icon: Users },
  { title: "Atendimento", url: "/atendimento", icon: HandHeart },
];

const estoque = [
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Recebimentos", url: "/recebimentos", icon: PackagePlus },
  { title: "Composição por benefício", url: "/composicao-cesta", icon: Boxes },
];

const admin = [
  { title: "Usuários", url: "/usuarios", icon: UserCog, adminOnly: true },
  { title: "Configurações", url: "/configuracoes", icon: Settings, adminOnly: false },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, adminOnly: false },
  { title: "Auditoria", url: "/auditoria", icon: ShieldCheck, adminOnly: false },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) =>
    pathname === url || (url !== "/painel" && pathname.startsWith(url));

  const renderGroup = (
    label: string,
    items: { title: string; url: string; icon: typeof Users }[],
  ) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  const [logoError, setLogoError] = useState(false);
  const [papel, setPapel] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void getCurrentProfile().then(({ data }) => {
      if (ativo) setPapel(data?.papel ?? null);
    });
    return () => {
      ativo = false;
    };
  }, []);

  // Esconde itens exclusivos de administrador (ex.: Usuários) de outros papéis.
  const adminItems = admin.filter((item) => !item.adminOnly || papel === "administrador");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/painel" className="flex items-center gap-2 px-2 py-3">
          {logoError ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <House className="h-5 w-5" />
            </span>
          ) : (
            <img
              src="/seac-logo.svg"
              alt="SEAC Social"
              className="h-9 w-9 rounded-lg object-contain"
              onError={() => setLogoError(true)}
            />
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold text-foreground">
              SEAC <span className="text-primary">Social</span>
            </span>
            <span className="text-[10px] text-muted-foreground">Gestão social</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Operacional", operacional)}
        {renderGroup("Estoque", estoque)}
        {renderGroup("Administração", adminItems)}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sair">
              <Link to="/auth" className="flex items-center gap-3">
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
