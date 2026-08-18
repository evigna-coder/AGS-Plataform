import { StyleSheet } from '@react-pdf/renderer';
import '../../presupuestos/pdf/pdfFonts';

/**
 * Hoja de OT para imprimir (2026-08-14).
 *
 * Pensada para salir en BLANCO Y NEGRO: la jerarquia se sostiene con peso
 * tipografico, grosor de borde y una sola mancha solida (el chip "EN BENCH").
 * No hay ningun dato que dependa del color para entenderse — un ambar o un teal
 * en fotocopia quedan todos en el mismo gris.
 */
export const C = {
  ink: '#0F172A',
  ink2: '#475569',
  ink3: '#94A3B8',
  line: '#CBD5E1',
  lineSoft: '#E2E8F0',
  wash: '#F8FAFC',
  bench: '#E8F1F1',
  black: '#0B0B0B',
};

export const s = StyleSheet.create({
  // Aire generoso a proposito (2026-08-14): con una OT sin presupuesto la hoja
  // terminaba a media pagina. Los datos se estiran en vez de amontonarse arriba.
  page: { fontFamily: 'Inter', fontSize: 9.5, color: C.ink, paddingVertical: 38, paddingHorizontal: 42 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: C.ink, paddingBottom: 8 },
  headLeft: { flexDirection: 'row', alignItems: 'center' },
  otNum: { fontSize: 20, fontWeight: 'bold', letterSpacing: -0.3 },
  chip: { marginLeft: 10, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 3,
    borderWidth: 1, borderColor: C.ink2 },
  chipTxt: { fontSize: 7, letterSpacing: 0.5, color: C.ink2 },
  headRight: { alignItems: 'flex-end' },
  marca: { fontSize: 8, letterSpacing: 0.8, color: C.ink2 },
  emitida: { fontSize: 7.5, color: C.ink3, marginTop: 1 },

  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  secTitle: { fontSize: 7.5, letterSpacing: 1.2, color: C.ink2, fontWeight: 'bold' },
  secRule: { flex: 1, height: 1, backgroundColor: C.lineSoft, marginLeft: 6 },

  cols: { flexDirection: 'row', marginTop: 16 },
  colA: { flex: 1, paddingRight: 14 },
  colB: { width: 250 },
  block: { marginBottom: 16 },

  kv: { flexDirection: 'row', paddingVertical: 2.5 },
  k: { width: 92, fontSize: 8, color: C.ink3 },
  v: { flex: 1, fontSize: 10 },
  vStrong: { flex: 1, fontSize: 11, fontWeight: 'bold' },
  obs: { fontSize: 8, color: C.ink3, marginTop: 5, lineHeight: 1.4 },

  caja: { backgroundColor: C.wash, borderLeftWidth: 2, borderLeftColor: C.ink, padding: 9 },
  cajaTxt: { fontSize: 9.5, lineHeight: 1.5 },

  // Borde izquierdo grueso: en blanco y negro es lo que apunta al modulo, ya
  // que no hay color que lo distinga del resto de la configuracion.
  benchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bench,
    borderWidth: 2, borderLeftWidth: 7, borderColor: C.black, borderRadius: 3,
    paddingVertical: 9, paddingLeft: 8, paddingRight: 9 },
  benchChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.black,
    borderRadius: 2, paddingVertical: 3, paddingHorizontal: 6 },
  benchChipTxt: { color: '#FFFFFF', fontSize: 7, fontWeight: 'bold', letterSpacing: 0.9 },
  benchMarker: { width: 100 },
  benchRol: { fontSize: 7, letterSpacing: 0.9, color: C.ink2 },
  benchDesc: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  benchSerie: { flexDirection: 'row', marginTop: 1 },
  benchSn: { fontSize: 11, fontWeight: 'bold' },
  benchFw: { fontSize: 8.5, color: C.ink2, marginLeft: 12 },

  modRow: { flexDirection: 'row', marginTop: 7 },
  modCell: { flex: 1, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.lineSoft,
    paddingBottom: 5, marginRight: 10 },
  modRol: { width: 92, fontSize: 6.5, letterSpacing: 0.4, color: C.ink3 },
  modDesc: { fontSize: 9 },
  modSerie: { fontSize: 8, color: C.ink2 },

  tblHead: { flexDirection: 'row', backgroundColor: C.wash, paddingVertical: 4, paddingHorizontal: 8,
    borderWidth: 1, borderColor: C.lineSoft },
  tblRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8,
    borderWidth: 1, borderTopWidth: 0, borderColor: C.lineSoft },
  th: { fontSize: 6.5, letterSpacing: 0.5, color: C.ink2 },

  tarea: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 9,
    borderWidth: 1, borderColor: C.lineSoft },
  casillero: { width: 9, height: 9, borderWidth: 1, borderColor: C.ink2, marginRight: 8, marginTop: 1 },
  tareaNum: { width: 12, fontSize: 8, fontWeight: 'bold' },
  tareaTxt: { fontSize: 10 },
  tareaDet: { fontSize: 7.5, color: C.ink3, marginTop: 2 },

  // Detalle tecnico: recuadro a ancho completo con alto minimo, para que el
  // bloque exista aunque el texto sea corto y la hoja no termine a la mitad.
  detalle: { borderWidth: 1, borderColor: C.line, borderRadius: 3, padding: 12, minHeight: 150 },
  detalleTxt: { fontSize: 10, lineHeight: 1.55 },
  detalleVacio: { fontSize: 9, color: C.ink3, fontStyle: 'italic' },

  pie: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: C.lineSoft },
  pieTxt: { fontSize: 6.5, color: C.ink3 },
});
