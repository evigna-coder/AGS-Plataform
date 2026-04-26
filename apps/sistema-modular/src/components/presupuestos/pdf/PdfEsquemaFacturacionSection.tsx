/**
 * PdfEsquemaFacturacionSection — PDF rendering for Phase 12 porcentual billing schema.
 * Used by PresupuestoPDFEstandar when presupuesto.esquemaFacturacion is present and
 * presupuesto.tipo !== 'contrato'.
 *
 * Pure rendering — no React hooks, no Firestore. Safe for @react-pdf/renderer tree.
 */
import { View, Text } from '@react-pdf/renderer';
import { COLORS } from './pdfStyles';
import type { PresupuestoCuotaFacturacion, CuotaFacturacionHito } from '@ags/shared';
import { computeTotalsByCurrency } from '../../../utils/cuotasFacturacion';
import type { Presupuesto } from '@ags/shared';

const HITO_LABELS: Record<CuotaFacturacionHito, string> = {
  ppto_aceptado: 'Ppto. aceptado',
  oc_recibida: 'OC recibida',
  pre_embarque: 'Pre-embarque',
  todas_ots_cerradas: 'Todas las OTs cerradas',
  manual: 'Manual',
};

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  presupuesto: Presupuesto;
  esquema: PresupuestoCuotaFacturacion[];
}

export function PdfEsquemaFacturacionSection({ presupuesto, esquema }: Props) {
  if (!esquema || esquema.length === 0) return null;

  // Derive active monedas and totals (I3 helper — pure function, no hooks)
  const totalsByCurrency = computeTotalsByCurrency(presupuesto.items ?? [], presupuesto.moneda ?? 'USD');
  const monedasActivas = Object.keys(totalsByCurrency).filter(m => (totalsByCurrency[m] ?? 0) > 0);

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{
        fontSize: 7, fontWeight: 700, color: COLORS.primary, marginBottom: 4, textTransform: 'uppercase',
      }}>
        Esquema de facturación — {esquema.length} cuota{esquema.length !== 1 ? 's' : ''}
      </Text>

      <View style={{ borderWidth: 0.5, borderColor: COLORS.border }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', backgroundColor: COLORS.sectionBg, padding: 3 }}>
          <Text style={{ fontSize: 6, fontWeight: 700, width: '8%', textAlign: 'center' }}>#</Text>
          <Text style={{ fontSize: 6, fontWeight: 700, width: '32%' }}>Descripción</Text>
          <Text style={{ fontSize: 6, fontWeight: 700, width: '22%' }}>Hito disparador</Text>
          {monedasActivas.map(m => (
            <Text key={m} style={{ fontSize: 6, fontWeight: 700, width: `${38 / monedasActivas.length}%`, textAlign: 'right' }}>
              {m} %
            </Text>
          ))}
        </View>

        {/* Cuota rows */}
        {esquema.map((cuota, i) => (
          <View
            key={cuota.id}
            style={{
              flexDirection: 'row',
              padding: 2,
              borderTopWidth: i > 0 ? 0.5 : 0,
              borderTopColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 6, width: '8%', textAlign: 'center' }}>{cuota.numero}</Text>
            <Text style={{ fontSize: 6, width: '32%' }}>{cuota.descripcion || `Cuota ${cuota.numero}`}</Text>
            <Text style={{ fontSize: 6, width: '22%' }}>
              {HITO_LABELS[cuota.hito] ?? cuota.hito}
            </Text>
            {monedasActivas.map(m => {
              const pct = cuota.porcentajePorMoneda?.[m as keyof typeof cuota.porcentajePorMoneda] ?? 0;
              const total = totalsByCurrency[m] ?? 0;
              const monto = (pct / 100) * total;
              const colWidth = `${38 / monedasActivas.length}%`;
              return (
                <Text key={m} style={{ fontSize: 6, width: colWidth, textAlign: 'right' }}>
                  {pct > 0 ? `${pct}% = ${fmt(monto)}` : '—'}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
