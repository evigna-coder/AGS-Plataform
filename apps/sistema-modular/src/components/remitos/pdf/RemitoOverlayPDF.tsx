import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PDF overlay para imprimir SOBRE el papel preimpreso de remito (formato R, A4).
 *
 * El papel ya tiene logo, marco, tabla vacía, número y CAI preimpresos. Este PDF
 * solo dibuja los DATOS — texto en negro sobre fondo transparente, posicionado en
 * coordenadas absolutas que coinciden con las casillas del papel.
 *
 * Coordenadas en puntos (1pt = 1/72"). A4 = 595 × 842 pt.
 *
 * Si la impresora del cliente desplaza la salida, ajustar `globalOffsetX` y
 * `globalOffsetY` (en puntos) — afectan a TODO el contenido por igual.
 */

// =============================================
// Coordenadas calibradas contra el papel preimpreso (REM 0001-).
// Si necesitás reajustar la calibración, modificá estos valores y regenerá un
// PDF de prueba; idealmente imprimirlo en una hoja blanca y superponerlo sobre
// el papel preimpreso a contraluz.
// =============================================

/** Y de la fila "Fecha" (esquina superior derecha del header) */
const Y_FECHA = 178;
const X_FECHA = 535;

/** Columna izquierda — datos del destinatario (cliente o proveedor) */
const X_VALUE_LEFT = 130;

/** Columna derecha — datos del transportista */
const X_VALUE_RIGHT = 525;

/** Y de cada fila del header. La altura entre filas en el papel es ~33pt. */
const Y_RAZON_SOCIAL = 270;
const Y_DOMICILIO   = 305;
const Y_LOCALIDAD   = 340;
const Y_PROVINCIA   = 375;
const Y_IVA         = 410;
const Y_CUIT        = 445;

/** Tabla de items */
const TABLE_TOP = 525;       // Y de la primera fila de datos
const TABLE_ROW_H = 16;
const TABLE_MAX_ROWS = 25;

const COL_X = {
  item: 50,
  cant: 110,
  producto: 175,
  descripcion: 400,
};

// =============================================

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  field: {
    position: 'absolute',
    fontSize: 9,
  },
  fieldSm: {
    position: 'absolute',
    fontSize: 8,
  },
  cell: {
    position: 'absolute',
    fontSize: 8.5,
  },
});

export interface RemitoOverlayDestinatario {
  razonSocial: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  iva: string;
  cuit: string;
}

export interface RemitoOverlayItem {
  /** Número de fila (Item). `''` para filas-cabecera sin numerar (remito de servicio). */
  numero: number | string;
  /** Cantidad. `''` para filas-cabecera. */
  cantidad: number | string;
  /** Producto: N° de ficha (FPC-XXXX) en remitos de ficha; código de equipo en servicio. */
  producto: string;
  /** Descripción libre que va a la columna ancha */
  descripcion: string;
}

/** Ajustes FINOS por campo (en pt; +x = derecha, +y = abajo). Se suman a los
 *  offsets globales. Opcionales — los flujos que no los pasan quedan igual.
 *  (Calibración del remito de stock contra papel real, 2026-07-31.) */
export interface RemitoOverlayFieldOffsets {
  fecha?: { x?: number; y?: number };
  razonSocial?: { y?: number };
  domicilio?: { y?: number };
  localidad?: { y?: number };
  provincia?: { y?: number };
  iva?: { y?: number };
  cuit?: { y?: number };
  /** Corrimiento vertical de TODAS las filas de la tabla de items. */
  tablaY?: number;
  /** Corrimientos horizontales por columna de la tabla. */
  colItemX?: number;
  colCantX?: number;
  colProductoX?: number;
  colDescripcionX?: number;
}

interface RemitoOverlayPDFProps {
  fecha: string;                        // dd/mm/yyyy ya formateada
  destinatario: RemitoOverlayDestinatario;
  transportista?: RemitoOverlayDestinatario | null;
  items: RemitoOverlayItem[];
  /** Offsets globales para calibrar contra impresora específica (en pt). */
  globalOffsetX?: number;
  globalOffsetY?: number;
  fieldOffsets?: RemitoOverlayFieldOffsets;
  /**
   * Cantidad de copias = cantidad de páginas idénticas en el PDF.
   * El papel preimpreso viene en triplicado (blanco, reciclado, celeste);
   * cargás las 3 hojas en la bandeja en orden y al imprimir el PDF salen las
   * 3 copias en una sola operación. Default: 3.
   */
  copies?: number;
}

function valuePos(x: number, y: number, ox: number, oy: number) {
  return { left: x + ox, top: y + oy } as const;
}

interface PaginaProps {
  fecha: string;
  destinatario: RemitoOverlayDestinatario;
  transportista?: RemitoOverlayDestinatario | null;
  items: RemitoOverlayItem[];
  ox: number;
  oy: number;
  fo: RemitoOverlayFieldOffsets;
}

/** Una página = una copia del remito. Renderiza idéntico siempre. */
function PaginaRemito({ fecha, destinatario, transportista, items, ox, oy, fo }: PaginaProps) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Fecha */}
      <Text style={[styles.field, valuePos(X_FECHA + (fo.fecha?.x ?? 0), Y_FECHA + (fo.fecha?.y ?? 0), ox, oy)]}>{fecha}</Text>

      {/* Columna izquierda — destinatario */}
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_RAZON_SOCIAL + (fo.razonSocial?.y ?? 0), ox, oy)]}>{destinatario.razonSocial}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_DOMICILIO + (fo.domicilio?.y ?? 0),    ox, oy)]}>{destinatario.domicilio}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_LOCALIDAD + (fo.localidad?.y ?? 0),    ox, oy)]}>{destinatario.localidad}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_PROVINCIA + (fo.provincia?.y ?? 0),    ox, oy)]}>{destinatario.provincia}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_IVA + (fo.iva?.y ?? 0),          ox, oy)]}>{destinatario.iva}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_CUIT + (fo.cuit?.y ?? 0),         ox, oy)]}>{destinatario.cuit}</Text>

      {/* Columna derecha — transportista */}
      {transportista && (
        <>
          <Text style={[styles.field, valuePos(X_VALUE_RIGHT, Y_RAZON_SOCIAL, ox, oy)]}>{transportista.razonSocial}</Text>
          <Text style={[styles.field, valuePos(X_VALUE_RIGHT, Y_DOMICILIO,    ox, oy)]}>{transportista.domicilio}</Text>
          <Text style={[styles.field, valuePos(X_VALUE_RIGHT, Y_LOCALIDAD,    ox, oy)]}>{transportista.localidad}</Text>
          <Text style={[styles.field, valuePos(X_VALUE_RIGHT, Y_PROVINCIA,    ox, oy)]}>{transportista.provincia}</Text>
          <Text style={[styles.field, valuePos(X_VALUE_RIGHT, Y_IVA,          ox, oy)]}>{transportista.iva}</Text>
          <Text style={[styles.field, valuePos(X_VALUE_RIGHT, Y_CUIT,         ox, oy)]}>{transportista.cuit}</Text>
        </>
      )}

      {/* Filas de items en la tabla */}
      {items.slice(0, TABLE_MAX_ROWS).map((row, i) => {
        const y = TABLE_TOP + (fo.tablaY ?? 0) + i * TABLE_ROW_H + oy;
        return (
          <View key={i}>
            <Text style={[styles.cell, { left: COL_X.item + (fo.colItemX ?? 0) + ox,        top: y }]}>{row.numero}</Text>
            <Text style={[styles.cell, { left: COL_X.cant + (fo.colCantX ?? 0) + ox,        top: y }]}>{row.cantidad}</Text>
            <Text style={[styles.cell, { left: COL_X.producto + (fo.colProductoX ?? 0) + ox,    top: y }]}>{row.producto}</Text>
            <Text style={[styles.cell, { left: COL_X.descripcion + (fo.colDescripcionX ?? 0) + ox, top: y, maxWidth: 380 - (fo.colDescripcionX ?? 0) }]}>
              {row.descripcion}
            </Text>
          </View>
        );
      })}
    </Page>
  );
}

export function RemitoOverlayPDF({
  fecha,
  destinatario,
  transportista,
  items,
  globalOffsetX = 0,
  globalOffsetY = 0,
  fieldOffsets,
  copies = 3,
}: RemitoOverlayPDFProps) {
  const ox = globalOffsetX;
  const oy = globalOffsetY;
  const totalCopies = Math.max(1, copies);

  return (
    <Document>
      {Array.from({ length: totalCopies }).map((_, idx) => (
        <PaginaRemito
          key={idx}
          fecha={fecha}
          destinatario={destinatario}
          transportista={transportista}
          items={items}
          ox={ox}
          oy={oy}
          fo={fieldOffsets ?? {}}
        />
      ))}
    </Document>
  );
}
