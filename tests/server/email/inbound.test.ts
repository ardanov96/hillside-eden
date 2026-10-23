import { describe, it, expect } from "vitest";
import { isTrustedEmailSender } from "@/server/email/inbound";

describe("Inbound Email Service (S5-05)", () => {
  it("memvalidasi domain pengirim yang masuk whitelist terpercaya", () => {
    expect(isTrustedEmailSender("automated@airbnb.com")).toBe(true);
    expect(isTrustedEmailSender("support@mailer.airbnb.com")).toBe(true);
    expect(isTrustedEmailSender("no-reply@tiket.com")).toBe(true);
    expect(isTrustedEmailSender("booking@traveloka.com")).toBe(true);

    // Domain non-whitelist
    expect(isTrustedEmailSender("phishing@fake-airbnb.xyz")).toBe(false);
    expect(isTrustedEmailSender("spammer@random.com")).toBe(false);
  });
});
