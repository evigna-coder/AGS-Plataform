import { useEffect, useState } from 'react';
import { auth } from '../services/authService';
import type { FirebaseService, AgendaOTDelDia } from '../services/firebaseService';

/**
 * OTs que el ingeniero logueado tiene agendadas para el mismo día del reporte
 * que está cargando (pedido 2026-08-08: estando en el reporte, poder ver y
 * saltar a las otras OT del día sin volver al portal → Mis OT → entrar).
 *
 * Lectura one-shot: la agenda del día ya está armada cuando el ingeniero sale
 * a la calle y no cambia mientras trabaja; un onSnapshot abierto todo el día
 * sería un costo sin beneficio en un equipo de campo con datos móviles.
 *
 * Si algo falla (sin sesión, sin permisos, sin agenda) devuelve lista vacía y
 * el panel no se muestra: es una ayuda de navegación, nunca puede trabar el
 * reporte.
 */
export function useOTsDelDia(firebase: FirebaseService, fecha: string): AgendaOTDelDia[] {
  const [items, setItems] = useState<AgendaOTDelDia[]>([]);

  useEffect(() => {
    let vigente = true;
    const user = auth.currentUser;
    if (!user || !fecha) {
      setItems([]);
      return;
    }
    (async () => {
      // `agendaEntries` referencia al ingeniero por uid o por doc id de
      // `ingenieros` según cómo se haya creado la entrada — se piden los dos.
      const ingeniero = user.email ? await firebase.getIngenieroByEmail(user.email) : null;
      const ids = [user.uid, ingeniero?.id].filter((x): x is string => !!x);
      const data = await firebase.getAgendaDelDia(ids, fecha);
      if (vigente) setItems(data);
    })().catch(() => { if (vigente) setItems([]); });
    return () => { vigente = false; };
  }, [firebase, fecha]);

  return items;
}
