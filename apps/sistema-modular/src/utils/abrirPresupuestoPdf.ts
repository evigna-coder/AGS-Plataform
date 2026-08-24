import {
  presupuestosService,
  clientesService,
  contactosService,
  establecimientosService,
  condicionesPagoService,
  categoriasPresupuestoService,
} from '../services/firebaseService';

/**
 * Genera y abre el PDF de un presupuesto a partir de su id (2026-08-24).
 *
 * Se arma con los datos FRESCOS de Firestore, no con lo que tenga la pantalla
 * en memoria: el PDF es el papel que ve el cliente y tiene que salir igual
 * desde donde sea que se lo pida.
 *
 * Vive en `utils/` y no dentro de una pantalla porque lo piden dos lugares —el
 * aviso de facturación y el visor de entregas— y va a haber más. Las
 * dependencias que faltan (cliente dado de baja, condición borrada) degradan a
 * `null`: el PDF sale igual, sin ese bloque.
 */
export async function abrirPresupuestoPdf(presupuestoId: string): Promise<void> {
  const p = await presupuestosService.getById(presupuestoId);
  if (!p) throw new Error('Presupuesto no encontrado');

  const [cliente, establecimiento, contactos, condiciones, categorias] = await Promise.all([
    p.clienteId ? clientesService.getById(p.clienteId).catch(() => null) : Promise.resolve(null),
    p.establecimientoId ? establecimientosService.getById(p.establecimientoId).catch(() => null) : Promise.resolve(null),
    p.clienteId ? contactosService.getByCliente(p.clienteId).catch(() => []) : Promise.resolve([]),
    condicionesPagoService.getAll().catch(() => []),
    categoriasPresupuestoService.getAll().catch(() => []),
  ]);

  const { previewPresupuestoPDF } = await import('../components/presupuestos/pdf');
  await previewPresupuestoPDF({
    presupuesto: p,
    cliente,
    establecimiento,
    contacto: (contactos.find((c: { id: string }) => c.id === p.contactoId) as any) || null,
    condicionPago: condiciones.find((c: { id: string }) => c.id === p.condicionPagoId) || null,
    categorias,
  });
}
