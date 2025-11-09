import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";

type Props = { title?: string; children: React.ReactNode };

export default function ParentLayout({ title, children }: Props) {
  const { logout } = useAuth();
  const { pathname } = useRouter();

  const isActive = (href: string) => (pathname === href ? "active" : "");

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <Image
            src="/IMG_1423.PNG"
            alt="American Corpory"
            width={44}
            height={44}
            priority
          />
          <div className="brand-text">
            <span>American Corpory</span>
            <small>Portal do responsável</small>
          </div>
        </div>
        <nav className="nav">
          <Link
            className={isActive("/responsavel")}
            href="/responsavel"
          >
            Visão geral
          </Link>
          <Link
            className={isActive("/responsavel/mensagens")}
            href="/responsavel/mensagens"
          >
            Mensagens
          </Link>
          <Link
            className={isActive("/responsavel/regras")}
            href="/responsavel/regras"
          >
            Regras
          </Link>
        </nav>
        <button className="btn danger" onClick={logout}>
          Sair
        </button>
      </aside>

      <main className="content">
        <header className="header">
          <h1>{title || "Painel do Responsável"}</h1>
          <div className="spacer" />
          <Link className="link" href="/responsavel/mensagens">
            Mensagens
          </Link>
          <Link className="link" href="/responsavel/regras">
            Regras
          </Link>
          <button className="btn" onClick={logout}>
            Sair
          </button>
        </header>

        {children}

        <footer className="footer">M&D Solutions — Admin</footer>
      </main>
    </div>
  );
}
