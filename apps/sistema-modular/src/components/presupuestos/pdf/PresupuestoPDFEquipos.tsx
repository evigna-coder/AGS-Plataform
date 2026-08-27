import { Document, Page } from '@react-pdf/renderer';
import { baseStyles } from './pdfStyles';
import './pdfFonts';
import {
  PDFHeader,
  PDFClienteInfo,
  PDFCondiciones,
  PDFCondicionesFila,
  PDFTotalesNeto,
  PDFConformidad,
  PDFFooter,
  VentasMetadataBlock,
} from './PresupuestoPDFEstandar';
import type { PresupuestoPDFData } from './PresupuestoPDFEstandar';
import { PdfEsquemaFacturacionSection } from './PdfEsquemaFacturacionSection';
import { PDFEquiposItemsTable } from './equipos/PDFEquiposItemsTable';
import { PDFEquiposConfigDetalles, collectBloquesDetalle } from './equipos/PDFEquiposConfigDetalles';

const S = baseStyles;

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

        <PDFEquiposItemsTable items={presupuesto.items} />

        {/* Misma caja de totales que partes/servicios (2026-08-27): el
            protagonista es el valor SIN IVA, con el desglose subordinado. */}
        <PDFTotalesNeto data={data} />

        {/* Misma fila de condiciones con iconitos que partes/servicios (2026-08-27):
            almanaque de vigencia, tarjeta de forma de pago, documento de condiciones.
            El texto de alcance conserva el propio de equipos. */}
        <PDFCondicionesFila data={data}
          alcance="No incluye ningún otro trabajo de lo indicado arriba, como ser puesta a punto de métodos analíticos, repuestos o consumibles no especificados, etc." />

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

      {/* Última página: bloques de texto templados + conformidad/firma.
          Las notas técnicas salen adentro de PDFCondiciones (primera sección). */}
      <Page size="A4" style={S.page}>
        <PDFCondiciones data={data} />
        <PDFConformidad />
        <PDFFooter />
      </Page>
    </Document>
  );
}
