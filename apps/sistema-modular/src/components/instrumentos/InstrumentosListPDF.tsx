import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { InstrumentoPatron, EstadoCertificado } from '@ags/shared';
import { CATEGORIA_INSTRUMENTO_LABELS, CATEGORIA_PATRON_LABELS, calcularEstadoCertificado } from '@ags/shared';
import { diasDesde } from '../../utils/formatFecha';

const ALL_CAT_LABELS: Record<string, string> = { ...CATEGORIA_INSTRUMENTO_LABELS, ...CATEGORIA_PATRON_LABELS };

const ESTADO_LABEL: Record<EstadoCertificado | 'en_calibracion', string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  sin_certificado: 'Sin cert.',
  en_calibracion: 'En calibración',
};

function fmtFechaAR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function effectiveEstado(i: InstrumentoPatron): EstadoCertificado | 'en_calibracion' {
  if (i.estadoCalibracion === 'en_calibracion') return 'en_calibracion';
  return calcularEstadoCertificado(i.certificadoVencimiento);
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: 'Helvetica' },
  header: { marginBottom: 14, borderBottom: '1pt solid #0D6E6E', paddingBottom: 8 },
  title: { fontSize: 14, fontWeight: 700, color: '#0D6E6E' },
  subtitle: { fontSize: 9, color: '#475569', marginTop: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, fontSize: 8, color: '#64748B' },
  table: { borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'solid' },
  thead: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderBottom: '1pt solid #CBD5E1' },
  th: { padding: 4, fontSize: 7.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase' },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #E2E8F0' },
  td: { padding: 4, fontSize: 8, color: '#1E293B' },
  c1: { width: '13%' },
  c2: { width: '23%' },
  c3: { width: '11%' },
  c4: { width: '18%' },
  c5: { width: '11%' },
  c6: { width: '13%' },
  c7: { width: '6%' },
  c8: { width: '9%' },
  badge: { fontSize: 7.5, fontWeight: 700 },
  footer: { marginTop: 12, fontSize: 7.5, color: '#94A3B8', textAlign: 'right' },
});

const ESTADO_COLOR: Record<string, string> = {
  vigente: '#15803D',
  por_vencer: '#B45309',
  vencido: '#B91C1C',
  sin_certificado: '#64748B',
  en_calibracion: '#1D4ED8',
};

interface Props {
  items: InstrumentoPatron[];
  generadoPor?: string | null;
  filtros?: string;
}

export function InstrumentosListPDF({ items, generadoPor, filtros }: Props) {
  const fechaImpresion = fmtFechaAR(new Date().toISOString());
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>Instrumentos y Patrones — Listado de auditoría</Text>
          <Text style={styles.subtitle}>{items.length} ítem{items.length === 1 ? '' : 's'}{filtros ? ` · ${filtros}` : ''}</Text>
          <View style={styles.meta}>
            <Text>Generado: {fechaImpresion}{generadoPor ? ` · ${generadoPor}` : ''}</Text>
            <Text>AGS Analítica</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.thead} fixed>
            <Text style={[styles.th, styles.c1]}>Identificación</Text>
            <Text style={[styles.th, styles.c2]}>Marca / Modelo</Text>
            <Text style={[styles.th, styles.c3]}>Serie</Text>
            <Text style={[styles.th, styles.c4]}>Categorías</Text>
            <Text style={[styles.th, styles.c5]}>Vencimiento</Text>
            <Text style={[styles.th, styles.c6]}>Proveedor calib.</Text>
            <Text style={[styles.th, styles.c7]}>Días fuera</Text>
            <Text style={[styles.th, styles.c8]}>Estado</Text>
          </View>
          {items.map(i => {
            const estado = effectiveEstado(i);
            const cats = i.categorias.map(c => ALL_CAT_LABELS[c] || c).join(', ');
            const marcaModelo = [i.marca, i.modelo].filter(Boolean).join(' / ') || '—';
            const enCalibracion = i.estadoCalibracion === 'en_calibracion';
            const proveedor = enCalibracion ? (i.calibracionProveedorNombre ?? '—') : '—';
            const diasFuera = enCalibracion ? diasDesde(i.calibracionFechaEnvio) : null;
            return (
              <View key={i.id} style={styles.row} wrap={false}>
                <Text style={[styles.td, styles.c1, { color: '#0D6E6E', fontWeight: 700 }]}>{i.nombre}</Text>
                <Text style={[styles.td, styles.c2]}>{marcaModelo}</Text>
                <Text style={[styles.td, styles.c3]}>{i.serie || '—'}</Text>
                <Text style={[styles.td, styles.c4]}>{cats || '—'}</Text>
                <Text style={[styles.td, styles.c5]}>{fmtFechaAR(i.certificadoVencimiento)}</Text>
                <Text style={[styles.td, styles.c6]}>{proveedor}</Text>
                <Text style={diasFuera !== null ? [styles.td, styles.c7, { color: '#1D4ED8', fontWeight: 700 }] : [styles.td, styles.c7]}>
                  {diasFuera !== null ? `${diasFuera} d` : '—'}
                </Text>
                <Text style={[styles.td, styles.c8, styles.badge, { color: ESTADO_COLOR[estado] }]}>{ESTADO_LABEL[estado]}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
