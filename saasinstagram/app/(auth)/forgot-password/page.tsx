'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar o email. Verifique o endereço e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(124,58,237,0.08)_0%,_transparent_60%)] pointer-events-none" />

      <div className="w-full max-w-[380px] animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden">
            <Image src="/logo.png" alt="HannaAI" width={64} height={64} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">HannaAI</h1>
          <p className="text-sm text-text-muted mt-1">Atendimento omnichannel com IA</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-modal">
          {sent ? (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={22} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">Email enviado</h2>
              <p className="text-sm text-text-muted mb-6">
                Se o endereço <span className="font-medium text-text-secondary">{email}</span> estiver cadastrado,
                você receberá as instruções para redefinir sua senha em alguns minutos.
              </p>
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                <ArrowLeft size={14} />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-text-primary mb-1">Esqueceu a senha?</h2>
              <p className="text-sm text-text-muted mb-6">
                Informe seu email e enviaremos um link para redefinir sua senha.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                  fullWidth
                />

                <Button type="submit" fullWidth loading={isLoading} disabled={!email}>
                  Enviar link de redefinição
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
                >
                  <ArrowLeft size={14} />
                  Voltar para o login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
