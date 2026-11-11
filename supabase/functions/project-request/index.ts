declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (request: Request) => Promise<Response> | Response) => void;
};

const allowedServices = new Set([
  "Site institucional",
  "Landing page",
  "Catálogo online",
  "Manutenção ou melhoria",
  "Outro projeto",
]);

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

const jsonResponse = (
  status: number,
  body: Record<string, string>,
  origin: string,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });

const isString = (value: unknown): value is string => typeof value === "string";

const isValidEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const maxRequestBytes = 12000;

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGIN") ?? "")
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);

  if (!origin || !allowedOrigins.includes(origin)) {
    return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Método não permitido." }, origin);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > maxRequestBytes) {
    return jsonResponse(413, { error: "O pedido excedeu o tamanho permitido." }, origin);
  }

  if (!request.body) {
    return jsonResponse(400, { error: "Formato de pedido inválido." }, origin);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxRequestBytes) {
        try {
          await reader.cancel();
        } catch (error) {
          console.error("Failed to cancel oversized project request body.", error);
        }
        return jsonResponse(413, { error: "O pedido excedeu o tamanho permitido." }, origin);
      }

      chunks.push(value);
    }
  } catch (error) {
    console.error("Failed to read project request body.", error);
    return jsonResponse(400, { error: "Formato de pedido inválido." }, origin);
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let bodyOffset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, bodyOffset);
    bodyOffset += chunk.byteLength;
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bodyBytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse(400, { error: "Formato de pedido inválido." }, origin);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { error: "Formato de pedido inválido." }, origin);
  }

  const { name, company, email, service, message, website } = payload;
  if (
    !isString(name) ||
    !isString(company) ||
    !isString(email) ||
    !isString(service) ||
    !isString(message) ||
    !isString(website)
  ) {
    return jsonResponse(400, { error: "Preencha os campos do pedido corretamente." }, origin);
  }

  if (website.trim()) {
    return jsonResponse(400, { error: "Não foi possível validar o pedido." }, origin);
  }

  const cleanName = name.trim();
  const cleanCompany = company.trim();
  const cleanEmail = email.trim();
  const cleanService = service.trim();
  const cleanMessage = message.trim();

  if (
    cleanName.length < 2 ||
    cleanName.length > 100 ||
    cleanCompany.length > 120 ||
    !isValidEmail(cleanEmail) ||
    !allowedServices.has(cleanService) ||
    cleanMessage.length < 10 ||
    cleanMessage.length > 4000
  ) {
    return jsonResponse(400, { error: "Confira os dados e tente novamente." }, origin);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("RESEND_FROM_EMAIL");
  const recipient = Deno.env.get("CONTACT_EMAIL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSalt = Deno.env.get("RATE_LIMIT_SALT");

  if (!resendApiKey || !sender || !recipient || !supabaseUrl || !serviceRoleKey || !rateLimitSalt) {
    console.error("Project request function is missing required server configuration.");
    return jsonResponse(503, { error: "O recebimento de pedidos ainda está sendo configurado." }, origin);
  }

  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const subjectHash = await sha256(`${forwardedIp}:${rateLimitSalt}`);

  let rateLimitResponse: Response;
  try {
    rateLimitResponse = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/consume_form_rate_limit`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_subject_hash: subjectHash,
          p_limit: 5,
          p_window_seconds: 3600,
        }),
      },
    );
  } catch (error) {
    console.error("Form rate-limit service is unavailable.", error);
    return jsonResponse(503, { error: "Não foi possível validar o pedido agora." }, origin);
  }

  if (!rateLimitResponse.ok) {
    console.error("Form rate-limit service returned status", rateLimitResponse.status);
    return jsonResponse(503, { error: "Não foi possível validar o pedido agora." }, origin);
  }

  let withinRateLimit: unknown;
  try {
    withinRateLimit = await rateLimitResponse.json();
  } catch (error) {
    console.error("Form rate-limit service returned invalid JSON.", error);
    return jsonResponse(503, { error: "Não foi possível validar o pedido agora." }, origin);
  }

  if (typeof withinRateLimit !== "boolean") {
    console.error("Form rate-limit service returned an invalid response.");
    return jsonResponse(503, { error: "Não foi possível validar o pedido agora." }, origin);
  }

  if (!withinRateLimit) {
    return jsonResponse(429, { error: "Limite de pedidos atingido. Tente novamente mais tarde." }, origin);
  }

  let deliveryResponse: Response;
  try {
    deliveryResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        reply_to: cleanEmail,
        subject: `Novo pedido de orçamento — ${cleanService}`,
        text: [
          `Nome: ${cleanName}`,
          `Empresa: ${cleanCompany || "Não informada"}`,
          `E-mail: ${cleanEmail}`,
          `Serviço: ${cleanService}`,
          "",
          "Descrição do projeto:",
          cleanMessage,
        ].join("\n"),
      }),
    });
  } catch (error) {
    console.error("Resend request failed.", error);
    return jsonResponse(502, { error: "Não foi possível enviar o pedido agora." }, origin);
  }

  if (!deliveryResponse.ok) {
    console.error("Resend rejected the email request with status", deliveryResponse.status);
    return jsonResponse(502, { error: "Não foi possível enviar o pedido agora." }, origin);
  }

  return jsonResponse(200, { message: "Pedido recebido." }, origin);
});
