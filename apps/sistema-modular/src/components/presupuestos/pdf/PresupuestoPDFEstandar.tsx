import { Document, Page, View, Text, Image, Svg, Rect, Path, Line as SvgLine } from '@react-pdf/renderer';
import { baseStyles, COLORS } from './pdfStyles';
import './pdfFonts';
import { agruparPorSistemaSimple, validezHastaFecha } from './pdfUtils';
import { PdfEsquemaFacturacionSection } from './PdfEsquemaFacturacionSection';
import { PDFRichText } from './PDFRichText';
import { presupuestoTieneValidez } from '@ags/shared';
import type {
  Presupuesto,
  Cliente,
  Establecimiento,
  ContactoEstablecimiento,
  CondicionPago,
  CategoriaPresupuesto,
  PresupuestoItem,
  ModuloSistema,
  VentasMetadata,
} from '@ags/shared';

export interface PresupuestoPDFData {
  presupuesto: Presupuesto;
  cliente: Cliente | null;
  establecimiento: Establecimiento | null;
  contacto: ContactoEstablecimiento | null;
  condicionPago: CondicionPago | null;
  categorias: CategoriaPresupuesto[];
  montoEnLetras: string;
  logoSrc: string;
  isoLogoSrc: string;
  impuestos: {
    iva21: number;
    iva105: number;
    ganancias: number;
    iibb: number;
    /** Total de impuestos por moneda — para armar el TOTAL final de cada una. */
    porMoneda: Record<string, number>;
  };
  /**
   * Total FINAL por moneda = neto + impuestos (2026-08-07). No se usa
   * `presupuesto.total`: ese campo se guarda con impuestos incluidos y volver a
   * sumárselos duplicaba el IVA.
   */
  totalesPorMoneda: Record<string, number>;
  /** Neto por moneda (suma de subtotales de ítems). Subtotal + IVA = TOTAL. */
  netoPorMoneda: Record<string, number>;
  /** Módulos por sistemaId — para mostrar info de equipos en PDF contrato */
  modulosBySistema?: Record<string, ModuloSistema[]>;
  /** Per-currency totals for MIXTA presupuestos */
  totalsByCurrency?: Record<string, number>;
  /**
   * (Equipos) Fotos de sub-ítems pre-descargadas como data URLs, indexadas por
   * la URL original de Storage. Se resuelven en generatePresupuestoPDF antes de
   * renderizar (fetch → dataURL) para no depender de CORS/red dentro de @react-pdf.
   */
  fotosDataUrls?: Record<string, string>;
}

const S = baseStyles;

/** Formato monetario es-AR: 1.234,56 — separador de miles punto, decimal coma. */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateValue: any): string {
  if (!dateValue) return '-';
  try {
    const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

const itemCols = {
  item: '8%',
  producto: '12%',
  cantidad: '8%',
  descripcion: '40%',
  precio: '14%',
  total: '18%',
};

/** Anchos fijos de columnas numéricas (estilo Odoo); la descripción toma el resto con flex:1. */
const odooCols = { cantidad: 56, precio: 86, descuento: 44, total: 96 };

/**
 * Fila de item. Compactada 2026-08-09: era `fontSize: 8.5` con `paddingVertical: 7`
 * (~24pt por fila), y con 5 items el presupuesto ya se iba a dos hojas. Ahora
 * ~18pt, que es lo que asume `ALTO_FILA_ITEM` en el calculo de las notas.
 */
const ITEM_FS = 7.5;

function ItemRow({ item, showDescuento }: { item: PresupuestoItem; showDescuento?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight }} wrap={false}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ fontSize: ITEM_FS, color: COLORS.text }}>{item.descripcion}</Text>
        {/* Se cotiza por el N° de parte del envase: es el que el cliente ve en
            su orden de compra (Fase 3 presentaciones, 2026-08-13). */}
        {(item.presentacion?.codigoParte || item.codigoProducto) ? (
          <Text style={{ fontSize: 6.5, color: COLORS.textMuted }}>
            {item.presentacion?.codigoParte || item.codigoProducto}
          </Text>
        ) : null}
      </View>
      <Text style={{ width: odooCols.cantidad, fontSize: ITEM_FS, color: COLORS.text, textAlign: 'center' }}>{fmt(item.cantidad)}</Text>
      <Text style={{ width: odooCols.precio, fontSize: ITEM_FS, color: COLORS.textMuted, textAlign: 'right' }}>{fmt(item.precioUnitario)}</Text>
      {showDescuento ? (
        <Text style={{ width: odooCols.descuento, fontSize: ITEM_FS, color: COLORS.textMuted, textAlign: 'center' }}>{item.descuento ? `${fmt(item.descuento)}%` : '—'}</Text>
      ) : null}
      {/* 700→600 (2026-08-12): el total de línea no debe pesar más que la descripción. */}
      <Text style={{ width: odooCols.total, fontSize: ITEM_FS, fontWeight: 600, color: COLORS.text, textAlign: 'right' }}>{fmt(item.subtotal)}</Text>
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Separador Servicios/Partes (Phase 10) — DESACTIVADO por pedido.
 * Renderizaba mixto/partes en 2 secciones con headers + subtotales. Hoy todos
 * los items van en una tabla flat única. Para reactivar: descomentar este
 * bloque + MixtoItemsBlock y volver a rutear mixto/partes hacia él.
 *
 * function splitItemsByTipo(items: PresupuestoItem[]): { servicios: PresupuestoItem[]; partes: PresupuestoItem[] } {
 *   const servicios: PresupuestoItem[] = [];
 *   const partes: PresupuestoItem[] = [];
 *   for (const it of items) {
 *     if (it.stockArticuloId) partes.push(it);
 *     else servicios.push(it);
 *   }
 *   return { servicios, partes };
 * }
 *
 * function sumSubtotal(items: PresupuestoItem[]): number {
 *   return items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
 * }
 * ------------------------------------------------------------------------- */

/**
 * Phase 10 — Tabla flat de items (sin agrupación por sistema).
 * Reusada por MixtoItemsBlock y por el renderer default (servicio/ventas).
 */
function ItemsTable({ items }: { items: PresupuestoItem[]; moneda?: string }) {
  const showDescuento = items.some(i => i.descuento && i.descuento > 0);
  return (
    <View style={{ marginBottom: 12 }}>
      {/* Sin fondo gris (reforma 2026-08-12): labels azules + línea azul fina. */}
      <View style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.primary }}>
        <Text style={{ flex: 1, fontSize: 7.5, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.4 }}>DESCRIPCIÓN</Text>
        <Text style={{ width: odooCols.cantidad, fontSize: 7.5, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.4, textAlign: 'center' }}>CANT.</Text>
        <Text style={{ width: odooCols.precio, fontSize: 7.5, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.4, textAlign: 'right' }}>PRECIO</Text>
        {showDescuento ? <Text style={{ width: odooCols.descuento, fontSize: 7.5, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.4, textAlign: 'center' }}>DTO</Text> : null}
        <Text style={{ width: odooCols.total, fontSize: 7.5, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.4, textAlign: 'right' }}>TOTAL</Text>
      </View>
      {items.map((item) => <ItemRow key={item.id} item={item} showDescuento={showDescuento} />)}
    </View>
  );
}

/* Phase 10 — MixtoItemsBlock: separador Servicios/Partes en 2 secciones.
 * DESACTIVADO por pedido (ver nota arriba). Conservado para reactivar.
 *
 * function MixtoItemsBlock({ items, moneda }: { items: PresupuestoItem[]; moneda: string }) {
 *   const { servicios, partes } = splitItemsByTipo(items);
 *   const sym = (moneda || 'USD');
 *   return (
 *     <View>
 *       {servicios.length > 0 && (
 *         <View style={{ marginBottom: 10 }}>
 *           <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 }}>
 *             Servicios
 *           </Text>
 *           <ItemsTable items={servicios} moneda={moneda} />
 *           <Text style={{ fontSize: 9, textAlign: 'right', marginTop: 2, fontWeight: 'bold' }}>
 *             Subtotal servicios: {sym} {fmt(sumSubtotal(servicios))}
 *           </Text>
 *         </View>
 *       )}
 *       {partes.length > 0 && (
 *         <View style={{ marginBottom: 10 }}>
 *           <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 }}>
 *             Partes
 *           </Text>
 *           <ItemsTable items={partes} moneda={moneda} />
 *           <Text style={{ fontSize: 9, textAlign: 'right', marginTop: 2, fontWeight: 'bold' }}>
 *             Subtotal partes: {sym} {fmt(sumSubtotal(partes))}
 *           </Text>
 *         </View>
 *       )}
 *     </View>
 *   );
 * }
 */

/**
 * Phase 10 — Bloque "Datos de entrega e instalación" para ppto tipo 'ventas'.
 * Se inserta ANTES del detalle de items.
 */
export function VentasMetadataBlock({ metadata }: { metadata: VentasMetadata }) {
  const hasAny = metadata.fechaEstimadaEntrega || metadata.lugarInstalacion || metadata.requiereEntrenamiento;
  if (!hasAny) return null;
  const fechaStr = metadata.fechaEstimadaEntrega
    ? formatDate(metadata.fechaEstimadaEntrega)
    : '—';
  return (
    <View style={{ marginTop: 8, marginBottom: 10, padding: 6, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'solid' }}>
      <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.primary, marginBottom: 3 }}>
        Datos de entrega e instalación
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Text style={{ fontSize: 9 }}><Text style={{ fontWeight: 'bold' }}>Fecha estimada: </Text>{fechaStr}</Text>
        <Text style={{ fontSize: 9 }}><Text style={{ fontWeight: 'bold' }}>Lugar: </Text>{metadata.lugarInstalacion || '—'}</Text>
      </View>
      <Text style={{ fontSize: 9, marginTop: 2 }}>
        <Text style={{ fontWeight: 'bold' }}>Entrenamiento post-instalación: </Text>
        {metadata.requiereEntrenamiento ? 'Sí' : 'No'}
      </Text>
    </View>
  );
}

/** Header estilo Odoo: empresa a la izquierda, título + metadata key/value a la derecha (sin recuadro). */
export function PDFHeader({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  // Reforma visual 2026-08-12 (pedido de dirección): header compacto, título
  // -20%, y la info bien repartida — lo FISCAL de AGS (CUIT/IIBB/IVA) va a la
  // izquierda con el resto de los datos de la empresa; a la derecha solo lo del
  // PRESUPUESTO (N°, fecha, quién presupuestó) + el sello TÜV discreto.
  const metaRows: [string, string][] = [
    ['Fecha', formatDate(presupuesto.createdAt)],
    ['Preparó', presupuesto.responsableNombre || '-'],
  ];
  // Dos columnas con eje derecho cada una (pedido dirección 2026-08-12):
  // "Fecha:"/"Preparó:" terminan a la misma altura, y los valores también.
  // El ancho de la columna de valores se estima con el valor más largo para
  // que el hueco de la fila corta (la fecha) quede mínimo.
  const metaValorW = Math.max(46, Math.min(110, 4.3 * Math.max(...metaRows.map(([, v]) => v.length)) + 2));
  return (
    // Sin alignItems: los hijos se estiran a la altura de la fila (default
    // stretch) — necesario para que el sello TÜV ancle al PISO del bloque
    // derecho, a la altura del bloque fiscal izquierdo.
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
      {/* Bloque izquierdo: TODO lo institucional de AGS en un mismo eje a la
          izquierda — datos de contacto y, tras un filete azul, los fiscales
          como tablita label/valor alineada (jerarquía secundaria). */}
      <View style={{ width: '52%' }}>
        {/* marginLeft negativo: el PNG del logo trae aire interno y se veía
            corrido respecto del texto (ajuste dirección 2026-08-12). */}
        <Image src={data.logoSrc} style={[S.logo, { marginLeft: -5 }]} />
        <Text style={S.companyName}>AGS Analítica S.A.</Text>
        {/* Dirección en 2 renglones de largo parejo (dirección 2026-08-12). */}
        <Text style={S.companyInfo}>Arenales 605 – Piso 15   Vicente López</Text>
        <Text style={S.companyInfo}>(B1638BRG) – Buenos Aires – Argentina</Text>
        <Text style={S.companyInfo}>Tel.: 011-4524-7247</Text>
        <Text style={S.companyInfo}>info@agsanalitica.com</Text>
        <Text style={[S.companyInfo, { color: COLORS.primary }]}>www.agsanalitica.com</Text>
        <View style={{ width: 170, borderTopWidth: 0.5, borderTopColor: COLORS.primary, marginTop: 4, marginBottom: 3 }} />
        {([
          ['CUIT:', '30-70861861-2'],
          ['Ing. Brutos C.M.:', '30-70861861-2 901'],
          ['IVA:', 'Responsable Inscripto'],
        ] as const).map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', marginBottom: 1.5 }}>
            {/* 78→66: valores más pegados a los labels (dirección 2026-08-12). */}
            <Text style={{ fontSize: 7, fontWeight: 600, color: COLORS.primary, width: 66 }}>{k}</Text>
            <Text style={{ fontSize: 7, color: COLORS.text }}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Bloque derecho: SOLO lo del presupuesto, eje derecho. El sello TÜV va
          ANCLADO al fondo del bloque, a la altura del bloque fiscal de la
          izquierda (decisión 2026-08-12): las dos columnas comparten techo y
          piso, y el aire del medio queda deliberado — no un sello flotando. */}
      <View style={{ width: '44%', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.3 }}>Presupuesto</Text>
          <Text style={{ fontSize: 6.5, color: COLORS.textMuted, marginBottom: 5 }}>Documento no válido como factura</Text>
          <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: COLORS.text }}>N° {presupuesto.numero}</Text>
          <View style={{ width: 130, borderTopWidth: 0.5, borderTopColor: COLORS.primary, marginTop: 3, marginBottom: 5 }} />
          {metaRows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2.5 }}>
              <Text style={{ fontSize: 7.5, fontWeight: 600, color: COLORS.primary, textAlign: 'right' }}>{k}:</Text>
              <Text style={{ fontSize: 7.5, fontWeight: 600, color: COLORS.text, textAlign: 'right', width: metaValorW }}>{v}</Text>
            </View>
          ))}
        </View>
        {/* Sello TÜV discreto, al pie del bloque. */}
        <Image src={data.isoLogoSrc} style={{ width: 68, height: 'auto', marginTop: 7 }} />
      </View>
    </View>
  );
}

export function PDFClienteInfo({ data }: { data: PresupuestoPDFData }) {
  const { cliente, establecimiento, contacto } = data;
  const nombre = cliente?.razonSocial || '-';
  const dir = establecimiento?.direccion || cliente?.direccion || '-';
  const localidad = establecimiento?.localidad || cliente?.localidad || '-';
  const tel = contacto?.telefono || '-';
  const contactoNombre = contacto?.nombre || '-';
  const sector = contacto?.sector || '-';
  const email = contacto?.email || '-';

  // Equipo/Sistema vinculado: los items quedan estampados con sistemaNombre +
  // sistemaCodigoInterno al elegir el sistema en el header del presupuesto.
  // Deduplicamos por sistema para mostrarlo una sola vez en el encabezado.
  const sistemaMap = new Map<string, string>();
  for (const it of data.presupuesto.items) {
    if (!it.sistemaNombre) continue;
    const key = it.sistemaId || it.sistemaNombre;
    if (!sistemaMap.has(key)) {
      sistemaMap.set(key, `${it.sistemaNombre}${it.sistemaCodigoInterno ? ` (${it.sistemaCodigoInterno})` : ''}`);
    }
  }
  const equipoStr = [...sistemaMap.values()].join('   ·   ');

  const dirLine = [dir, localidad !== '-' ? localidad : ''].filter(Boolean).join(' — ')
    + (tel !== '-' ? `   ·   Tel: ${tel}` : '');
  const contactoLine = `Contacto: ${contactoNombre}`
    + (sector !== '-' ? ` — ${sector}` : '')
    + (email !== '-' ? `   ·   ${email}` : '');

  // Sin caja gris (reforma 2026-08-12): separación por línea fina + aire, y la
  // razón social -20% — el cliente se identifica rápido pero no compite con el
  // servicio cotizado.
  return (
    <View style={{ marginBottom: 12, borderTopWidth: 0.5, borderTopColor: COLORS.borderLight, paddingTop: 8 }}>
      <Text style={{ fontSize: 7, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.5, marginBottom: 3 }}>CLIENTE</Text>
      <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: COLORS.text, marginBottom: 3 }}>{nombre}</Text>
      <Text style={{ fontSize: 8, color: COLORS.textMuted, marginBottom: 1.5 }}>{dirLine}</Text>
      <Text style={{ fontSize: 8, color: COLORS.textMuted }}>{contactoLine}</Text>
      {equipoStr ? (
        <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.primary, marginTop: 3 }}>Equipo: {equipoStr}</Text>
      ) : null}
    </View>
  );
}

function PDFItemsTable({ data }: { data: PresupuestoPDFData }) {
  const { items } = data.presupuesto;
  const hasGrupos = items.some(i => i.grupo && i.grupo > 0);

  return (
    <View style={S.table}>
      <View style={S.tableHeaderRow}>
        <Text style={[S.tableHeaderCell, { width: itemCols.item }]}>Item</Text>
        <Text style={[S.tableHeaderCell, { width: itemCols.producto }]}>Producto</Text>
        <Text style={[S.tableHeaderCell, { width: itemCols.cantidad }]}>Cantidad</Text>
        <Text style={[S.tableHeaderCell, { width: itemCols.descripcion, textAlign: 'left' }]}>Descripción</Text>
        <Text style={[S.tableHeaderCell, { width: itemCols.precio }]}>Precio</Text>
        <Text style={[S.tableHeaderCell, { width: itemCols.total }]}>TOTAL</Text>
      </View>

      {hasGrupos ? (
        agruparPorSistemaSimple(items).map(grupo => {
          return (
            <View key={grupo.grupo}>
              <View style={{ flexDirection: 'row', backgroundColor: COLORS.sectionBg, paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
                <Text style={{ fontSize: 7, fontWeight: 600, color: COLORS.headerBg }}>
                  {grupo.grupo > 0 ? `${grupo.grupo}. ` : ''}{grupo.sistemaNombre.toUpperCase()}
                </Text>
              </View>
              {grupo.items.map((item) => <ItemRow key={item.id} item={item} />)}
            </View>
          );
        })
      ) : (
        items.map((item) => <ItemRow key={item.id} item={item} />)
      )}
    </View>
  );
}

/**
 * Iconitos de la fila de condiciones (reforma 2026-08-12, mockup de dirección):
 * almanaque / tarjeta / documento en trazo azul, dibujados como SVG inline —
 * react-pdf no tiene fuentes de íconos.
 */
function CondicionIcono({ tipo }: { tipo: 'calendario' | 'tarjeta' | 'documento' }) {
  const stroke = COLORS.primary;
  const common = { stroke, strokeWidth: 1.2, fill: 'none' } as const;
  return (
    <Svg width={13.5} height={13.5} viewBox="0 0 14 14" style={{ marginRight: 4.5 }}>
      {tipo === 'calendario' && (
        <>
          <Rect x={1.2} y={2.2} width={11.6} height={10.6} rx={2} {...common} />
          {/* Banda superior rellena, como el mockup. */}
          <Path d="M1.2 4.2 Q1.2 2.2 3.2 2.2 H10.8 Q12.8 2.2 12.8 4.2 V5.4 H1.2 Z" fill={stroke} />
          <SvgLine x1={4.6} y1={0.8} x2={4.6} y2={3} stroke={stroke} strokeWidth={1.4} />
          <SvgLine x1={9.4} y1={0.8} x2={9.4} y2={3} stroke={stroke} strokeWidth={1.4} />
          <Rect x={3.6} y={7.2} width={1.8} height={1.8} fill={stroke} />
          <Rect x={6.6} y={7.2} width={1.8} height={1.8} fill={stroke} />
          <Rect x={9.6} y={7.2} width={1.8} height={1.8} fill={stroke} />
        </>
      )}
      {tipo === 'tarjeta' && (
        <>
          <Rect x={0.8} y={2.8} width={12.4} height={9} rx={2} {...common} />
          {/* Banda magnética rellena. */}
          <Rect x={0.8} y={4.8} width={12.4} height={2.2} fill={stroke} />
          <SvgLine x1={3} y1={9.6} x2={6.5} y2={9.6} stroke={stroke} strokeWidth={1.3} />
        </>
      )}
      {tipo === 'documento' && (
        <>
          <Path d="M3.6 1.2 H8.8 L11.6 4 V11 Q11.6 12.8 9.8 12.8 H5.4 Q3.6 12.8 3.6 11 Z" {...common} />
          <Path d="M8.8 1.2 V4 H11.6" {...common} />
          <SvgLine x1={5.4} y1={6.6} x2={9.8} y2={6.6} {...common} />
          <SvgLine x1={5.4} y1={8.6} x2={9.8} y2={8.6} {...common} />
          <SvgLine x1={5.4} y1={10.6} x2={8.2} y2={10.6} {...common} />
        </>
      )}
    </Svg>
  );
}

/** Un segmento de la fila de condiciones: icono + label azul + valor. */
function CondicionSegmento({ icono, label, valor, primero }: {
  icono: 'calendario' | 'tarjeta' | 'documento';
  label: string;
  valor: string;
  primero?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', flexShrink: 1,
      ...(primero ? {} : { borderLeftWidth: 0.5, borderLeftColor: COLORS.border, marginLeft: 10, paddingLeft: 10 }),
    }}>
      <CondicionIcono tipo={icono} />
      <Text style={{ fontSize: 8, color: COLORS.text, flexShrink: 1 }}>
        {label ? <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{label} </Text> : null}
        {valor}
      </Text>
    </View>
  );
}

function PDFTotals({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto, impuestos, condicionPago } = data;
  const { moneda, subtotal, total, montoEnLetras } = { ...presupuesto, montoEnLetras: data.montoEnLetras };

  return (
    <View>
      {/* Totales — el protagonista es el precio SIN IVA (formato "D + B" elegido
          por dirección sobre docs/design/presupuesto-totales-alternativas.pen,
          2026-08-11): caja con tinte azul y borde primario para el neto, y
          debajo el desglose IVA + total final como tabla fina gris — visible
          pero subordinado. */}
      {/* Reforma 2026-08-12: caja y cifra ~25% más chicas — el total se
          localiza rápido pero no domina la página. */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
        <View style={{ width: 240 }}>
          {(() => {
            const netos: [string, number][] = Object.keys(data.netoPorMoneda).length > 0
              ? Object.entries(data.netoPorMoneda)
              : [[moneda, subtotal]];
            const esUnaMoneda = netos.length === 1;
            const filaChica = (label: string, value: string, strong = false) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 }}>
                <Text style={{ fontSize: 8, color: COLORS.textMuted, fontWeight: strong ? 600 : 400, flexGrow: 1 }}>{label}</Text>
                <Text style={{ fontSize: 8, color: COLORS.textMuted, fontWeight: strong ? 600 : 400 }}>{value}</Text>
              </View>
            );
            return netos.map(([m, neto]) => {
              const imp = esUnaMoneda
                ? impuestos.iva105 + impuestos.iva21 + impuestos.ganancias + impuestos.iibb
                : (impuestos.porMoneda[m] ?? 0);
              const totalFinal = data.totalesPorMoneda[m] ?? (esUnaMoneda ? total : neto + imp);
              const filas: [string, number][] = esUnaMoneda
                ? ([
                    ['I.V.A 10,5%', impuestos.iva105],
                    ['I.V.A 21%', impuestos.iva21],
                    ['Ganancias', impuestos.ganancias],
                    ['IIBB', impuestos.iibb],
                  ] as [string, number][]).filter(([, v]) => v > 0)
                : imp > 0 ? [['Impuestos', imp]] : [];
              return (
                <View key={m} style={{ marginTop: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primaryTint, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 10 }}>
                    <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: COLORS.primaryDark }}>TOTAL {m} (sin IVA)</Text>
                    <Text style={{ fontSize: 11.5, fontWeight: 'bold', color: COLORS.primaryDark }}>{fmt(neto)}</Text>
                  </View>
                  {imp > 0 && (
                    <View style={{ marginTop: 3, paddingHorizontal: 10 }}>
                      {filas.map(([label, v]) => filaChica(label, fmt(v)))}
                      {filaChica(`Total ${m} con IVA`, fmt(totalFinal), true)}
                    </View>
                  )}
                </View>
              );
            });
          })()}
        </View>
      </View>

      {/* Monto en letras */}
      <Text style={[S.monedaLetras, { marginBottom: 8 }]}>{montoEnLetras}</Text>

      {/* Condiciones comerciales SIN caja gris (reforma 2026-08-12): fila de
          tres segmentos con iconitos (almanaque / tarjeta / documento, como el
          mockup de dirección) separados por filetes, y debajo el alcance en
          cuerpo menor. La validez desaparece una vez aceptado (2026-08-09). */}
      <View style={{ marginBottom: 8, borderTopWidth: 0.5, borderTopColor: COLORS.borderLight, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
          <CondicionSegmento
            icono="calendario"
            label={presupuestoTieneValidez(presupuesto.estado) ? 'Vigencia:' : ''}
            valor={presupuestoTieneValidez(presupuesto.estado)
              ? `${presupuesto.validezDias || 15} días — hasta el ${validezHastaFecha(presupuesto.createdAt, presupuesto.validezDias)}`
              : 'Presupuesto aceptado'}
            primero
          />
          {condicionPago ? (
            <CondicionSegmento
              icono="tarjeta"
              label="Forma de pago:"
              valor={`${condicionPago.nombre}${condicionPago.dias > 0 ? ` (${condicionPago.dias} días)` : ''}`}
            />
          ) : null}
          {presupuesto.condicionesComerciales ? (
            <CondicionSegmento icono="documento" label="Condiciones generales:" valor="ver página 2" />
          ) : null}
        </View>
        <Text style={{ fontSize: 7, color: COLORS.textMuted, lineHeight: 1.4 }}>
          El servicio comprende exclusivamente el alcance indicado en esta propuesta.
        </Text>
      </View>

      {/* Billing section: Phase 12 esquema (non-contrato) OR legacy cuotas[] (contrato / legacy) */}
      {(presupuesto.esquemaFacturacion?.length ?? 0) > 0 && presupuesto.tipo !== 'contrato' ? (
        /* Phase 12: porcentual billing schema — renders % per moneda + monto preview per cuota */
        <PdfEsquemaFacturacionSection
          presupuesto={presupuesto}
          esquema={presupuesto.esquemaFacturacion!}
        />
      ) : presupuesto.cuotas && presupuesto.cuotas.length > 0 ? (
        /* Legacy / contrato: monto-based PresupuestoCuota[] */
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 7, fontWeight: 700, color: COLORS.primary, marginBottom: 4, textTransform: 'uppercase' }}>
            Plan de cuotas ({presupuesto.cuotas.length})
          </Text>
          <View style={{ borderWidth: 0.5, borderColor: COLORS.border }}>
            <View style={{ flexDirection: 'row', backgroundColor: COLORS.sectionBg, padding: 3 }}>
              <Text style={{ fontSize: 6, fontWeight: 700, width: '15%', textAlign: 'center' }}>#</Text>
              <Text style={{ fontSize: 6, fontWeight: 700, width: '20%', textAlign: 'center' }}>Moneda</Text>
              <Text style={{ fontSize: 6, fontWeight: 700, width: '30%', textAlign: 'right' }}>Monto</Text>
              <Text style={{ fontSize: 6, fontWeight: 700, width: '35%', textAlign: 'left', paddingLeft: 6 }}>Descripción</Text>
            </View>
            {presupuesto.cuotas.map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', padding: 2, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: COLORS.border }}>
                <Text style={{ fontSize: 6, width: '15%', textAlign: 'center' }}>{c.numero}</Text>
                <Text style={{ fontSize: 6, width: '20%', textAlign: 'center' }}>{c.moneda}</Text>
                <Text style={{ fontSize: 6, width: '30%', textAlign: 'right' }}>{fmt(c.monto)}</Text>
                <Text style={{ fontSize: 6, width: '35%', textAlign: 'left', paddingLeft: 6 }}>{c.descripcion || ''}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * ¿Entran las notas técnicas en la primera hoja, después de los items?
 *
 * Pedido 2026-08-07: el cliente no las estaba viendo en la hoja 2, así que van
 * en la primera junto al presupuesto; si NO hay lugar, bajan a la hoja de
 * condiciones y se juntan con el resto de las notas (en vez de generar una hoja
 * intermedia con las notas solas).
 *
 * react-pdf no permite consultar el espacio restante, así que se estima con el
 * layout real de la hoja (A4 = 842pt). Constantes conservadoras: si el cálculo
 * se queda corto el bloque igual va con `wrap`, así que continúa en la hoja
 * siguiente en lugar de recortarse.
 */
const ALTO_A4 = 842;
const ALTO_BASE_PAGINA1 = 430;   // header + datos del cliente + totales + footer + márgenes
const ALTO_FILA_ITEM = 18;
const ALTO_LINEA_NOTA = 10;
const CHARS_POR_LINEA = 95;
const ALTO_TITULO_NOTA = 26;     // título + padding del recuadro destacado

/**
 * Cuenta los renglones REALES que ocupa un HTML: los saltos explicitos
 * (`<br>`, `</p>`, `</div>`, `</li>`) valen una linea cada uno, y ademas cada
 * bloque se wrappea por ancho.
 *
 * Antes se dividia el largo TOTAL del texto por `CHARS_POR_LINEA`, lo que solo
 * modelaba el wrapping (2026-08-09). Una nota con un equipo por renglon —320
 * caracteres en 8 lineas— se estimaba en 4, entraba "justo" en la hoja 1 y
 * terminaba cortada al pie.
 */
function contarLineasHtml(html: string): number {
  const bloques = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n');
  let lineas = 0;
  for (const b of bloques) {
    const t = b.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
    // Un bloque vacio sigue siendo un renglon en blanco, que ocupa alto.
    lineas += t ? Math.ceil(t.length / CHARS_POR_LINEA) : 1;
  }
  return Math.max(1, lineas);
}

/** Alto estimado del recuadro de una nota, con titulo. */
function altoEstimadoNota(html: string | null | undefined): number {
  if (!html) return 0;
  const lineas = contarLineasHtml(html);
  if (lineas === 1 && !html.replace(/<[^>]+>/g, '').trim()) return 0;
  return ALTO_TITULO_NOTA + lineas * ALTO_LINEA_NOTA;
}

export function notasTecnicasEntranEnPagina1(
  notasHtml: string | null | undefined,
  cantidadItems: number,
): boolean {
  if (!notasHtml) return false;
  const altoNotas = altoEstimadoNota(notasHtml);
  if (altoNotas === 0) return false;
  const consumido = ALTO_BASE_PAGINA1 + cantidadItems * ALTO_FILA_ITEM;
  // Margen de seguridad: si el calculo se queda corto la nota va con
  // `wrap={false}` y saltaria ENTERA a una hoja nueva, dejando la 1 a medio
  // llenar. Preferimos bajarla a la hoja de condiciones antes que arriesgar eso.
  const MARGEN = 40;
  return consumido + altoNotas + MARGEN <= ALTO_A4;
}

/** Alto util de una hoja de condiciones (A4 menos margenes, header y footer). */
const ALTO_UTIL_CONDICIONES = 680;

/** Alto estimado de un bloque de texto con titulo (mismo contador de renglones). */
const altoEstimadoSeccion = altoEstimadoNota;

export function PDFCondiciones({ data, omitirNotasTecnicas }: { data: PresupuestoPDFData; omitirNotasTecnicas?: boolean }) {
  const { presupuesto } = data;
  const secciones = presupuesto.seccionesVisibles || {};

  // largo: las secciones de texto extenso pueden CONTINUAR en la página siguiente
  // (wrap) en vez de quedar recortadas al fondo; las cortas van enteras (wrap=false).
  const sections: { key: string; title: string; content: string | null | undefined; largo?: boolean }[] = [
    // Notas técnicas: van acá SOLO si no entraron en la primera hoja
    // (`omitirNotasTecnicas`), para que nunca queden duplicadas.
    { key: 'notasTecnicas', title: 'NOTAS TÉCNICAS:', content: omitirNotasTecnicas ? null : presupuesto.notasTecnicas, largo: true },
    { key: 'notasAdministrativas', title: 'NOTAS ADMINISTRATIVAS:', content: presupuesto.notasAdministrativas, largo: true },
    { key: 'garantia', title: 'GARANTÍA:', content: presupuesto.garantia },
    { key: 'variacionTipoCambio', title: 'VARIACIÓN DEL TIPO DE CAMBIO:', content: presupuesto.variacionTipoCambio },
    { key: 'condicionesComerciales', title: 'CONDICIONES COMERCIALES:', content: presupuesto.condicionesComerciales },
    { key: 'aceptacionPresupuesto', title: 'ACEPTACIÓN DEL PRESUPUESTO:', content: presupuesto.aceptacionPresupuesto },
  ];

  const visibleSections = sections.filter(s => {
    const isVisible = secciones[s.key as keyof typeof secciones] !== false;
    return isVisible && s.content;
  });

  if (visibleSections.length === 0) return null;

  return (
    <View>
      {visibleSections.map((section) => (
        <View key={section.key}
          // Notas técnicas en recuadro destacado (pedido 2026-07-31) — el resto
          // conserva el filete izquierdo.
          style={section.key === 'notasTecnicas' ? S.condicionSectionDestacada : S.condicionSection}
          // Partir un bloque de notas al medio entre dos hojas se ve como un
          // error (2026-08-09). Ahora solo se permite `wrap` cuando el bloque es
          // MAS ALTO que una hoja: ahi es inevitable, y sin wrap react-pdf lo
          // saltearia entero. Si entra en una hoja, va completo a la siguiente.
          wrap={!!section.largo && altoEstimadoSeccion(section.content) > ALTO_UTIL_CONDICIONES}>
          <Text style={S.condicionTitle}>{section.title}</Text>
          <PDFRichText html={section.content} fallbackStyle={S.condicionText} />
        </View>
      ))}
    </View>
  );
}

/** Bloque de conformidad + firma al final de las condiciones (antes era la hoja 3;
 *  el campo firma/fecha simple de la hoja de condiciones se eliminó — pedido
 *  2026-07-29, junto con "Lugar de recepción de la Factura"). */
export function PDFConformidad() {
  return (
    <View wrap={false} style={{ marginTop: 16 }}>
      <View style={{
        borderWidth: 1,
        borderColor: COLORS.primary,
        padding: 12,
        borderRadius: 4,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <View style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: COLORS.primaryLight,
          marginRight: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ color: COLORS.white, fontSize: 10, fontWeight: 'bold' }}>✓</Text>
        </View>
        <Text style={{ fontSize: 7, color: COLORS.text, flex: 1 }}>
          Para que la orden de compra sea aceptada, las condiciones de pago deberán ser las
          mismas que las que se definen en el presente presupuesto.
        </Text>
      </View>

      <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.text, marginBottom: 16 }}>
        Doy conformidad para efectuar el servicio descripto en el presente presupuesto.
      </Text>

      {/* Fecha */}
      <View style={{ flexDirection: 'row', marginBottom: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.primary, width: 60 }}>Fecha</Text>
        <View style={{ flex: 0.4, borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 20 }} />
      </View>

      {/* Firma + Aclaración */}
      <View style={{ flexDirection: 'row', gap: 30 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.primary, marginBottom: 4 }}>Firma</Text>
          <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 40 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.primary, marginBottom: 4 }}>Aclaración</Text>
          <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 40 }} />
        </View>
      </View>
    </View>
  );
}

export function PDFFooter() {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerLeft}>Archivo: Presupuesto</Text>
      <Text style={S.footerCenter}>Formulario: QF7.0201 rev: 06</Text>
      <Text
        style={S.footerRight}
        render={({ pageNumber, totalPages }) => `Pág. ${pageNumber}/${totalPages}`}
      />
    </View>
  );
}

/** Bloque de notas técnicas para la primera hoja (mismo recuadro destacado). */
function PDFNotasTecnicasPagina1({ data }: { data: PresupuestoPDFData }) {
  const html = data.presupuesto.notasTecnicas;
  if (!html) return null;
  return (
    // Nunca partido: si no entra, `notasTecnicasEntranEnPagina1` ya decidio
    // bajarlo a la hoja de condiciones (2026-08-09).
    <View style={S.condicionSectionDestacada} wrap={false}>
      <Text style={S.condicionTitle}>NOTAS TÉCNICAS:</Text>
      <PDFRichText html={html} fallbackStyle={S.condicionText} />
    </View>
  );
}

export function PresupuestoPDFEstandar({ data }: { data: PresupuestoPDFData }) {
  // Notas técnicas en la hoja 1 si entran; si no, bajan con el resto (hoja 2).
  const secciones = data.presupuesto.seccionesVisibles || {};
  const notasVisibles = secciones.notasTecnicas !== false;
  const notasEnHoja1 = notasVisibles
    && notasTecnicasEntranEnPagina1(data.presupuesto.notasTecnicas, data.presupuesto.items?.length ?? 0);

  return (
    <Document
      title={`Presupuesto ${data.presupuesto.numero}`}
      author="AGS Analítica S.A."
      subject="Presupuesto"
    >
      {/* Página 1: Header + Items + Totales */}
      <Page size="A4" style={S.page}>
        <PDFHeader data={data} />
        <PDFClienteInfo data={data} />

        {/* Phase 10: bloque entrega/instalación solo para tipo 'ventas' */}
        {data.presupuesto.tipo === 'ventas' && data.presupuesto.ventasMetadata && (
          <VentasMetadataBlock metadata={data.presupuesto.ventasMetadata} />
        )}

        {/* contrato → PDFItemsTable con grupos; resto → tabla flat.
            NOTA: el split mixto/partes en 2 secciones (MixtoItemsBlock) está
            desactivado por pedido — todos los items van en una tabla única.
            Para reactivarlo: descomentar MixtoItemsBlock más arriba y volver a
            rutear mixto/partes hacia él. */}
        {data.presupuesto.tipo === 'contrato' ? (
          <PDFItemsTable data={data} />
        ) : (
          <ItemsTable items={data.presupuesto.items} moneda={data.presupuesto.moneda} />
        )}

        <PDFTotals data={data} />
        {/* Notas técnicas junto al presupuesto (pedido 2026-08-07): en la hoja 2
            no las estaban leyendo. Si no entran acá, se renderizan con el resto
            de las notas en la hoja siguiente. */}
        {notasEnHoja1 && <PDFNotasTecnicasPagina1 data={data} />}
        <PDFFooter />
      </Page>

      {/* Página 2: Notas + Condiciones + Conformidad/Firma — SIEMPRE separada de los
          items (arranca en página nueva aunque los items ocupen 1 o 2 hojas). */}
      <Page size="A4" style={S.page}>
        <PDFCondiciones data={data} omitirNotasTecnicas={notasEnHoja1} />
        <PDFConformidad />
        <PDFFooter />
      </Page>
    </Document>
  );
}
