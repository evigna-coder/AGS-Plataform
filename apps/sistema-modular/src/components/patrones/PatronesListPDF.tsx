import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Patron, EstadoCertificado } from '@ags/shared';
import { CATEGORIA_PATRON_LABELS, calcularEstadoCertificado } from '@ags/shared';

const ESTADO_LABEL: Record<EstadoCertificado, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  sin_certificado: 'Sin cert.',
};

const ESTADO_COLOR: Record<EstadoCertificado, string> = {
  vigente: '#15803D',
  por_vencer: '#B45309',
  vencido: '#B91C1C',
  sin_certificado: '#64748B',
};

function fmtFechaAR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: 'Helvetica' },
  header: { marginBottom: 14, borderBottom: '1pt solid #0D6E6E', paddingBottom: 8 },
  title: { fontSize: 14, fontWeight: 700, color: '#0D6E6E' },
  subtitle: { fontSize: 9, color: '#475569', marginTop: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, fontSize: 8, color: '#64748B' },
  totals: { flexDirection: 'row', gap: 12, marginTop: 6, fontSize: 8, color: '#334155' },
  totalCell: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#F1F5F9', borderRadius: 2 },
  table: { borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'solid' },
  thead: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderBottom: '1pt solid #CBD5E1' },
  th: { padding: 4, fontSize: 7.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase' },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #E2E8F0' },
  td: { padding: 4, fontSize: 8, color: '#1E293B' },
  c1: { width: '11%' },
  c2: { width: '24%' },
  c3: { width: '12%' },
  c4: { width: '12%' },
  c5: { width: '11%' },
  c6: { width: '10%' },
  c7: { width: '8%' },
  c8: { width: '12%' },
  badge: { fontSize: 7.5, fontWeight: 700 },
  footer: { marginTop: 12, fontSize: 7.5, color: '#94A3B8', textAlign: 'right' },
});

interface Props {
  items: Patron[];
  generadoPor?: string | null;
  filtros?: string;
}

interface Row {
  patron: Patron;
  lote: string;
  fechaVencimiento: string | null;
  cantidad: number | null;
  estado: EstadoCertificado;
  emisor: string | null;
}

function buildRows(items: Patron[]): Row[] {
  const rows: Row[] = [];
  for (const p of items) {
    if (!p.lotes || p.lotes.length === 0) {
      rows.push({
        patron: p,
        lote: '—',
        fechaVencimiento: null,
        cantidad: null,
        estado: 'sin_certificado',
        emisor: null,
      });
    } else {
      for (const l of p.lotes) {
        rows.push({
          patron: p,
          lote: l.lote || '—',
          fechaVencimiento: l.fechaVencimiento ?? null,
          cantidad: typeof l.cantidad === 'number' ? l.cantidad : null,
          estado: calcularEstadoCertificado(l.fechaVencimiento),
          emisor: l.certificadoEmisor ?? null,
        });
      }
    }
  }
  return rows;
}

export function PatronesListPDF({ items, generadoPor, filtros }: Props) {
  const fechaImpresion = fmtFechaAR(new Date().toISOString());
  const rows = buildRows(items);

  const totalCantidad = rows.reduce((sum, r) => sum + (r.cantidad ?? 0), 0);
  const totalLotes = rows.filter(r => r.lote !== '—').length;
  const vencidos = rows.filter(r => r.estado === 'vencido').length;
  const porVencer = rows.filter(r => r.estado === 'por_vencer').length;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>Patrones — Listado de auditoría</Text>
          <Text style={styles.subtitle}>
            {items.length} patrón{items.length === 1 ? '' : 'es'} · {totalLotes} lote{totalLotes === 1 ? '' : 's'}
            {filtros ? ` · ${filtros}` : ''}
          </Text>
          <View style={styles.meta}>
            <Text>Generado: {fechaImpresion}{generadoPor ? ` · ${generadoPor}` : ''}</Text>
            <Text>AGS Analítica</Text>
          </View>
          <View style={styles.totals}>
            <Text style={styles.totalCell}>Cantidad total: {totalCantidad}</Text>
            {vencidos > 0 && <Text style={[styles.totalCell, { color: '#B91C1C' }]}>Vencidos: {vencidos}</Text>}
            {porVencer > 0 && <Text style={[styles.totalCell, { color: '#B45309' }]}>Por vencer: {porVencer}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.thead} fixed>
            <Text style={[styles.th, styles.c1]}>Código</Text>
            <Text style={[styles.th, styles.c2]}>Descripción</Text>
            <Text style={[styles.th, styles.c3]}>Marca</Text>
            <Text style={[styles.th, styles.c4]}>Categorías</Text>
            <Text style={[styles.th, styles.c5]}>Lote</Text>
            <Text style={[styles.th, styles.c6]}>Vencimiento</Text>
            <Text style={[styles.th, styles.c7]}>Cantidad</Text>
            <Text style={[styles.th, styles.c8]}>Estado</Text>
          </View>
          {rows.map((r, i) => {
            const cats = r.patron.categorias.map(c => CATEGORIA_PATRON_LABELS[c] || c).join(', ');
            return (
              <View key={`${r.patron.id}-${i}`} style={styles.row} wrap={false}>
                <Text style={[styles.td, styles.c1, { color: '#0D6E6E', fontWeight: 700 }]}>
                  {r.patron.codigoArticulo || '—'}
                </Text>
                <Text style={[styles.td, styles.c2]}>{r.patron.descripcion || '—'}</Text>
                <Text style={[styles.td, styles.c3]}>{r.patron.marca || '—'}</Text>
                <Text style={[styles.td, styles.c4]}>{cats || '—'}</Text>
                <Text style={[styles.td, styles.c5]}>{r.lote}</Text>
                <Text style={[styles.td, styles.c6]}>{fmtFechaAR(r.fechaVencimiento)}</Text>
                <Text style={[styles.td, styles.c7]}>{r.cantidad ?? '—'}</Text>
                <Text style={[styles.td, styles.c8, styles.badge, { color: ESTADO_COLOR[r.estado] }]}>
                  {ESTADO_LABEL[r.estado]}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
