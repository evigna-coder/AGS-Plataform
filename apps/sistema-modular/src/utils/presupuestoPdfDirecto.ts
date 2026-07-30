import type { Presupuesto, PresupuestoItem, CategoriaPresupuesto, ContactoEstablecimiento } from '@ags/shared';
import {
  clientesService,
  establecimientosService,
  contactosService,
  condicionesPagoService,
  categoriasPresupuestoService,
} from '../services/firebaseService';

/**
 * MISMO cálculo que usePresupuestoEdit.calculateTotals — el doc guarda
 * `total = subtotal` (sin impuestos) y el editor lo recalcula al generar el
 * PDF. Descargar desde la lista con el total GUARDADO producía un PDF con las
 * líneas de IVA correctas pero el TOTAL sin sumarlas (BUG CRÍTICO UAT
 * 2026-07-30: "en la vista previa suma el IVA, descargado no").
 */
function computeTotalesConImpuestos(items: PresupuestoItem[], categorias: CategoriaPresupuesto[]): { subtotal: number; total: number } {
  const catById = new Map(categorias.map(c => [c.id, c]));
  let subtotal = 0;
  let impuestos = 0;
  for (const item of items) {
    const sub = item.subtotal || 0;
    subtotal += sub;
    const cat = item.categoriaPresupuestoId ? catById.get(item.categoriaPresupuestoId) : null;
    if (!cat) continue;
    let iva = 0;
    if (cat.incluyeIva && cat.porcentajeIva) {
      iva = cat.ivaReduccion && cat.porcentajeIvaReduccion
        ? sub * (cat.porcentajeIvaReduccion / 100)
        : sub * (cat.porcentajeIva / 100);
    }
    let ganancias = 0;
    let iibb = 0;
    if (cat.incluyeGanancias && cat.porcentajeGanancias) ganancias = (sub + iva) * (cat.porcentajeGanancias / 100);
    if (cat.incluyeIIBB && cat.porcentajeIIBB) iibb = (sub + iva) * (cat.porcentajeIIBB / 100);
    impuestos += iva + ganancias + iibb;
  }
  return { subtotal, total: subtotal + impuestos };
}

/**
 * Descarga el PDF de un presupuesto desde la LISTA, sin abrir el editor
 * (pedido 2026-07-29). Resuelve acá las entidades relacionadas que el editor
 * ya tiene en memoria (cliente, establecimiento, contacto, condición de pago,
 * categorías) y delega en downloadPresupuestoPDF, que arma el nombre de
 * archivo "N° - Razón Social.pdf".
 */
export async function descargarPresupuestoPdfDirecto(p: Presupuesto): Promise<void> {
  const [cliente, establecimiento, contactos, condiciones, categorias] = await Promise.all([
    p.clienteId ? clientesService.getById(p.clienteId).catch(() => null) : Promise.resolve(null),
    p.establecimientoId ? establecimientosService.getById(p.establecimientoId).catch(() => null) : Promise.resolve(null),
    p.clienteId ? contactosService.getByCliente(p.clienteId).catch(() => []) : Promise.resolve([]),
    condicionesPagoService.getAll().catch(() => []),
    categoriasPresupuestoService.getAll().catch(() => []),
  ]);

  const contacto = p.contactoId
    ? ((contactos as ContactoEstablecimiento[]).find(c => c.id === p.contactoId) ?? null)
    : null;
  const condicionPago = p.condicionPagoId
    ? (condiciones.find(c => c.id === p.condicionPagoId) ?? null)
    : null;

  const { subtotal, total } = computeTotalesConImpuestos(p.items ?? [], categorias);

  const { downloadPresupuestoPDF } = await import('../components/presupuestos/pdf');
  await downloadPresupuestoPDF({
    // Totales RECALCULADOS con impuestos (ver computeTotalesConImpuestos).
    presupuesto: { ...p, subtotal, total },
    cliente,
    establecimiento,
    contacto,
    condicionPago,
    categorias,
  });
}
