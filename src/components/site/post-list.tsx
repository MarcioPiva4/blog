import Link from "next/link";
import type { BlogTheme, Category } from "@/db/schema";
import type { PostCard } from "@/lib/public-data";
import type { Dict } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

type Props = { posts: PostCard[]; categories: Category[]; d: Dict; locale: string };

function Cover({ post, className }: { post: PostCard; className?: string }) {
  if (!post.coverImage) return <div className={`bg-gradient-to-br from-brand/80 to-brand ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={post.coverImage} alt={post.coverAlt ?? ""} loading="lazy" className={`object-cover ${className}`} />;
}

function Meta({ post, d, locale, cat }: { post: PostCard; d: Dict; locale: string; cat?: Category }) {
  return (
    <p className="text-xs text-zinc-500">
      {cat && <span className="font-medium text-brand">{cat.name} · </span>}
      {formatDate(post.publishedAt, locale)} · {post.readingTime} {d.minRead}
    </p>
  );
}

export function PostList({ theme, ...props }: Props & { theme: BlogTheme }) {
  if (theme === "magazine") return <MagazineList {...props} />;
  if (theme === "editorial") return <EditorialList {...props} />;
  return <MinimalList {...props} />;
}

function MinimalList({ posts, categories, d, locale }: Props) {
  return (
    <ul className="mx-auto max-w-2xl divide-y divide-zinc-200">
      {posts.map((p) => (
        <li key={p.id} className="py-7">
          <Meta post={p} d={d} locale={locale} cat={categories.find((c) => c.id === p.categoryId)} />
          <h2 className="mt-1.5 text-2xl font-bold leading-snug tracking-tight text-zinc-900">
            <Link href={`/${p.slug}`} className="hover:text-brand">
              {p.title}
            </Link>
          </h2>
          <p className="mt-2 text-zinc-600">{p.excerpt}</p>
        </li>
      ))}
    </ul>
  );
}

function MagazineList({ posts, categories, d, locale }: Props) {
  const [first, ...rest] = posts;
  if (!first) return null;
  return (
    <div className="space-y-10">
      <Link href={`/${first.slug}`} className="group grid overflow-hidden rounded-2xl border border-zinc-200 bg-white md:grid-cols-2">
        <Cover post={first} className="aspect-[16/10] h-full w-full" />
        <div className="flex flex-col justify-center p-6 md:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">{d.featured}</p>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-zinc-900 group-hover:text-brand">{first.title}</h2>
          <p className="mt-3 text-zinc-600">{first.excerpt}</p>
          <div className="mt-4">
            <Meta post={first} d={d} locale={locale} />
          </div>
        </div>
      </Link>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((p) => (
          <Link key={p.id} href={`/${p.slug}`} className="group overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <Cover post={p} className="aspect-[16/9] w-full" />
            <div className="p-5">
              <Meta post={p} d={d} locale={locale} cat={categories.find((c) => c.id === p.categoryId)} />
              <h3 className="mt-1.5 text-lg font-bold leading-snug text-zinc-900 group-hover:text-brand">{p.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{p.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EditorialList({ posts, categories, d, locale }: Props) {
  const [first, ...rest] = posts;
  if (!first) return null;
  return (
    <div className="space-y-12">
      <Link href={`/${first.slug}`} className="group block">
        <Cover post={first} className="aspect-[21/9] w-full rounded-2xl" />
        <div className="mx-auto mt-6 max-w-3xl text-center">
          <Meta post={first} d={d} locale={locale} cat={categories.find((c) => c.id === first.categoryId)} />
          <h2 className="mt-2 font-serif text-4xl font-semibold leading-tight text-zinc-900 group-hover:text-brand md:text-5xl">{first.title}</h2>
          <p className="mt-4 font-serif text-lg text-zinc-600">{first.excerpt}</p>
        </div>
      </Link>
      <div className="grid gap-x-10 gap-y-10 border-t border-zinc-200 pt-10 md:grid-cols-2">
        {rest.map((p) => (
          <Link key={p.id} href={`/${p.slug}`} className="group grid grid-cols-[120px_1fr] gap-5">
            <Cover post={p} className="aspect-square w-full rounded-lg" />
            <div>
              <Meta post={p} d={d} locale={locale} cat={categories.find((c) => c.id === p.categoryId)} />
              <h3 className="mt-1 font-serif text-xl font-semibold leading-snug text-zinc-900 group-hover:text-brand">{p.title}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-zinc-600">{p.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, base, d }: { page: number; pages: number; base: string; d: Dict }) {
  if (pages <= 1) return null;
  const href = (p: number) => (p === 1 ? base || "/" : `${base}/pagina/${p}`);
  return (
    <nav className="mt-12 flex items-center justify-center gap-4 text-sm" aria-label={d.page}>
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className="rounded-lg border border-zinc-200 px-4 py-2 hover:bg-zinc-50">
          ← {d.previous}
        </Link>
      )}
      <span className="text-zinc-500">
        {d.page} {page} / {pages}
      </span>
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className="rounded-lg border border-zinc-200 px-4 py-2 hover:bg-zinc-50">
          {d.next} →
        </Link>
      )}
    </nav>
  );
}
