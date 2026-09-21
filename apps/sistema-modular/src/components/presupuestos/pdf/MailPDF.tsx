import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PDFRichText } from './PDFRichText';
import type { MailParseado } from '../../../utils/mailParse';
import './pdfFonts';

/**
 * Un correo (Outlook .msg / .eml) como PDF para adjuntar a una OC (2026-09-19):
 * encabezado con remitente, destinatarios, fecha y asunto; la lista de lo que
 * traía adjunto; y el cuerpo, en HTML si lo hay (PDFRichText, con caída a
 * texto plano) o en texto.
 */

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Inter', fontSize: 9, color: '#1e293b' },
  titulo: { fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#0f172a' },
  cab: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, padding: 8, marginBottom: 10, backgroundColor: '#f8fafc' },
  fila: { flexDirection: 'row', marginBottom: 2 },
  etiqueta: { width: 52, fontSize: 8, fontWeight: 600, color: '#64748b' },
  valor: { flex: 1, fontSize: 9 },
  seccion: { fontSize: 8, fontWeight: 600, color: '#64748b', marginTop: 8, marginBottom: 3, textTransform: 'uppercase' },
  cuerpo: { fontSize: 9, lineHeight: 1.4 },
  pie: { position: 'absolute', bottom: 18, left: 36, right: 36, fontSize: 7, color: '#94a3b8', textAlign: 'right' },
});

const fechaLarga = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Fila = ({ etiqueta, valor }: { etiqueta: string; valor: string }) => (
  valor ? (
    <View style={s.fila}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  ) : null
);

export function MailPDF({ mail, archivoOriginal }: { mail: MailParseado; archivoOriginal: string }) {
  const texto = (mail.texto ?? '').replace(/\r\n/g, '\n').trim();
  return (
    <Document title={mail.asunto || archivoOriginal}>
      <Page size="A4" style={s.page}>
        <Text style={s.titulo}>{mail.asunto || '(sin asunto)'}</Text>
        <View style={s.cab}>
          <Fila etiqueta="De" valor={mail.de} />
          <Fila etiqueta="Para" valor={mail.para.join('; ')} />
          <Fila etiqueta="CC" valor={mail.cc.join('; ')} />
          <Fila etiqueta="Fecha" valor={fechaLarga(mail.fecha)} />
          {mail.adjuntos.length > 0 && (
            <Fila etiqueta="Adjuntos" valor={mail.adjuntos.map(a => a.nombre).join('; ')} />
          )}
        </View>
        {mail.html && mail.html.trim() ? (
          <View style={s.cuerpo}>
            <PDFRichText html={mail.html} fallbackStyle={s.cuerpo} fontFamily="Inter" />
          </View>
        ) : (
          <Text style={s.cuerpo}>{texto || '(sin contenido)'}</Text>
        )}
        <Text style={s.pie} fixed>
          Convertido desde {archivoOriginal} el {new Date().toLocaleDateString('es-AR')} · AGS Analítica
        </Text>
      </Page>
    </Document>
  );
}
