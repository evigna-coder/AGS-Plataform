import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { UserRole, ModuloId } from '@ags/shared';
import { canAccessModulo, getModuloFromPath } from '@ags/shared';
import { useAuth } from '../../contexts/AuthContext';
import { AccessDeniedPage } from '../../pages/auth/AccessDeniedPage';

interface Props {
  children: ReactNode;
  /** @deprecated Usar el sistema de permisos por módulo en vez de allowedRoles */
  allowedRoles?: UserRole[];
  /** Módulo requerido — si no se pasa, se infiere de la ruta */
  modulo?: ModuloId;
}

export const ProtectedRoute: React.FC<Props> = ({ children, allowedRoles, modulo }) => {
  const { usuario, hasRole } = useAuth();
  const { pathname } = useLocation();

  if (!usuario) return <AccessDeniedPage />;

  // Permisos por módulo: si se pasa explícito o se infiere de la ruta
  const moduloTarget = modulo ?? getModuloFromPath(pathname);
  if (moduloTarget) {
    if (!canAccessModulo(usuario, moduloTarget)) {
      return <AccessDeniedPage />;
    }
    return <>{children}</>;
  }

  // Fallback legacy: allowedRoles (para rutas sin módulo mapeado)
  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
};
