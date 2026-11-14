import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { GET, POST } from "@/app/api/webhooks/direct-booking/route";
import { WEBHOOK_MAX_SKEW_SECONDS } from "@/lib/webhook-auth";

describe("Direct Booking Webhook Route Handler (/api/webhooks/direct-booking)", () => {
  const originalEnv = process.env.DIRECT_BOOKING_WEBHOOK_SECRET;
  const SECRET = "test-direct-secret-key-12345678";

  beforeEach(() => {
    process.env.DIRECT_BOOKING_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DIRECT_BOOKING_WEBHOOK_SECRET;
    } else {
      process.env.DIRECT_BOOKING_WEBHOOK_SECRET = originalEnv;
    }
  });

  describe("GET /api/webhooks/direct-booking", () => {
    it("mengembalikan status ready dan info endpoint untuk health check", async () => {
      const response = await GET();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(json.endpoint).toBe("/api/webhooks/direct-booking");
      expect(json.channel).toBe("DIRECT");
      expect(json.status).toBe("ready");
    });
  });

  describe("POST /api/webhooks/direct-booking Security & Authentication", () => {
    it("menolak request tanpa secret token (401 Unauthorized)", async () => {
      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: "HE-1" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Unauthorized/);
    });

    it("gagal tertutup (503) bila secret webhook belum dikonfigurasi", async () => {
      delete process.env.DIRECT_BOOKING_WEBHOOK_SECRET;

      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: "HE-1" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toMatch(/DIRECT_BOOKING_WEBHOOK_SECRET/);
    });

    it("gagal tertutup (503) bila secret webhook terlalu pendek", async () => {
      process.env.DIRECT_BOOKING_WEBHOOK_SECRET = "pendek";

      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "pendek",
        },
        body: JSON.stringify({ bookingId: "HE-1" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(503);
    });

    it("menolak request dengan secret token yang salah (401 Unauthorized)", async () => {
      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "wrong-secret-token-key-xxxxxxx",
        },
        body: JSON.stringify({ bookingId: "HE-1" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("menerima request dengan x-webhook-secret yang valid", async () => {
      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": SECRET,
          "x-wc-webhook-topic": "webhook.ping",
        },
        body: JSON.stringify({ ping: true }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("menerima request dengan Authorization: Bearer <secret> yang valid", async () => {
      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${SECRET}`,
          "x-wc-webhook-topic": "webhook.ping",
        },
        body: JSON.stringify({ ping: true }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("menerima HMAC-SHA256 ber-timestamp yang valid", async () => {
      const payloadString = JSON.stringify({ webhook_id: 123 });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", SECRET)
        .update(`${timestamp}.${payloadString}`)
        .digest("base64");

      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wc-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
          "x-wc-webhook-topic": "webhook.ping",
        },
        body: payloadString,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("menolak HMAC lama (atas body saja) karena dapat direplay (401)", async () => {
      const payloadString = JSON.stringify({ webhook_id: 123 });
      const signature = createHmac("sha256", SECRET).update(payloadString).digest("base64");

      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wc-webhook-signature": signature,
          "x-wc-webhook-topic": "webhook.ping",
        },
        body: payloadString,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("menolak HMAC dengan timestamp basi / di luar jendela skew (401)", async () => {
      const payloadString = JSON.stringify({ webhook_id: 123 });
      const timestamp = String(Math.floor(Date.now() / 1000) - WEBHOOK_MAX_SKEW_SECONDS - 60);
      const signature = createHmac("sha256", SECRET)
        .update(`${timestamp}.${payloadString}`)
        .digest("base64");

      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wc-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
          "x-wc-webhook-topic": "webhook.ping",
        },
        body: payloadString,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("menolak payload bukan JSON valid dengan status 400", async () => {
      const req = new Request("http://localhost:3000/api/webhooks/direct-booking", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "x-webhook-secret": SECRET,
        },
        body: "invalid-non-json-string",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
