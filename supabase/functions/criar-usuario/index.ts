// Edge Function: criar-usuario
//
// O admin informa nome, e-mail e papel; a função valida que o chamador é
// administrador ativo e cria o usuário JÁ ATIVO (e-mail confirmado), SEM senha e
// SEM enviar convite (auth.admin.createUser via service_role). O usuário define a
// senha no 1º acesso pela opção "Esqueci a senha" da tela de login (e-mail de
// recuperação → rota /definir-senha).
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

    if (!nome || !email || !papel) {
      return json({ ok: false, error: "Nome, e-mail e papel são obrigatórios." }, 200);
    }
    if (!PAPEIS.includes(papel)) {
      return json({ ok: false, error: "Papel inválido." }, 200);
    }

    // Cria o usuário já ativo (e-mail confirmado), SEM senha e SEM enviar convite.
    // O usuário define a senha no 1º acesso via "Esqueci a senha" (e-mail de recuperação).
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nome_completo: nome },
    });

    if (createError || !created?.user) {
      const msg = createError?.message ?? "Falha ao criar o usuário.";
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
      .eq("id", created.user.id);

    if (updateError) {
      return json(
        { ok: false, error: "Usuário convidado, mas houve falha ao definir o papel/status." },
        200,
      );
    }

    return json({ ok: true, user_id: created.user.id });
  } catch (error) {
    return json({ ok: false, error: `Erro inesperado: ${(error as Error).message}` }, 200);
  }
});
