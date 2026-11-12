/**
 * Webhook Handler untuk Direct Booking (hillsideedenubud.com) - Opsi A.
 *
 * Endpoint: POST /api/webhooks/direct-booking
 *
 * Menerima payload reservasi langsung dari website resmi (WordPress MotoPress
 * Hotel Booking, WooCommerce, atau form reservasi kustom), memvalidasi secret,
 * memastikan listing DIRECT tersedia, dan mengalirkan event ke IngestPipeline.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DirectWebhookAdapter } from "@/adapters/direct/adapter";
import { createRouterRegistry } from "@/ingest/pipeline/router";
import { runIngest } from "@/ingest/pipeline/pipeline";

export const instant = false;

/**
 * Verifikasi signature / secret token webhook secara aman (timing-attack resistant).
 */
function verifySecret(received: string, expected: string): boolean {
  if (received.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Health check & discovery endpoint untuk tester webhook / admin.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/direct-booking",
    channel: "DIRECT",
    status: "ready",
    documentation:
      "Webhook endpoint untuk direct booking hillsideedenubud.com (mendukung MotoPress Hotel Booking, WooCommerce, dan payload JSON standar)",
  });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.DIRECT_BOOKING_WEBHOOK_SECRET;

  // Baca raw body text untuk keperluan verifikasi HMAC signature & JSON parsing
  let rawBodyText: string;
  try {
    rawBodyText = await req.text();
  } catch {
    return NextResponse.json({ error: "Gagal membaca body request" }, { status: 400 });
  }

  // 1. Verifikasi Autentikasi jika DIRECT_BOOKING_WEBHOOK_SECRET dikonfigurasi di ENV
  if (webhookSecret) {
    const authHeader = req.headers.get("x-webhook-secret") || req.headers.get("authorization");
    const wcSignature = req.headers.get("x-wc-webhook-signature");

    let isAuthorized = false;

    // Cek header x-webhook-secret atau Authorization: Bearer <secret>
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (verifySecret(token, webhookSecret)) {
        isAuthorized = true;
      }
    }

    // Cek signature WooCommerce HMAC-SHA256 (bila dikirim oleh webhook WooCommerce)
    if (!isAuthorized && wcSignature) {
      try {
        const computedHmac = createHmac("sha256", webhookSecret)
          .update(rawBodyText, "utf-8")
          .digest("base64");
        if (verifySecret(wcSignature.trim(), computedHmac.trim())) {
          isAuthorized = true;
        }
      } catch {
        isAuthorized = false;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized: Webhook secret atau signature tidak valid" },
        { status: 401 },
      );
    }
  }

  // 2. Parse JSON
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBodyText);
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "Payload harus berupa format JSON valid" }, { status: 400 });
  }

  // Handle WooCommerce webhook ping event
  const wcTopic = req.headers.get("x-wc-webhook-topic");
  if (
    wcTopic === "webhook.ping" ||
    (body.webhook_id !== undefined && Object.keys(body).length <= 2)
  ) {
    return NextResponse.json({ ok: true, message: "WooCommerce webhook ping received" });
  }

  // 3. Dapatkan default Organization (Hillside Eden)
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true },
  });

  if (!org) {
    return NextResponse.json(
      { error: "Organisasi Hillside Eden tidak ditemukan di database" },
      { status: 500 },
    );
  }

  // 4. Pastikan listing DIRECT tersedia untuk Hillside Eden agar resolusi listing selalu berhasil
  const defaultProperty = await prisma.property.findFirst({
    where: { organizationId: org.id, slug: "hillside-eden" },
    select: { id: true },
  });

  const propertyId =
    defaultProperty?.id ||
    (await prisma.property.findFirst({ where: { organizationId: org.id }, select: { id: true } }))
      ?.id;

  if (propertyId) {
    await prisma.listing.upsert({
      where: {
        organizationId_channel_externalId: {
          organizationId: org.id,
          channel: "DIRECT",
          externalId: "he-direct-website",
        },
      },
      update: { isActive: true },
      create: {
        organizationId: org.id,
        propertyId,
        channel: "DIRECT",
        externalId: "he-direct-website",
        name: "Hillside Eden Ubud - Direct Website",
        url: "https://hillsideedenubud.com",
        currency: "IDR",
        isActive: true,
      },
    });
  }

  // 5. Inisialisasi Router dengan DirectWebhookAdapter
  const router = createRouterRegistry([new DirectWebhookAdapter()]);

  // 6. Jalankan IngestPipeline
  try {
    const result = await runIngest(prisma, router, {
      organizationId: org.id,
      kind: "MANUAL",
      channel: "DIRECT",
      filename: "webhook:direct-booking",
      rawInput: {
        kind: "webhook",
        channel: "DIRECT",
        source: "direct-website",
        payload: body,
      },
    });

    if (result.failed > 0 && result.created === 0 && result.updated === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ingest direct booking gagal atau masuk karantina",
          result,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      batchId: result.batchId,
      created: result.created,
      updated: result.updated,
      duplicate: result.duplicate,
      needsReview: result.needsReview,
      status: result.created > 0 ? "created" : result.updated > 0 ? "updated" : "processed",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message || "Internal server error saat memproses ingest webhook",
      },
      { status: 500 },
    );
  }
}
