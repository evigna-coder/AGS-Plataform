import type { ReactNode } from 'react';
import type { UserRole } from '@ags/shared';
import { useAuth } from '../../contexts/AuthContext';
import { AccessDeniedPage } from '../../pages/auth/AccessDeniedPage';

interface Props {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<Props> = ({ children, allowedRoles }) => {
  const { hasRole } = useAuth();

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
};
