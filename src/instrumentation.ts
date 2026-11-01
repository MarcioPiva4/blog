export async function register() {
  // Em produção (Docker/Coolify) aplica as migrações pendentes no boot.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const { db } = await import("./db");
    await migrate(db, { migrationsFolder: "./drizzle" });
  }
}
