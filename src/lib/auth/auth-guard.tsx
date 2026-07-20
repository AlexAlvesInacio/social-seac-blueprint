import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { getCurrentProfile, getCurrentUser, signOut } from "@/lib/auth/auth-service";

type AccessState = "checking" | "allowed";

export function RequireActiveProfile({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [accessState, setAccessState] = useState<AccessState>("checking");

  useEffect(() => {
    let isCurrent = true;

    async function verifyAccess() {
      try {
        const { data: userData, error: userError } = await getCurrentUser();

        if (userError || !userData?.user) {
          if (isCurrent) {
            await navigate({ to: "/auth", replace: true });
          }
          return;
        }

        const { data: profile, error: profileError } = await getCurrentProfile();

        if (profileError || profile?.status !== "ativo") {
          await signOut();
          if (isCurrent) {
            await navigate({ to: "/auth", replace: true });
          }
          return;
        }

        if (isCurrent) {
          setAccessState("allowed");
        }
      } catch {
        if (isCurrent) {
          await navigate({ to: "/auth", replace: true });
        }
      }
    }

    void verifyAccess();

    return () => {
      isCurrent = false;
    };
  }, [navigate]);

  if (accessState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
        Verificando acesso…
      </div>
    );
  }

  return children;
}
