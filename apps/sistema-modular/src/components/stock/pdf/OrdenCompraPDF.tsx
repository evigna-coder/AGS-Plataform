import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { OrdenCompra, Proveedor } from '@ags/shared';
import { LOGO_SRC, ISO_LOGO_SRC } from '../../presupuestos/pdf/logos';
import '../../presupuestos/pdf/pdfFonts';

/**
 * Rediseño 2026-07-16 (elegido por dirección sobre 5 alternativas en
 * docs/design/oc-pdf-alternativas.pen): mix "B+D" — encabezado editorial
 * (título serif, número grande en mono, regla) + cuerpo en bloques (tarjetas
 * proveedor/condiciones, tabla contenida con cebra, resumen y firmas).
 */
const COLORS = {
  primary: '#1C5D9C',
  primaryDark: '#143F6B',
  primarySoft: '#E8F0F8',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#cbd5e1',
  cardBg: '#F6F8FA',
};

const MONEDA_SYM: Record<string, string> = { ARS: '$', USD: 'U$S', EUR: '€' };

const S = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 46, paddingHorizontal: 40, fontSize: 8, color: COLORS.text, fontFamily: 'Inter' },
  logo: { width: 120, height: 'auto', marginBottom: 8 },
  companyInfo: { fontSize: 6.5, color: COLORS.textMuted, marginBottom: 1.5 },
  tituloSerif: { fontFamily: 'Times-Roman', fontSize: 21, color: COLORS.text },
  subEn: { fontFamily: 'Courier', fontSize: 6.5, letterSpacing: 1.6, color: COLORS.textMuted, marginTop: 2 },
  numero: { fontFamily: 'Courier-Bold', fontSize: 15, color: COLORS.primary, marginTop: 4 },
  fechaLinea: { fontSize: 7.5, color: COLORS.textMuted, marginTop: 3 },
  regla: { height: 1.5, backgroundColor: COLORS.primary, marginTop: 12, marginBottom: 14 },
  cardLabel: { fontFamily: 'Courier', fontSize: 6, letterSpacing: 1, color: COLORS.textMuted, marginBottom: 2 },
  provCard: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 6, padding: 12 },
  provName: { fontSize: 11, fontWeight: 'bold', color: COLORS.text, marginBottom: 2 },
  provLine: { fontSize: 7, color: COLORS.textMuted, marginBottom: 1 },
  condCard: { width: 220, borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 6, padding: 12, marginLeft: 12 },
  condRow: { flexDirection: 'row', marginBottom: 7 },
  condCell: { flex: 1 },
  condVal: { fontSize: 7, fontWeight: 600, color: COLORS.text },
  tablaWrap: { marginTop: 14, borderWidth: 0.75, borderColor: COLORS.border, borderRadius: 6, overflow: 'hidden' },
  thRow: { flexDirection: 'row', backgroundColor: COLORS.primarySoft, paddingVertical: 6, paddingHorizontal: 10 },
  th: { fontFamily: 'Courier', fontSize: 6, letterSpacing: 0.6, color: COLORS.primaryDark },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 10 },
  trZebra: { backgroundColor: COLORS.cardBg },
  td: { fontSize: 7.5, color: COLORS.text },
  tdMono: { fontFamily: 'Courier', fontSize: 7.5, color: COLORS.text },
  colNum: { width: '5%' },
  colCod: { width: '14%' },
  colDesc: { width: '39%' },
  colCant: { width: '8%', textAlign: 'right' },
  colUnid: { width: '10%', textAlign: 'center' },
  colPrecio: { width: '12%', textAlign: 'right' },
  colSub: { width: '12%', textAlign: 'right' },
  sumRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  sumCard: { width: 210, backgroundColor: COLORS.cardBg, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14 },
  sumLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sumLabel: { fontSize: 7.5, color: COLORS.textMuted },
  sumValue: { fontSize: 7.5, fontWeight: 600, color: COLORS.text },
  sumDiv: { height: 0.5, backgroundColor: COLORS.border, marginVertical: 4 },
  totLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totLabel: { fontFamily: 'Courier', fontSize: 7, letterSpacing: 0.8, color: COLORS.primaryDark },
  totValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  notas: { marginTop: 12 },
  notasText: { fontSize: 7, color: COLORS.textMuted },
  firmas: { flexDirection: 'row', gap: 40, marginTop: 34 },
  firma: { flex: 1, borderTopWidth: 0.75, borderTopColor: COLORS.text, paddingTop: 4 },
  firmaLabel: { fontSize: 6.5, color: COLORS.textMuted },
  footer: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 6 },
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

  const condiciones: [string, string][] = [
    ['PROFORMA', oc.proformaNumero ? `${oc.proformaNumero}${oc.fechaProforma ? ` (${fmtDate(oc.fechaProforma)})` : ''}` : '-'],
    ['ENTREGA ESTIMADA', fmtDate(oc.fechaEntregaEstimada)],
    ['COND. DE PAGO', oc.condicionesPago || '-'],
    ['INCOTERM', oc.incoterm || (esNacional ? '-' : '-')],
  ];

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header editorial */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Image src={LOGO_SRC} style={S.logo} />
            <Text style={S.companyInfo}>Arenales 605 - Piso 15, Vicente Lopez (B1638BRG)</Text>
            <Text style={S.companyInfo}>Buenos Aires, Argentina  ·  Tel 011-4524-7247</Text>
            <Text style={S.companyInfo}>info@agsanalitica.com  ·  CUIT 30-70861861-2  ·  IVA Resp. Inscripto</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.tituloSerif}>Orden de Compra</Text>
            <Text style={S.subEn}>PURCHASE ORDER</Text>
            <Text style={S.numero}>{oc.numero}</Text>
            <Text style={S.fechaLinea}>{fmtDate(oc.createdAt)}  ·  {esNacional ? 'Nacional' : 'Importacion'}  ·  {oc.moneda}</Text>
            <Image src={ISO_LOGO_SRC} style={{ width: 38, height: 'auto', marginTop: 5 }} />
          </View>
        </View>

        <View style={S.regla} />

        {/* Tarjetas: proveedor + condiciones */}
        <View style={{ flexDirection: 'row' }}>
          <View style={S.provCard}>
            <Text style={S.cardLabel}>PROVEEDOR / SUPPLIER</Text>
            <Text style={S.provName}>{oc.proveedorNombre || proveedor?.nombre || '-'}</Text>
            {proveedor?.direccion ? (
              <Text style={S.provLine}>{proveedor.direccion}{proveedor.pais ? ` — ${proveedor.pais}` : ''}</Text>
            ) : null}
            {(proveedor?.contacto || proveedor?.telefono || proveedor?.email) ? (
              <Text style={S.provLine}>
                {[
                  proveedor?.contacto || null,
                  proveedor?.telefono ? `Tel: ${proveedor.telefono}` : null,
                  proveedor?.email || null,
                ].filter(Boolean).join('  ·  ')}
              </Text>
            ) : null}
          </View>
          <View style={S.condCard}>
            <View style={S.condRow}>
              {condiciones.slice(0, 2).map(([k, v]) => (
                <View key={k} style={S.condCell}>
                  <Text style={S.cardLabel}>{k}</Text>
                  <Text style={S.condVal}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={[S.condRow, { marginBottom: 0 }]}>
              {condiciones.slice(2).map(([k, v]) => (
                <View key={k} style={S.condCell}>
                  <Text style={S.cardLabel}>{k}</Text>
                  <Text style={S.condVal}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Tabla de items */}
        <View style={S.tablaWrap}>
          <View style={S.thRow}>
            <Text style={[S.th, S.colNum]}>#</Text>
            <Text style={[S.th, S.colCod]}>CODIGO</Text>
            <Text style={[S.th, S.colDesc]}>DESCRIPCION</Text>
            <Text style={[S.th, S.colCant]}>CANT.</Text>
            <Text style={[S.th, S.colUnid]}>UNIDAD</Text>
            <Text style={[S.th, S.colPrecio]}>PRECIO</Text>
            <Text style={[S.th, S.colSub]}>SUBTOTAL</Text>
          </View>
          {oc.items.map((item, idx) => {
            const sub = item.cantidad * (item.precioUnitario || 0);
            return (
              <View key={item.id} style={idx % 2 === 1 ? [S.tr, S.trZebra] : S.tr}>
                <Text style={[S.td, S.colNum]}>{idx + 1}</Text>
                <Text style={[S.tdMono, S.colCod]}>{item.articuloCodigo || '-'}</Text>
                <Text style={[S.td, S.colDesc]}>{item.descripcion}</Text>
                <Text style={[S.td, S.colCant]}>{item.cantidad}</Text>
                <Text style={[S.td, S.colUnid]}>{item.unidadMedida}</Text>
                <Text style={[S.td, S.colPrecio]}>{item.precioUnitario != null ? fmtMoney(item.precioUnitario, sym) : '-'}</Text>
                <Text style={[S.td, S.colSub]}>{item.precioUnitario != null ? fmtMoney(sub, sym) : '-'}</Text>
              </View>
            );
          })}
        </View>

        {/* Resumen */}
        <View style={S.sumRow}>
          <View style={S.sumCard}>
            <View style={S.sumLine}>
              <Text style={S.sumLabel}>{esNacional ? 'Neto' : 'Subtotal'}</Text>
              <Text style={S.sumValue}>{fmtMoney(subtotal, sym)}</Text>
            </View>
            {esNacional ? (
              <View style={S.sumLine}>
                <Text style={S.sumLabel}>IVA</Text>
                <Text style={S.sumValue}>{fmtMoney(ivaTotal, sym)}</Text>
              </View>
            ) : null}
            <View style={S.sumDiv} />
            <View style={S.totLine}>
              <Text style={S.totLabel}>{esNacional ? 'TOTAL' : `TOTAL${oc.incoterm ? ` ${oc.incoterm.toUpperCase()}` : ''}`}</Text>
              <Text style={S.totValue}>{fmtMoney(total, sym)}</Text>
            </View>
          </View>
        </View>

        {oc.notas ? (
          <View style={S.notas}>
            <Text style={S.cardLabel}>NOTAS</Text>
            <Text style={S.notasText}>{oc.notas}</Text>
          </View>
        ) : null}

        {/* Firmas */}
        <View style={S.firmas}>
          <View style={S.firma}>
            <Text style={S.firmaLabel}>Autorizado por — AGS Analitica S.A.</Text>
          </View>
          <View style={S.firma}>
            <Text style={S.firmaLabel}>Aceptado por — Proveedor</Text>
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>AGS Analitica S.A. — Orden de Compra {oc.numero}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
