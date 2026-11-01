import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Bot, ExternalLink, Trash2 } from "lucide-react";
import { db } from "@/db";
import { postRevisions, posts } from "@/db/schema";
import { PostEditor } from "@/components/admin/post-editor";
import { Badge, Button, Card, CardHeader, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { blogBaseUrl } from "@/lib/tenant";
import { formatDateTime } from "@/lib/utils";
import { deletePostAction, restoreRevisionAction } from "../actions";
import { loadEditorBlogs } from "../editor-data";

export const metadata = { title: "Editar post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { blog: true, postTags: { with: { tag: true } } },
  });
  if (!post) notFound();

  const [blogs, revisions, baseUrl] = await Promise.all([
    loadEditorBlogs(),
    db.select({ id: postRevisions.id, title: postRevisions.title, source: postRevisions.source, createdAt: postRevisions.createdAt }).from(postRevisions).where(eq(postRevisions.postId, id)).orderBy(desc(postRevisions.createdAt)).limit(15),
    blogBaseUrl(post.blog),
  ]);

  return (
    <>
      <PageHeader
        title="Editar post"
        description={`${post.blog.name} · atualizado ${formatDateTime(post.updatedAt)}`}
        action={
          <div className="flex items-center gap-2">
            {post.source === "mcp" && (
              <Badge color="violet">
                <Bot className="mr-1 h-3 w-3" /> Escrito pela IA
              </Badge>
            )}
            <StatusBadge status={post.status} />
            {post.status === "published" && (
              <a href={`${baseUrl}/${post.slug}`} target="_blank" className={buttonClass("outline", "sm")}>
                <ExternalLink className="h-4 w-4" /> Ver
              </a>
            )}
            <form action={deletePostAction.bind(null, post.id)}>
              <Button variant="ghost" size="sm" aria-label="Excluir post">
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          </div>
        }
      />
      <PostEditor
        blogs={blogs}
        post={{
          id: post.id,
          blogId: post.blogId,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          contentMd: post.contentMd,
          coverImage: post.coverImage,
          coverAlt: post.coverAlt,
          status: post.status,
          publishAt: post.publishAt?.toISOString() ?? null,
          seoTitle: post.seoTitle,
          metaDescription: post.metaDescription,
          focusKeyword: post.focusKeyword,
          secondaryKeywords: post.secondaryKeywords,
          categoryId: post.categoryId,
          canonicalUrl: post.canonicalUrl,
          noindex: post.noindex,
          faq: post.faq,
          affiliateProducts: post.affiliateProducts,
          sources: post.sources,
          tags: post.postTags.map((pt) => pt.tag.name),
        }}
      />
      {revisions.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Histórico de revisões" description="Versões anteriores do texto. Restaurar cria uma nova revisão." />
          <ul className="divide-y text-sm">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
                <span className="min-w-0 truncate">
                  {formatDateTime(r.createdAt)} · {r.source === "mcp" ? "IA" : "manual"} · <span className="text-muted-foreground">{r.title}</span>
                </span>
                <form action={restoreRevisionAction.bind(null, post.id, r.id)}>
                  <Button variant="ghost" size="sm">Restaurar</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
