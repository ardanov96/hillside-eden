import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "./actions/auth";

export const instant = false;

export default async function Home() {
  const session = await auth();
  // Middleware sudah seharusnya menahan, tapi lapisan ini menjamin DoD
  // "Route tanpa login ditolak" meski matcher berubah.
  if (!session?.user) {
    redirect("/login");
  }
  const user = session.user;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <header className="space-y-2 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Hillside Eden Dashboard
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Selamat datang, {user.name ?? user.email}
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Monitoring booking dan keuangan untuk satu pemilik, banyak properti. Fokus: Tiket.com,
            Traveloka, Airbnb.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Akun Anda
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs text-zinc-500">Email</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{user.email}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-zinc-500">Peran</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {user.role ?? "OWNER"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/api/health"
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Cek /api/health
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Keluar
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="https://github.com/ardanov96/hillside-eden"
            className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Repository</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              github.com/ardanov96/hillside-eden
            </p>
          </Link>
          <Link
            href="https://nextjs.org/docs"
            className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Dokumentasi</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Lihat folder docs/ di repository
            </p>
          </Link>
        </section>

        <footer className="pt-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
          Zona waktu: Asia/Makassar (WITA) - Mata uang dasar: IDR
        </footer>
      </div>
    </main>
  );
}
