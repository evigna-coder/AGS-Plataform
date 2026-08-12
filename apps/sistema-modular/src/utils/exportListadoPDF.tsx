import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import { LOGO_SRC } from '../components/presupuestos/pdf/logos';
// side-effect: registra Inter para @react-pdf/renderer
import '../components/presupuestos/pdf/pdfFonts';
import type { ExportColumn } from './exportToExcel';

/**
 * Generador GENÉRICO de PDF tabular para listados (2026-08-12).
 * Reusa el MISMO `ExportColumn<T>` de exportToExcel: cada listado define sus
 * columnas UNA sola vez y las comparte entre Excel y PDF (vía ExportarButton).
 * Estética: encabezado editorial estilo OC (logo + título serif azul + regla),
 * tabla sin fondos — header de texto azul con línea azul fina (criterio de la
 * reforma de presupuestos 2026-08-12), filas alternadas suaves, footer paginado.
 */
export interface ExportListadoPDFOptions<T> {
  titulo: string;
  subtitulo?: string;
  /** Strings legibles ("Estado: Aceptado") — armados con filtrosAplicadosDesc. */
  filtrosAplicados?: string[];
  columnas: ExportColumn<T>[];
  data: T[];
  filename: string; // sin .pdf
  orientacion?: 'portrait' | 'landscape';
}

const COLORS = {
  primary: '#1C5D9C',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#cbd5e1',
  borderLight: '#E5E9F0',
  rowAlt: '#f8fafc',
};

const S = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 44, paddingHorizontal: 34, fontSize: 7.5, color: COLORS.text, fontFamily: 'Inter' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 96, height: 'auto' },
  tituloSerif: { fontFamily: 'Times-Roman', fontSize: 19, color: COLORS.primary },
  subtitulo: { fontSize: 7.5, color: COLORS.textMuted, marginTop: 2, textAlign: 'right' },
  regla: { height: 1.2, backgroundColor: COLORS.primary, marginTop: 8, marginBottom: 6 },
  metaLinea: { fontSize: 6.5, color: COLORS.textMuted, marginBottom: 1.5 },
  th: { fontSize: 6.5, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.4, paddingVertical: 3, paddingHorizontal: 3 },
  thRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.primary, marginTop: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight },
  trAlt: { backgroundColor: COLORS.rowAlt },
  td: { fontSize: 7, color: COLORS.text, paddingVertical: 2.5, paddingHorizontal: 3 },
  footer: {
    position: 'absolute', bottom: 16, left: 34, right: 34,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: COLORS.textMuted },
});

export async function exportListadoPDF<T>(opts: ExportListadoPDFOptions<T>): Promise<void> {
  const blob = await pdf(buildDocument(opts)).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${opts.filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildDocument<T>(opts: ExportListadoPDFOptions<T>) {
  const { titulo, subtitulo, filtrosAplicados = [], columnas, data } = opts;
  // Landscape automático para tablas anchas (> ~6 columnas), salvo override.
  const orientacion = opts.orientacion ?? (columnas.length > 6 ? 'landscape' : 'portrait');
  // Ancho relativo de cada columna a partir del width (en caracteres) de Excel.
  const totalW = columnas.reduce((acc, c) => acc + (c.width ?? 12), 0);
  const widthPct = (c: ExportColumn<T>) => `${(((c.width ?? 12) / totalW) * 100).toFixed(2)}%`;
  const generado = new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <Document title={titulo}>
      <Page size="A4" orientation={orientacion} style={S.page}>
        {/* Encabezado editorial: logo chico + título serif azul */}
        <View style={S.headerRow}>
          <Image src={LOGO_SRC} style={S.logo} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.tituloSerif}>{titulo}</Text>
            {subtitulo ? <Text style={S.subtitulo}>{subtitulo}</Text> : null}
          </View>
        </View>
        <View style={S.regla} />
        <Text style={S.metaLinea}>
          Generado: {generado}  ·  {data.length} registro{data.length === 1 ? '' : 's'}
        </Text>
        {filtrosAplicados.length > 0 ? (
          <Text style={S.metaLinea}>Filtros: {filtrosAplicados.join('  ·  ')}</Text>
        ) : null}

        {/* Header de tabla: texto azul + línea azul fina, sin fondos */}
        <View style={S.thRow}>
          {columnas.map((c, i) => (
            <Text key={i} style={[S.th, { width: widthPct(c), textAlign: c.align || 'left' }]}>
              {c.header.toUpperCase()}
            </Text>
          ))}
        </View>

        {/* Filas alternadas suaves */}
        {data.map((row, i) => (
          <View key={i} style={i % 2 === 1 ? [S.tr, S.trAlt] : S.tr} wrap={false}>
            {columnas.map((c, j) => {
              const v = c.get(row);
              return (
                <Text key={j} style={[S.td, { width: widthPct(c), textAlign: c.align || 'left' }]}>
                  {v === null || v === undefined || v === '' ? '—' : String(v)}
                </Text>
              );
            })}
          </View>
        ))}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>AGS Analítica S.A. — {titulo}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Pág. ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
