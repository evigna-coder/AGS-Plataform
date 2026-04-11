import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFloatingPresupuesto } from '../../contexts/FloatingPresupuestoContext';
import { presupuestosService } from '../../services/presupuestosService';

/**
 * Entry point for direct URL access (/presupuestos/:id).
 * Verifies the presupuesto exists, opens the floating modal, and redirects to
 * the list. If the id is invalid or the presupuesto was deleted, shows an
 * alert and redirects without opening a ghost modal.
 */
export const PresupuestoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { open } = useFloatingPresupuesto();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!id) {
        navigate('/presupuestos', { replace: true });
        return;
      }
      try {
        const presupuesto = await presupuestosService.getById(id);
        if (cancelled) return;
        if (!presupuesto) {
          alert('El presupuesto no existe o fue eliminado.');
          navigate('/presupuestos', { replace: true });
          return;
        }
        open(id);
        navigate('/presupuestos', { replace: true });
      } catch (err) {
        if (cancelled) return;
        console.error('Error cargando presupuesto por URL:', err);
        alert('Error al cargar el presupuesto.');
        navigate('/presupuestos', { replace: true });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [id]);

  return null;
};
