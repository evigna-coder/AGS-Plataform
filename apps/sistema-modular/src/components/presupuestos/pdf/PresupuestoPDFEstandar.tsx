import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { baseStyles, COLORS } from './pdfStyles';
import './pdfFonts';
import { agruparPorSistemaSimple } from './pdfUtils';
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

function ItemRow({ item, index }: { item: PresupuestoItem; index: number }) {
  return (
    <View style={[S.tableRow, index % 2 === 1 ? S.tableRowAlt : {}]} wrap={false}>
      <Text style={[S.tableCell, S.tableCellCenter, { width: itemCols.item }]}>
        {String(index + 1).padStart(4, '0')}
      </Text>
      <Text style={[S.tableCell, { width: itemCols.producto }]}>{item.codigoProducto || '-'}</Text>
      <Text style={[S.tableCell, S.tableCellCenter, { width: itemCols.cantidad }]}>{item.cantidad?.toFixed(2) || '0.00'}</Text>
      <Text style={[S.tableCell, { width: itemCols.descripcion }]}>{item.descripcion}</Text>
      <Text style={[S.tableCell, S.tableCellRight, { width: itemCols.precio }]}>{item.precioUnitario?.toFixed(2) || '0.00'}</Text>
      <Text style={[S.tableCell, S.tableCellRight, { width: itemCols.total, fontWeight: 600 }]}>{item.subtotal?.toFixed(2) || '0.00'}</Text>
    </View>
  );
}

/**
 * Phase 10: clasifica items de un ppto mixto/partes para rendering en 2 secciones.
 * Reglas:
 *   - Con `stockArticuloId` (no-null)    → 'partes'
 *   - Con `conceptoServicioId` (no-null) → 'servicios'
 *   - Sin ninguno (carga manual texto)   → 'servicios' (default, los partes tienen stock siempre)
 */
function splitItemsByTipo(items: PresupuestoItem[]): { servicios: PresupuestoItem[]; partes: PresupuestoItem[] } {
  const servicios: PresupuestoItem[] = [];
  const partes: PresupuestoItem[] = [];
  for (const it of items) {
    if (it.stockArticuloId) partes.push(it);
    else servicios.push(it);
  }
  return { servicios, partes };
}

function sumSubtotal(items: PresupuestoItem[]): number {
  return items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
}

/**
 * Phase 10 — Tabla flat de items (sin agrupación por sistema).
 * Reusada por MixtoItemsBlock y por el renderer default (servicio/ventas).
 */
function ItemsTable({ items, moneda: _moneda }: { items: PresupuestoItem[]; moneda: string }) {
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
      {items.map((item, i) => <ItemRow key={item.id} item={item} index={i} />)}
    </View>
  );
}

/**
 * Phase 10 — Renderea items en 2 secciones con headers + subtotales.
 * Oculta la sección 'Servicios' si está vacía (caso partes puro).
 * Reusa ItemsTable extraído en Step 0.
 */
function MixtoItemsBlock({ items, moneda }: { items: PresupuestoItem[]; moneda: string }) {
  const { servicios, partes } = splitItemsByTipo(items);
  const sym = (moneda || 'USD');
  return (
    <View>
      {servicios.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 }}>
            Servicios
          </Text>
          <ItemsTable items={servicios} moneda={moneda} />
          <Text style={{ fontSize: 9, textAlign: 'right', marginTop: 2, fontWeight: 'bold' }}>
            Subtotal servicios: {sym} {sumSubtotal(servicios).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      )}
      {partes.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 }}>
            Partes
          </Text>
          <ItemsTable items={partes} moneda={moneda} />
          <Text style={{ fontSize: 9, textAlign: 'right', marginTop: 2, fontWeight: 'bold' }}>
            Subtotal partes: {sym} {sumSubtotal(partes).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      )}
    </View>
  );
}

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

function PDFHeader({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  return (
    <View style={S.headerRow}>
      {/* Logo + datos empresa */}
      <View style={S.logoSection}>
        <Image src={data.logoSrc} style={S.logo} />
        <Text style={S.companyName}>AGS Analítica S.A.</Text>
        <Text style={S.companyInfo}>Bauness 2351 - 1ro.C - C1431DNS</Text>
        <Text style={S.companyInfo}>CABA - Capital Federal - Argentina</Text>
        <Text style={S.companyInfo}>Te: 011-4524-7247</Text>
        <Text style={S.companyInfo}>info@agsanalitica.com</Text>
        <Text style={S.companyInfo}>www.agsanalitica.com</Text>
      </View>

      {/* Título central */}
      <View style={S.titleSection}>
        <View style={S.titleBox}>
          <Text style={S.titleLabel}>PRESUPUESTO</Text>
          <Text style={S.titleSubLabel}>Documento no válido{'\n'}como factura</Text>
        </View>
      </View>

      {/* Metadata derecha */}
      <View style={S.metaSection}>
        <View style={S.metaBox}>
          <Text style={{
            fontSize: 10,
            fontWeight: 'bold',
            color: COLORS.primary,
            textAlign: 'center',
            marginBottom: 6,
          }}>
            {presupuesto.numero}
          </Text>
          <View style={S.metaRow}>
            <Text style={S.metaLabel}>Fecha:</Text>
            <Text style={S.metaValue}>{formatDate(presupuesto.createdAt)}</Text>
          </View>
          <View style={S.metaRow}>
            <Text style={S.metaLabel}>Usuario:</Text>
            <Text style={S.metaValue}>{presupuesto.responsableNombre || '-'}</Text>
          </View>
          <View style={S.metaRow}>
            <Text style={S.metaLabel}>CUIT:</Text>
            <Text style={S.metaValue}>30-70861861-2</Text>
          </View>
          <View style={S.metaRow}>
            <Text style={S.metaLabel}>Ing. Brutos C.M.:</Text>
            <Text style={S.metaValue}>30-70861861-2 901</Text>
          </View>
          <View style={S.metaRow}>
            <Text style={S.metaLabel}>IVA:</Text>
            <Text style={S.metaValue}>Responsable Inscripto</Text>
          </View>
        </View>
        <Image src={data.isoLogoSrc} style={S.isoLogo} />
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

  return (
    <View style={S.clienteSection}>
      {/* Fila 1: Cliente + Teléfono */}
      <View style={S.clienteRow}>
        <Text style={S.clienteLabel}>Cliente:</Text>
        <Text style={S.clienteValue}>{nombre}</Text>
        <Text style={S.clienteLabelSmall}>Te:</Text>
        <Text style={[S.clienteValue, { flex: 0.6 }]}>{tel}</Text>
      </View>
      {/* Fila 2: Dirección + Localidad */}
      <View style={S.clienteRow}>
        <Text style={S.clienteLabel}>Dirección:</Text>
        <Text style={S.clienteValue}>{dir}</Text>
        <Text style={S.clienteLabelSmall}>Localidad:</Text>
        <Text style={[S.clienteValue, { flex: 0.6 }]}>{localidad}</Text>
      </View>
      {/* Fila 3: Contacto + Sector + Mail */}
      <View style={[S.clienteRow, { borderBottomWidth: 0 }]}>
        <Text style={S.clienteLabel}>Contacto:</Text>
        <Text style={[S.clienteValue, { flex: 0.5 }]}>{contactoNombre}</Text>
        <Text style={S.clienteLabelSmall}>Sector:</Text>
        <Text style={[S.clienteValue, { flex: 0.4 }]}>{sector}</Text>
        <Text style={[S.clienteLabelSmall, { width: 30 }]}>Mail:</Text>
        <Text style={[S.clienteValue, { flex: 0.6 }]}>{email}</Text>
      </View>
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
          let counter = 0;
          return (
            <View key={grupo.grupo}>
              <View style={{ flexDirection: 'row', backgroundColor: COLORS.sectionBg, paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
                <Text style={{ fontSize: 7, fontWeight: 600, color: COLORS.headerBg }}>
                  {grupo.grupo > 0 ? `${grupo.grupo}. ` : ''}{grupo.sistemaNombre.toUpperCase()}
                </Text>
              </View>
              {grupo.items.map((item) => {
                counter++;
                return <ItemRow key={item.id} item={item} index={counter - 1} />;
              })}
            </View>
          );
        })
      ) : (
        items.map((item, i) => <ItemRow key={item.id} item={item} index={i} />)
      )}
    </View>
  );
}

function PDFTotals({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto, impuestos, condicionPago } = data;
  const { moneda, subtotal, total, montoEnLetras } = { ...presupuesto, montoEnLetras: data.montoEnLetras };

  return (
    <View>
      {/* Forma de pago */}
      {condicionPago && (
        <View style={S.formaPago}>
          <Text style={S.formaPagoLabel}>Forma de Pago:</Text>
          <Text style={S.formaPagoValue}>
            {condicionPago.nombre}{condicionPago.dias > 0 ? ` (${condicionPago.dias} días)` : ''}
            {presupuesto.condicionesComerciales
              ? ` - (VER CONDICIONES COMERCIALES PÁGINA 2)`
              : ''}
          </Text>
        </View>
      )}

      {/* Validez — bloque de protección contractual prominente */}
      <View style={S.validezBox}>
        <Text style={S.validezText}>
          OFERTA VÁLIDA POR {presupuesto.validezDias || 15} DÍAS desde la fecha de emisión
        </Text>
      </View>

      {/* Disclaimer + Totales */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ width: '55%', paddingRight: 10 }}>
          <Text style={{ fontSize: 6.5, color: COLORS.textMuted, lineHeight: 1.4 }}>
            (No incluye ningún otro trabajo de lo indicado arriba, como ser puesta a punto de
            métodos analíticos, repuestos o consumibles no especificados, etc.)
          </Text>
        </View>

        {/* Totals box */}
        <View style={S.totalsBox}>
          <View style={S.totalsRow}>
            <Text style={S.totalsLabel}>Subtotal:</Text>
            <Text style={S.totalsValue}>{subtotal?.toFixed(2)}</Text>
          </View>
          {impuestos.iva105 > 0 && (
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>I.V.A: 10,5%</Text>
              <Text style={S.totalsValue}>{impuestos.iva105.toFixed(2)}</Text>
            </View>
          )}
          {impuestos.iva21 > 0 && (
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>I.V.A: 21%</Text>
              <Text style={S.totalsValue}>{impuestos.iva21.toFixed(2)}</Text>
            </View>
          )}
          {impuestos.ganancias > 0 && (
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Ganancias:</Text>
              <Text style={S.totalsValue}>{impuestos.ganancias.toFixed(2)}</Text>
            </View>
          )}
          {impuestos.iibb > 0 && (
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>IIBB:</Text>
              <Text style={S.totalsValue}>{impuestos.iibb.toFixed(2)}</Text>
            </View>
          )}
          {data.totalsByCurrency ? (
            Object.entries(data.totalsByCurrency).map(([m, t]) => (
              <View key={m} style={S.totalsRowFinal}>
                <Text style={S.totalsLabelFinal}>TOTAL {m}</Text>
                <Text style={S.totalsValueFinal}>{t?.toFixed(2)}</Text>
              </View>
            ))
          ) : (
            <View style={S.totalsRowFinal}>
              <Text style={S.totalsLabelFinal}>TOTAL {moneda}</Text>
              <Text style={S.totalsValueFinal}>{total?.toFixed(2)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Monto en letras */}
      <Text style={S.monedaLetras}>{montoEnLetras}</Text>

      {/* Plan de cuotas */}
      {presupuesto.cuotas && presupuesto.cuotas.length > 0 && (
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
                <Text style={{ fontSize: 6, width: '30%', textAlign: 'right' }}>{c.monto?.toFixed(2)}</Text>
                <Text style={{ fontSize: 6, width: '35%', textAlign: 'left', paddingLeft: 6 }}>{c.descripcion || ''}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function PDFCondiciones({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  const secciones = presupuesto.seccionesVisibles || {};

  const sections: { key: string; title: string; content: string | null | undefined }[] = [
    { key: 'notasTecnicas', title: 'NOTAS TÉCNICAS:', content: presupuesto.notasTecnicas },
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
          <Text style={S.condicionText}>{section.content}</Text>
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

        {/* Phase 10: mixto/partes → 2 secciones; contrato → PDFItemsTable con grupos; resto → tabla flat */}
        {(data.presupuesto.tipo === 'mixto' || data.presupuesto.tipo === 'partes') ? (
          <MixtoItemsBlock items={data.presupuesto.items} moneda={data.presupuesto.moneda} />
        ) : data.presupuesto.tipo === 'contrato' ? (
          <PDFItemsTable data={data} />
        ) : (
          <ItemsTable items={data.presupuesto.items} moneda={data.presupuesto.moneda} />
        )}

        <PDFTotals data={data} />
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
