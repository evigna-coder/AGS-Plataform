import type { Remito } from '@ags/shared';
import { movimientosAplicarService, remitoMueveStock } from '../services/movimientosAplicar';
import { nombreUsuarioActual } from '../services/asignacionesStockHelpers';

// Calibración contra el papel preimpreso real (2026-07-31, 2 rondas de fitting).
// Offsets en pt (1 mm = 2,835 pt); negativo = arriba / izquierda. Globales
// primero, ajustes por campo después. Si cambia la impresora o el papel, se
// ajusta SOLO acá.
const MM = 2.83465;
const CM = 10 * MM;
const OFFSET_X = -1.0 * CM;
const OFFSET_Y = -3.6 * CM; // 2026-08-04: +1mm (bajar todo 1mm, calibración con papel real)
// Ronda 2 — correcciones por campo medidas sobre el papel:
const FIELD_OFFSETS: RemitoOverlayFieldOffsets = {
  razonSocial: { y: 1 * MM },        // 1 mm abajo
  domicilio:   { y: -1 * MM },       // 1 mm arriba
  localidad:   { y: -5 * MM },       // 5 mm arriba
  provincia:   { y: -8 * MM },       // 8 mm arriba
  cuit:        { y: -15 * MM },      // 1,5 cm arriba
  fecha:       { x: -3 * MM, y: 28 * MM }, // 2,8 cm abajo · 3 mm izquierda
  tablaY: -27 * MM,                  // toda la línea de items 2,7 cm arriba (corregido de -45)
  colItemX: 7 * MM,                  // n° de item 7 mm derecha (5 + 2 de la ronda 3)
  colProductoX: -15 * MM,            // artículo 1,5 cm izquierda
  colDescripcionX: -45 * MM,         // descripción 4,5 cm izquierda
};
import { clientesService, establecimientosService, remitosService } from '../services/firebaseService';
import { RemitoOverlayPDF, type RemitoOverlayItem, type RemitoOverlayFieldOffsets } from '../components/remitos/pdf/RemitoOverlayPDF';
import { printRemitoSilentOrOpen } from './remitoPdfActions';

/**
 * Imprime (o reimprime) un remito de stock sobre el papel preimpreso en
 * triplicado, resolviendo destinatario desde el cliente (datos fiscales) y el
 * establecimiento (domicilio de entrega, si hay). Marca `impreso` en el doc —
 * a partir de ahí el remito no se edita más, solo se reimprime.
 * (Rework remitos 2026-07-31.)
 */
export async function imprimirRemitoStock(remito: Remito): Promise<void> {
  // Imprimir = EMITIR (pedido 2026-07-31: "el remito genera movimientos de
  // stock"): la primera impresión de un borrador aplica la salida real —
  // unidades descontadas/entregadas + MovimientoStock, misma transacción que
  // el botón Confirmar del detalle. Reimprimir (ya confirmado) no re-aplica.
  // Items manuales (sin unidadId) no mueven stock — remito documental.
  if (remito.estado === 'borrador') {
    if (remitoMueveStock(remito)) {
      await movimientosAplicarService.aplicarSalidaRemito({ remito, creadoPor: nombreUsuarioActual() });
    } else {
      await remitosService.update(remito.id, { estado: 'confirmado' });
    }
  }

  const [cliente, establecimiento] = await Promise.all([
    remito.clienteId ? clientesService.getById(remito.clienteId).catch(() => null) : Promise.resolve(null),
    remito.establecimientoId ? establecimientosService.getById(remito.establecimientoId).catch(() => null) : Promise.resolve(null),
  ]);

  const destinatario = {
    razonSocial: cliente?.razonSocial ?? remito.clienteNombre ?? '',
    // Domicilio de ENTREGA: el del establecimiento si está elegido; si no, el fiscal.
    domicilio: establecimiento?.direccion ?? cliente?.direccionFiscal ?? cliente?.direccion ?? '',
    localidad: establecimiento?.localidad ?? cliente?.localidadFiscal ?? cliente?.localidad ?? '',
    provincia: establecimiento?.provincia ?? cliente?.provinciaFiscal ?? cliente?.provincia ?? '',
    iva: cliente?.condicionIva ?? '',
    cuit: cliente?.cuit ?? '',
  };

  const items: RemitoOverlayItem[] = remito.items.map((it, i) => ({
    numero: i + 1,
    cantidad: it.cantidad,
    producto: it.articuloCodigo ?? it.loanerCodigo ?? it.instrumentoCodigo ?? '',
    descripcion: [
      it.articuloDescripcion ?? it.fichaDescripcion ?? '',
      it.serie ? `S/N ${it.serie}` : null,
      it.observaciones || null,
    ].filter(Boolean).join(' · '),
  }));

  const now = new Date();
  const fechaFmt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  await printRemitoSilentOrOpen(
    <RemitoOverlayPDF fecha={fechaFmt} destinatario={destinatario} items={items}
      observaciones={remito.observaciones}
      globalOffsetX={OFFSET_X} globalOffsetY={OFFSET_Y} fieldOffsets={FIELD_OFFSETS} />,
  );

  // Marcar impreso — best-effort (la impresión ya salió; si el update falla,
  // el remito queda editable pero el papel existe: preferible loguear y seguir).
  await remitosService.update(remito.id, {
    impreso: true,
    fechaImpresion: new Date().toISOString(),
  }).catch(err => console.error('[imprimirRemitoStock] marcar impreso falló:', err));
}
