import { collection, getDocs, getDoc, query, where } from 'firebase/firestore';
import type { RequerimientoCompra } from '@ags/shared';
import { db, docRef } from './firebase';
import { esConsumoDesviado, faltanteDelPresupuesto, type UnidadParaDesvio } from '../utils/reservaDesviada';
import { notify } from '../utils/notify';

/**
 * Después de consumir una unidad en una OT (2026-10-01): si la unidad estaba
 * reservada para OTRO presupuesto, le devuelve la cobertura a ese cliente.
 * Primero intenta reservar stock libre; si no alcanza, crea un requerimiento
 * de compra por lo que falta. Avisa en pantalla qué hizo.
 *
 * Best-effort y post-commit: el consumo ya quedó; si esto falla se loguea y el
 * relevamiento lo detecta (ver utils/reservaDesviada.ts).
 */
export async function revisarConsumoDeReservada(unidadId: string | null | undefined, otNumber: string | null | undefined): Promise<void> {
  if (!unidadId || !otNumber) return;
  try {
    const uSnap = await getDoc(docRef('unidades', unidadId));
    if (!uSnap.exists()) return;
    const u = uSnap.data();
    const presupuestoId = u.reservadoParaPresupuestoId as string | undefined;
    if (!presupuestoId) return;
    const pSnap = await getDoc(docRef('presupuestos', presupuestoId));
    if (!pSnap.exists()) return;
    const ppto = pSnap.data();
    if (['anulado', 'rechazado', 'vencido'].includes(ppto.estado)) return;
    if (!esConsumoDesviado(ppto, otNumber)) return;

    const articuloId = u.articuloId as string;
    const cliente = (u.reservadoParaClienteNombre as string | undefined) || 'el cliente';
    const pptoNumero = (u.reservadoParaPresupuestoNumero as string | undefined) || ppto.numero || presupuestoId;
    const etiqueta = `${u.articuloCodigo ?? 'la parte'}`;

    // 1) Reservar stock libre para el presupuesto original, si hay.
    const { reservasService } = await import('./stockService');
    const { reservadas } = await reservasService.reservarPendientesParaPresupuesto({
      presupuestoId, articuloId, solicitadoPorNombre: 'Sistema (reserva desviada)',
    }).catch(() => ({ reservadas: 0 }));

    // 2) Lo que todavía falte: requerimiento de compra.
    const { requerimientosService } = await import('./importacionesService');
    const [unidadesSnap, reqs] = await Promise.all([
      getDocs(query(collection(db, 'unidades'), where('reservadoParaPresupuestoId', '==', presupuestoId))),
      requerimientosService.getByPresupuesto(presupuestoId).catch(() => [] as RequerimientoCompra[]),
    ]);
    const unidades = unidadesSnap.docs.map(d => d.data() as UnidadParaDesvio);
    const falta = faltanteDelPresupuesto(ppto, articuloId, unidades, reqs);
    let reqNumero: string | null = null;
    if (falta > 0) {
      const id = await requerimientosService.create({
        articuloId,
        articuloCodigo: u.articuloCodigo ?? null,
        articuloDescripcion: u.articuloDescripcion ?? etiqueta,
        cantidad: falta,
        unidadMedida: 'unidad',
        motivo: `Reposición para ${pptoNumero}: su reserva se consumió en la OT ${otNumber}`,
        origen: 'presupuesto',
        estado: 'pendiente',
        urgencia: 'alta',
        solicitadoPor: 'Sistema',
        fechaSolicitud: new Date().toISOString().slice(0, 10),
        presupuestoId,
        presupuestoNumero: pptoNumero,
        desglose: [{ concepto: 'cliente', cantidad: falta, presupuestoId, presupuestoNumero: pptoNumero, clienteNombre: cliente }],
        notas: `La unidad reservada para ${cliente} (${pptoNumero}) se consumió en la OT ${otNumber}, que no es de ese presupuesto.`,
      } as Omit<RequerimientoCompra, 'id' | 'numero' | 'createdAt' | 'updatedAt'>);
      reqNumero = (await requerimientosService.getById(id).catch(() => null))?.numero ?? null;
    }

    const partes = [
      `${etiqueta} estaba reservada para ${cliente} (${pptoNumero}) y se consumió en la OT ${otNumber}.`,
      reservadas > 0 ? `Se reservaron ${reservadas} u. libres para ${cliente}.` : null,
      reqNumero ? `Se pidió comprar ${falta} u. (${reqNumero}).` : null,
      reservadas === 0 && !reqNumero ? `${cliente} sigue cubierto con lo que ya tiene reservado o pedido.` : null,
    ].filter(Boolean);
    notify.warning(partes.join(' '));
  } catch (err) {
    console.error('[revisarConsumoDeReservada] no se pudo re-cubrir la reserva (el consumo quedó):', err);
  }
}
