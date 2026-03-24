import { StyleSheet } from '@react-pdf/renderer';

// Colores corporativos AGS
export const COLORS = {
  primary: '#1a5276',       // Azul oscuro AGS
  primaryLight: '#2980b9',  // Azul medio
  accent: '#e67e22',        // Naranja acento
  headerBg: '#1a5276',      // Fondo header tabla
  headerText: '#ffffff',     // Texto header tabla
  rowAlt: '#f8fafc',         // Fondo fila alternada
  border: '#cbd5e1',        // Bordes
  borderDark: '#94a3b8',    // Bordes más oscuros
  text: '#1e293b',          // Texto principal
  textMuted: '#64748b',     // Texto secundario
  sectionBg: '#f1f5f9',     // Fondo secciones
  sectionBorder: '#1a5276', // Borde izquierdo secciones
  white: '#ffffff',
  black: '#000000',
  red: '#dc2626',
  green: '#16a34a',
};

// Estilos base compartidos entre ambos templates
export const baseStyles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 30,
  },

  // --- Header ---
  headerRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  logoSection: {
    width: '35%',
  },
  logo: {
    width: 120,
    height: 'auto',
    marginBottom: 4,
  },
  companyInfo: {
    fontSize: 6.5,
    color: COLORS.textMuted,
    lineHeight: 1.4,
  },
  companyName: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  titleSection: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  titleBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
    alignItems: 'center',
  },
  titleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 2,
  },
  titleLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  titleSubLabel: {
    fontSize: 6,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  metaSection: {
    width: '35%',
    alignItems: 'flex-end',
  },
  metaBox: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 6,
    minWidth: 160,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.primary,
    width: 80,
  },
  metaValue: {
    fontSize: 7,
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },
  isoLogo: {
    width: 50,
    height: 'auto',
    marginTop: 4,
    alignSelf: 'flex-end',
  },

  // --- Cliente info ---
  clienteSection: {
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    padding: 0,
  },
  clienteRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    minHeight: 16,
  },
  clienteLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.primary,
    width: 70,
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: COLORS.sectionBg,
  },
  clienteValue: {
    fontSize: 7,
    color: COLORS.text,
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  clienteLabelSmall: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.primary,
    width: 55,
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: COLORS.sectionBg,
    borderLeftWidth: 0.5,
    borderLeftColor: COLORS.border,
  },

  // --- Tabla de items ---
  table: {
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBg,
    minHeight: 20,
    alignItems: 'center',
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 'bold',
    color: COLORS.headerText,
    paddingVertical: 4,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    minHeight: 18,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: COLORS.rowAlt,
  },
  tableCell: {
    fontSize: 7,
    color: COLORS.text,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableCellRight: {
    textAlign: 'right',
  },
  tableCellCenter: {
    textAlign: 'center',
  },

  // --- Totales ---
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  totalsBox: {
    width: 200,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalsRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  totalsRowFinal: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: COLORS.headerBg,
  },
  totalsLabel: {
    fontSize: 7,
    color: COLORS.text,
    flex: 1,
  },
  totalsValue: {
    fontSize: 7,
    color: COLORS.text,
    textAlign: 'right',
    width: 70,
  },
  totalsLabelFinal: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.headerText,
    flex: 1,
  },
  totalsValueFinal: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.headerText,
    textAlign: 'right',
    width: 70,
  },

  // --- Secciones de texto (condiciones) ---
  condicionSection: {
    marginBottom: 10,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.sectionBorder,
    paddingLeft: 8,
  },
  condicionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  condicionText: {
    fontSize: 7,
    color: COLORS.text,
    lineHeight: 1.5,
    textAlign: 'justify',
  },

  // --- Forma de pago ---
  formaPago: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.sectionBg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  formaPagoLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginRight: 8,
  },
  formaPagoValue: {
    fontSize: 7,
    color: COLORS.text,
    flex: 1,
  },

  // --- Validez ---
  validez: {
    fontSize: 7,
    fontStyle: 'italic',
    color: COLORS.textMuted,
    marginBottom: 8,
    textAlign: 'center',
  },

  // --- Moneda en letras ---
  monedaLetras: {
    fontSize: 7,
    fontStyle: 'italic',
    color: COLORS.text,
    marginBottom: 8,
  },

  // --- Firma ---
  firmaSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  firmaBlock: {
    width: '40%',
    alignItems: 'center',
  },
  firmaLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.primary,
    marginBottom: 4,
  },
  firmaLine: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.text,
    width: '100%',
    marginBottom: 4,
    height: 30,
  },
  firmaSubLabel: {
    fontSize: 6.5,
    color: COLORS.textMuted,
  },

  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 4,
  },
  footerLeft: {
    fontSize: 6,
    color: COLORS.textMuted,
  },
  footerCenter: {
    fontSize: 6,
    color: COLORS.textMuted,
  },
  footerRight: {
    fontSize: 6,
    color: COLORS.textMuted,
  },

  // --- Separador ---
  separator: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    marginVertical: 8,
  },
});
