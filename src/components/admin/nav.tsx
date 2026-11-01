"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, FileText, LayoutGrid, ListTodo, Newspaper, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutGrid, exact: true },
  { href: "/dashboard/blogs", label: "Blogs", icon: Newspaper },
  { href: "/dashboard/posts", label: "Posts", icon: FileText },
  { href: "/dashboard/categorias", label: "Categorias e tags", icon: Tags },
  { href: "/dashboard/pauta", label: "Pauta", icon: ListTodo },
  { href: "/dashboard/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { href: "/dashboard/mcp", label: "Integração IA (MCP)", icon: Bot },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
