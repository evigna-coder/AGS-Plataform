import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { UsuarioAGS, UserRole, ModuloId } from '@ags/shared';
import { canAccessModulo as _canAccessModulo } from '@ags/shared';
import { onAuthStateChanged, isAllowedDomain, signOut } from '../services/authService';
import { usuariosService } from '../services/firebaseService';
import { setCurrentUser } from '../services/currentUser';

interface AuthContextValue {
  firebaseUser: User | null;
  usuario: UsuarioAGS | null;
  loading: boolean;
  authError: string | null;
  /** Email rechazado por dominio incorrecto (para mostrar en LoginPage). null = sin error de dominio. */
  domainError: string | null;
  isAuthenticated: boolean;
  isPending: boolean;
  isDisabled: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  /** Verifica si el usuario puede acceder a un módulo */
  canAccess: (modulo: ModuloId) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  usuario: null,
  loading: true,
  authError: null,
  domainError: null,
  isAuthenticated: false,
  isPending: false,
  isDisabled: false,
  hasRole: () => false,
  canAccess: () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<UsuarioAGS | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(
        async (user) => {
          setFirebaseUser(user);
          if (user && isAllowedDomain(user)) {
            setDomainError(null);
            try {
              const uData = await usuariosService.upsertOnLogin({
                uid: user.uid,
                email: user.email!,
                displayName: user.displayName || user.email!,
                photoURL: user.photoURL,
              });
              setUsuario(uData);
              setCurrentUser(uData);
            } catch (err) {
              console.error('Error en upsertOnLogin:', err);
              setUsuario(null);
              setCurrentUser(null);
            }
          } else {
            if (user && !isAllowedDomain(user)) {
              setDomainError(user.email ?? 'cuenta sin email');
              await signOut();
            }
            setUsuario(null);
            setCurrentUser(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error('Firebase Auth listener error:', err);
          setAuthError(
            'Error de Firebase Authentication: ' + err.message +
            '. Ve a Firebase Console > Authentication > Sign-in method > Google y habilitalo.'
          );
          setLoading(false);
        },
      );
    } catch (err) {
      console.error('Firebase Auth error:', err);
      setAuthError(
        'Firebase Authentication no esta configurado. Ve a Firebase Console > Authentication > Sign-in method > Google y habilitalo.'
      );
      setLoading(false);
    }
    return () => unsub?.();
  }, []);

  const isAuthenticated = !!usuario && usuario.status === 'activo' && usuario.role !== null;
  const isPending = !!usuario && (usuario.status === 'pendiente' || (usuario.status === 'activo' && usuario.role === null));
  const isDisabled = !!usuario && usuario.status === 'deshabilitado';

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!isAuthenticated || !usuario?.role) return false;
    return roles.includes(usuario.role);
  };

  const canAccess = (modulo: ModuloId): boolean => {
    if (!isAuthenticated || !usuario) return false;
    return _canAccessModulo(usuario, modulo);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, usuario, loading, authError, domainError, isAuthenticated, isPending, isDisabled, hasRole, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
};
