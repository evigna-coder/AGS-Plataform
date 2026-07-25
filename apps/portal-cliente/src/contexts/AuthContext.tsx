import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { loginEmail, loginGoogle, logoutFirebase, mapAuthError } from '@/services/authService';
import type { ClientePortal } from '@/data/types';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Login BÁSICO: derivamos la identidad del usuario de Firebase Auth.
 * TODO(auth): cuando se defina el método de validación de cuentas, leer del token
 * los claims `{ role:'client', clienteId, establecimientoIds }` (setClientClaims) y
 * mapear el `ClientePortal` real (razón social del `clientes/{clienteId}`), además de
 * exigir `email_verified`. Hoy no hay gating de rol/tenant.
 */
function toCliente(u: User): ClientePortal {
  const nombre = u.displayName || u.email || 'Cliente';
  // establecimientosCount se conocerá al leer los datos reales del cliente (Firestore).
  return { id: u.uid, razonSocial: nombre, iniciales: initials(nombre), establecimientosCount: 0 };
}

interface AuthState {
  cliente: ClientePortal | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<ClientePortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setCliente(u ? toCliente(u) : null);
        setLoading(false);
      },
      (err) => {
        setError(mapAuthError(err));
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await loginEmail(email, password);
    } catch (e) {
      setError(mapAuthError(e));
      throw e;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await loginGoogle();
    } catch (e) {
      setError(mapAuthError(e));
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    void logoutFirebase();
  }, []);

  const value: AuthState = {
    cliente,
    isAuthenticated: cliente !== null,
    loading,
    error,
    login,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
