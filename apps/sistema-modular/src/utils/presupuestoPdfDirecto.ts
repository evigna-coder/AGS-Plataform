import type { Presupuesto, ContactoEstablecimiento } from '@ags/shared';
import {
  clientesService,
  establecimientosService,
  contactosService,
  condicionesPagoService,
  categoriasPresupuestoService,
} from '../services/firebaseService';

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

  const { downloadPresupuestoPDF } = await import('../components/presupuestos/pdf');
  await downloadPresupuestoPDF({
    presupuesto: p,
    cliente,
    establecimiento,
    contacto,
    condicionPago,
    categorias,
  });
}
