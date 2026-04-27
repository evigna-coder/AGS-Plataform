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
  /** Número de fila (Item) */
  numero: number;
  cantidad: number;
  /** Producto: usamos el número de ficha (FPC-XXXX) */
  producto: string;
  /** Descripción libre que va a la columna ancha */
  descripcion: string;
}

interface RemitoOverlayPDFProps {
  fecha: string;                        // dd/mm/yyyy ya formateada
  destinatario: RemitoOverlayDestinatario;
  transportista?: RemitoOverlayDestinatario | null;
  items: RemitoOverlayItem[];
  /** Offsets globales para calibrar contra impresora específica (en pt). */
  globalOffsetX?: number;
  globalOffsetY?: number;
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
}

/** Una página = una copia del remito. Renderiza idéntico siempre. */
function PaginaRemito({ fecha, destinatario, transportista, items, ox, oy }: PaginaProps) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Fecha */}
      <Text style={[styles.field, valuePos(X_FECHA, Y_FECHA, ox, oy)]}>{fecha}</Text>

      {/* Columna izquierda — destinatario */}
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_RAZON_SOCIAL, ox, oy)]}>{destinatario.razonSocial}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_DOMICILIO,    ox, oy)]}>{destinatario.domicilio}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_LOCALIDAD,    ox, oy)]}>{destinatario.localidad}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_PROVINCIA,    ox, oy)]}>{destinatario.provincia}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_IVA,          ox, oy)]}>{destinatario.iva}</Text>
      <Text style={[styles.field, valuePos(X_VALUE_LEFT, Y_CUIT,         ox, oy)]}>{destinatario.cuit}</Text>

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
        const y = TABLE_TOP + i * TABLE_ROW_H + oy;
        return (
          <View key={i}>
            <Text style={[styles.cell, { left: COL_X.item + ox,        top: y }]}>{row.numero}</Text>
            <Text style={[styles.cell, { left: COL_X.cant + ox,        top: y }]}>{row.cantidad}</Text>
            <Text style={[styles.cell, { left: COL_X.producto + ox,    top: y }]}>{row.producto}</Text>
            <Text style={[styles.cell, { left: COL_X.descripcion + ox, top: y, maxWidth: 380 }]}>
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
        />
      ))}
    </Document>
  );
}
