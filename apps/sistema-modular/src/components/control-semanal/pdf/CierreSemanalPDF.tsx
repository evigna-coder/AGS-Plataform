import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { CierreSemanal } from '@ags/shared';
import { LOGO_SRC } from '../../presupuestos/pdf/logos';
import { COLORS } from '../../presupuestos/pdf/pdfStyles';
import '../../presupuestos/pdf/pdfFonts';

const C = COLORS;
const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 28, fontFamily: 'Inter', fontSize: 8, color: C.text },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: C.primary, paddingBottom: 6, marginBottom: 8 },
  logo: { width: 84 },
  titulo: { fontSize: 14, fontWeight: 'bold', color: C.primary },
  sub: { fontSize: 8, color: C.textMuted, marginTop: 2 },
  kpis: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  kpi: { flex: 1, borderWidth: 0.8, borderColor: C.borderLight, borderRadius: 3, paddingVertical: 4, paddingHorizontal: 6 },
  kpiK: { fontSize: 6, letterSpacing: .6, color: C.textMuted, textTransform: 'uppercase' },
  kpiV: { fontSize: 12, fontWeight: 'bold', color: C.primary, marginTop: 1 },
  h2: { fontSize: 9, fontWeight: 'bold', color: C.primary, marginTop: 10, marginBottom: 4, letterSpacing: .4 },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.primary, paddingVertical: 3, paddingHorizontal: 3 },
  thTxt: { fontSize: 6.5, fontWeight: 'bold', color: C.primary, letterSpacing: .3 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: C.borderLight, paddingVertical: 3, paddingHorizontal: 3 },
  td: { fontSize: 7.2, paddingRight: 4 },
  muted: { color: C.textMuted },
  rojo: { color: '#b91c1c' },
  ambar: { color: '#b45309' },
  vacio: { fontSize: 7.5, color: C.textMuted, fontStyle: 'italic', paddingVertical: 4 },
  comentarios: { marginTop: 14, borderWidth: 1, borderColor: C.primary, borderRadius: 3, padding: 8 },
  comLinea: { borderBottomWidth: 0.5, borderBottomColor: C.borderLight, height: 16 },
  pie: { position: 'absolute', bottom: 18, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.borderLight, paddingTop: 4 },
  pieTxt: { fontSize: 6.5, color: C.textMuted },
});

type Estilo = Parameters<typeof StyleSheet.create>[0][string];
type Col = { h: string; w?: number; get: (r: any) => string; estilo?: (r: any) => Estilo };
const dias = (n: number | null) => (n == null ? '' : `${n} d`);
const fecha = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const nada: Estilo = {};
const colorDias = (n: number | null): Estilo => (n == null ? nada : n >= 30 ? s.rojo : n >= 14 ? s.ambar : nada);

function Tabla({ cols, rows, vacio }: { cols: Col[]; rows: any[]; vacio: string }) {
  if (rows.length === 0) return <Text style={s.vacio}>{vacio}</Text>;
  return (
    <View>
      <View style={s.th} fixed>
        {cols.map(c => <Text key={c.h} style={[s.thTxt, c.w ? { width: c.w } : { flex: 1 }]}>{c.h}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          {cols.map(c => (
            <Text key={c.h} style={[s.td, c.w ? { width: c.w } : { flex: 1 }, c.estilo ? c.estilo(r) : nada]}>{c.get(r)}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const colsOT: Col[] = [
  { h: 'FECHA', w: 44, get: r => fecha(r.fecha) },
  { h: 'OT', w: 48, get: r => r.otNumber },
  { h: 'CLIENTE', w: 150, get: r => r.cliente },
  { h: 'INGENIERO', w: 80, get: r => r.ingeniero },
  { h: 'SERVICIO', w: 100, get: r => r.servicio },
  { h: 'ESTADO', w: 70, get: r => r.estado, estilo: r => (r.estado === 'Sin realizar' ? s.rojo : r.estado === 'Sin cierre admin' ? s.ambar : nada) },
  { h: 'TRABADA', w: 38, get: r => dias(r.diasTrabado), estilo: r => colorDias(r.diasTrabado) },
  { h: 'MOTIVO', get: r => r.motivos.join(' · ') },
];
const colsEntregas: Col[] = [
  { h: 'OT', w: 48, get: r => r.otNumber },
  { h: 'CLIENTE', w: 170, get: r => r.cliente },
  { h: 'SERVICIO', w: 120, get: r => r.servicio },
  { h: 'PRESUPUESTO', w: 90, get: r => r.presupuestos.join(', ') },
  { h: 'VALOR', w: 90, get: r => r.valor },
  { h: 'ESTADO', w: 80, get: r => r.estado },
  { h: 'CREADA', get: r => fecha(r.creada) },
];
const colsPpto: Col[] = [
  { h: 'PRESUPUESTO', w: 72, get: r => r.numero },
  { h: 'CLIENTE', w: 150, get: r => r.cliente },
  { h: 'TOTAL', w: 70, get: r => r.total },
  { h: 'ESTADO', w: 80, get: r => r.estado },
  { h: 'SIN FACTURAR', w: 48, get: r => dias(r.diasTrabado), estilo: r => colorDias(r.diasTrabado) },
  { h: 'QUÉ FALTA', get: r => r.queFalta.join(' · ') },
  { h: 'COMENTARIO', w: 110, get: r => r.comentario ?? '', estilo: () => s.muted },
];
const colsFact: Col[] = [
  { h: 'PASADO EL', w: 48, get: r => fecha(r.pasadoEl) },
  { h: 'EN FACT.', w: 38, get: r => dias(r.diasTrabado), estilo: r => colorDias(r.diasTrabado) },
  { h: 'PRESUPUESTO', w: 72, get: r => r.presupuesto },
  { h: 'CLIENTE', w: 150, get: r => r.cliente },
  { h: 'MONTO', w: 80, get: r => r.monto },
  { h: 'OTS', w: 80, get: r => r.ots.join(', ') },
  { h: 'ESTADO', w: 60, get: r => r.estado },
  { h: 'N° FACTURA', w: 70, get: r => r.nroFactura ?? '' },
  { h: 'COMENTARIO', get: r => r.comentario ?? '', estilo: () => s.muted },
];

const fmtMontos = (m: Record<string, number>) =>
  Object.entries(m).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`).join(' · ') || '—';

/**
 * PDF del cierre semanal para dirección (2026-09-09): la foto congelada del
 * control de la semana (lunes a domingo), sección por sección, y al final un
 * cuadro de comentarios en blanco para escribir a mano sobre la copia
 * impresa. Apaisado: las tablas son anchas.
 */
export function CierreSemanalPDF({ cierre }: { cierre: CierreSemanal }) {
  const d = cierre.datos; const r = cierre.resumen;
  const rango = `${fecha(cierre.semanaInicio)} al ${fecha(cierre.semanaFin)}`;
  const pptoSemana = d.presupuestos.filter(p => !p.arrastre);
  const pptoArrastre = d.presupuestos.filter(p => p.arrastre);
  return (
    <Document title={`Cierre semanal ${rango}`} author="AGS Analítica S.A.">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.head} fixed>
          <Image src={LOGO_SRC} style={s.logo} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titulo}>Cierre semanal · {rango}</Text>
            <Text style={s.sub}>Generado el {fecha(cierre.generadoAt)}{cierre.generadoPorNombre ? ` por ${cierre.generadoPorNombre}` : ''} · Coordinación, presupuestos y facturación</Text>
          </View>
        </View>

        <View style={s.kpis}>
          {[
            ['OTs agendadas', r.agendadas], ['Con cierre admin', r.cerradas], ['Sin cierre admin', r.sinCierreAdmin], ['Sin realizar', r.sinRealizar],
            ['Arrastre OTs', r.otsArrastre], ['Entregas pend.', r.entregasPendientes], ['Pptos en control', r.presupuestosEnControl],
            ['Listos sin aviso', r.listosSinAviso], ['Sin OC', r.sinOC], ['Sin facturar', r.sinFacturar],
          ].map(([k, v]) => (
            <View key={String(k)} style={s.kpi}><Text style={s.kpiK}>{k}</Text><Text style={s.kpiV}>{v}</Text></View>
          ))}
          <View style={[s.kpi, { flex: 1.6 }]}><Text style={s.kpiK}>Monto sin facturar</Text><Text style={[s.kpiV, { fontSize: 9 }]}>{fmtMontos(r.montoSinFacturar)}</Text></View>
        </View>

        <Text style={s.h2}>1. OTs agendadas en la semana ({d.ots.length})</Text>
        <Tabla cols={colsOT} rows={d.ots} vacio="Sin OTs agendadas en la semana." />
        <Text style={s.h2}>1c. OTs que arrastran de semanas anteriores ({d.otsArrastre.length})</Text>
        <Tabla cols={colsOT.map(c => (c.h === 'FECHA' ? { ...c, h: 'AGENDADA' } : c))} rows={d.otsArrastre} vacio="Nada arrastrado." />
        <Text style={s.h2}>1b. Entregas de partes pendientes ({d.entregas.length})</Text>
        <Tabla cols={colsEntregas} rows={d.entregas} vacio="Sin entregas pendientes." />
        <Text style={s.h2}>2. Presupuestos con trabajo realizado ({pptoSemana.length})</Text>
        <Tabla cols={colsPpto} rows={pptoSemana} vacio="Sin presupuestos en control esta semana." />
        {pptoArrastre.length > 0 && (<>
          <Text style={s.h2}>2b. Presupuestos que arrastran ({pptoArrastre.length})</Text>
          <Tabla cols={colsPpto} rows={pptoArrastre} vacio="" />
        </>)}
        <Text style={s.h2}>3. Facturación ({d.facturacion.length})</Text>
        <Tabla cols={colsFact} rows={d.facturacion} vacio="Sin avisos a facturación en control." />

        <View style={s.comentarios} wrap={false}>
          <Text style={[s.kpiK, { marginBottom: 6 }]}>Comentarios de la reunión de cierre</Text>
          {Array.from({ length: 8 }).map((_, i) => <View key={i} style={s.comLinea} />)}
        </View>

        <View style={s.pie} fixed>
          <Text style={s.pieTxt}>AGS Analítica S.A. · Cierre semanal · {rango} · uso interno</Text>
          <Text style={s.pieTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
