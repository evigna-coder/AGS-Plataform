import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Certificacion, ImporteCertificado, ItemCertificacion } from '@ags/shared';
import { LOGO_SRC, ISO_LOGO_SRC } from '../../presupuestos/pdf/logos';
import '../../presupuestos/pdf/pdfFonts';

const C = { ink: '#0F1F1E', ink2: '#46605E', ink3: '#93A8A6', rule: '#D9E5E3', wash: '#F5FAF9', teal: '#0D6E6E' };

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: C.ink, paddingTop: 34, paddingBottom: 58, paddingHorizontal: 40 },
  membrete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomWidth: 2, borderBottomColor: C.teal, paddingBottom: 10, marginBottom: 16 },
  logo: { width: 132 },
  iso: { width: 46 },
  titulo: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  sub: { fontSize: 9, color: C.ink2 },

  meta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  metaCell: { width: '33%', marginBottom: 6 },
  k: { fontSize: 6.5, letterSpacing: .8, color: C.ink3, marginBottom: 1 },
  v: { fontSize: 9.5 },

  intro: { fontSize: 9, color: C.ink2, lineHeight: 1.5, marginBottom: 12 },

  th: { flexDirection: 'row', backgroundColor: C.wash, borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: C.rule, paddingVertical: 5, paddingHorizontal: 6 },
  thTxt: { fontSize: 6.5, letterSpacing: .6, color: C.ink2, fontWeight: 'bold' },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: C.rule,
    paddingVertical: 5, paddingHorizontal: 6 },
  td: { fontSize: 8.5 },

  totBox: { marginTop: 14, alignSelf: 'flex-end', minWidth: 230, borderWidth: 1, borderColor: C.teal, borderRadius: 3 },
  totHead: { backgroundColor: C.teal, paddingVertical: 3, paddingHorizontal: 8 },
  totHeadTxt: { color: '#FFFFFF', fontSize: 7, letterSpacing: .8, fontWeight: 'bold' },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8 },

  firmas: { flexDirection: 'row', marginTop: 34, gap: 40 },
  firmaCol: { flex: 1 },
  firmaLinea: { borderTopWidth: 1, borderTopColor: C.ink2, marginTop: 42, paddingTop: 4 },
  firmaTxt: { fontSize: 6.5, letterSpacing: .6, color: C.ink3 },

  sello: { marginTop: 26, borderWidth: 1.5, borderColor: C.ink2, borderRadius: 4, padding: 12, width: 250 },
  selloTit: { fontSize: 7, letterSpacing: 1, color: C.ink2, fontWeight: 'bold', marginBottom: 8 },
  selloLinea: { borderBottomWidth: 0.8, borderBottomColor: C.rule, height: 15, marginBottom: 4 },
  selloCap: { fontSize: 6, color: C.ink3 },

  pie: { position: 'absolute', bottom: 28, left: 40, right: 40, flexDirection: 'row',
    justifyContent: 'space-between', borderTopWidth: 0.6, borderTopColor: C.rule, paddingTop: 5 },
  pieTxt: { fontSize: 6.5, color: C.ink3 },
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

const fechaLarga = (iso: string) => {
  const [a, m, d] = (iso || '').slice(0, 10).split('-');
  return a ? `${d}/${m}/${a}` : '—';
};

interface Props {
  cert: Certificacion;
  items: ItemCertificacion[];
  totales: ImporteCertificado[];
}

/**
 * Resumen de servicios a certificar — el documento que se le manda al cliente
 * (2026-08-17).
 *
 * Sale de la empresa con membrete y sello ISO, así que no lleva nada interno:
 * ni estados, ni motivos de objeción, ni números de presupuesto. Solo qué se
 * hizo, dónde, sobre qué equipo y cuánto se certifica.
 *
 * El recuadro de conformidad al pie es el que firma y sella el cliente: es el
 * comprobante que después habilita a facturar.
 */
export function CertificacionLotePDF({ cert, items, totales }: Props) {
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <Document title={`Certificación ${cert.clienteNombre ?? ''} ${cert.periodo ?? ''}`.trim()}>
      <Page size="A4" style={s.page}>
        <View style={s.membrete} fixed>
          <View>
            <Image src={LOGO_SRC} style={s.logo} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titulo}>Resumen de servicios a certificar</Text>
            <Text style={s.sub}>AGS Analítica S.R.L.</Text>
          </View>
          <Image src={ISO_LOGO_SRC} style={s.iso} />
        </View>

        <View style={s.meta}>
          {[
            ['CLIENTE', cert.clienteNombre || '—'],
            ['PERÍODO', cert.periodo || '—'],
            ['EMITIDO', fechaLarga(hoy)],
            ['SERVICIOS', String(items.length)],
            ['CONTRATO', cert.contratoNumero || '—'],
          ].map(([k, v]) => (
            <View key={k} style={s.metaCell}>
              <Text style={s.k}>{k}</Text>
              <Text style={s.v}>{v}</Text>
            </View>
          ))}
        </View>

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
            <Text style={[s.td, { width: COLS[4].w }]}>{(it.fechaServicio || '').slice(0, 10) || '—'}</Text>
          </View>
        ))}

        {totales.length > 0 && (
          <View style={s.totBox} wrap={false}>
            <View style={s.totHead}><Text style={s.totHeadTxt}>IMPORTE CERTIFICADO</Text></View>
            {totales.map(t => (
              <View key={t.moneda} style={s.totRow}>
                <Text style={{ fontSize: 8.5, color: C.ink2 }}>{t.moneda}</Text>
                <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{fmt(t)}</Text>
              </View>
            ))}
          </View>
        )}

        {cert.observaciones ? (
          <View style={{ marginTop: 14 }} wrap={false}>
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
            AGS Analítica S.R.L. · Resumen de servicios a certificar
            {cert.periodo ? ` · ${cert.periodo}` : ''}
          </Text>
          <Text style={s.pieTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
