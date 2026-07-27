// Edge Function: criar-usuario
//
// Convida um novo usuário por e-mail (fluxo "invite"): o admin informa nome, e-mail
// e papel; a função valida que o chamador é administrador ativo, cria o usuário via
// service_role (auth.admin.inviteUserByEmail) e deixa o perfil ativo com o papel
// escolhido. O usuário recebe um e-mail, define a própria senha (rota /definir-senha)
// e passa a logar.
//
// A service_role NUNCA vai para o frontend: é lida aqui do ambiente do Supabase
// (SUPABASE_SERVICE_ROLE_KEY, injetada automaticamente na function).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAPEIS = ["administrador", "atendente", "estoque"];

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

    // Cliente service_role — para verificar perfil e criar o usuário.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: perfil } = await admin
      .from("profiles")
      .select("papel, status")
      .eq("id", callerId)
      .maybeSingle();

    if (!perfil || perfil.papel !== "administrador" || perfil.status !== "ativo") {
      return json({ ok: false, error: "Apenas administrador ativo pode incluir usuários." }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const nome = String(body.nome ?? "").trim();
    const email = String(body.email ?? "").trim();
    const papel = String(body.papel ?? "");
    const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;

    if (!nome || !email || !papel) {
      return json({ ok: false, error: "Nome, e-mail e papel são obrigatórios." }, 200);
    }
    if (!PAPEIS.includes(papel)) {
      return json({ ok: false, error: "Papel inválido." }, 200);
    }

    // Convite por e-mail: cria o usuário (sem senha) e dispara o e-mail.
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome_completo: nome },
      redirectTo,
    });

    if (inviteError || !invited?.user) {
      const msg = inviteError?.message ?? "Falha ao convidar o usuário.";
      const jaExiste = /already|registered|exists/i.test(msg);
      return json(
        { ok: false, error: jaExiste ? "Já existe um usuário com este e-mail." : msg },
        200,
      );
    }

    // O trigger criou o perfil como pendente; deixamos ativo com o papel escolhido.
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        nome_completo: nome,
        papel,
        status: "ativo",
        aprovado_em: new Date().toISOString(),
        aprovado_por: callerId,
      })
      .eq("id", invited.user.id);

    if (updateError) {
      return json(
        { ok: false, error: "Usuário convidado, mas houve falha ao definir o papel/status." },
        200,
      );
    }

    return json({ ok: true, user_id: invited.user.id });
  } catch (error) {
    return json({ ok: false, error: `Erro inesperado: ${(error as Error).message}` }, 200);
  }
});
