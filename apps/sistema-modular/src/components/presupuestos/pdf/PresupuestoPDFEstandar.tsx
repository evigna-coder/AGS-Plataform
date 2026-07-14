import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { baseStyles, COLORS } from './pdfStyles';
import './pdfFonts';
import { agruparPorSistemaSimple } from './pdfUtils';
import { PdfEsquemaFacturacionSection } from './PdfEsquemaFacturacionSection';
import { PDFRichText } from './PDFRichText';
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
  };
  /** Módulos por sistemaId — para mostrar info de equipos en PDF contrato */
  modulosBySistema?: Record<string, ModuloSistema[]>;
  /** Per-currency totals for MIXTA presupuestos */
  totalsByCurrency?: Record<string, number>;
}

const S = baseStyles;

/** Formato monetario es-AR: 1.234,56 — separador de miles punto, decimal coma. */
function fmt(n: number | null | undefined): string {
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

function ItemRow({ item, showDescuento }: { item: PresupuestoItem; showDescuento?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight }} wrap={false}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ fontSize: 8.5, color: COLORS.text }}>{item.descripcion}</Text>
        {item.codigoProducto ? (
          <Text style={{ fontSize: 7, color: COLORS.textMuted, marginTop: 1 }}>{item.codigoProducto}</Text>
        ) : null}
      </View>
      <Text style={{ width: odooCols.cantidad, fontSize: 8.5, color: COLORS.text, textAlign: 'center' }}>{fmt(item.cantidad)}</Text>
      <Text style={{ width: odooCols.precio, fontSize: 8.5, color: COLORS.textMuted, textAlign: 'right' }}>{fmt(item.precioUnitario)}</Text>
      {showDescuento ? (
        <Text style={{ width: odooCols.descuento, fontSize: 8.5, color: COLORS.textMuted, textAlign: 'center' }}>{item.descuento ? `${fmt(item.descuento)}%` : '—'}</Text>
      ) : null}
      <Text style={{ width: odooCols.total, fontSize: 8.5, fontWeight: 700, color: COLORS.text, textAlign: 'right' }}>{fmt(item.subtotal)}</Text>
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
      <View style={{ flexDirection: 'row', backgroundColor: COLORS.cardBg, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1.5, borderBottomColor: COLORS.primary }}>
        <Text style={{ flex: 1, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text }}>Descripción</Text>
        <Text style={{ width: odooCols.cantidad, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' }}>Cant.</Text>
        <Text style={{ width: odooCols.precio, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, textAlign: 'right' }}>Precio</Text>
        {showDescuento ? <Text style={{ width: odooCols.descuento, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' }}>Dto</Text> : null}
        <Text style={{ width: odooCols.total, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, textAlign: 'right' }}>Total</Text>
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
function VentasMetadataBlock({ metadata }: { metadata: VentasMetadata }) {
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
function PDFHeader({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  const metaRows: [string, string][] = [
    ['Fecha', formatDate(presupuesto.createdAt)],
    ['Usuario', presupuesto.responsableNombre || '-'],
    ['CUIT', '30-70861861-2'],
    ['Ing. Brutos C.M.', '30-70861861-2 901'],
    ['IVA', 'Responsable Inscripto'],
  ];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
      {/* Logo + datos empresa */}
      <View style={{ width: '52%' }}>
        <Image src={data.logoSrc} style={S.logo} />
        <Text style={S.companyName}>AGS Analítica S.A.</Text>
        <Text style={S.companyInfo}>Arenales 605 – Piso 15</Text>
        <Text style={S.companyInfo}>Vicente López (B1638BRG) - Buenos Aires - Argentina</Text>
        <Text style={S.companyInfo}>Te: 011-4524-7247</Text>
        <Text style={S.companyInfo}>info@agsanalitica.com</Text>
        <Text style={S.companyInfo}>www.agsanalitica.com</Text>
      </View>

      {/* Título grande + metadata key/value a la derecha */}
      <View style={{ width: '44%', alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 23, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.3 }}>Presupuesto</Text>
        <Text style={{ fontSize: 6.5, color: COLORS.textMuted, marginBottom: 7 }}>Documento no válido como factura</Text>
        <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.text, marginBottom: 7 }}>{presupuesto.numero}</Text>
        <View style={{ width: 180 }}>
          {metaRows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2.5 }}>
              <Text style={{ fontSize: 7.5, color: COLORS.textMuted, marginRight: 8 }}>{k}</Text>
              <Text style={{ fontSize: 7.5, fontWeight: 600, color: COLORS.text, textAlign: 'right' }}>{v}</Text>
            </View>
          ))}
        </View>
        <Image src={data.isoLogoSrc} style={{ width: 46, height: 'auto', marginTop: 8 }} />
      </View>
    </View>
  );
}

function PDFClienteInfo({ data }: { data: PresupuestoPDFData }) {
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

  return (
    <View style={{ marginBottom: 14, padding: 12, backgroundColor: COLORS.cardBg, borderRadius: 6 }}>
      <Text style={{ fontSize: 7, fontWeight: 'bold', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 3 }}>CLIENTE</Text>
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 }}>{nombre}</Text>
      <Text style={{ fontSize: 8.5, color: COLORS.textMuted, marginBottom: 1.5 }}>{dirLine}</Text>
      <Text style={{ fontSize: 8.5, color: COLORS.textMuted }}>{contactoLine}</Text>
      {equipoStr ? (
        <Text style={{ fontSize: 8.5, fontWeight: 600, color: COLORS.primary, marginTop: 3 }}>Equipo: {equipoStr}</Text>
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

function PDFTotals({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto, impuestos, condicionPago } = data;
  const { moneda, subtotal, total, montoEnLetras } = { ...presupuesto, montoEnLetras: data.montoEnLetras };

  return (
    <View>
      {/* Totales — bloque derecho estilo Odoo */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
        <View style={{ width: 280 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.textMuted }}>Subtotal</Text>
            <Text style={{ fontSize: 8.5, color: COLORS.text }}>{fmt(subtotal)}</Text>
          </View>
          {([
            impuestos.iva105 > 0 ? ['I.V.A 10,5%', impuestos.iva105] as const : null,
            impuestos.iva21 > 0 ? ['I.V.A 21%', impuestos.iva21] as const : null,
            impuestos.ganancias > 0 ? ['Ganancias', impuestos.ganancias] as const : null,
            impuestos.iibb > 0 ? ['IIBB', impuestos.iibb] as const : null,
          ].filter(Boolean) as readonly (readonly [string, number])[]).map(([label, value]) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 }}>
              <Text style={{ fontSize: 8.5, color: COLORS.textMuted }}>{label}</Text>
              <Text style={{ fontSize: 8.5, color: COLORS.text }}>{fmt(value)}</Text>
            </View>
          ))}
          {(data.totalsByCurrency
            ? Object.entries(data.totalsByCurrency)
            : [[moneda, total] as [string, number]]
          ).map(([m, t]) => (
            <View key={m} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12, marginTop: 5 }}>
              <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: COLORS.white }}>TOTAL {m}</Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.white }}>{fmt(t)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Monto en letras */}
      <Text style={[S.monedaLetras, { marginBottom: 8 }]}>{montoEnLetras}</Text>

      {/* Tarjeta de condiciones: validez + forma de pago + disclaimer */}
      <View style={{ padding: 11, backgroundColor: COLORS.cardBg, borderRadius: 6, marginBottom: 8 }}>
        <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: COLORS.primary, marginBottom: 3 }}>
          Oferta válida por {presupuesto.validezDias || 15} días desde la fecha de emisión
          {condicionPago ? `   ·   Forma de pago: ${condicionPago.nombre}${condicionPago.dias > 0 ? ` (${condicionPago.dias} días)` : ''}` : ''}
          {presupuesto.condicionesComerciales ? `   ·   Ver condiciones comerciales en página 2` : ''}
        </Text>
        <Text style={{ fontSize: 7, color: COLORS.textMuted, lineHeight: 1.4 }}>
          No incluye ningún otro trabajo de lo indicado arriba, como ser puesta a punto de métodos
          analíticos, repuestos o consumibles no especificados, etc.
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

/** Notas técnicas en la PRIMERA hoja (pedido del user: el contexto técnico del trabajo
 *  debe verse junto a los items, no enterrado en la página de condiciones). */
function PDFNotasTecnicas({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  const visible = (presupuesto.seccionesVisibles || {}).notasTecnicas !== false;
  if (!visible || !presupuesto.notasTecnicas) return null;
  return (
    <View style={[S.condicionSection, { marginTop: 10 }]} wrap={false}>
      <Text style={S.condicionTitle}>NOTAS TÉCNICAS:</Text>
      <PDFRichText html={presupuesto.notasTecnicas} fallbackStyle={S.condicionText} />
    </View>
  );
}

function PDFCondiciones({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  const secciones = presupuesto.seccionesVisibles || {};

  const sections: { key: string; title: string; content: string | null | undefined }[] = [
    // notasTecnicas NO va acá: sale en la PRIMERA hoja (PDFNotasTecnicas), junto a los items.
    { key: 'notasAdministrativas', title: 'NOTAS ADMINISTRATIVAS:', content: presupuesto.notasAdministrativas },
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
        <View key={section.key} style={S.condicionSection} wrap={false}>
          <Text style={S.condicionTitle}>{section.title}</Text>
          <PDFRichText html={section.content} fallbackStyle={S.condicionText} />
        </View>
      ))}
    </View>
  );
}

function PDFFirma() {
  return (
    <View style={S.firmaSection} wrap={false}>
      <View style={S.firmaBlock}>
        <Text style={S.firmaLabel}>Fecha</Text>
        <View style={S.firmaLine} />
      </View>
      <View style={S.firmaBlock}>
        <Text style={S.firmaLabel}>Firma</Text>
        <View style={S.firmaLine} />
        <Text style={S.firmaSubLabel}>Aclaración</Text>
      </View>
    </View>
  );
}

function PDFFooter() {
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

export function PresupuestoPDFEstandar({ data }: { data: PresupuestoPDFData }) {
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
        <PDFNotasTecnicas data={data} />
        <PDFFooter />
      </Page>

      {/* Página 2: Condiciones */}
      <Page size="A4" style={S.page}>
        <PDFCondiciones data={data} />
        <PDFFirma />
        <PDFFooter />
      </Page>

      {/* Página 3: Conformidad + Firma detallada */}
      <Page size="A4" style={S.page}>
        <View style={{
          borderWidth: 1,
          borderColor: COLORS.primary,
          padding: 12,
          borderRadius: 4,
          marginBottom: 20,
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

        <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.text, marginBottom: 20 }}>
          Doy conformidad para efectuar el servicio descripto en el presente presupuesto.
        </Text>

        {/* Fecha */}
        <View style={{ flexDirection: 'row', marginBottom: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.primary, width: 60 }}>Fecha</Text>
          <View style={{ flex: 0.4, borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 20 }} />
        </View>

        {/* Firma + Aclaración */}
        <View style={{ flexDirection: 'row', marginBottom: 20, gap: 30 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.primary, marginBottom: 4 }}>Firma</Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 40 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.primary, marginBottom: 4 }}>Aclaración</Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 40 }} />
          </View>
        </View>

        {/* Lugar de recepción */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 8, fontWeight: 600, color: COLORS.primary, width: 160 }}>
            Lugar de recepción de la Factura
          </Text>
          <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: COLORS.text, height: 20 }} />
        </View>

        <PDFFooter />
      </Page>
    </Document>
  );
}
