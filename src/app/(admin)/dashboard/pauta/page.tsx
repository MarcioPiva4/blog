import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, posts, topicQueue, type TopicStatus } from "@/db/schema";
import { TopicManager } from "@/components/admin/topic-manager";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Pauta" };

const STATUSES: TopicStatus[] = ["idea", "assigned", "written", "published", "discarded"];

export default async function TopicsPage({ searchParams }: { searchParams: Promise<{ blog?: string; status?: string }> }) {
  const sp = await searchParams;
  const blogList = await db
    .select({
      id: blogs.id,
      name: blogs.name,
      brandColor: blogs.brandColor,
      queued: sql<number>`(select count(*) from topic_queue q where q.blog_id = ${blogs.id} and q.status = 'idea')::int`,
    })
    .from(blogs)
    .orderBy(asc(blogs.id));

  if (!blogList.length) {
    return (
      <>
        <PageHeader title="Pauta" />
        <EmptyState title="Crie um blog primeiro." />
      </>
    );
  }
  const blog = blogList.find((b) => b.id === Number(sp.blog)) ?? blogList[0];

  const topics = await db
    .select({
      id: topicQueue.id,
      keyword: topicQueue.keyword,
      title: topicQueue.title,
      intent: topicQueue.intent,
      cluster: topicQueue.cluster,
      notes: topicQueue.notes,
      status: topicQueue.status,
      assignedAt: topicQueue.assignedAt,
      updatedAt: topicQueue.updatedAt,
      postId: topicQueue.postId,
      postTitle: posts.title,
      postStatus: posts.status,
    })
    .from(topicQueue)
    .leftJoin(posts, eq(posts.id, topicQueue.postId))
    .where(eq(topicQueue.blogId, blog.id))
    .orderBy(desc(topicQueue.priority), asc(topicQueue.id))
    .limit(2000);

  return (
    <>
      <PageHeader title="Pauta" description="Temas que a IA vai escrever. Ela pega sempre a primeira pauta da fila de cada blog (get_next_topic)." />
      <TopicManager
        key={blog.id}
        blogs={blogList}
        blogId={blog.id}
        topics={topics}
        initialStatus={(STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as TopicStatus) : "idea"}
      />
    </>
  );
}
