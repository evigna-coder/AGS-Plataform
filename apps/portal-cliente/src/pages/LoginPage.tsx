import { useState, type FormEvent } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoginBrandPanel } from '@/components/login/LoginBrandPanel';
import { GoogleGlyph } from '@/components/login/GoogleGlyph';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const { login, loginWithGoogle, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      /* el mensaje de error se muestra vía contexto */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-app">
      <LoginBrandPanel />

      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <img src="/logo-ags.svg" alt="AGS Analítica" className="mb-9 h-14 w-auto" />

          <div className="mb-7 flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] font-semibold text-ink">Iniciar sesión</h1>
            <p className="text-sm text-ink-soft">Ingresá con tu cuenta de cliente de AGS.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-bg px-3.5 py-3 text-[13px] text-danger">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input
              id="email"
              type="email"
              label="EMAIL"
              required
              autoComplete="email"
              placeholder="tu@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-[17px] w-[17px]" />}
            />
            <Input
              id="password"
              type={showPw ? 'text' : 'password'}
              label="CONTRASEÑA"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-[17px] w-[17px]" />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-ink-faint transition-colors hover:text-ink-soft"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPw ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                </button>
              }
            />
            <div className="flex justify-end">
              <a href="#" className="text-[13px] font-medium text-teal-600 hover:text-teal-700">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <Button
              type="submit"
              block
              disabled={submitting}
              icon={submitting ? <Loader2 className="h-[17px] w-[17px] animate-spin" /> : undefined}
            >
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[11px] text-ink-faint">O</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Button
            variant="secondary"
            block
            onClick={() => {
              void loginWithGoogle().catch(() => {});
            }}
            icon={<GoogleGlyph />}
          >
            Continuar con Google
          </Button>

          <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
            Acceso exclusivo para clientes de AGS Analítica.
            <br />
            ¿No tenés cuenta? Contactá a tu representante.
          </p>
        </div>
      </div>
    </div>
  );
}
