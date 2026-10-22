import { redirect } from "next/navigation";
import { Trees } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const instant = false;

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Trees className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Hillside Eden</h1>
            <p className="text-xs text-muted-foreground">
              Dashboard Monitoring Booking &amp; Keuangan
            </p>
          </div>
        </div>

        <Card className="border-border/80 shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg">Masuk ke Akun</CardTitle>
            <CardDescription className="text-xs">
              Masukkan kredensial owner untuk mengakses dashboard properti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <footer className="text-center text-[11px] text-muted-foreground/80">
          Zona waktu: Asia/Makassar (WITA) · Mata uang: IDR
        </footer>
      </div>
    </main>
  );
}
