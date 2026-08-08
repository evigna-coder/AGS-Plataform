import { useEffect, useState } from 'react';
import { auth } from '../services/authService';
import type { FirebaseService, AgendaOTDelDia } from '../services/firebaseService';

/**
 * Único rol que ve la agenda completa del día: `admin`.
 *
 * OJO con los nombres (aclaración del usuario, 2026-08-08): `admin_soporte` es
 * el ADMINISTRATIVO de soporte, no un administrador; y `admin_ing_soporte`
 * tampoco. Los dos ven sólo sus propias visitas.
 */
const ROLES_SUPERVISION = ['admin'];

export interface OTsDelDiaResult {
  items: AgendaOTDelDia[];
  /** true si se están viendo las visitas de TODOS (usuario admin). */
  supervision: boolean;
}

/**
 * OTs agendadas para el mismo día del reporte que el ingeniero está cargando
 * (pedido 2026-08-08: estando en el reporte, poder ver y saltar a las otras OT
 * del día sin volver al portal → Mis OT → entrar).
 *
 * Todos ven sólo las suyas: mostrarle a un técnico las visitas de sus compañeros
 * en una app de campo es ruido. La ÚNICA excepción es el rol `admin`
 * (2026-08-08), que entra a un reporte ajeno para revisar y con el filtro por
 * ingeniero le quedaba el panel siempre vacío.
 *
 * Lectura one-shot: la agenda del día ya está armada cuando el ingeniero sale a
 * la calle y no cambia mientras trabaja; un onSnapshot abierto todo el día sería
 * costo sin beneficio en un equipo de campo con datos móviles.
 *
 * Si algo falla (sin sesión, sin permisos, sin agenda) devuelve lista vacía y el
 * panel no se muestra: es una ayuda de navegación, nunca puede trabar el reporte.
 */
export function useOTsDelDia(firebase: FirebaseService, fecha: string): OTsDelDiaResult {
  const [result, setResult] = useState<OTsDelDiaResult>({ items: [], supervision: false });

  useEffect(() => {
    let vigente = true;
    const user = auth.currentUser;
    if (!user || !fecha) {
      setResult({ items: [], supervision: false });
      return;
    }
    (async () => {
      const rol = await firebase.getRolUsuario(user.uid);
      const esSupervision = !!rol && ROLES_SUPERVISION.includes(rol);

      // `agendaEntries` referencia al ingeniero por uid o por doc id de
      // `ingenieros` según cómo se haya creado la entrada — se piden los dos.
      const ingeniero = user.email ? await firebase.getIngenieroByEmail(user.email) : null;
      const ids = [user.uid, ingeniero?.id].filter((x): x is string => !!x);

      // Sin ids el servicio devuelve el día completo: es el modo supervisión.
      const data = await firebase.getAgendaDelDia(esSupervision ? [] : ids, fecha);
      if (vigente) setResult({ items: data, supervision: esSupervision });
    })().catch(() => { if (vigente) setResult({ items: [], supervision: false }); });
    return () => { vigente = false; };
  }, [firebase, fecha]);

  return result;
}
