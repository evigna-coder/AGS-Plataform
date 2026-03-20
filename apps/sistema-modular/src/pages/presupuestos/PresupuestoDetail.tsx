import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFloatingPresupuesto } from '../../contexts/FloatingPresupuestoContext';

/**
 * Fallback page for direct URL access (/presupuestos/:id).
 * Opens the floating presupuesto modal via context, then navigates back to list.
 */
export const PresupuestoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { open } = useFloatingPresupuesto();

  useEffect(() => {
    if (id) {
      open(id);
      navigate('/presupuestos', { replace: true });
    } else {
      navigate('/presupuestos', { replace: true });
    }
  }, [id]);

  return null;
};
