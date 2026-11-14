import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "@/app/api/webhooks/inbound-email/route";

describe("Inbound Email Webhook Route Handler (/api/webhooks/inbound-email)", () => {
  const originalEnv = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  const SECRET = "test-inbound-email-secret-12345678";

  beforeEach(() => {
    process.env.INBOUND_EMAIL_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    } else {
      process.env.INBOUND_EMAIL_WEBHOOK_SECRET = originalEnv;
    }
  });

  it("gagal tertutup (503) bila secret webhook belum dikonfigurasi", async () => {
    delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

    const req = new Request("http://localhost:3000/api/webhooks/inbound-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "automated@airbnb.com", subject: "Booking" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/INBOUND_EMAIL_WEBHOOK_SECRET/);
  });

  it("menolak request tanpa secret (401)", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/inbound-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "automated@airbnb.com", subject: "Booking" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("menolak secret yang salah (401)", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/inbound-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": "secret-yang-salah-123456789",
      },
      body: JSON.stringify({ from: "automated@airbnb.com", subject: "Booking" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("menolak HMAC lama (atas body saja) karena dapat direplay (401)", async () => {
    const payload = JSON.stringify({ from: "automated@airbnb.com", subject: "Booking" });
    const signature = createHmac("sha256", SECRET).update(payload).digest("base64");

    const req = new Request("http://localhost:3000/api/webhooks/inbound-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wc-webhook-signature": signature,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("menolak payload JSON tidak valid (400) setelah autentikasi berhasil", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/inbound-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": SECRET,
      },
      body: "bukan-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
