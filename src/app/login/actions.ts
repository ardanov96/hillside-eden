"use server";
/**
 * Server Action untuk login.
 * - Menghindari pengiriman password sebagai JSON dari klien.
 * - Memakai signIn bawaan Auth.js (otomatis validasi + redirect).
 * - P2-9: rate limit login (maksimal 5 percobaan gagal per 15 menit per email)
 *   untuk mencegah percobaan paksa (brute force) pada kredensial owner.
 */
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { loginRateLimiter } from "@/lib/rate-limit";

export type LoginState = {
  error?: string;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email dan password wajib diisi." };
  }

  // P2-9: rate limit login — tolak bila melebihi batas percobaan per email.
  const rate = loginRateLimiter.consume(email);
  if (!rate.allowed) {
    return {
      error: "Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.",
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
    // signIn melempar redirect; baris ini tidak pernah tercapai saat sukses.
    return {};
  } catch (err) {
    // next-auth melempar error khusus saat perlu redirect;
    // itu bukan kegagalan dan harus dibiarkan naik.
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        return { error: "Email atau password salah." };
      }
      return { error: "Gagal masuk. Coba lagi." };
    }
    throw err;
  }
}
