import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Certificacion, Cliente, Establecimiento, ImporteCertificado, ItemCertificacion, Presupuesto } from '@ags/shared';
import { LOGO_SRC, ISO_LOGO_SRC } from '../../presupuestos/pdf/logos';
import { baseStyles, COLORS } from '../../presupuestos/pdf/pdfStyles';
import { PDFHeader, PDFClienteInfo, type PDFCabeceraData } from '../../presupuestos/pdf/PresupuestoPDFEstandar';
import '../../presupuestos/pdf/pdfFonts';

const C = COLORS;

const s = StyleSheet.create({
  k: { fontSize: 6.5, letterSpacing: .8, color: C.textMuted, marginBottom: 1 },

  intro: { fontSize: 8.5, color: C.textMuted, lineHeight: 1.5, marginBottom: 10 },

  th: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.primary },
  thTxt: { fontSize: 7.5, fontWeight: 'bold', color: C.primary, letterSpacing: .4 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.borderLight,
    paddingVertical: 4, paddingHorizontal: 4 },
  td: { fontSize: 8 },

  totBox: { marginTop: 12, alignSelf: 'flex-end', minWidth: 230, borderWidth: 1, borderColor: C.primary, borderRadius: 3 },
  totHead: { backgroundColor: C.primary, paddingVertical: 3, paddingHorizontal: 8 },
  totHeadTxt: { color: C.white, fontSize: 7, letterSpacing: .8, fontWeight: 'bold' },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8 },

  firmas: { flexDirection: 'row', marginTop: 30, gap: 40 },
  firmaCol: { flex: 1 },
  firmaLinea: { borderTopWidth: 1, borderTopColor: C.textMuted, marginTop: 42, paddingTop: 4 },
  firmaTxt: { fontSize: 6.5, letterSpacing: .6, color: C.textMuted },

  sello: { marginTop: 22, borderWidth: 1.5, borderColor: C.textMuted, borderRadius: 4, padding: 12, width: 250 },
  selloTit: { fontSize: 7, letterSpacing: 1, color: C.textMuted, fontWeight: 'bold', marginBottom: 8 },
  selloLinea: { borderBottomWidth: 0.8, borderBottomColor: C.borderLight, height: 15, marginBottom: 4 },
  selloCap: { fontSize: 6, color: C.textMuted },

  pie: { position: 'absolute', bottom: 24, left: 30, right: 30, flexDirection: 'row',
    justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.borderLight, paddingTop: 5 },
  pieTxt: { fontSize: 6.5, color: C.textMuted },
});

const COLS = [
  { h: 'ESTABLECIMIENTO', w: 108 },
  { h: 'N° DE OT', w: 56 },
  { h: 'EQUIPO', w: 0 },
  { h: 'SERVICIO REALIZADO', w: 0 },
  { h: 'FECHA', w: 48 },
];

const fmt = (i: ImporteCertificado) =>
  `${i.moneda} ${i.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

const fechaCorta = (iso: string) => {
  const [a, m, d] = (iso || '').slice(0, 10).split('-');
  return a ? `${d}/${m}/${a}` : '—';
};

interface Props {
  cert: Certificacion;
  items: ItemCertificacion[];
  totales: ImporteCertificado[];
  /** Para el bloque de cliente de la cabecera (mismo que el presupuesto). */
  cliente: Cliente | null;
  /** Solo cuando el lote es de una única planta; con varias, van en la tabla. */
  establecimiento: Establecimiento | null;
}

/**
 * Resumen de servicios a certificar — el documento que se le manda al cliente
 * (2026-08-17).
 *
 * Sale de la empresa con la MISMA cabecera que el presupuesto (membrete, datos
 * fiscales, sello TÜV y bloque de cliente — pedido 2026-09-04), así que no
 * lleva nada interno: ni estados, ni motivos de objeción, ni números de
 * presupuesto. Solo qué se hizo, dónde, sobre qué equipo y cuánto se certifica.
 *
 * El recuadro de conformidad al pie es el que firma y sella el cliente: es el
 * comprobante que después habilita a facturar.
 */
export function CertificacionLotePDF({ cert, items, totales, cliente, establecimiento }: Props) {
  const hoy = new Date().toISOString().slice(0, 10);
  const cabecera: PDFCabeceraData = {
    // La cabecera lee N°/fecha/preparó del "presupuesto"; acá van los del lote.
    presupuesto: { numero: cert.numero ?? '', createdAt: cert.fecha, responsableNombre: null, items: [] } as unknown as Pick<Presupuesto, 'numero' | 'createdAt' | 'responsableNombre' | 'items'>,
    cliente,
    establecimiento,
    contacto: null,
    logoSrc: LOGO_SRC,
    isoLogoSrc: ISO_LOGO_SRC,
  };
  const doc = {
    titulo: 'Certificación de servicios',
    leyenda: 'Resumen de servicios ejecutados a certificar',
    numero: cert.periodo ? `Período ${cert.periodo}` : null,
    meta: [
      ['Emitido', fechaCorta(hoy)],
      ['Servicios', String(items.length)],
      ...(cert.contratoNumero ? [['Contrato', cert.contratoNumero] as [string, string]] : []),
    ] as [string, string][],
  };
  return (
    <Document title={`Certificación ${cert.clienteNombre ?? ''} ${cert.periodo ?? ''}`.trim()} author="AGS Analítica S.A.">
      <Page size="A4" style={baseStyles.page}>
        <PDFHeader data={cabecera} doc={doc} />
        <PDFClienteInfo data={cabecera} />

        <Text style={s.intro}>
          Se detallan a continuación los servicios ejecutados en el período indicado, pendientes
          de certificación por parte del cliente. La conformidad sobre este detalle habilita la
          facturación de los servicios listados.
        </Text>

        <View style={s.th} fixed>
          {COLS.map(c => (
            <Text key={c.h} style={[s.thTxt, c.w ? { width: c.w } : { flex: 1 }]}>{c.h}</Text>
          ))}
        </View>
        {items.map((it, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={[s.td, { width: COLS[0].w }]}>{it.establecimientoNombre || '—'}</Text>
            <Text style={[s.td, { width: COLS[1].w, fontWeight: 'bold' }]}>{it.otNumber}</Text>
            <Text style={[s.td, { flex: 1, paddingRight: 6 }]}>{it.equipo || '—'}</Text>
            <Text style={[s.td, { flex: 1, paddingRight: 6 }]}>{it.descripcionServicio || '—'}</Text>
            <Text style={[s.td, { width: COLS[4].w }]}>{fechaCorta(it.fechaServicio || '')}</Text>
          </View>
        ))}

        {totales.length > 0 && (
          <View style={s.totBox} wrap={false}>
            <View style={s.totHead}><Text style={s.totHeadTxt}>IMPORTE CERTIFICADO</Text></View>
            {totales.map(t => (
              <View key={t.moneda} style={s.totRow}>
                <Text style={{ fontSize: 8.5, color: C.textMuted }}>{t.moneda}</Text>
                <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{fmt(t)}</Text>
              </View>
            ))}
          </View>
        )}

        {cert.observaciones ? (
          <View style={{ marginTop: 12 }} wrap={false}>
            <Text style={s.k}>OBSERVACIONES</Text>
            <Text style={{ fontSize: 8.5, lineHeight: 1.45 }}>{cert.observaciones}</Text>
          </View>
        ) : null}

        {/* Sello y firma del cliente: es el comprobante que habilita a facturar. */}
        <View style={s.firmas} wrap={false}>
          <View style={s.firmaCol}>
            <View style={s.sello}>
              <Text style={s.selloTit}>CERTIFICACIÓN DEL CLIENTE</Text>
              <View style={s.selloLinea} />
              <Text style={s.selloCap}>N° de certificación</Text>
              <View style={[s.selloLinea, { marginTop: 8 }]} />
              <Text style={s.selloCap}>Fecha</Text>
            </View>
          </View>
          <View style={s.firmaCol}>
            <View style={s.firmaLinea}>
              <Text style={s.firmaTxt}>FIRMA, ACLARACIÓN Y SELLO</Text>
            </View>
          </View>
        </View>

        <View style={s.pie} fixed>
          <Text style={s.pieTxt}>
            AGS Analítica S.A. · Certificación de servicios
            {cert.periodo ? ` · ${cert.periodo}` : ''}
          </Text>
          <Text style={s.pieTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
