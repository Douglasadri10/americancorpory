// src/components/AdminLayout.tsx
import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { logout } = useAuth();
  const { pathname } = useRouter();

  const navLinks = [
    { label: "Visão geral", href: "/admin" },
    { label: "Rotas", href: "/admin/rota" },
    { label: "Pagamentos", href: "/admin/pagamentos" },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">
            <Image
              src="/IMG_1423.PNG"
              alt="American Corpory"
              width={52}
              height={52}
              priority
            />
          </span>
          <div className="admin-brand-copy">
            <span className="admin-brand-title">American Corpory</span>
            <p className="admin-brand-sub">Painel administrativo</p>
          </div>
        </div>

        <nav className="admin-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`admin-nav-link ${
                isActive(link.href) ? "active" : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-topbar-tag">Dashboard</span>
            <h1>{title}</h1>
          </div>
          <nav className="admin-topbar-links">
            {navLinks.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`admin-topbar-link ${
                  isActive(link.href) ? "active" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button className="btn primary" onClick={logout}>
              Sair
            </button>
          </nav>
        </header>

        <main className="admin-content">{children}</main>

        <footer className="admin-footer">M&D Solutions — Admin</footer>
      </div>
    </div>
  );
}
