import { redirect } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { getSession, login } from "@/lib/auth";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getSession()) redirect("/dashboard");

  async function action(formData: FormData) {
    "use server";
    const ok = await login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    const dest = String(formData.get("next") || "/dashboard");
    if (!ok) redirect(`/login?error=1&next=${encodeURIComponent(dest)}`);
    redirect(dest.startsWith("/dashboard") ? dest : "/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">RB</div>
          <div>
            <p className="font-semibold leading-tight">Rede de Blogs</p>
            <p className="text-xs text-muted-foreground">Acesso ao painel</p>
          </div>
        </div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <Field label="E-mail">
            <Input name="email" type="email" required autoComplete="email" autoFocus />
          </Field>
          <Field label="Senha">
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          {error && <p className="text-sm text-danger">E-mail ou senha incorretos.</p>}
          <Button className="w-full">Entrar</Button>
        </form>
      </Card>
    </main>
  );
}
