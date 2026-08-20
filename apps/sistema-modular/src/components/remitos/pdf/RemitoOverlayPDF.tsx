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

/** 1 mm en puntos PDF (72 dpi). */
const MM = 2.83465;

/**
 * Columna derecha — datos del transportista. Medido sobre el papel preimpreso
 * (2026-08-07): arranca 8,5 cm a la derecha de donde arranca la razón social
 * del destinatario, +1 mm del ajuste fino contra impresión real.
 */
const X_VALUE_RIGHT = X_VALUE_LEFT + 241 + 1 * MM;

/**
 * Ajustes verticales POR CAMPO del bloque transportista, medidos contra el
 * papel impreso (2026-08-07). El papel no tiene las casillas de transportista
 * a la misma altura que las del destinatario, así que no alcanza con reusar
 * las Y_* de la izquierda. Positivo = hacia abajo.
 */
const DY_TRANSPORTISTA = {
  razonSocial: 2 * MM,
  domicilio: -1 * MM,
  localidad: -4.5 * MM, // bajada 0,5 mm — papel real 2026-08-20
  provincia: -8 * MM,   // bajada 1 mm — papel real 2026-08-20
  iva: 0,
  cuit: -15 * MM,
};

/**
 * Corrimiento a la IZQUIERDA del bloque destinatario (2026-08-20): las casillas
 * del papel arrancan 5 mm antes de donde estábamos escribiendo. Aplica a los
 * SEIS campos — la columna entera, IVA incluido.
 */
const X_LEFT_AJUSTE = -5 * MM;

/**
 * Corte de los campos del header (2026-08-20). En el papel entran 54 caracteres
 * en minúscula por renglón, y cada casilla tiene lugar para DOS renglones. Lo
 * que no entra en dos se corta: es preferible a que se monte sobre la casilla
 * de abajo.
 *
 * El corte es por CARACTERES y no por ancho porque así está medido contra el
 * papel real. Helvetica es proporcional, así que 54 caracteres en mayúscula
 * ocupan más — el número sale de una razón social típica en minúscula.
 */
const MAX_CHARS_CAMPO = 54;
const MAX_RENGLONES_CAMPO = 2;

/** Alto de renglón del segundo renglón de un campo (fontSize 9 × 1,05). */
const FIELD_LINE_H = 9.5;

/**
 * Parte un texto en hasta `maxRenglones` de `max` caracteres, cortando entre
 * palabras. Una palabra sola más larga que el renglón se corta al medio (un
 * CUIT o un código sin espacios no tiene dónde partirse). Lo que sobra después
 * del último renglón se descarta.
 */
export function partirEnRenglones(
  texto: string,
  max = MAX_CHARS_CAMPO,
  maxRenglones = MAX_RENGLONES_CAMPO,
): string[] {
  const limpio = (texto ?? '').trim();
  if (!limpio) return [];
  const renglones: string[] = [];
  let resto = limpio;
  while (resto.length > 0 && renglones.length < maxRenglones) {
    if (resto.length <= max) { renglones.push(resto); break; }
    const corte = resto.lastIndexOf(' ', max);
    // Sin espacio donde cortar → tajo seco en `max`.
    const fin = corte > 0 ? corte : max;
    renglones.push(resto.slice(0, fin).trimEnd());
    resto = resto.slice(fin).trimStart();
  }
  return renglones;
}

/** Y de cada fila del header. La altura entre filas en el papel es ~33pt. */
const Y_RAZON_SOCIAL = 270;
const Y_DOMICILIO   = 305;
const Y_LOCALIDAD   = 340;
const Y_PROVINCIA   = 375;
const Y_IVA         = 410;
const Y_CUIT        = 445;

/**
 * Ancho útil de la columna Descripción del papel preimpreso, en pt (2026-08-14).
 * La descripción arranca en `COL_X.descripcion` (400) corrida 4,5 cm a la
 * izquierda por `colDescripcionX` → ~272 pt, y el A4 mide 595: quedan ~285 pt
 * hasta el borde de la caja de items. El `maxWidth: 380 - colDescripcionX` que
 * había antes daba 507 pt, o sea 190 pt FUERA de la hoja — por eso el texto
 * salía cortado justo al final, que es donde va el N° de serie.
 */
const DESC_ANCHO_PT = 280;

/**
 * Cuerpo de la descripción cuando va en DOS renglones: 2 × 7 × 1,05 ≈ 14,7 pt,
 * que entra en los 16 pt de alto de la fila (TABLE_ROW_H) sin invadir la de
 * abajo. Si se toca TABLE_ROW_H hay que rehacer esta cuenta.
 */
const DESC_FS_DOS_LINEAS = 7;
const DESC_LINE_H = 1.05;

/**
 * Cuerpo de letra de la descripción (2026-08-18).
 *
 * Antes se achicaba hasta 6pt con tal de entrar en UNA línea, porque el papel
 * tiene renglones de alto fijo y una segunda línea se pisaba con el item
 * siguiente. Pero a 6pt no se lee: queda feo y no cumple su función.
 *
 * Ahora: si entra cómoda en una línea, va grande; si no, pasa a DOS renglones a
 * 7pt, que es el cuerpo más grande cuyas dos líneas caben en los 16pt de la
 * fila sin invadir la de abajo.
 *
 * Helvetica promedia ~0,5 × el cuerpo por carácter.
 */
export function fontSizeDescripcion(texto: string): number {
  const largo = texto.length;
  if (largo === 0) return 8.5;
  for (const fs of [8.5, 8]) {
    if (largo * fs * 0.5 <= DESC_ANCHO_PT) return fs;
  }
  return DESC_FS_DOS_LINEAS;
}

/** `true` si el texto necesita el segundo renglón. */
export function descripcionEnDosLineas(texto: string): boolean {
  return fontSizeDescripcion(texto) === DESC_FS_DOS_LINEAS && texto.length > 0;
}

/**
 * Tope duro: lo que no entra ni en dos renglones se recorta con puntos
 * suspensivos. Sigue siendo mejor perder el final que pisar la fila siguiente.
 */
export function recortarDescripcion(texto: string): string {
  const lineas = descripcionEnDosLineas(texto) ? 2 : 1;
  const fs = fontSizeDescripcion(texto);
  const maxChars = Math.floor((DESC_ANCHO_PT * lineas) / (fs * 0.5));
  return texto.length <= maxChars ? texto : `${texto.slice(0, maxChars - 1)}…`;
}

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

/** Recuadro de observaciones generales (2026-08-04): arranca en la columna
 *  descripción, 9,5 cm debajo de la primera fila de items. 11 × 1,5 cm. */
const PT_MM = 2.83465;
const OBS_BOX = {
  offsetY: 95 * PT_MM,   // 9,5 cm bajo la primera línea de la tabla
  width: 110 * PT_MM,    // 11 cm
  height: 15 * PT_MM,    // 1,5 cm
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
  /** Ajuste fino del recuadro de observaciones generales. */
  obsBox?: { x?: number; y?: number };
}

interface RemitoOverlayPDFProps {
  fecha: string;                        // dd/mm/yyyy ya formateada
  destinatario: RemitoOverlayDestinatario;
  transportista?: RemitoOverlayDestinatario | null;
  items: RemitoOverlayItem[];
  /** Observaciones generales del remito (texto libre): recuadro debajo del
   *  detalle de items. Sin texto → no se dibuja el recuadro. */
  observaciones?: string | null;
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

/**
 * Un campo del header: uno o dos renglones según entre en `MAX_CHARS_CAMPO`.
 * El segundo renglón cae `FIELD_LINE_H` abajo — hay ~25 pt hasta la casilla
 * siguiente, así que no la invade.
 */
function Campo({ x, y, ox, oy, texto }: {
  x: number; y: number; ox: number; oy: number; texto: string;
}) {
  return (
    <>
      {partirEnRenglones(texto).map((renglon, i) => (
        <Text key={i} style={[styles.field, valuePos(x, y + i * FIELD_LINE_H, ox, oy)]}>{renglon}</Text>
      ))}
    </>
  );
}

interface PaginaProps {
  fecha: string;
  destinatario: RemitoOverlayDestinatario;
  transportista?: RemitoOverlayDestinatario | null;
  items: RemitoOverlayItem[];
  observaciones?: string | null;
  ox: number;
  oy: number;
  fo: RemitoOverlayFieldOffsets;
}

/** Una página = una copia del remito. Renderiza idéntico siempre. */
function PaginaRemito({ fecha, destinatario, transportista, items, observaciones, ox, oy, fo }: PaginaProps) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Fecha */}
      <Text style={[styles.field, valuePos(X_FECHA + (fo.fecha?.x ?? 0), Y_FECHA + (fo.fecha?.y ?? 0), ox, oy)]}>{fecha}</Text>

      {/* Columna izquierda — destinatario */}
      <Campo x={X_VALUE_LEFT + X_LEFT_AJUSTE} y={Y_RAZON_SOCIAL + (fo.razonSocial?.y ?? 0)} ox={ox} oy={oy} texto={destinatario.razonSocial} />
      <Campo x={X_VALUE_LEFT + X_LEFT_AJUSTE} y={Y_DOMICILIO + (fo.domicilio?.y ?? 0)}    ox={ox} oy={oy} texto={destinatario.domicilio} />
      <Campo x={X_VALUE_LEFT + X_LEFT_AJUSTE} y={Y_LOCALIDAD + (fo.localidad?.y ?? 0)}    ox={ox} oy={oy} texto={destinatario.localidad} />
      <Campo x={X_VALUE_LEFT + X_LEFT_AJUSTE} y={Y_PROVINCIA + (fo.provincia?.y ?? 0)}    ox={ox} oy={oy} texto={destinatario.provincia} />
      <Campo x={X_VALUE_LEFT + X_LEFT_AJUSTE} y={Y_IVA + (fo.iva?.y ?? 0)}                ox={ox} oy={oy} texto={destinatario.iva} />
      <Campo x={X_VALUE_LEFT + X_LEFT_AJUSTE} y={Y_CUIT + (fo.cuit?.y ?? 0)}              ox={ox} oy={oy} texto={destinatario.cuit} />

      {/* Columna derecha — transportista */}
      {transportista && (
        <>
          {/* +1 mm a la derecha SOLO el nombre (papel real 2026-08-18): la
              casilla del transportista arranca corrida respecto de las de abajo. */}
          <Campo x={X_VALUE_RIGHT + 1 * MM} y={Y_RAZON_SOCIAL + DY_TRANSPORTISTA.razonSocial} ox={ox} oy={oy} texto={transportista.razonSocial} />
          <Campo x={X_VALUE_RIGHT} y={Y_DOMICILIO + DY_TRANSPORTISTA.domicilio}  ox={ox} oy={oy} texto={transportista.domicilio} />
          <Campo x={X_VALUE_RIGHT} y={Y_LOCALIDAD + DY_TRANSPORTISTA.localidad}  ox={ox} oy={oy} texto={transportista.localidad} />
          <Campo x={X_VALUE_RIGHT} y={Y_PROVINCIA + DY_TRANSPORTISTA.provincia}  ox={ox} oy={oy} texto={transportista.provincia} />
          <Campo x={X_VALUE_RIGHT} y={Y_IVA + DY_TRANSPORTISTA.iva}              ox={ox} oy={oy} texto={transportista.iva} />
          <Campo x={X_VALUE_RIGHT} y={Y_CUIT + DY_TRANSPORTISTA.cuit}            ox={ox} oy={oy} texto={transportista.cuit} />
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
            {/* Descripción: una línea si entra; si no, DOS a 7pt (2026-08-18).
                Antes se achicaba hasta 6pt con tal de no envolver y quedaba
                ilegible. El `width` es lo que permite el corte de línea, y
                `maxLines` impide que una descripción larguísima empuje la fila
                de abajo. */}
            {(() => {
              const texto = recortarDescripcion(String(row.descripcion ?? ''));
              const dosLineas = descripcionEnDosLineas(String(row.descripcion ?? ''));
              return (
                <Text
                  style={[styles.cell, {
                    left: COL_X.descripcion + (fo.colDescripcionX ?? 0) + ox,
                    top: y,
                    width: DESC_ANCHO_PT,
                    fontSize: fontSizeDescripcion(String(row.descripcion ?? '')),
                    lineHeight: DESC_LINE_H,
                    maxLines: dosLineas ? 2 : 1,
                    textOverflow: 'ellipsis',
                  }]}
                  wrap={false}
                >
                  {texto}
                </Text>
              );
            })()}
          </View>
        );
      })}

      {/* Recuadro de observaciones generales (2026-08-04): contacto, horario de
          entrega, "pendiente entrega de", etc. Solo si hay texto. */}
      {observaciones?.trim() ? (
        <View
          style={{
            position: 'absolute',
            left: COL_X.descripcion + (fo.colDescripcionX ?? 0) + (fo.obsBox?.x ?? 0) + ox,
            top: TABLE_TOP + (fo.tablaY ?? 0) + OBS_BOX.offsetY + (fo.obsBox?.y ?? 0) + oy,
            width: OBS_BOX.width,
            height: OBS_BOX.height,
            borderWidth: 1,
            borderColor: '#000',
            borderStyle: 'solid',
            padding: 4,
          }}
        >
          <Text style={{ fontSize: 8.5 }}>{observaciones.trim()}</Text>
        </View>
      ) : null}
    </Page>
  );
}

export function RemitoOverlayPDF({
  fecha,
  destinatario,
  transportista,
  items,
  observaciones,
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
          observaciones={observaciones}
          ox={ox}
          oy={oy}
          fo={fieldOffsets ?? {}}
        />
      ))}
    </Document>
  );
}
