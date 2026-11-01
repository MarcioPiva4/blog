import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/nav";
import { logout, requireAdmin } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  async function signOut() {
    "use server";
    await logout();
    redirect("/login");
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b bg-card md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">RB</div>
          <div>
            <p className="text-sm font-semibold leading-tight">Rede de Blogs</p>
            <p className="text-xs text-muted-foreground">Painel</p>
          </div>
        </div>
        <div className="px-3 pb-3 md:flex-1">
          <AdminNav />
        </div>
        <div className="hidden border-t px-5 py-3 md:block">
          <p className="truncate text-xs text-muted-foreground">{session.email}</p>
          <form action={signOut}>
            <button className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 bg-muted/30 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
