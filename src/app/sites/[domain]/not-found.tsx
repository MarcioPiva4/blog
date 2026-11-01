import Link from "next/link";

// not-found não recebe params; texto bilíngue curto
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-6xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-bold">Página não encontrada · Page not found</h1>
      <Link href="/" className="mt-8 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground">
        ← Início · Home
      </Link>
    </main>
  );
}
