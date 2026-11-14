/**
 * Webhook handler untuk email masuk OTA (S5-05).
 * Endpoint: POST /api/webhooks/inbound-email
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processInboundEmail, isTrustedEmailSender } from "@/server/email/inbound";
import { authenticateWebhookRequest, WEBHOOK_MIN_SECRET_LENGTH } from "@/lib/webhook-auth";

export const instant = false;

export async function POST(req: Request) {
  // 1. Fail-closed: secret WAJIB dikonfigurasi. Tanpa secret, endpoint menolak
  //    semua request (503) alih-alih menerima email masuk tanpa autentikasi.
  const webhookSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret.length < WEBHOOK_MIN_SECRET_LENGTH) {
    return NextResponse.json(
      {
        error:
          "Webhook belum dikonfigurasi: set INBOUND_EMAIL_WEBHOOK_SECRET " +
          `(minimal ${WEBHOOK_MIN_SECRET_LENGTH} karakter)`,
      },
      { status: 503 },
    );
  }

  // 2. Raw body diperlukan untuk verifikasi HMAC ber-timestamp.
  let rawBodyText: string;
  try {
    rawBodyText = await req.text();
  } catch {
    return NextResponse.json({ error: "Gagal membaca body request" }, { status: 400 });
  }

  // 3. Autentikasi: shared secret (x-webhook-secret / Authorization: Bearer)
  //    atau HMAC-SHA256 ber-timestamp atas `timestamp + "." + body`.
  const auth = authenticateWebhookRequest({
    secret: webhookSecret,
    rawBody: rawBodyText,
    headers: req.headers,
  });
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Parse JSON
  let rawBody: unknown;
  try {
    rawBody = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const body = (rawBody && typeof rawBody === "object" ? rawBody : {}) as Record<string, unknown>;

  const from =
    typeof body.from === "string" ? body.from : typeof body.sender === "string" ? body.sender : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const text =
    typeof body.text === "string"
      ? body.text
      : typeof body["body-plain"] === "string"
        ? (body["body-plain"] as string)
        : "";
  const html =
    typeof body.html === "string"
      ? body.html
      : typeof body["body-html"] === "string"
        ? (body["body-html"] as string)
        : "";
  const to = typeof body.to === "string" ? body.to : undefined;
  const headers =
    body.headers && typeof body.headers === "object"
      ? (body.headers as Record<string, string>)
      : undefined;
  const rawEml = typeof body.rawEml === "string" ? body.rawEml : undefined;

  if (!from || !subject) {
    return NextResponse.json({ error: "Missing required fields: from, subject" }, { status: 422 });
  }

  // Cek sender domain
  if (!isTrustedEmailSender(from)) {
    return NextResponse.json(
      { error: `Sender domain not in trusted whitelist: ${from}` },
      { status: 403 },
    );
  }

  // Dapatkan default organization (Hillside Eden)
  const org = await prisma.organization.findFirst({
    select: { id: true },
  });

  if (!org) {
    return NextResponse.json({ error: "No organization found" }, { status: 500 });
  }

  try {
    const result = await processInboundEmail(
      {
        from,
        to,
        subject,
        text,
        html,
        headers,
        rawEml,
      },
      {
        prisma,
        organizationId: org.id,
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
