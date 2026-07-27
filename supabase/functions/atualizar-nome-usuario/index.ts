// Edge Function: atualizar-nome-usuario
//
// O admin edita o nome (nome_completo) de um perfil. A função valida que o
// chamador é administrador ativo e grava o nome em DOIS lugares, na mesma chamada:
//   1) public.profiles.nome_completo  (fonte de verdade do app)
//   2) auth.users.raw_user_meta_data  (display_name / nome_completo) — para que o
//      nome também apareça no "Display name" do painel Authentication do Supabase.
//
// A service_role NUNCA vai para o frontend: é lida aqui do ambiente do Supabase
// (SUPABASE_SERVICE_ROLE_KEY, injetada automaticamente na function).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Cliente com o JWT do chamador — para identificar quem está pedindo.
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user) {
      return json({ ok: false, error: "Não autenticado." }, 200);
    }
    const callerId = userData.user.id;

    // Cliente service_role — para verificar perfil e atualizar profiles + auth.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: perfil } = await admin
      .from("profiles")
      .select("papel, status")
      .eq("id", callerId)
      .maybeSingle();

    if (!perfil || perfil.papel !== "administrador" || perfil.status !== "ativo") {
      return json(
        { ok: false, error: "Apenas administrador ativo pode alterar o nome de usuários." },
        200,
      );
    }

    const body = await req.json().catch(() => ({}));
    const profileId = String(body.profile_id ?? "").trim();
    const nome = String(body.nome ?? "").trim();

    if (!profileId) return json({ ok: false, error: "Perfil não informado." }, 200);
    if (!nome) return json({ ok: false, error: "O nome é obrigatório." }, 200);

    // 1) Fonte de verdade do app: profiles.nome_completo.
    const { error: profileError } = await admin
      .from("profiles")
      .update({ nome_completo: nome })
      .eq("id", profileId);

    if (profileError) {
      return json({ ok: false, error: "Não foi possível salvar o nome no perfil." }, 200);
    }

    // 2) Metadata do Auth (Display name no painel). Merge — preserva as demais chaves.
    const { error: authError } = await admin.auth.admin.updateUserById(profileId, {
      user_metadata: { nome_completo: nome, display_name: nome },
    });

    // Se o profile gravou mas a metadata falhou, o app já está correto (fonte de
    // verdade é profiles); reportamos, mas não tratamos como erro fatal.
    if (authError) {
      return json({ ok: true, aviso: "Nome salvo no perfil; a metadata do Auth não atualizou." });
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: `Erro inesperado: ${(error as Error).message}` }, 200);
  }
});
