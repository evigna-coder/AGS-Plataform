import { Document, Page, View, Text, pdf } from '@react-pdf/renderer';
// side-effect import — registers Inter + Newsreader fonts for @react-pdf/renderer
import '../components/presupuestos/pdf/pdfFonts';

export interface ExportPDFColumn<T> {
  header: string;
  width: string | number;  // '20%' or px
  get: (row: T) => string;
  align?: 'left' | 'center' | 'right';
}

export interface ExportToPDFOptions<T> {
  data: T[];
  columns: ExportPDFColumn<T>[];
  title: string;
  subtitle?: string;
  filename: string;  // sin .pdf
  orientation?: 'portrait' | 'landscape';  // default 'landscape' para tablas anchas
}

export async function exportToPDF<T>(opts: ExportToPDFOptions<T>): Promise<void> {
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

function buildDocument<T>(opts: ExportToPDFOptions<T>) {
  const { data, columns, title, subtitle, orientation = 'landscape' } = opts;
  const fmtGen = new Date().toLocaleString('es-AR');

  return (
    <Document title={title}>
      <Page
        size="A4"
        orientation={orientation}
        style={{ padding: 20, fontFamily: 'Helvetica' }}
      >
        <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 9, color: '#666', marginBottom: 6 }}>{subtitle}</Text>
        ) : null}
        <Text style={{ fontSize: 8, color: '#999', marginBottom: 10 }}>
          Generado: {fmtGen} — {data.length} registro{data.length === 1 ? '' : 's'}
        </Text>

        {/* Table header */}
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderColor: '#0D6E6E',
            paddingVertical: 3,
          }}
        >
          {columns.map((c, i) => (
            <Text
              key={i}
              style={{
                width: c.width,
                fontSize: 8,
                fontWeight: 700,
                textAlign: c.align || 'left',
                paddingHorizontal: 2,
              }}
            >
              {c.header}
            </Text>
          ))}
        </View>

        {/* Table rows */}
        {data.map((row, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              paddingVertical: 2,
              borderBottomWidth: 0.5,
              borderColor: '#eee',
            }}
          >
            {columns.map((c, j) => (
              <Text
                key={j}
                style={{
                  width: c.width,
                  fontSize: 7,
                  textAlign: c.align || 'left',
                  paddingHorizontal: 2,
                }}
              >
                {c.get(row)}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
