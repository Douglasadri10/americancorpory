// src/components/RedefinirSenhaModal.tsx
import { useEffect, useRef, useState } from "react";

type Props = {
  onClose: () => void;
  onConfirm: (newPass: string) => Promise<void>;
  obrigatorio?: boolean; // se true, esconde botão "Sair"
};

export default function RedefinirSenhaModal({
  onClose,
  onConfirm,
  obrigatorio = false,
}: Props) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string>("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // foca no primeiro input quando abrir
    inputRef.current?.focus();
  }, []);

  async function handleSalvar() {
    setErr("");

    if (!p1 || p1.length < 8) {
      setErr("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (p1 !== p2) {
      setErr("As senhas não coincidem.");
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm(p1); // quem chama faz updatePassword + updateDoc flags
      onClose(); // fecha (ou use reload no pai, se quiser)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao redefinir senha.";
      setErr(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSalvar();
  }

  return (
    <div className="gate" role="dialog" aria-modal="true">
      <div className="card" onKeyDown={handleKeyDown}>
        <h1>Redefinir senha</h1>
        <p className="sub">
          Por segurança, defina uma nova senha para continuar.
        </p>

        <label>Nova senha</label>
        <input
          ref={inputRef}
          type="password"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          disabled={submitting}
        />

        <label>Confirmar nova senha</label>
        <input
          type="password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          disabled={submitting}
        />

        {err && <div className="error">{err}</div>}

        <div className="actions">
          {!obrigatorio && (
            <button
              className="btn ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Sair
            </button>
          )}
          <button
            className="btn primary"
            onClick={handleSalvar}
            disabled={submitting}
          >
            {submitting ? "Salvando..." : "Salvar senha"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .gate {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: rgba(17, 24, 39, 0.75);
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .card {
          width: 100%;
          max-width: 520px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
          padding: 22px;
        }
        h1 {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 800;
          color: #111827;
        }
        .sub {
          margin: 0 0 14px;
          color: #6b7280;
          font-size: 14px;
        }
        label {
          display: block;
          margin: 10px 0 6px;
          font-size: 13px;
          color: #374151;
        }
        input {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          outline: none;
        }
        input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        }
        .error {
          margin-top: 10px;
          color: #b91c1c;
          font-size: 13px;
        }
        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 16px;
        }
        .btn {
          height: 38px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
        }
        .btn.primary {
          background: #111827;
          border-color: #111827;
          color: #fff;
        }
        .btn.ghost {
          background: #fff;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
