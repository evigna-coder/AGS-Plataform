import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { VentasInsumosReportRow, VentasInsumosRangeLabel } from '../../../utils/ventasInsumosReport';
import { fmtDateShort, fmtCurrencyARS } from '../../../utils/ventasInsumosReport';

const TEAL = '#0D6E6E';
const TEAL_SOFT = '#E6F2F2';
const TEXT = '#1F2937';
const BORDER = '#D1D5DB';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 24,
    fontSize: 8,
    color: TEXT,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
    borderBottom: `2pt solid ${TEAL}`,
    paddingBottom: 8,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: TEAL, letterSpacing: 0.5 },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 2 },
  metaCol: { alignItems: 'flex-end' },
  metaLabel: { fontSize: 7, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 },
  metaValue: { fontSize: 9, color: TEXT, marginTop: 1 },
  summary: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  summaryCard: {
    flex: 1,
    padding: 6,
    backgroundColor: TEAL_SOFT,
    borderRadius: 3,
  },
  summaryLabel: { fontSize: 7, color: '#4B5563', textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: TEAL, marginTop: 2 },
  table: { borderLeft: `0.5pt solid ${BORDER}`, borderTop: `0.5pt solid ${BORDER}` },
  tableRow: { flexDirection: 'row' },
  th: {
    padding: 5,
    backgroundColor: TEAL,
    color: 'white',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    borderRight: `0.5pt solid ${BORDER}`,
    borderBottom: `0.5pt solid ${BORDER}`,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  td: {
    padding: 4,
    fontSize: 7,
    borderRight: `0.5pt solid ${BORDER}`,
    borderBottom: `0.5pt solid ${BORDER}`,
  },
  tdAlt: { backgroundColor: '#F9FAFB' },
  resultadoResuelto: { color: '#047857', fontFamily: 'Helvetica-Bold' },
  resultadoSinResolver: { color: '#B91C1C', fontFamily: 'Helvetica-Bold' },
  resultadoEnCurso: { color: '#92400E' },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 24,
    right: 24,
    fontSize: 7,
    color: '#6B7280',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  empty: { textAlign: 'center', padding: 40, color: '#6B7280' },
});

const COL_WIDTHS = {
  ticket: 40,
  fecha: 48,
  cliente: 120,
  creador: 72,
  derivador: 72,
  asignado: 72,
  estado: 72,
  ultimo: 48,
  valor: 55,
  descripcion: 130,
  resultado: 55,
};

const totalWidth = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0);

interface Props {
  rows: VentasInsumosReportRow[];
  range: VentasInsumosRangeLabel;
  generadoPor: string;
}

function resultadoStyle(r: VentasInsumosReportRow['resultado']) {
  if (r === 'Resuelto') return styles.resultadoResuelto;
  if (r === 'Sin resolver') return styles.resultadoSinResolver;
  return styles.resultadoEnCurso;
}

export function ReporteVentasInsumosPDF({ rows, range, generadoPor }: Props) {
  const totalValor = rows.reduce((acc, r) => acc + (r.valorEstimado || 0), 0);
  const countByResultado = rows.reduce((acc, r) => {
    acc[r.resultado] = (acc[r.resultado] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Reporte · Ventas de Insumos</Text>
            <Text style={styles.subtitle}>
              Período: {fmtDateShort(range.desde)} — {fmtDateShort(range.hasta)} ({range.label})
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Generado</Text>
            <Text style={styles.metaValue}>{fmtDateShort(new Date().toISOString())} · {generadoPor}</Text>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Oportunidades</Text>
            <Text style={styles.summaryValue}>{rows.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>En curso</Text>
            <Text style={styles.summaryValue}>{countByResultado['En curso'] || 0}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Resueltos</Text>
            <Text style={styles.summaryValue}>{countByResultado['Resuelto'] || 0}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Sin resolver</Text>
            <Text style={styles.summaryValue}>{countByResultado['Sin resolver'] || 0}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Valor estimado total</Text>
            <Text style={styles.summaryValue}>{fmtCurrencyARS(totalValor)}</Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <Text style={styles.empty}>Sin tickets de ventas de insumos en el período seleccionado.</Text>
        ) : (
          <View style={[styles.table, { width: totalWidth }]}>
            <View style={styles.tableRow} fixed>
              <Text style={[styles.th, { width: COL_WIDTHS.ticket }]}>Ticket</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.fecha }]}>Creación</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.cliente }]}>Razón social</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.creador }]}>Creador</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.derivador }]}>Derivador</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.asignado }]}>Asignado</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.estado }]}>Estado</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.ultimo }]}>Últ. mov.</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.valor }]}>Valor est.</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.descripcion }]}>Descripción</Text>
              <Text style={[styles.th, { width: COL_WIDTHS.resultado }]}>Resultado</Text>
            </View>

            {rows.map((r, idx) => {
              const baseTd = idx % 2 === 1 ? [styles.td, styles.tdAlt] : [styles.td];
              return (
                <View key={r.ticketId} style={styles.tableRow} wrap={false}>
                  <Text style={[...baseTd, { width: COL_WIDTHS.ticket }]}>
                    {r.ticketId.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.fecha }]}>
                    {fmtDateShort(r.fechaCreacion)}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.cliente }]}>
                    {r.razonSocial}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.creador }]}>
                    {r.creador}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.derivador }]}>
                    {r.derivador}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.asignado }]}>
                    {r.asignado}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.estado }]}>
                    {r.estadoActual}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.ultimo }]}>
                    {fmtDateShort(r.ultimoMovimiento)}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.valor, textAlign: 'right' }]}>
                    {fmtCurrencyARS(r.valorEstimado)}
                  </Text>
                  <Text style={[...baseTd, { width: COL_WIDTHS.descripcion }]}>
                    {r.descripcion.length > 140 ? r.descripcion.slice(0, 137) + '…' : r.descripcion}
                  </Text>
                  <Text style={[...baseTd, resultadoStyle(r.resultado), { width: COL_WIDTHS.resultado }]}>
                    {r.resultado}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>AGS Analítica · Reporte interno</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
