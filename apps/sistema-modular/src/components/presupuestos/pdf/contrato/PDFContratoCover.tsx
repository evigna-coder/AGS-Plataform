import { View, Text, Image } from '@react-pdf/renderer';
import { cs, T } from './pdfContratoStyles';
import { fmtDate, fmtDateISO, fmtNum, totalsByCurrency } from './pdfContratoHelpers';
import type { PresupuestoPDFData } from '../PresupuestoPDFEstandar';

export function PDFContratoCover({ data }: { data: PresupuestoPDFData }) {
  const { presupuesto, cliente, establecimiento, contacto } = data;
  const totals = totalsByCurrency(presupuesto.items);
  const isMixta = presupuesto.moneda === 'MIXTA';

  return (
    <View style={cs.coverWrap}>
      {/* Logo + ISO top bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
        <Image src={data.logoSrc} style={{ width: 120, height: 'auto' }} />
        <Image src={data.isoLogoSrc} style={{ width: 55, height: 'auto' }} />
      </View>

      {/* Title block */}
      <Text style={cs.coverEyebrow}>Documento no válido como factura</Text>
      <Text style={cs.coverTitle}>Presupuesto de Contrato</Text>
      <Text style={cs.coverSubtitle}>Servicio Prestacional de Soporte Técnico Analítico</Text>
      <Text style={cs.coverNumero}>N° {presupuesto.numero}</Text>

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
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={cs.vigenciaLabel}>Oferta válida por</Text>
            <Text style={{ fontSize: 11, color: T.text, fontWeight: 'bold', marginTop: 2 }}>
              {presupuesto.validezDias || 15} días
            </Text>
          </View>
        </View>
      )}

      {/* Cliente + AGS info grid */}
      <View style={cs.coverGrid}>
        <View style={cs.coverBlock}>
          <Text style={cs.coverBlockLabel}>Cliente</Text>
          <Text style={cs.coverBlockValueStrong}>{cliente?.razonSocial || '—'}</Text>
          {contacto?.nombre && <Text style={cs.coverBlockValue}>Attn: {contacto.nombre}</Text>}
          {establecimiento?.direccion && <Text style={cs.coverBlockValue}>{establecimiento.direccion}</Text>}
          {(establecimiento?.localidad || establecimiento?.provincia) && (
            <Text style={cs.coverBlockValue}>
              {[establecimiento.localidad, establecimiento.provincia].filter(Boolean).join(', ')}
            </Text>
          )}
          {contacto?.email && <Text style={[cs.coverBlockValue, { color: T.primary }]}>{contacto.email}</Text>}
        </View>
        <View style={cs.coverBlock}>
          <Text style={cs.coverBlockLabel}>Emitido por</Text>
          <Text style={cs.coverBlockValueStrong}>AGS Analítica S.A.</Text>
          <Text style={cs.coverBlockValue}>CUIT 30-70861861-2</Text>
          <Text style={cs.coverBlockValue}>Arenales 605, Piso 15</Text>
          <Text style={cs.coverBlockValue}>B1638BRG — Vicente López, Buenos Aires</Text>
          <Text style={[cs.coverBlockValue, { color: T.primary }]}>info@agsanalitica.com</Text>
        </View>
        <View style={cs.coverBlock}>
          <Text style={cs.coverBlockLabel}>Responsable</Text>
          <Text style={cs.coverBlockValueStrong}>{presupuesto.responsableNombre || '—'}</Text>
          <Text style={[cs.coverBlockLabel, { marginTop: 8 }]}>Fecha emisión</Text>
          <Text style={cs.coverBlockValue}>{fmtDate(presupuesto.createdAt)}</Text>
        </View>
      </View>

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
              {!isMixta && <Text style={cs.totalCardSub}>Sin IVA</Text>}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
