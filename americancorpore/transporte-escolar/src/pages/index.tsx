import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => router.replace("/login"), 2000);
    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="landing-hero">
      <div className="landing-card">
        <div className="landing-logo">
          <Image
            src="/IMG_1423.PNG"
            alt="American Corpory"
            width={72}
            height={72}
            priority
          />
          <div>
            <p>American Corpory</p>
            <small>Transporte Escolar</small>
          </div>
        </div>
        <h1>Gerencie suas rotas e famílias em um só lugar.</h1>
        <p>
          Estamos preparando o painel para você. Caso o redirecionamento não
          ocorra automaticamente, escolha o ambiente desejado abaixo.
        </p>

        <div className="landing-actions">
          <Link href="/login" className="btn primary">
            Entrar
          </Link>
          <Link href="/responsavel" className="btn ghost">
            Painel do responsável
          </Link>
        </div>
      </div>
    </div>
  );
}
