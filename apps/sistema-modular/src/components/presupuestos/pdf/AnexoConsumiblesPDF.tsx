import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

import { Document, Page, View, Text, Image, pdf, StyleSheet } from '@react-pdf/renderer';
import { COLORS, baseStyles } from './pdfStyles';
import './pdfFonts';
import { LOGO_SRC } from './logos';
import type { ConsumibleModulo } from '@ags/shared';

// =============================================
// Types públicos
// =============================================

/**
 * Una entrada de módulo en el anexo. Si `placeholder=true`, el render NO muestra
 * tabla de consumibles sino un texto en italics — corresponde a:
 *   - Caso (i) de CONTEXT.md: módulo sin código (codigo === '')
 *   - Caso (ii) de CONTEXT.md: código existe pero no está en `consumibles_por_modulo`
 *
 * Caso (iii) (lista vacía intencional) NO llega acá — el builder filtra antes.
 */
export interface AnexoModuloEntry {
  codigo: string;
  descripcion: string;
  consumibles: ConsumibleModulo[];
  placeholder?: boolean;
}

/** Payload completo para renderizar UN anexo (un sistema → N módulos). */
export interface AnexoConsumiblesData {
  presupuestoNumero: string;
  sistemaNombre: string;
  clienteRazonSocial: string;
  /** ISO string. Se formatea adentro a `dd/mm/yyyy` (es-AR). */
  fechaEmision: string;
  modulos: AnexoModuloEntry[];
  /** Override opcional del logo (default: LOGO_SRC). */
  logoSrc?: string;
}

// =============================================
// StyleSheet local — tokens "liviano" (más blanco, menos peso visual que PresupuestoPDFEstandar).
// NO se modifica pdfStyles.ts (consistencia con el PDF principal).
// =============================================

const A = StyleSheet.create({
  page: {
    ...baseStyles.page,
    paddingTop: 36,
    paddingHorizontal: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 14,
  },
  logo: {
    width: 90,
    height: 'auto',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerLine: {
    fontSize: 7.5,
    color: COLORS.textMuted,
    marginBottom: 1,
  },
  moduloSection: {
    marginBottom: 14,
  },
  moduloHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.primary,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderDark,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 8,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  table: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 2,
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.rowAlt,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  th: {
    padding: 4,
    fontSize: 7,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.25,
    borderBottomColor: COLORS.border,
  },
  td: {
    padding: 4,
    fontSize: 8,
    color: COLORS.text,
  },
  colCodigo: { width: '22%' },
  colDesc: { flex: 1 },
  colCant: { width: '14%', textAlign: 'right' as const },
  footerNote: {
    position: 'absolute' as const,
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 6.5,
    color: COLORS.textMuted,
    textAlign: 'center' as const,
    fontStyle: 'italic',
  },
});

// =============================================
// Helpers
// =============================================

function formatFecha(iso: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

// =============================================
// Sub-component: una sección de módulo (mantiene el componente principal liviano)
// =============================================

function ModuloSection({ mod }: { mod: AnexoModuloEntry }) {
  return (
    <View style={A.moduloSection} wrap={false}>
      <Text style={A.moduloHeader}>
        {mod.codigo ? `${mod.codigo} — ${mod.descripcion}` : mod.descripcion}
      </Text>
      {mod.placeholder ? (
        <Text style={A.placeholderText}>
          Consumibles no especificados — sin código en catálogo. Coordinar con el equipo técnico.
        </Text>
      ) : (
        <View style={A.table}>
          <View style={A.thRow}>
            <Text style={[A.th, A.colCodigo]}>Código</Text>
            <Text style={[A.th, A.colDesc]}>Descripción</Text>
            <Text style={[A.th, A.colCant]}>Cantidad</Text>
          </View>
          {mod.consumibles.map((c, i) => (
            <View key={i} style={A.tr}>
              <Text style={[A.td, A.colCodigo]}>{c.codigo}</Text>
              <Text style={[A.td, A.colDesc]}>{c.descripcion}</Text>
              <Text style={[A.td, A.colCant]}>{c.cantidad}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================
// Componente principal
// =============================================

export const AnexoConsumiblesPDF = ({ data }: { data: AnexoConsumiblesData }) => (
  <Document
    title={`Anexo Consumibles - ${data.presupuestoNumero} - ${data.sistemaNombre}`}
    author="AGS Analítica S.A."
    subject="Anexo de Consumibles"
  >
    <Page size="A4" style={A.page}>
      {/* Header liviano: logo + bloque de metadata derecha */}
      <View style={A.headerRow}>
        <Image style={A.logo} src={data.logoSrc || LOGO_SRC} />
        <View style={A.headerInfo}>
          <Text style={A.headerTitle}>Anexo de Consumibles</Text>
          <Text style={A.headerLine}>Presupuesto N° {data.presupuestoNumero}</Text>
          <Text style={A.headerLine}>Sistema: {data.sistemaNombre}</Text>
          <Text style={A.headerLine}>Cliente: {data.clienteRazonSocial}</Text>
          <Text style={A.headerLine}>Fecha: {formatFecha(data.fechaEmision)}</Text>
        </View>
      </View>

      {/* Secciones por módulo */}
      {data.modulos.map((mod, idx) => (
        <ModuloSection key={idx} mod={mod} />
      ))}

      <Text style={A.footerNote} fixed>
        Listado informativo de consumibles — los precios y la periodicidad están definidos en el
        presupuesto principal.
      </Text>
    </Page>
  </Document>
);

// =============================================
// Generator helper
// =============================================

/** Genera un Blob PDF a partir de un AnexoConsumiblesData. Análogo a generatePresupuestoPDF. */
export async function generateAnexoConsumiblesPDF(data: AnexoConsumiblesData): Promise<Blob> {
  return await pdf(<AnexoConsumiblesPDF data={data} />).toBlob();
}
