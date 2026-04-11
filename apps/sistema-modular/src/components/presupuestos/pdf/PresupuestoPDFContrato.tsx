import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import './pdfFonts';
import { cs } from './contrato/pdfContratoStyles';
import { PDFContratoCover } from './contrato/PDFContratoCover';
import { PDFContratoDetail } from './contrato/PDFContratoDetail';
import { PDFContratoCuotas, PDFContratoCondicionesText, PDFContratoAceptacion } from './contrato/PDFContratoCondiciones';
import type { PresupuestoPDFData } from './PresupuestoPDFEstandar';

function PageHeaderStrip({ data }: { data: PresupuestoPDFData }) {
  return (
    <View style={cs.pageHeaderStrip} fixed>
      <Image src={data.logoSrc} style={cs.pageHeaderLogo} />
      <View style={cs.pageHeaderMeta}>
        <View style={cs.pageHeaderMetaItem}>
          <Text style={cs.pageHeaderMetaLabel}>Presupuesto</Text>
          <Text style={cs.pageHeaderMetaValue}>{data.presupuesto.numero}</Text>
        </View>
        <View style={cs.pageHeaderMetaItem}>
          <Text style={cs.pageHeaderMetaLabel}>Cliente</Text>
          <Text style={cs.pageHeaderMetaValue}>{data.cliente?.razonSocial || '—'}</Text>
        </View>
      </View>
    </View>
  );
}

function Footer({ data }: { data: PresupuestoPDFData }) {
  return (
    <View style={cs.footer} fixed>
      <Text style={cs.footerText}>Presupuesto de contrato · {data.presupuesto.numero}</Text>
      <Text
        style={cs.footerText}
        render={({ pageNumber, totalPages }) => `Hoja ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

/**
 * Modern, clean PDF layout for contrato presupuestos.
 * Editorial Teal palette, hierarchical Sector → Sistema → items layout,
 * MIXTA currency support, inline item notes, S/L rendering, and asymmetric
 * cuotas per currency (when cantidadCuotasPorMoneda is set).
 */
export function PresupuestoPDFContrato({ data }: { data: PresupuestoPDFData }) {
  return (
    <Document
      title={`Presupuesto de Contrato ${data.presupuesto.numero}`}
      author="AGS Analítica S.A."
      subject="Presupuesto de Contrato"
    >
      {/* Hoja 1 — Portada */}
      <Page size="A4" style={cs.page}>
        <PDFContratoCover data={data} />
        <Footer data={data} />
      </Page>

      {/* Hojas de detalle */}
      <Page size="A4" style={cs.page}>
        <PageHeaderStrip data={data} />
        <PDFContratoDetail data={data} />
        <PDFContratoCuotas data={data} />
        <Footer data={data} />
      </Page>

      {/* Hoja de condiciones + aceptación */}
      <Page size="A4" style={cs.page}>
        <PageHeaderStrip data={data} />
        <PDFContratoCondicionesText data={data} />
        <PDFContratoAceptacion data={data} />
        <Footer data={data} />
      </Page>
    </Document>
  );
}
