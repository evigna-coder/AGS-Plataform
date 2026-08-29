import type { Remito, RemitoItem } from '@ags/shared';
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
  domicilio:   { y: -2 * MM },       // 2 mm arriba (2026-08-28: salía 1 mm bajo la casilla)
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
import { getRemitoItemCodigo, lineaDescripcionRemito, cantidadImpresaRemito } from './inventarioToRemitoItem';
import { enriquecerItemsRemito } from './enriquecerItemsRemito';
import { razonSocialConEstablecimiento } from './razonSocialRemito';
import { domicilioSinLocalidadNiProvincia } from './domicilioRemito';

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
 * AGS como transportista (2026-08-25). Cuando la mercadería la lleva un
 * ingeniero de campo (o nadie cargó un flete), el transporte ES AGS — la
 * columna salía VACÍA en el papel. Vivía como constante privada del modal de
 * loaners; ahora es el default de TODO remito sin transportista explícito.
 */
export const TRANSPORTISTA_AGS: OverlayParty = {
  razonSocial: 'AGS Analítica S.A.',
  domicilio: 'Arenales 605 — Piso 15',
  localidad: 'Buenos Aires',
  provincia: 'Buenos Aires',
  iva: 'Responsable Inscripto',
  cuit: '30-70861861-2',
};

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
  // El papel tiene casillas SEPARADAS para Domicilio/Localidad/Provincia, pero
  // varios clientes y proveedores tienen la dirección cargada entera en un solo
  // campo: salía todo concatenado en Domicilio Y repetido abajo (2026-08-28,
  // caso derivación LABCI). Se recorta acá — punto único de TODO remito.
  const limpiar = (p: OverlayParty): OverlayParty => ({
    ...p,
    domicilio: domicilioSinLocalidadNiProvincia(p.domicilio, p.localidad, p.provincia),
  });
  await printRemitoSilentOrOpen(
    <RemitoOverlayPDF
      fecha={opts.fecha}
      destinatario={limpiar(opts.destinatario)}
      transportista={limpiar(opts.transportista ?? TRANSPORTISTA_AGS)}
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
      // Documental (sin items de stock): emitir solo lo confirma. El cierre lo
      // da la descarga contra la OT, nunca la impresión (2026-08-18).
      await remitosService.update(remito.id, { estado: 'confirmado' });
    }
  }

  // Destinatario: cliente o PROVEEDOR según el tipo (2026-08-07). Las
  // derivaciones a proveedor no tienen clienteId — al reimprimirlas el papel
  // salía SIN razón social (el modal de creación sí resolvía el proveedor).
  const esDerivacion = remito.tipo === 'derivacion_proveedor' || (!remito.clienteId && !!remito.proveedorId);
  const [cliente, establecimiento, proveedor, transportista] = await Promise.all([
    remito.clienteId ? clientesService.getById(remito.clienteId).catch(() => null) : Promise.resolve(null),
    remito.establecimientoId ? establecimientosService.getById(remito.establecimientoId).catch(() => null) : Promise.resolve(null),
    esDerivacion && remito.proveedorId
      ? proveedoresService.getById(remito.proveedorId).catch(() => null)
      : Promise.resolve(null),
    // Bloque transportista del papel (2026-08-07): salía siempre vacío en los
    // remitos de stock porque no había dónde cargarlo.
    remito.transportistaId
      ? proveedoresService.getById(remito.transportistaId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const destinatario = esDerivacion
    ? {
        razonSocial: proveedor?.nombre ?? remito.proveedorNombre ?? '',
        domicilio: proveedor?.direccion ?? '',
        localidad: proveedor?.localidad ?? '',
        provincia: proveedor?.provincia ?? '',
        iva: proveedor?.condicionIva ?? '',
        cuit: proveedor?.cuit ?? '',
      }
    : {
        // Planta entre paréntesis (2026-08-12): en un cliente multi-planta el
        // nombre solo no dice a dónde va la mercadería. Salía en la vista de
        // remitos pero no en el papel.
        razonSocial: razonSocialConEstablecimiento(
          cliente?.razonSocial ?? remito.clienteNombre ?? '',
          establecimiento?.nombre ?? remito.establecimientoNombre,
        ),
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
  // el equipo no tiene código va "S/C": ni el número de ficha ni el LNR del
  // loaner son códigos de producto, son internos de AGS y no se declaran nunca.
  // Minikits e instrumentos salían con la Descripción VACÍA (2026-08-12): la
  // asignación guarda solo el código/nombre. Se completa desde el catálogo
  // antes de armar las líneas — también arregla las reimpresiones viejas.
  const itemsRemito = await enriquecerItemsRemito(remito.items)
    .catch(err => { console.error('[imprimirRemitoStock] enriquecer items falló:', err); return remito.items; });

  // Consolidación de fungibles (2026-08-25): el stock sale en varios documentos
  // (2+1+2) y el remito guarda una línea por documento, pero el papel tiene que
  // decir UNA línea ×5 — tres renglones iguales gastaban el talonario (11 por
  // hoja) y confundían al cliente. Se agrupa por lo que IMPRIME la línea
  // (código + descripción + envase); las líneas con serie nunca se agrupan.
  const consolidados: RemitoItem[] = [];
  const porClave = new Map<string, RemitoItem>();
  for (const it of itemsRemito) {
    const clave = [
      getRemitoItemCodigo(it), lineaDescripcionRemito(it),
      it.presentacion?.codigoParte ?? '', it.presentacion?.factor ?? '',
      it.tipoItem,
    ].join('|');
    const prev = !it.serie ? porClave.get(clave) : undefined;
    if (prev) {
      prev.cantidad += it.cantidad;
    } else {
      const copia = { ...it };
      if (!it.serie) porClave.set(clave, copia);
      consolidados.push(copia);
    }
  }

  const items: RemitoOverlayItem[] = consolidados.map((it, i) => ({
    numero: i + 1,
    // Cantidad EN ENVASES si la línea se entrega por presentación (2026-08-14):
    // el papel tiene que decir "5183-2067 · 1", no "5182-0715 · 10".
    cantidad: cantidadImpresaRemito(it),
    producto: getRemitoItemCodigo(it) || 'S/C',
    descripcion: lineaDescripcionRemito(it),
  }));

  const now = new Date();
  const fechaFmt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  await imprimirRemitoOverlay({
    fecha: fechaFmt,
    destinatario,
    // Prioridad: snapshot guardado en el remito (2026-08-11 — conserva fletes
    // cargados a mano) → proveedor del catálogo por id → nombre pelado.
    transportista: remito.transportista?.razonSocial
      ? remito.transportista
      : transportista
        ? {
            razonSocial: transportista.nombre,
            domicilio: domicilioSinLocalidadNiProvincia(
              transportista.direccion, transportista.localidad, transportista.provincia),
            localidad: transportista.localidad ?? '',
            provincia: transportista.provincia ?? '',
            iva: transportista.condicionIva ?? '',
            cuit: transportista.cuit ?? '',
          }
        : (remito.transportistaNombre
            ? { razonSocial: remito.transportistaNombre, domicilio: '', localidad: '', provincia: '', iva: '', cuit: '' }
            : null),
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
