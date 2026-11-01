import Link from "next/link";
import type { Tenant } from "@/lib/tenant";
import { t } from "@/lib/i18n";
import { institutionalSlugs } from "@/lib/institutional";

export function SiteHeader({ tenant }: { tenant: Tenant }) {
  const { blog, categories } = tenant;
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="h-1 bg-brand" />
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {blog.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={blog.logoUrl} alt={blog.name} className="h-8 w-auto" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-foreground">{blog.name.slice(0, 1)}</span>
          )}
          <span className="text-lg font-bold tracking-tight text-zinc-900">{blog.name}</span>
        </Link>
        <nav className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm" aria-label={t(blog.language).categories}>
          {categories.slice(0, 6).map((c) => (
            <Link key={c.id} href={`/categoria/${c.slug}`} className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
              {c.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ tenant }: { tenant: Tenant }) {
  const { blog, categories } = tenant;
  const d = t(blog.language);
  const s = institutionalSlugs(blog.language);
  return (
    <footer className="mt-20 border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-bold text-zinc-900">{blog.name}</p>
          <p className="mt-2 text-sm text-zinc-600">{blog.tagline || blog.description}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">{d.categories}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categoria/${c.slug}`} className="text-zinc-600 hover:text-zinc-900">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">{blog.name}</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href={`/${s.about}`} className="text-zinc-600 hover:text-zinc-900">{d.about}</Link></li>
            <li><Link href={`/${s.contact}`} className="text-zinc-600 hover:text-zinc-900">{d.contact}</Link></li>
            <li><Link href={`/${s.privacy}`} className="text-zinc-600 hover:text-zinc-900">{d.privacy}</Link></li>
            <li><Link href={`/${s.terms}`} className="text-zinc-600 hover:text-zinc-900">{d.terms}</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} {blog.name}. {d.allRights}
      </p>
    </footer>
  );
}
