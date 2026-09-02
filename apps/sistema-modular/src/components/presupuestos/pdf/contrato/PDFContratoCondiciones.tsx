import { View, Text } from '@react-pdf/renderer';
import { cs, T } from './pdfContratoStyles';
import { fmtDateISO, fmtNum, planCuotas } from './pdfContratoHelpers';
import { PDFRichText } from '../PDFRichText';
import type { PresupuestoPDFData } from '../PresupuestoPDFEstandar';

export function PDFContratoCuotas({ data }: { data: PresupuestoPDFData }) {
  // Las cuotas IGUALES se resumen en la PORTADA ("12 pagos de $X"); este bloque
  // del anexo queda solo para planes DESPAREJOS que necesitan la tabla
  // (UAT contrato 2026-08-04 — también elimina la hoja casi vacía del cierre).
  const { desparejas } = planCuotas(data.presupuesto);
  if (desparejas.length === 0) return null;

  return (
    <View style={cs.cuotasWrap} wrap={false}>
      <Text style={cs.cuotasTitle}>Plan de cuotas</Text>
      <View style={cs.cuotasTablesRow}>
        {desparejas.map(([cur, list]) => (
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
  // notasTecnicas NO va aca (2026-09-02): se movio a la HOJA 1 — ver
  // PDFContratoNotasTecnicas, que la renderiza debajo de la portada.
  const blocks = [
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
          {/* PDFRichText: el contenido viene del RichTextEditor (HTML) — un <Text>
              plano imprimía los tags literales (UAT 2026-07-30). */}
          <PDFRichText html={b.content} fallbackStyle={cs.condicionText} />
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

/**
 * Notas tecnicas del presupuesto, en la HOJA 1 (pedido 2026-09-02). Vivian con
 * el resto de las condiciones en la ultima hoja; son lo que el cliente tiene
 * que leer junto al alcance y el precio, no al final.
 *
 * Va como hermano de la portada dentro de la misma Page: si el texto es largo,
 * react-pdf lo desborda a la hoja siguiente en vez de recortarlo.
 */
export function PDFContratoNotasTecnicas({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto } = data;
  const visible = (presupuesto.seccionesVisibles || {}).notasTecnicas !== false;
  if (!visible || !presupuesto.notasTecnicas) return null;
  return (
    <View style={[cs.condicionBlock, { marginTop: 10 }]}>
      <Text style={cs.condicionTitle}>Notas sobre este presupuesto</Text>
      <PDFRichText html={presupuesto.notasTecnicas} fallbackStyle={cs.condicionText} />
    </View>
  );
}
