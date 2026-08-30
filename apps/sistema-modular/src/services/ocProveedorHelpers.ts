import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import type { Lead, OrdenCompra, Posta, TicketArea, TicketEstado } from '@ags/shared';
import { TICKET_ESTADO_ORDER } from '@ags/shared';
import { db, getCurrentUserTrace } from './firebase';
import { adminConfigService } from './adminConfigService';
import { usuariosService } from './personalService';
import { leadsService } from './leadsService';

/**
 * Side-effects del PRIMER envío de una OC interna al proveedor (colección
 * `ordenes_compra`). Invocado por `ordenesCompraService.update` vía import
 * dinámico, en la transición borrador → enviada_proveedor — venga del modal de
 * envío (markEnviada), del cambio manual de estado (OCStatusTransition, el caso
 * común: la OC se manda por mail afuera del sistema) o de cualquier flujo futuro.
 *
 * Qué hace (decisión 2026-08-30 — antes el circuito moría en `oc_recibida`):
 *   1. Tickets vinculados (vía `presupuestoIds` de la OC) avanzan a
 *      `espera_importacion` y se derivan a Materiales (`usuarioMaterialesId`),
 *      que coordina embarque y seguimiento — la importación la crea Materiales
 *      desde la OC, por eso el aviso sale acá y no espera a la impo.
 *   2. Coordinación (`usuarioCoordinadorOTId`) recibe un ticket de aviso
 *      separado: los artículos del/los presupuesto(s) llegan en esta OC.
 *
 * Best-effort en cada paso: sin config, usuario inactivo o error de red, el
 * envío de la OC ya quedó committeado y esto solo loguea. Una OC sin
 * presupuestos vinculados (reposición de stock) no dispara nada.
 */
export async function notificarEnvioOCProveedor(oc: OrdenCompra): Promise<void> {
  // Presupuestos vinculados: `oc.presupuestoIds` es legacy y la OC generada desde
  // requerimientos (useGenerarOC) no lo estampa — la fuente real del vínculo son
  // los requerimientos de la OC (`presupuestoId`, u `origenRef` si nació de un
  // presupuesto).
  const pptoIdSet = new Set((oc.presupuestoIds ?? []).filter(Boolean));
  try {
    const reqSnap = await getDocs(query(
      collection(db, 'requerimientos_compra'),
      where('ordenCompraId', '==', oc.id),
    ));
    for (const d of reqSnap.docs) {
      const req = d.data() as any;
      if (req.presupuestoId) pptoIdSet.add(req.presupuestoId as string);
      else if (req.origen === 'presupuesto' && req.origenRef) pptoIdSet.add(req.origenRef as string);
    }
  } catch (err) {
    console.warn('[notificarEnvioOCProveedor] query de requerimientos falló:', err);
  }
  const pptoIds = [...pptoIdSet];
  if (pptoIds.length === 0) {
    console.warn(`[notificarEnvioOCProveedor] OC ${oc.numero} sin presupuestos vinculados — sin avisos`);
    return;
  }

  const cfg = await adminConfigService.getWithDefaults();
  const resolver = async (uid?: string | null) => {
    if (!uid) return null;
    const u = await usuariosService.getById(uid).catch(() => null);
    return u && u.status === 'activo' ? { id: u.id, nombre: u.displayName ?? '' } : null;
  };
  const materiales = await resolver(cfg.usuarioMaterialesId);
  const coordinador = await resolver(cfg.usuarioCoordinadorOTId);

  // Números y cliente de los presupuestos vinculados, para los textos.
  const pptos: { id: string; numero: string; clienteId: string | null }[] = [];
  for (const pid of pptoIds) {
    const snap = await getDoc(doc(db, 'presupuestos', pid)).catch(() => null);
    if (snap?.exists()) {
      const d = snap.data() as any;
      pptos.push({ id: pid, numero: (d.numero as string) || pid, clienteId: (d.clienteId as string) ?? null });
    }
  }
  const pptoLabel = pptos.map(p => p.numero).join(', ') || 'presupuesto vinculado';
  const trace = getCurrentUserTrace();

  // ── 1. Tickets de seguimiento → espera_importacion + derivación a Materiales ──
  const targetIdx = TICKET_ESTADO_ORDER.indexOf('espera_importacion');
  const vistos = new Set<string>();
  for (const pid of pptoIds) {
    let docsSnap;
    try {
      docsSnap = await getDocs(query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', pid)));
    } catch (err) {
      console.warn('[notificarEnvioOCProveedor] query de tickets falló:', err);
      continue;
    }
    for (const d of docsSnap.docs) {
      if (vistos.has(d.id)) continue;
      vistos.add(d.id);
      const lead = { id: d.id, ...(d.data() as any) } as Lead;
      if (lead.estado === 'finalizado' || lead.estado === 'no_concretado') continue;

      // Order guard: nunca retroceder un ticket que ya está más adelante
      // (en_coordinacion, ot_creada, …) — en ese caso solo posta informativa.
      const currentIdx = TICKET_ESTADO_ORDER.indexOf(lead.estado);
      const avanza = currentIdx >= 0 && currentIdx < targetIdx;
      const deriva = avanza && !!materiales && materiales.id !== lead.asignadoA;
      const comentario = deriva
        ? `OC ${oc.numero} enviada al proveedor · derivado a ${materiales!.nombre} (Materiales)`
        : `OC ${oc.numero} enviada al proveedor`;
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: trace?.uid ?? 'system',
        deUsuarioNombre: trace?.name ?? 'Sistema',
        aUsuarioId: deriva ? materiales!.id : (lead.asignadoA || ''),
        aUsuarioNombre: deriva ? materiales!.nombre : (lead.asignadoNombre || ''),
        comentario,
        estadoAnterior: lead.estado,
        estadoNuevo: avanza ? ('espera_importacion' as TicketEstado) : lead.estado,
      };
      const updates: Partial<Lead> = {
        postas: [...(lead.postas || []), posta],
        ultimaObservacion: comentario,
      };
      if (avanza) {
        updates.estado = 'espera_importacion';
        if (materiales) {
          updates.asignadoA = materiales.id;
          updates.asignadoNombre = materiales.nombre;
          // Materiales pertenece a Administración de Soporte (no existe sector
          // "compras" ni va a Administración — corrección 2026-08-30).
          updates.areaActual = 'admin_soporte' as TicketArea;
          updates.accionPendiente = `Coordinar embarque y seguimiento de OC ${oc.numero}`;
        }
      }
      await leadsService.update(lead.id, updates as any)
        .catch(err => console.warn(`[notificarEnvioOCProveedor] update ticket ${lead.id} falló:`, err));
    }
  }

  // ── 2. Ticket de aviso a Coordinación (uno por OC) ──
  if (!coordinador) return;
  const clienteId = pptos.find(p => p.clienteId)?.clienteId ?? null;
  let razonSocial = '';
  if (clienteId) {
    try {
      const cliSnap = await getDoc(doc(db, 'clientes', clienteId));
      razonSocial = cliSnap.exists() ? ((cliSnap.data() as any).razonSocial as string) ?? '' : '';
    } catch { /* aviso sale sin razón social */ }
  }
  try {
    await leadsService.create({
      clienteId,
      contactoId: null,
      razonSocial,
      contactos: [],
      contacto: '',
      email: '',
      telefono: '',
      motivoLlamado: 'administracion',
      motivoContacto: `Artículos en camino — OC ${oc.numero}`,
      descripcion: `Aviso automático: la OC ${oc.numero} (${oc.proveedorNombre}) se envió al proveedor. Los artículos de ${pptoLabel} llegan en esa orden.`,
      ultimaObservacion: `Artículos de ${pptoLabel} llegan en OC ${oc.numero}`,
      sistemaId: null,
      moduloId: null,
      estado: 'nuevo' as TicketEstado,
      postas: [],
      asignadoA: coordinador.id,
      asignadoNombre: coordinador.nombre,
      derivadoPor: null,
      areaActual: 'agenda_coordinacion' as TicketArea,
      esAutogenerado: true,
      accionPendiente: `Planificar OT — artículos de ${pptoLabel} llegan en OC ${oc.numero}`,
      adjuntos: [],
      presupuestosIds: pptoIds,
      otIds: [],
      finalizadoAt: null,
      prioridad: 'normal',
      proximoContacto: null,
      valorEstimado: null,
    } as any);
  } catch (err) {
    console.warn('[notificarEnvioOCProveedor] ticket de aviso a coordinación falló:', err);
  }
}
