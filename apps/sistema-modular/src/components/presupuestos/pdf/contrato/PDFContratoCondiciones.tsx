import { View, Text } from '@react-pdf/renderer';
import { cs, T } from './pdfContratoStyles';
import { fmtDateISO, fmtNum } from './pdfContratoHelpers';
import type { PresupuestoPDFData } from '../PresupuestoPDFEstandar';

export function PDFContratoCuotas({ data }: { data: PresupuestoPDFData }) {
  const cuotas = data.presupuesto.cuotas || [];
  if (cuotas.length === 0) return null;

  const byCurrency = new Map<string, typeof cuotas>();
  for (const c of cuotas) {
    if (!byCurrency.has(c.moneda)) byCurrency.set(c.moneda, []);
    byCurrency.get(c.moneda)!.push(c);
  }

  return (
    <View style={cs.cuotasWrap} wrap={false}>
      <Text style={cs.cuotasTitle}>Plan de cuotas</Text>
      <Text style={cs.cuotasTitleSub}>
        {Array.from(byCurrency.entries()).map(([cur, list]) => `${list.length} en ${cur}`).join(' · ')}
      </Text>
      <View style={cs.cuotasTablesRow}>
        {Array.from(byCurrency.entries()).map(([cur, list]) => (
          <View key={cur} style={cs.cuotasTable}>
            <View style={cs.cuotasTableHead}>
              <Text style={cs.cuotasTableHeadText}>Cuotas {cur}</Text>
            </View>
            {list.map((c, i) => (
              <View key={`${cur}-${c.numero}`} style={[cs.cuotaRow, i % 2 === 1 && cs.cuotaRowAlt] as any}>
                <Text style={cs.cuotaNum}>#{c.numero}</Text>
                <Text style={cs.cuotaDesc}>{c.descripcion || 'Cuota mensual'}</Text>
                <Text style={cs.cuotaMonto}>{cur} {fmtNum(c.monto)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export function PDFContratoCondicionesText({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  const secciones = presupuesto.seccionesVisibles || {};
  const blocks = [
    { key: 'notasTecnicas', title: 'Notas sobre este presupuesto', content: presupuesto.notasTecnicas },
    { key: 'condicionesComerciales', title: 'Condiciones comerciales', content: presupuesto.condicionesComerciales },
    { key: 'garantia', title: 'Garantía', content: presupuesto.garantia },
    { key: 'variacionTipoCambio', title: 'Variación del tipo de cambio', content: presupuesto.variacionTipoCambio },
    { key: 'notasAdministrativas', title: 'Notas administrativas', content: presupuesto.notasAdministrativas },
  ].filter(b => (secciones[b.key as keyof typeof secciones] !== false) && b.content);

  return (
    <View>
      {blocks.map(b => (
        <View key={b.key} style={cs.condicionBlock} wrap={false}>
          <Text style={cs.condicionTitle}>{b.title}</Text>
          <Text style={cs.condicionText}>{b.content}</Text>
        </View>
      ))}
    </View>
  );
}

export function PDFContratoAceptacion({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto, cliente } = data;
  return (
    <View style={cs.aceptacionCard} wrap={false}>
      <Text style={cs.aceptacionTitle}>Aceptación del presupuesto</Text>
      <Text style={cs.aceptacionIntro}>
        Enviar Orden de Compra mencionando número de presupuesto y completar los siguientes datos.
        Acepto el presente Presupuesto N° <Text style={{ fontWeight: 'bold', color: T.primary }}>{presupuesto.numero}</Text>.
      </Text>
      <View style={cs.aceptacionGrid}>
        <View style={cs.aceptacionField}>
          <Text style={cs.aceptacionFieldLabel}>Fecha</Text>
          <View style={cs.aceptacionLine} />
        </View>
        <View style={[cs.aceptacionField, { flex: 2 }]}>
          <Text style={cs.aceptacionFieldLabel}>Orden de compra N°</Text>
          <View style={cs.aceptacionLine} />
        </View>
      </View>
      <View style={cs.aceptacionGrid}>
        <View style={[cs.aceptacionField, { flex: 2 }]}>
          <Text style={cs.aceptacionFieldLabel}>Firma y aclaración (cliente)</Text>
          <View style={cs.aceptacionLine} />
        </View>
        <View style={cs.aceptacionField}>
          <Text style={cs.aceptacionFieldLabel}>CUIT cliente</Text>
          <View style={cs.aceptacionLine} />
        </View>
      </View>
      {(presupuesto.contratoFechaInicio || presupuesto.contratoFechaFin) && (
        <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: T.border }}>
          <Text style={[cs.aceptacionFieldLabel, { marginBottom: 2 }]}>Período de vigencia acordado</Text>
          <Text style={{ fontSize: 8, color: T.text }}>
            Desde {fmtDateISO(presupuesto.contratoFechaInicio)} hasta {fmtDateISO(presupuesto.contratoFechaFin)}
          </Text>
        </View>
      )}
      {cliente?.razonSocial && (
        <Text style={{ fontSize: 6.5, color: T.textFaint, marginTop: 6 }}>
          {cliente.razonSocial}
        </Text>
      )}
    </View>
  );
}
