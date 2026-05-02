import { useEffect, useState } from 'react';
import { sistemasService } from '../services/firebaseService';
import type { Sistema, ModuloSistema } from '@ags/shared';

/**
 * Trae el sistema y sus módulos para enriquecer la vista de detalle de OT.
 * Falla soft: si el sistemaId no existe o no se puede leer, devuelve nulls.
 */
export function useSistemaContext(sistemaId: string | null | undefined) {
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sistemaId) { setSistema(null); setModulos([]); return; }
    let active = true;
    setLoading(true);
    Promise.all([
      sistemasService.getById(sistemaId),
      sistemasService.getModulos(sistemaId),
    ]).then(([s, m]) => {
      if (!active) return;
      setSistema(s);
      setModulos(m);
    }).catch(err => {
      console.warn('[useSistemaContext] failed:', err);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sistemaId]);

  return { sistema, modulos, loading };
}
