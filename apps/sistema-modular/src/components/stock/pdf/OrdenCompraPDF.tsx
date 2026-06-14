import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { OrdenCompra, Proveedor } from '@ags/shared';
import { LOGO_SRC, ISO_LOGO_SRC } from '../../presupuestos/pdf/logos';

const COLORS = {
  primary: '#1C5D9C',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#cbd5e1',
  cardBg: '#F6F8FA',
};

const MONEDA_SYM: Record<string, string> = { ARS: '$', USD: 'U$S', EUR: '€' };

const S = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 40, paddingHorizontal: 36, fontSize: 8, color: COLORS.text, fontFamily: 'Helvetica' },
  logo: { width: 130, height: 'auto', marginBottom: 6 },
  companyName: { fontSize: 11, fontWeight: 'bold', color: COLORS.text, marginBottom: 2 },
  companyInfo: { fontSize: 7, color: COLORS.textMuted, marginBottom: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2.5, width: 190 },
  metaKey: { fontSize: 7.5, color: COLORS.textMuted, marginRight: 8 },
  metaVal: { fontSize: 7.5, fontWeight: 600, color: COLORS.text, textAlign: 'right' },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 4, padding: 10, marginBottom: 12 },
  cardLabel: { fontSize: 6.5, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  cardValue: { fontSize: 10, fontWeight: 'bold', color: COLORS.text },
  thRow: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 4, paddingHorizontal: 6 },
  th: { fontSize: 7, fontWeight: 'bold', color: '#ffffff' },
  tr: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  td: { fontSize: 8, color: COLORS.text },
  colNum: { width: '6%' },
  colDesc: { width: '46%' },
  colCant: { width: '12%', textAlign: 'right' },
  colUnid: { width: '12%', textAlign: 'center' },
  colPrecio: { width: '12%', textAlign: 'right' },
  colSub: { width: '12%', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', width: 170, marginBottom: 2 },
  sumLabel: { fontSize: 8, color: COLORS.textMuted },
  sumValue: { fontSize: 8, color: COLORS.text, fontWeight: 600 },
  totalBox: { backgroundColor: COLORS.primary, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 4 },
  totalLabel: { fontSize: 7, color: '#ffffff', marginRight: 10 },
  totalValue: { fontSize: 12, fontWeight: 'bold', color: '#ffffff' },
  notas: { marginTop: 12, fontSize: 8, color: COLORS.textMuted },
  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 6 },
  footerText: { fontSize: 6.5, color: COLORS.textMuted },
});

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
};
const fmtMoney = (n: number, sym: string) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function OrdenCompraPDF({ oc, proveedor }: { oc: OrdenCompra; proveedor?: Proveedor | null }) {
  const sym = MONEDA_SYM[oc.moneda] || '$';
  const esNacional = oc.tipo === 'nacional';
  const subtotal = oc.items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0), 0);
  const ivaTotal = esNacional
    ? oc.items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0) * ((i.porcentajeIva ?? 21) / 100), 0)
    : 0;
  const total = subtotal + ivaTotal;
  const meta: [string, string][] = [
    ['Fecha', fmtDate(oc.createdAt)],
    ['Tipo', oc.tipo === 'importacion' ? 'Importacion' : 'Nacional'],
    ['Moneda', oc.moneda],
    ['CUIT', '30-70861861-2'],
    ['IVA', 'Responsable Inscripto'],
  ];

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <View style={{ width: '52%' }}>
            <Image src={LOGO_SRC} style={S.logo} />
            <Text style={S.companyName}>AGS Analitica S.A.</Text>
            <Text style={S.companyInfo}>Arenales 605 - Piso 15</Text>
            <Text style={S.companyInfo}>Vicente Lopez (B1638BRG) - Buenos Aires - Argentina</Text>
            <Text style={S.companyInfo}>Te: 011-4524-7247</Text>
            <Text style={S.companyInfo}>info@agsanalitica.com</Text>
          </View>
          <View style={{ width: '44%', alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.3 }}>Orden de Compra</Text>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.text, marginTop: 4, marginBottom: 7 }}>{oc.numero}</Text>
            {meta.map(([k, v]) => (
              <View key={k} style={S.metaRow}>
                <Text style={S.metaKey}>{k}</Text>
                <Text style={S.metaVal}>{v}</Text>
              </View>
            ))}
            <Image src={ISO_LOGO_SRC} style={{ width: 42, height: 'auto', marginTop: 6 }} />
          </View>
        </View>

        {/* Proveedor + condiciones */}
        <View style={S.card}>
          <Text style={S.cardLabel}>Proveedor</Text>
          <Text style={S.cardValue}>{oc.proveedorNombre || proveedor?.nombre || '-'}</Text>
          {proveedor && (proveedor.direccion || proveedor.telefono || proveedor.contacto || proveedor.email) ? (
            <View style={{ marginTop: 3 }}>
              {proveedor.direccion ? (
                <Text style={{ fontSize: 7.5, color: COLORS.textMuted }}>
                  {proveedor.direccion}{proveedor.pais ? ` — ${proveedor.pais}` : ''}
                </Text>
              ) : null}
              <Text style={{ fontSize: 7.5, color: COLORS.textMuted }}>
                {[
                  proveedor.contacto ? `Contacto: ${proveedor.contacto}` : null,
                  proveedor.telefono ? `Tel: ${proveedor.telefono}` : null,
                  proveedor.email || null,
                ].filter(Boolean).join('   ·   ')}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 24 }}>
            <View>
              <Text style={S.cardLabel}>Proforma</Text>
              <Text style={{ fontSize: 8, color: COLORS.text }}>{oc.proformaNumero || '-'}{oc.fechaProforma ? `  (${fmtDate(oc.fechaProforma)})` : ''}</Text>
            </View>
            <View>
              <Text style={S.cardLabel}>Entrega estimada</Text>
              <Text style={{ fontSize: 8, color: COLORS.text }}>{fmtDate(oc.fechaEntregaEstimada)}</Text>
            </View>
            <View>
              <Text style={S.cardLabel}>Cond. de pago</Text>
              <Text style={{ fontSize: 8, color: COLORS.text }}>{oc.condicionesPago || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <View>
          <View style={S.thRow}>
            <Text style={[S.th, S.colNum]}>#</Text>
            <Text style={[S.th, S.colDesc]}>Descripcion</Text>
            <Text style={[S.th, S.colCant]}>Cant.</Text>
            <Text style={[S.th, S.colUnid]}>Unidad</Text>
            <Text style={[S.th, S.colPrecio]}>Precio</Text>
            <Text style={[S.th, S.colSub]}>Subtotal</Text>
          </View>
          {oc.items.map((item, idx) => {
            const sub = item.cantidad * (item.precioUnitario || 0);
            return (
              <View key={item.id} style={S.tr}>
                <Text style={[S.td, S.colNum]}>{idx + 1}</Text>
                <Text style={[S.td, S.colDesc]}>{item.descripcion}{item.articuloCodigo ? `  [${item.articuloCodigo}]` : ''}</Text>
                <Text style={[S.td, S.colCant]}>{item.cantidad}</Text>
                <Text style={[S.td, S.colUnid]}>{item.unidadMedida}</Text>
                <Text style={[S.td, S.colPrecio]}>{item.precioUnitario != null ? fmtMoney(item.precioUnitario, sym) : '-'}</Text>
                <Text style={[S.td, S.colSub]}>{item.precioUnitario != null ? fmtMoney(sub, sym) : '-'}</Text>
              </View>
            );
          })}
        </View>

        {/* Total */}
        <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
          {esNacional && (
            <View style={{ marginBottom: 4 }}>
              <View style={S.sumRow}><Text style={S.sumLabel}>Neto</Text><Text style={S.sumValue}>{fmtMoney(subtotal, sym)}</Text></View>
              <View style={S.sumRow}><Text style={S.sumLabel}>IVA</Text><Text style={S.sumValue}>{fmtMoney(ivaTotal, sym)}</Text></View>
            </View>
          )}
          <View style={S.totalBox}>
            <Text style={S.totalLabel}>TOTAL</Text>
            <Text style={S.totalValue}>{fmtMoney(total, sym)}</Text>
          </View>
        </View>

        {oc.notas ? (
          <View style={S.notas}>
            <Text style={S.cardLabel}>Notas</Text>
            <Text>{oc.notas}</Text>
          </View>
        ) : null}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>AGS Analitica S.A. - Orden de Compra {oc.numero}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
