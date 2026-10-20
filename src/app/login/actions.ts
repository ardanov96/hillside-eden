"use server";
/**
 * Server Action untuk login.
 * - Menghindari pengiriman password sebagai JSON dari klien.
 * - Memakai signIn bawaan Auth.js (otomatis validasi + redirect).
 */
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email dan password wajib diisi." };
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
