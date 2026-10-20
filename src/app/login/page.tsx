/**
 * Halaman login (Server Component).
 * - Redirect ke / bila user sudah login.
 * - Menampilkan form Client Component dengan Server Action.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const instant = false;

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Hillside Eden
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Masuk ke Dashboard
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Gunakan email owner yang dipasang saat seed.
          </p>
        </header>
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <LoginForm />
        </section>
        <footer className="text-center text-xs text-zinc-500">
          Zona waktu: Asia/Makassar (WITA) - Mata uang dasar: IDR
        </footer>
      </div>
    </main>
  );
}
