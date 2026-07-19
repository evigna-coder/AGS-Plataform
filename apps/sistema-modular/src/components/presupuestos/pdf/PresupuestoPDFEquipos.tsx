import { Document, Page, View, Text } from '@react-pdf/renderer';
import { baseStyles, COLORS } from './pdfStyles';
import './pdfFonts';
import {
  PDFHeader,
  PDFClienteInfo,
  PDFNotasTecnicas,
  PDFCondiciones,
  PDFFirma,
  PDFFooter,
  VentasMetadataBlock,
} from './PresupuestoPDFEstandar';
import type { PresupuestoPDFData } from './PresupuestoPDFEstandar';
import { PdfEsquemaFacturacionSection } from './PdfEsquemaFacturacionSection';
import { PDFEquiposItemsTable } from './equipos/PDFEquiposItemsTable';
import { PDFEquiposConfigDetalles, collectBloquesDetalle } from './equipos/PDFEquiposConfigDetalles';

const S = baseStyles;

/** Tarjeta de validez + forma de pago (mismo contenido que el estándar). */
function ValidezCard({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto, condicionPago } = data;
  return (
    <View style={{ padding: 11, backgroundColor: COLORS.cardBg, borderRadius: 6, marginBottom: 8 }} wrap={false}>
      <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: COLORS.primary, marginBottom: 3 }}>
        Oferta válida por {presupuesto.validezDias || 15} días desde la fecha de emisión
        {condicionPago ? `   ·   Forma de pago: ${condicionPago.nombre}${condicionPago.dias > 0 ? ` (${condicionPago.dias} días)` : ''}` : ''}
      </Text>
      <Text style={{ fontSize: 7, color: COLORS.textMuted, lineHeight: 1.4 }}>
        No incluye ningún otro trabajo de lo indicado arriba, como ser puesta a punto de métodos
        analíticos, repuestos o consumibles no especificados, etc.
      </Text>
    </View>
  );
}

/**
 * Template de presupuesto tipo 'ventas' (Equipos) — formato JAS170-C.
 *
 * Página 1: cabecera estándar + tabla item padre / "Detalles:" / sub-ítems
 * N.1, N.2… + "Son: <total en letras>" + TOTAL <moneda>.
 * Página 2+ (si hay detalles): "Detalles de Configuración" — bloque por
 * sub-ítem con foto a la izquierda y configuración completa a la derecha.
 * Última página: bloques de texto templados (notas técnicas, notas sobre el
 * presupuesto, condiciones comerciales, garantía) + firma.
 */
export function PresupuestoPDFEquipos({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  const tieneConfig = collectBloquesDetalle(presupuesto.items).length > 0;

  return (
    <Document
      title={`Presupuesto ${presupuesto.numero}`}
      author="AGS Analítica S.A."
      subject="Presupuesto de equipos"
    >
      {/* Página 1: Header + Cliente + Tabla de items + Total */}
      <Page size="A4" style={S.page}>
        <PDFHeader data={data} />
        <PDFClienteInfo data={data} />

        {presupuesto.ventasMetadata && <VentasMetadataBlock metadata={presupuesto.ventasMetadata} />}

        <PDFEquiposItemsTable
          items={presupuesto.items}
          moneda={presupuesto.moneda}
          total={presupuesto.total || 0}
          montoEnLetras={data.montoEnLetras}
          impuestos={data.impuestos}
        />

        <ValidezCard data={data} />

        {(presupuesto.esquemaFacturacion?.length ?? 0) > 0 && (
          <PdfEsquemaFacturacionSection presupuesto={presupuesto} esquema={presupuesto.esquemaFacturacion!} />
        )}

        <PDFFooter />
      </Page>

      {/* Página 2+: Detalles de Configuración (solo si algún sub-ítem tiene detalle/fotos) */}
      {tieneConfig && (
        <Page size="A4" style={S.page}>
          <PDFEquiposConfigDetalles items={presupuesto.items} fotosDataUrls={data.fotosDataUrls || {}} />
          <PDFFooter />
        </Page>
      )}

      {/* Última página: bloques de texto templados + firma */}
      <Page size="A4" style={S.page}>
        <PDFNotasTecnicas data={data} />
        <PDFCondiciones data={data} />
        <PDFFirma />
        <PDFFooter />
      </Page>
    </Document>
  );
}
