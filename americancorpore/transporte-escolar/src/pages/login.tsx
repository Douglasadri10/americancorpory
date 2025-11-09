import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login, user, loading, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      setError("");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : err instanceof Error
          ? err.message
          : "Falha ao entrar";
      setError(message);
      alert(message);
    }
  };

  useEffect(() => {
    if (!loading && user && user.tipo) {
      console.log("🚀 Tipo do usuário:", user.tipo);

      switch (user.tipo) {
        case "admin":
          router.push("/admin");
          break;
        case "pai":
          router.push("/responsavel");
          break;
        case "motorista":
          router.push("/motorista");
          break;
        default:
          console.warn("Tipo de usuário desconhecido:", user.tipo);
          logout(); // força logout se o tipo estiver corrompido
          break;
      }
    }
  }, [user, loading, router, logout]);
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Carregando usuário...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-lg rounded-xl p-8 w-full max-w-md"
      >
        <h1 className="text-2xl font-bold mb-4 text-center">Login</h1>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          className="w-full p-2 border rounded mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          Entrar
        </button>

        <p className="text-center mt-4">
          Ainda não tem conta?{" "}
          <Link
            href="/signup"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Criar agora
          </Link>
        </p>
      </form>
    </div>
  );
}
