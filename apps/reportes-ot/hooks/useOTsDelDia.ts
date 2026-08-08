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
  /** Día efectivamente consultado (el agendado de la OT, o el del reporte). */
  fecha: string;
}

/**
 * OTs agendadas para el mismo día que la OT que el ingeniero está cargando
 * (pedido 2026-08-08: estando en el reporte, poder ver y saltar a las otras OT
 * del día sin volver al portal → Mis OT → entrar).
 *
 * El día sale de la AGENDA de la OT actual, no del campo INICIO del reporte
 * (fix 2026-08-08). El campo del formulario arrastra la fecha de creación o el
 * default, así que abriendo una OT agendada el 10 se listaban las visitas del 5
 * — siempre las mismas, sin importar qué OT se abriera. Si la OT no está
 * agendada, se cae a la fecha del reporte.
 *
 * Un TÉCNICO ve sólo las suyas: mostrarle las visitas de sus compañeros en una
 * app de campo es ruido. El rol `admin` ve todas las del día.
 *
 * Lectura one-shot: la agenda del día ya está armada cuando el ingeniero sale a
 * la calle y no cambia mientras trabaja.
 *
 * Si algo falla (sin sesión, sin permisos, sin agenda) devuelve lista vacía y el
 * panel no se muestra: es una ayuda de navegación, nunca puede trabar el reporte.
 */
export function useOTsDelDia(
  firebase: FirebaseService,
  otNumber: string,
  fechaReporte: string,
): OTsDelDiaResult {
  const [result, setResult] = useState<OTsDelDiaResult>({ items: [], supervision: false, fecha: '' });

  useEffect(() => {
    let vigente = true;
    const user = auth.currentUser;
    if (!user || (!otNumber && !fechaReporte)) {
      setResult({ items: [], supervision: false, fecha: '' });
      return;
    }
    (async () => {
      // El día real del trabajo: el agendado. La fecha del reporte es el fallback.
      const fechaAgenda = otNumber ? await firebase.getFechaAgendaDeOT(otNumber) : null;
      const fecha = fechaAgenda || fechaReporte;
      if (!fecha) { if (vigente) setResult({ items: [], supervision: false, fecha: '' }); return; }

      const rol = await firebase.getRolUsuario(user.uid);
      const esSupervision = !!rol && ROLES_SUPERVISION.includes(rol);

      // `agendaEntries` referencia al ingeniero por uid o por doc id de
      // `ingenieros` según cómo se haya creado la entrada — se piden los dos.
      const ingeniero = user.email ? await firebase.getIngenieroByEmail(user.email) : null;
      const ids = [user.uid, ingeniero?.id].filter((x): x is string => !!x);

      // Sin ids el servicio devuelve el día completo: es el modo supervisión.
      const data = await firebase.getAgendaDelDia(esSupervision ? [] : ids, fecha);
      if (vigente) setResult({ items: data, supervision: esSupervision, fecha });
    })().catch(() => { if (vigente) setResult({ items: [], supervision: false, fecha: '' }); });
    return () => { vigente = false; };
  }, [firebase, otNumber, fechaReporte]);

  return result;
}
