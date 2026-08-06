import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

/**
 * Cabeçalhos de segurança aplicados a toda resposta que sai daqui.
 *
 * Estavam só em `public/_headers`, que é convenção do Cloudflare: em qualquer
 * outra hospedagem (Vercel, por exemplo) o arquivo é ignorado e as proteções
 * sumiriam sem nada avisar. Aqui eles acompanham a aplicação, não a plataforma.
 *
 * O `_headers` continua no repositório porque no Cloudflare ele cobre também os
 * arquivos estáticos, que não passam por este handler.
 *
 * Sem Content-Security-Policy de propósito: CSP em app SSR quebra fácil (estilos
 * e scripts inline do TanStack Start) e precisa de teste tela a tela.
 */
const CABECALHOS_DE_SEGURANCA: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
};

/** Status em que o corpo precisa ser nulo (RFC 9110). */
const SEM_CORPO = new Set([101, 204, 205, 304]);

function comCabecalhosDeSeguranca(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [nome, valor] of Object.entries(CABECALHOS_DE_SEGURANCA)) {
    // Não sobrescreve: se a plataforma ou a rota já definiu, o valor dela vale.
    if (!headers.has(nome)) headers.set(nome, valor);
  }
  return new Response(SEM_CORPO.has(response.status) ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return comCabecalhosDeSeguranca(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return comCabecalhosDeSeguranca(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
