import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SKYLED Admin",
  description: "Administração de projetos, estoque e financeiro",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="h-screen bg-[#0f1020] text-white grid grid-cols-[240px_1fr] overflow-hidden">
        <aside className="h-full sticky top-0 bg-black/50 border-r border-white/10 p-4 flex flex-col">
          <div className="text-xl font-bold mb-6">
            {process.env.NEXT_PUBLIC_COMPANY_NAME || "SKYLED"}
          </div>
          <nav className="space-y-2 text-sm">
            <Link href="/" className="btn w-full block text-left">
              Dashboard
            </Link>
            <Link href="/items" className="btn w-full block text-left">
              Itens
            </Link>
            <Link href="/warehouses" className="btn w-full block text-left">
              Depósitos
            </Link>
            <Link href="/clients" className="btn w-full block text-left">
              Clientes
            </Link>
            <Link href="/projects" className="btn w-full block text-left">
              Projetos
            </Link>
            <Link href="/stock/move" className="btn w-full block text-left">
              Movimentar Estoque
            </Link>
            <Link href="/estoque" className="btn w-full block text-left">
              Estoque
            </Link>
          </nav>
          <div className="mt-auto pt-4 text-xs opacity-70">v0.1 MVP</div>
        </aside>
        <main className="h-full overflow-y-auto p-6">{children}</main>
      </body>
    </html>
  );
}
