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
import { proveedoresService } from '../services/personalService';
import { RemitoOverlayPDF, type RemitoOverlayItem, type RemitoOverlayFieldOffsets } from '../components/remitos/pdf/RemitoOverlayPDF';
import { printRemitoSilentOrOpen } from './remitoPdfActions';
import { getRemitoItemCodigo, getRemitoItemDescripcion } from './inventarioToRemitoItem';

/** Destinatario/transportista del overlay (mismo shape que DatosTransportista). */
interface OverlayParty {
  razonSocial: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  iva: string;
  cuit: string;
}

/**
 * Núcleo de impresión calibrada (2026-08-06): triplicado silencioso sobre el
 * papel preimpreso con LOS offsets calibrados. Único punto — cualquier remito
 * (stock, ficha, loaner, derivación) imprime por acá para salir igual.
 */
export async function imprimirRemitoOverlay(opts: {
  fecha: string;
  destinatario: OverlayParty;
  transportista?: OverlayParty | null;
  items: RemitoOverlayItem[];
  observaciones?: string | null;
}): Promise<void> {
  await printRemitoSilentOrOpen(
    <RemitoOverlayPDF
      fecha={opts.fecha}
      destinatario={opts.destinatario}
      transportista={opts.transportista ?? null}
      items={opts.items}
      observaciones={opts.observaciones ?? null}
      globalOffsetX={OFFSET_X} globalOffsetY={OFFSET_Y} fieldOffsets={FIELD_OFFSETS}
    />,
  );
}

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

  // Destinatario: cliente o PROVEEDOR según el tipo (2026-08-07). Las
  // derivaciones a proveedor no tienen clienteId — al reimprimirlas el papel
  // salía SIN razón social (el modal de creación sí resolvía el proveedor).
  const esDerivacion = remito.tipo === 'derivacion_proveedor' || (!remito.clienteId && !!remito.proveedorId);
  const [cliente, establecimiento, proveedor] = await Promise.all([
    remito.clienteId ? clientesService.getById(remito.clienteId).catch(() => null) : Promise.resolve(null),
    remito.establecimientoId ? establecimientosService.getById(remito.establecimientoId).catch(() => null) : Promise.resolve(null),
    esDerivacion && remito.proveedorId
      ? proveedoresService.getById(remito.proveedorId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const destinatario = esDerivacion
    ? {
        // Proveedor no modela localidad/provincia por separado — van dentro de
        // `direccion`. El overlay las deja vacías.
        razonSocial: proveedor?.nombre ?? remito.proveedorNombre ?? '',
        domicilio: proveedor?.direccion ?? '',
        localidad: '',
        provincia: '',
        iva: '',
        cuit: proveedor?.cuit ?? '',
      }
    : {
        razonSocial: cliente?.razonSocial ?? remito.clienteNombre ?? '',
        // Domicilio de ENTREGA: el del establecimiento si está elegido; si no, el fiscal.
        domicilio: establecimiento?.direccion ?? cliente?.direccionFiscal ?? cliente?.direccion ?? '',
        localidad: establecimiento?.localidad ?? cliente?.localidadFiscal ?? cliente?.localidad ?? '',
        provincia: establecimiento?.provincia ?? cliente?.provinciaFiscal ?? cliente?.provincia ?? '',
        iva: cliente?.condicionIva ?? '',
        cuit: cliente?.cuit ?? '',
      };

  // Código/descripción por tipoEntidad (2026-08-06): los items de asignación
  // (instrumento, dispositivo, minikit) imprimían columnas vacías o el ID —
  // getRemitoItem* resuelve el campo correcto para cada tipo.
  // Columna Producto = SOLO código de artículo / N° de parte (2026-08-07). Si
  // el equipo no tiene código, la celda va vacía: el número de ficha es interno
  // de AGS y no se declara nunca en el papel.
  const items: RemitoOverlayItem[] = remito.items.map((it, i) => ({
    numero: i + 1,
    cantidad: it.cantidad,
    producto: getRemitoItemCodigo(it),
    descripcion: [
      getRemitoItemDescripcion(it) || it.fichaDescripcion || '',
      it.serie ? `S/N ${it.serie}` : null,
      it.observaciones || null,
    ].filter(Boolean).join(' · '),
  }));

  const now = new Date();
  const fechaFmt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  await imprimirRemitoOverlay({
    fecha: fechaFmt,
    destinatario,
    items,
    observaciones: remito.observaciones,
  });

  // Marcar impreso — best-effort (la impresión ya salió; si el update falla,
  // el remito queda editable pero el papel existe: preferible loguear y seguir).
  await remitosService.update(remito.id, {
    impreso: true,
    fechaImpresion: new Date().toISOString(),
  }).catch(err => console.error('[imprimirRemitoStock] marcar impreso falló:', err));
}
