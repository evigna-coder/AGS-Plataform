import { useEffect, useMemo, useState } from 'react';
import { ingenierosService } from '../services/firebaseService';

interface IngenieroLite { id: string; usuarioId: string | null; email: string | null }

let cache: IngenieroLite[] | null = null;
let inflight: Promise<IngenieroLite[]> | null = null;

function loadIngenieros(): Promise<IngenieroLite[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = ingenierosService.getAll().then(list => {
      cache = list.map(i => ({ id: i.id, usuarioId: i.usuarioId, email: i.email }));
      return cache;
    });
  }
  return inflight;
}

/**
 * Resuelve el doc id de `ingenieros` correspondiente a un usuario (uid o email).
 * Varias colecciones de stock (unidades, asignaciones, agendaEntries) referencian
 * al ingeniero por su doc id, mientras que `reportes` usa el uid del usuario.
 */
export function useIngenieroDocId(usuarioId: string | null | undefined, email?: string | null) {
  const [ingenieros, setIngenieros] = useState<IngenieroLite[]>(cache ?? []);
  const [loaded, setLoaded] = useState(!!cache);

  useEffect(() => {
    let active = true;
    loadIngenieros().then(list => {
      if (!active) return;
      setIngenieros(list);
      setLoaded(true);
    }).catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const ingenieroDocId = useMemo(() => {
    if (!usuarioId) return null;
    const byUid = ingenieros.find(i => i.usuarioId === usuarioId);
    if (byUid) return byUid.id;
    if (email) {
      const lower = email.toLowerCase();
      const byEmail = ingenieros.find(i => (i.email || '').toLowerCase() === lower);
      if (byEmail) return byEmail.id;
    }
    return null;
  }, [ingenieros, usuarioId, email]);

  return { ingenieroDocId, loaded };
}
