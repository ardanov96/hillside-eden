import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <header className="space-y-2 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Sprint 0 - Fondasi
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Hillside Eden Dashboard
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Monitoring booking dan keuangan untuk satu pemilik, banyak properti. Fokus: Tiket.com,
            Traveloka, Airbnb.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Status Sistem
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Periksa endpoint health untuk memastikan database terhubung.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/api/health"
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Cek /api/health
            </Link>
            <Link
              href="/api/health?deep=1"
              className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              /api/health?deep=1
            </Link>
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
