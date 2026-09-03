import { View, Text } from '@react-pdf/renderer';
import { cs, T } from './pdfContratoStyles';
import { fmtDateISO, fmtNum, planCuotas, totalsByCurrency } from './pdfContratoHelpers';
import { presupuestoTieneValidez } from '@ags/shared';
import { validezHastaFecha } from '../pdfUtils';
import { PDFHeader, PDFClienteInfo, type PresupuestoPDFData } from '../PresupuestoPDFEstandar';

export function PDFContratoCover({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto, condicionPago } = data;
  const totals = totalsByCurrency(presupuesto.items, presupuesto.moneda);
  const plan = planCuotas(presupuesto);

  return (
    <View style={cs.coverWrap}>
      {/* Logo + ISO top bar */}
      {/* MISMA cabecera que el presupuesto estándar, hasta el cliente inclusive
          (pedido 2026-09-03): logo + datos fiscales a la izquierda, título +
          N° + fecha + preparó a la derecha, sello TÜV. Antes el contrato tenía
          su propia portada y parecían documentos de dos empresas distintas. */}
      <PDFHeader data={data} />
      <PDFClienteInfo data={data} />

      {/* Lo único propio del contrato en la cabecera: qué tipo de servicio es. */}
      <Text style={[cs.coverEyebrow, { marginTop: 6, marginBottom: 8 }]}>
        Presupuesto de contrato — Servicio Prestacional de Soporte Técnico Analítico
      </Text>

      {/* Vigencia del contrato */}
      {(presupuesto.contratoFechaInicio || presupuesto.contratoFechaFin) && (
        <View style={cs.vigenciaCard}>
          <View>
            <Text style={cs.vigenciaLabel}>Período de vigencia</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={cs.vigenciaDates}>{fmtDateISO(presupuesto.contratoFechaInicio)}</Text>
              <Text style={cs.vigenciaSeparator}>→</Text>
              <Text style={cs.vigenciaDates}>{fmtDateISO(presupuesto.contratoFechaFin)}</Text>
            </View>
          </View>
          {/* La validez desaparece una vez aceptado (2026-08-09). */}
          {presupuestoTieneValidez(presupuesto.estado) && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={cs.vigenciaLabel}>Oferta válida</Text>
              <Text style={{ fontSize: 11, color: T.text, fontWeight: 'bold', marginTop: 2 }}>
                {presupuesto.validezDias || 15} días — hasta el {validezHastaFecha(presupuesto.createdAt, presupuesto.validezDias)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Totals cards */}
      <Text style={[cs.coverBlockLabel, { marginBottom: 6, marginTop: 4 }]}>Resumen de montos anuales</Text>
      <View style={cs.totalsCardsRow}>
        {Object.keys(totals).length === 0 ? (
          <View style={cs.totalCard}>
            <Text style={cs.totalCardLabel}>Sin items</Text>
            <Text style={cs.totalCardValue}>—</Text>
          </View>
        ) : (
          Object.entries(totals).map(([cur, tot]) => (
            <View key={cur} style={cs.totalCard}>
              <Text style={cs.totalCardLabel}>Total {cur}</Text>
              <Text style={cs.totalCardValue}>{cur} {fmtNum(tot)}</Text>
              {/* IVA visible (UAT contrato 2026-08-04): antes decía solo "Sin IVA" */}
              <Text style={cs.totalCardSub}>+ IVA 21%: {fmtNum(tot * 0.21)} · c/IVA {cur} {fmtNum(tot * 1.21)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Plan de pagos en la PORTADA (UAT contrato 2026-08-04): "12 pagos de tanto" */}
      {(plan.uniformes.length > 0 || plan.desparejas.length > 0) && (
        <View style={{ marginTop: 10 }}>
          <Text style={cs.coverBlockLabel}>Plan de pagos</Text>
          {plan.uniformes.map(r => (
            <Text key={r.cur} style={{ fontSize: 10, color: T.text, marginTop: 3 }}>
              {r.n} pagos mensuales de{' '}
              <Text style={{ fontWeight: 'bold', color: T.primary }}>{r.cur} {fmtNum(r.monto)}</Text>
              {' '}+ IVA
              {r.ajusteRedondeo && <Text style={{ fontSize: 7, color: T.textMuted }}> (una cuota ajusta centavos por redondeo)</Text>}
            </Text>
          ))}
          {/* Cuotas desparejas: sin anexo — se listan compactas acá mismo */}
          {plan.desparejas.map(([cur, list]) => (
            <Text key={cur} style={{ fontSize: 9, color: T.text, marginTop: 3 }}>
              {list.length} cuotas en {cur}: {list.map(c => `#${c.numero} ${fmtNum(c.monto)}`).join(' · ')} (+ IVA)
            </Text>
          ))}
        </View>
      )}

      {/* Condición de pago debajo del plan (UAT contrato 2026-08-05: no salía) */}
      {condicionPago && (
        <View style={{ marginTop: 8 }}>
          <Text style={cs.coverBlockLabel}>Condición de pago</Text>
          <Text style={{ fontSize: 10, color: T.text, marginTop: 2 }}>
            {condicionPago.nombre}{condicionPago.dias > 0 ? ` (${condicionPago.dias} días)` : ''}
          </Text>
        </View>
      )}

      {/* Notas complementarias en recuadro (UAT contrato 2026-08-05) */}
      {presupuesto.notasComplementarias?.trim() && (
        <View style={{
          marginTop: 10, padding: 8,
          borderWidth: 0.75, borderColor: T.border, borderRadius: 4,
        }}>
          <Text style={[cs.coverBlockLabel, { marginBottom: 3 }]}>Notas complementarias</Text>
          <Text style={{ fontSize: 8.5, color: T.text, lineHeight: 1.4 }}>
            {presupuesto.notasComplementarias.trim()}
          </Text>
        </View>
      )}
    </View>
  );
}
