import type { Metadata } from "next";
import { fontVars } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Painel · Rede de Blogs", template: "%s · Painel" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`admin ${fontVars}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
