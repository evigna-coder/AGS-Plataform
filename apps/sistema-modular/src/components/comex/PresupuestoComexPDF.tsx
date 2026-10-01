import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { PresupuestoComex } from '@ags/shared';
import { LOGO_SRC } from '../presupuestos/pdf/logos';
import '../presupuestos/pdf/pdfFonts';
import { usd, type ResultadoComex } from '../../utils/presupuestoComex';

/**
 * PDF del presupuesto de comex (2026-10-01): reemplaza la planilla pegada en
 * un Word. Mismo encabezado editorial que la orden de compra; por posición la
 * liquidación de gravámenes, después gastos y el resumen de costo.
 */
const C = { primary: '#0D6E6E', soft: '#E6F2F2', text: '#1e293b', muted: '#64748b', border: '#cbd5e1', card: '#F6F8FA' };

const S = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 44, paddingHorizontal: 40, fontSize: 8, color: C.text, fontFamily: 'Inter' },
  logo: { width: 112, height: 'auto', marginBottom: 6 },
  info: { fontSize: 6.5, color: C.muted, marginBottom: 1.5 },
  titulo: { fontFamily: 'Times-Roman', fontSize: 19, color: C.text },
  sub: { fontFamily: 'Courier', fontSize: 6.5, letterSpacing: 1.4, color: C.muted, marginTop: 2 },
  numero: { fontFamily: 'Courier-Bold', fontSize: 14, color: C.primary, marginTop: 4 },
  fecha: { fontSize: 7.5, color: C.muted, marginTop: 3 },
  regla: { height: 1.5, backgroundColor: C.primary, marginTop: 10, marginBottom: 12 },
  ref: { backgroundColor: C.card, borderRadius: 6, padding: 10, marginBottom: 12 },
  refTit: { fontSize: 11, fontWeight: 'bold' },
  refSub: { fontSize: 7.5, color: C.muted, marginTop: 2 },
  label: { fontFamily: 'Courier', fontSize: 6, letterSpacing: 1, color: C.muted, marginBottom: 4 },
  pos: { borderWidth: 0.75, borderColor: C.border, borderRadius: 6, marginBottom: 10, overflow: 'hidden' },
  posHead: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.soft, paddingVertical: 6, paddingHorizontal: 10 },
  posTit: { fontSize: 8.5, fontWeight: 'bold', color: C.text },
  posNcm: { fontFamily: 'Courier', fontSize: 7, color: C.primary },
  fila: { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 10 },
  zebra: { backgroundColor: C.card },
  cConcepto: { flex: 1 },
  cAlic: { width: 60, textAlign: 'right', color: C.muted },
  cMonto: { width: 90, textAlign: 'right', fontFamily: 'Courier' },
  totalFila: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 10, borderTopWidth: 0.75, borderTopColor: C.border },
  bold: { fontWeight: 'bold' },
  dosCol: { flexDirection: 'row', marginTop: 2 },
  gastos: { flex: 1, borderWidth: 0.75, borderColor: C.border, borderRadius: 6, paddingVertical: 8, marginRight: 10 },
  resumen: { width: 250, backgroundColor: C.card, borderRadius: 6, padding: 10 },
  resLinea: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resDiv: { height: 0.75, backgroundColor: C.border, marginVertical: 5 },
  costo: { fontFamily: 'Courier-Bold', fontSize: 11, color: C.primary },
  notas: { marginTop: 12, fontSize: 7.5, color: C.text, lineHeight: 1.4 },
  pie: { position: 'absolute', bottom: 18, left: 40, right: 40, fontSize: 6.5, color: C.muted, textAlign: 'center' },
});

const fecha = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const pctTxt = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`;

const Linea = ({ c, a, m, i }: { c: string; a?: string; m: number; i: number }) => (
  <View style={[S.fila, i % 2 ? S.zebra : {}]}>
    <Text style={S.cConcepto}>{c}</Text>
    <Text style={S.cAlic}>{a ?? ''}</Text>
    <Text style={S.cMonto}>{usd(m)}</Text>
  </View>
);

export function PresupuestoComexPDF({ p, r }: { p: PresupuestoComex; r: ResultadoComex }) {
  return (
    <Document title={`${p.numero} ${p.titulo}`}>
      <Page size="A4" style={S.page}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Image src={LOGO_SRC} style={S.logo} />
            <Text style={S.info}>Arenales 605 - Piso 15, Vicente Lopez (B1638BRG)</Text>
            <Text style={S.info}>Buenos Aires, Argentina  ·  Tel 011-4524-7247  ·  info@agsanalitica.com</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.titulo}>Estimación de costo de importación</Text>
            <Text style={S.sub}>IMPORT COST ESTIMATE</Text>
            <Text style={S.numero}>{p.numero}</Text>
            <Text style={S.fecha}>{fecha(p.fecha)}  ·  USD</Text>
          </View>
        </View>
        <View style={S.regla} />

        <View style={S.ref}>
          <Text style={S.refTit}>{p.titulo || 'Sin título'}</Text>
          {p.cliente ? <Text style={S.refSub}>{p.cliente}</Text> : null}
        </View>

        <Text style={S.label}>LIQUIDACIÓN POR POSICIÓN ARANCELARIA</Text>
        {r.posiciones.map((x, i) => {
          const pos = p.posiciones[i];
          return (
            <View key={x.id} style={S.pos} wrap={false}>
              <View style={S.posHead}>
                <Text style={S.posTit}>{x.descripcion || `Posición ${i + 1}`}</Text>
                <Text style={S.posNcm}>{x.ncm ? `NCM ${x.ncm}` : ''}</Text>
              </View>
              <Linea i={0} c="Valor en aduana (CIF)" m={x.cif} />
              <Linea i={1} c="Derechos de importación" a={pctTxt(pos?.derechosPct ?? 0)} m={x.derechos} />
              <Linea i={2} c="Tasa de estadística" a={pctTxt(pos?.estadisticaPct ?? 0)} m={x.estadistica} />
              <Linea i={3} c="Base imponible" m={x.baseImponible} />
              <Linea i={4} c="IVA" a={pctTxt(x.ivaPct)} m={x.iva} />
              <Linea i={5} c="IVA adicional" a={pctTxt(x.ivaAdicionalPct)} m={x.ivaAdicional} />
              <Linea i={6} c="Percepción de Ganancias" a={pctTxt(pos?.gananciasPct ?? 0)} m={x.ganancias} />
              <Linea i={7} c="Percepción de Ingresos Brutos" a={pctTxt(pos?.iibbPct ?? 0)} m={x.iibb} />
              <View style={S.totalFila}>
                <Text style={[S.cConcepto, S.bold]}>Total gravámenes</Text>
                <Text style={[S.cMonto, S.bold]}>{usd(x.totalGravamenes)}</Text>
              </View>
            </View>
          );
        })}

        <View style={S.dosCol} wrap={false}>
          <View style={S.gastos}>
            <Text style={[S.label, { paddingHorizontal: 10 }]}>GASTOS</Text>
            {p.gastos.map((g, i) => <Linea key={g.id} i={i} c={g.concepto || 'Gasto'} m={g.monto || 0} />)}
            {r.gastosBancarios > 0 && <Linea i={p.gastos.length} c="Gastos bancarios" m={r.gastosBancarios} />}
            <View style={S.totalFila}>
              <Text style={[S.cConcepto, S.bold]}>Total gastos</Text>
              <Text style={[S.cMonto, S.bold]}>{usd(r.totalGastos + r.gastosBancarios)}</Text>
            </View>
          </View>
          <View style={S.resumen}>
            <Text style={S.label}>RESUMEN</Text>
            <View style={S.resLinea}><Text>Valor (CIF)</Text><Text style={S.cMonto}>{usd(r.valorCif)}</Text></View>
            <View style={S.resLinea}><Text>Derechos, IIBB y gastos</Text><Text style={S.cMonto}>{usd(r.noRecuperable)}</Text></View>
            <View style={S.resLinea}><Text>Costo financiero ({pctTxt(p.costoFinancieroPct)})</Text><Text style={S.cMonto}>{usd(r.costoFinanciero)}</Text></View>
            <View style={S.resDiv} />
            <View style={S.resLinea}><Text style={S.bold}>Costo total</Text><Text style={S.costo}>{usd(r.costoTotal)}</Text></View>
            <View style={S.resLinea}><Text style={{ color: C.muted }}>Factor de importación</Text><Text style={S.cMonto}>{r.factor.toFixed(4)}</Text></View>
            <View style={S.resDiv} />
            <View style={S.resLinea}><Text style={{ color: C.muted }}>A pagar en aduana</Text><Text style={S.cMonto}>{usd(r.totalGravamenes)}</Text></View>
            <View style={S.resLinea}><Text style={{ color: C.muted }}>Erogación total</Text><Text style={S.cMonto}>{usd(r.erogacion)}</Text></View>
          </View>
        </View>

        {p.notas ? <Text style={S.notas}>{p.notas}</Text> : null}
        <Text style={S.pie} fixed>
          Estimación no vinculante. IVA, IVA adicional y percepciones son crédito fiscal o anticipo: se pagan en aduana pero no integran el costo, salvo su costo financiero. Los valores finales surgen del despacho.
        </Text>
      </Page>
    </Document>
  );
}
