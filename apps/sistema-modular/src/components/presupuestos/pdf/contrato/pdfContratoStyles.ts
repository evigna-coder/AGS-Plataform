import { StyleSheet } from '@react-pdf/renderer';

// ═══════════════════════════════════════════════════════════════════════════
// Editorial Teal palette for the new contrato PDF
// ═══════════════════════════════════════════════════════════════════════════
export const T = {
  primary: '#0D6E6E',      // teal-700
  primaryDark: '#0A5454',
  primaryLight: '#E8F3F3',
  accent: '#0D6E6E',
  text: '#1E293B',         // slate-800
  textMuted: '#64748B',    // slate-500
  textFaint: '#94A3B8',    // slate-400
  border: '#E2E8F0',       // slate-200
  borderStrong: '#CBD5E1', // slate-300
  bgSubtle: '#F8FAFC',     // slate-50
  bgCard: '#FFFFFF',
  bgNote: '#FFFBEB',       // amber-50 for inline notes
  noteAccent: '#D97706',   // amber-600
  slCol: '#94A3B8',        // gray for S/L rows
  bonifBg: '#FEF2F2',      // red-50
};

export const cs = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: T.text,
    backgroundColor: '#ffffff',
    paddingTop: 28,
    paddingBottom: 45,
    paddingHorizontal: 30,
  },

  // ── Page header strip ──
  pageHeaderStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },
  pageHeaderLogo: { width: 70, height: 'auto' },
  pageHeaderMeta: { flexDirection: 'row', gap: 14 },
  pageHeaderMetaItem: { flexDirection: 'column', alignItems: 'flex-end' },
  pageHeaderMetaLabel: {
    fontSize: 6, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  pageHeaderMetaValue: { fontSize: 8, color: T.text, fontWeight: 600 },

  // ── Cover page ──
  coverWrap: { paddingTop: 20 },
  coverEyebrow: {
    fontSize: 7, color: T.primary, textTransform: 'uppercase',
    letterSpacing: 2, marginBottom: 4, fontWeight: 600,
  },
  coverTitle: {
    fontSize: 26, fontWeight: 'bold', color: T.text, marginBottom: 2, letterSpacing: -0.5,
  },
  coverSubtitle: { fontSize: 10, color: T.textMuted, marginBottom: 20 },
  coverNumero: { fontSize: 14, fontWeight: 'bold', color: T.primary, marginBottom: 24 },
  coverGrid: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  coverBlock: { flex: 1 },
  coverBlockLabel: {
    fontSize: 6, color: T.textFaint, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 3,
  },
  coverBlockValue: { fontSize: 9, color: T.text, lineHeight: 1.5 },
  coverBlockValueStrong: { fontSize: 10, color: T.text, fontWeight: 'bold' },

  // Vigencia card
  vigenciaCard: {
    borderWidth: 1, borderColor: T.primary, backgroundColor: T.primaryLight,
    padding: 14, marginBottom: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  vigenciaLabel: {
    fontSize: 7, color: T.primary, textTransform: 'uppercase',
    letterSpacing: 1, fontWeight: 600, marginBottom: 2,
  },
  vigenciaDates: { fontSize: 13, color: T.text, fontWeight: 'bold' },
  vigenciaSeparator: { fontSize: 10, color: T.primary, marginHorizontal: 10 },

  // Totals cards on cover
  totalsCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  totalCard: {
    flex: 1, borderWidth: 1, borderColor: T.borderStrong, padding: 10, backgroundColor: T.bgCard,
  },
  totalCardLabel: {
    fontSize: 6, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  totalCardValue: { fontSize: 14, fontWeight: 'bold', color: T.primary },
  totalCardSub: { fontSize: 7, color: T.textMuted, marginTop: 2 },

  // ── Sector header ──
  sectorHeader: {
    marginTop: 6, marginBottom: 8, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: T.primary,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  sectorLabel: {
    fontSize: 6, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1.5,
  },
  sectorName: { fontSize: 13, fontWeight: 'bold', color: T.primary, marginTop: 1 },

  // ── Sistema card ──
  sistemaCard: { borderWidth: 0.5, borderColor: T.borderStrong, marginBottom: 8 },
  sistemaCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 8,
    backgroundColor: T.primaryLight,
    borderBottomWidth: 0.5, borderBottomColor: T.border,
  },
  sistemaCardNum: { fontSize: 8, fontWeight: 'bold', color: T.primary, marginRight: 6 },
  sistemaCardName: { fontSize: 9, fontWeight: 'bold', color: T.text, flex: 1 },
  sistemaCardId: { fontSize: 7, color: T.textMuted, fontWeight: 600 },

  // ── Items table ──
  itemTableHead: {
    flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6,
    backgroundColor: T.bgSubtle,
    borderBottomWidth: 0.5, borderBottomColor: T.border,
  },
  itemTableHeadCell: {
    fontSize: 6, color: T.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, fontWeight: 600,
  },
  itemRow: {
    flexDirection: 'row', paddingVertical: 2.5, paddingHorizontal: 6,
    borderBottomWidth: 0.3, borderBottomColor: T.border,
    minHeight: 14, alignItems: 'center',
  },
  itemRowSL: { backgroundColor: T.bgSubtle },
  itemRowBonif: { backgroundColor: T.bonifBg },
  itemCell: { fontSize: 7, color: T.text, paddingRight: 3 },
  itemCellSL: { color: T.slCol },
  itemCellRight: { textAlign: 'right' },
  itemCellCenter: { textAlign: 'center' },
  itemCellMono: { fontSize: 6, color: T.textMuted },

  itemNoteRow: {
    flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: T.bgNote,
    borderLeftWidth: 2, borderLeftColor: T.noteAccent,
    marginBottom: 1,
  },
  itemNoteText: { fontSize: 6.5, color: T.noteAccent, fontStyle: 'italic', flex: 1 },

  // Módulos del sistema (bloque informativo debajo del header)
  modulosInfo: {
    paddingVertical: 3, paddingHorizontal: 8,
    backgroundColor: T.bgSubtle,
    borderBottomWidth: 0.5, borderBottomColor: T.border,
  },
  modulosInfoLabel: {
    fontSize: 6, color: T.textFaint, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 2, fontWeight: 600,
  },
  modulosInfoRow: {
    flexDirection: 'row',
    paddingVertical: 1.5,
  },
  modulosInfoCol: { fontSize: 6.5, color: T.textMuted },

  sistemaSubtotal: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: T.bgSubtle,
    borderTopWidth: 0.5, borderTopColor: T.border, gap: 16,
  },
  sistemaSubtotalLabel: {
    fontSize: 7, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sistemaSubtotalValue: { fontSize: 8, fontWeight: 'bold', color: T.primary },

  // ── Grand totals ──
  grandTotalsWrap: {
    marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.primary,
  },
  grandTotalsRow: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 18, paddingVertical: 6,
  },
  grandTotalBox: { alignItems: 'flex-end' },
  grandTotalLabel: { fontSize: 7, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  grandTotalValue: { fontSize: 13, fontWeight: 'bold', color: T.primary },

  // ── Cuotas ──
  cuotasWrap: { marginTop: 14 },
  cuotasTitle: { fontSize: 11, fontWeight: 'bold', color: T.text, marginBottom: 6 },
  cuotasTitleSub: { fontSize: 7, color: T.textMuted, marginBottom: 8 },
  cuotasTablesRow: { flexDirection: 'row', gap: 16 },
  cuotasTable: { flex: 1, borderWidth: 0.5, borderColor: T.border },
  cuotasTableHead: {
    flexDirection: 'row', backgroundColor: T.primary, paddingVertical: 4, paddingHorizontal: 6,
  },
  cuotasTableHeadText: { fontSize: 7, color: '#FFFFFF', fontWeight: 'bold' },
  cuotaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 2.5, paddingHorizontal: 6,
    borderBottomWidth: 0.3, borderBottomColor: T.border,
  },
  cuotaRowAlt: { backgroundColor: T.bgSubtle },
  cuotaNum: { fontSize: 7, color: T.textMuted, width: 20 },
  cuotaDesc: { fontSize: 7, color: T.text, flex: 1 },
  cuotaMonto: { fontSize: 7, color: T.text, fontWeight: 600 },

  // ── Condiciones ──
  condicionBlock: {
    marginBottom: 10, paddingLeft: 10,
    borderLeftWidth: 2, borderLeftColor: T.primary,
  },
  condicionTitle: {
    fontSize: 8, fontWeight: 'bold', color: T.primary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4,
  },
  condicionText: { fontSize: 7, color: T.text, lineHeight: 1.5, textAlign: 'justify' },

  // ── Aceptación ──
  aceptacionCard: {
    marginTop: 12, borderWidth: 1, borderColor: T.primary, padding: 12,
  },
  aceptacionTitle: { fontSize: 10, fontWeight: 'bold', color: T.primary, marginBottom: 6 },
  aceptacionIntro: { fontSize: 7, color: T.text, marginBottom: 10, lineHeight: 1.5 },
  aceptacionGrid: { flexDirection: 'row', gap: 16, marginTop: 8 },
  aceptacionField: { flex: 1 },
  aceptacionFieldLabel: {
    fontSize: 6, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  aceptacionLine: { borderBottomWidth: 0.8, borderBottomColor: T.text, height: 22 },

  // ── Footer ──
  footer: {
    position: 'absolute', bottom: 18, left: 30, right: 30,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.5, borderTopColor: T.border, paddingTop: 5,
  },
  footerText: { fontSize: 6, color: T.textFaint },
});

// ═══════════════════════════════════════════════════════════════════════════
// Column widths
// ═══════════════════════════════════════════════════════════════════════════
export const COLS_SINGLE = {
  num: '6%', codigo: '16%', desc: '42%', cant: '8%', precio: '14%', subtotal: '14%',
};
export const COLS_MIXTA = {
  num: '6%', codigo: '14%', desc: '36%', cant: '7%', mon: '7%', precio: '14%', subtotal: '16%',
};
