import { View, Text } from '@react-pdf/renderer';
import { cs, COLS_SINGLE, COLS_MIXTA, COLS_SIN_PRECIOS } from './pdfContratoStyles';
import { groupItems, totalsByCurrency, fmtNum, type SistemaGroup } from './pdfContratoHelpers';
import type { PresupuestoItem, ModuloSistema } from '@ags/shared';
import type { PresupuestoPDFData } from '../PresupuestoPDFEstandar';

function ItemRow({ item, isMixta, sinPrecios }: { item: PresupuestoItem; isMixta: boolean; sinPrecios: boolean }) {
  const COLS = sinPrecios ? COLS_SIN_PRECIOS : isMixta ? COLS_MIXTA : COLS_SINGLE;
  const isSL = item.esSinCargo === true;
  const isBonif = item.esBonificacion === true;
  const rowStyle = [cs.itemRow, isSL && cs.itemRowSL, isBonif && cs.itemRowBonif].filter(Boolean);
  const cellStyle = isSL ? [cs.itemCell, cs.itemCellSL] : [cs.itemCell];

  return (
    <View wrap={false}>
      <View style={rowStyle as any}>
        <Text style={[...cellStyle, { width: COLS.num }] as any}>
          {/* Grupo 0 (bonificación / sin sistema): sin numeral — la numeración visible arranca en 1 */}
          {item.subItem && !item.subItem.startsWith('0') ? item.subItem : '—'}
        </Text>
        <Text style={[...cellStyle, { width: COLS.codigo }] as any}>
          {item.codigoProducto || '—'}
          {item.servicioCode && (
            <Text style={cs.itemCellMono}>{'\n' + item.servicioCode}</Text>
          )}
        </Text>
        <Text style={[...cellStyle, { width: COLS.desc }] as any}>{item.descripcion}</Text>
        <Text style={[...cellStyle, cs.itemCellCenter, { width: COLS.cant }] as any}>
          {isSL ? 'S/L' : (item.cantidad || 0)}
        </Text>
        {/* Sin precios por línea (2026-08-04): el precio va solo en los totales */}
        {!sinPrecios && (
          <>
            {isMixta && (
              <Text style={[...cellStyle, cs.itemCellCenter, { width: COLS_MIXTA.mon }] as any}>
                {isSL ? '—' : (item.moneda || 'USD')}
              </Text>
            )}
            <Text style={[...cellStyle, cs.itemCellRight, { width: (COLS as typeof COLS_SINGLE).precio }] as any}>
              {isSL ? '—' : fmtNum(item.precioUnitario)}
            </Text>
            <Text
              style={[
                ...cellStyle,
                cs.itemCellRight,
                { width: (COLS as typeof COLS_SINGLE).subtotal, fontWeight: 600 },
              ] as any}
            >
              {isSL ? '—' : fmtNum(item.subtotal)}
            </Text>
          </>
        )}
      </View>
      {item.itemNotasAdicionales && (
        <View style={cs.itemNoteRow}>
          <Text style={cs.itemNoteText}>→ {item.itemNotasAdicionales}</Text>
        </View>
      )}
    </View>
  );
}

function SistemaCard({ group, isMixta, modulos, sinPrecios }: { group: SistemaGroup; isMixta: boolean; modulos?: ModuloSistema[]; sinPrecios: boolean }) {
  const COLS = sinPrecios ? COLS_SIN_PRECIOS : isMixta ? COLS_MIXTA : COLS_SINGLE;
  const subtotals = totalsByCurrency(group.items);

  // Un equipo NO puede quedar partido entre hojas (pedido 2026-07-31): si la
  // card estimada entra en una página, wrap={false} → pasa ENTERA a la hoja
  // siguiente. OJO: no se puede wrap={false} a ciegas — una card más alta que
  // la hoja hace que react-pdf la saltee entera (bug visto con 21 sistemas),
  // así que las que superan el umbral siguen partiendo entre filas (cada fila
  // ya es indivisible, y el header tiene su propio wrap={false}).
  const notasCount = group.items.filter(i => i.itemNotasAdicionales).length;
  const descLargas = group.items.filter(i => (i.descripcion || '').length > 70).length;
  const estHeight = 34 /* header + tableHead */
    + (modulos && modulos.length > 0 ? 16 + modulos.length * 11 : 0)
    + group.items.length * 13 + notasCount * 11 + descLargas * 9
    + 18 /* subtotal */;
  const cardEntera = estHeight < 460;

  return (
    <View style={cs.sistemaCard} wrap={!cardEntera}>
      <View wrap={false}>
        <View style={cs.sistemaCardHeader}>
          {group.grupo > 0 && <Text style={cs.sistemaCardNum}>{group.grupo}.</Text>}
          <Text style={cs.sistemaCardName}>
            {group.grupo === 0 && group.items.every(i => i.esBonificacion)
              ? 'Bonificación'
              : group.sistemaNombre}
          </Text>
          {group.moduloSeriePrincipal && (
            <Text style={cs.sistemaCardId}>S/N: {group.moduloSeriePrincipal}</Text>
          )}
          {group.sistemaCodigoInterno && (
            <Text style={[cs.sistemaCardId, { marginLeft: 8 }]}>ID: {group.sistemaCodigoInterno}</Text>
          )}
        </View>

        {/* Módulos del sistema (bloque informativo) */}
        {modulos && modulos.length > 0 && (
          <View style={cs.modulosInfo}>
            <Text style={cs.modulosInfoLabel}>Módulos del sistema</Text>
            <View style={[cs.modulosInfoRow, { marginBottom: 1 }]}>
              <Text style={[cs.modulosInfoCol, { width: '22%', fontWeight: 'bold' }]}>Módulo</Text>
              <Text style={[cs.modulosInfoCol, { width: '32%', fontWeight: 'bold' }]}>Descripción</Text>
              <Text style={[cs.modulosInfoCol, { width: '26%', fontWeight: 'bold' }]}>Serie</Text>
              <Text style={[cs.modulosInfoCol, { width: '20%', fontWeight: 'bold' }]}>Marca</Text>
            </View>
            {modulos.map(m => (
              <View key={m.id} style={cs.modulosInfoRow}>
                <Text style={[cs.modulosInfoCol, { width: '22%' }]}>{m.nombre || '—'}</Text>
                <Text style={[cs.modulosInfoCol, { width: '32%' }]}>{m.descripcion || '—'}</Text>
                <Text style={[cs.modulosInfoCol, { width: '26%' }]}>{m.serie || '—'}</Text>
                <Text style={[cs.modulosInfoCol, { width: '20%' }]}>{m.marca || '—'}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={cs.itemTableHead}>
          <Text style={[cs.itemTableHeadCell, { width: COLS.num }]}>#</Text>
          <Text style={[cs.itemTableHeadCell, { width: COLS.codigo }]}>Código</Text>
          <Text style={[cs.itemTableHeadCell, { width: COLS.desc }]}>Descripción</Text>
          <Text style={[cs.itemTableHeadCell, cs.itemCellCenter, { width: COLS.cant }]}>Cant.</Text>
          {!sinPrecios && (
            <>
              {isMixta && (
                <Text style={[cs.itemTableHeadCell, cs.itemCellCenter, { width: COLS_MIXTA.mon }]}>Mon.</Text>
              )}
              <Text style={[cs.itemTableHeadCell, cs.itemCellRight, { width: (COLS as typeof COLS_SINGLE).precio }]}>Precio</Text>
              <Text style={[cs.itemTableHeadCell, cs.itemCellRight, { width: (COLS as typeof COLS_SINGLE).subtotal }]}>Subtotal</Text>
            </>
          )}
        </View>
      </View>

      {group.items.map(item => (
        <ItemRow key={item.id} item={item} isMixta={isMixta} sinPrecios={sinPrecios} />
      ))}

      {Object.keys(subtotals).length > 0 && (
        <View style={cs.sistemaSubtotal} wrap={false}>
          {Object.entries(subtotals).map(([cur, tot]) => (
            <View key={cur} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={cs.sistemaSubtotalLabel}>{sinPrecios ? `Total anual equipo ${cur}` : `Subtotal ${cur}`}</Text>
              <Text style={cs.sistemaSubtotalValue}>{fmtNum(tot)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function PDFContratoDetail({ data }: { data: PresupuestoPDFData }) {
  const grouped = groupItems(data.presupuesto.items);
  const isMixta = data.presupuesto.moneda === 'MIXTA';
  // Sin precios por línea (2026-08-04): los servicios se listan sin Precio/Subtotal;
  // el número aparece solo en el total por equipo y en la portada.
  const sinPrecios = data.presupuesto.ocultarPreciosItems === true;

  return (
    <View>
      {/* Título de la hoja de detalle (UAT contrato 2026-08-04) */}
      <View style={{ marginBottom: 10 }}>
        <Text style={cs.sectorLabel}>Anexo técnico</Text>
        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>
          Detalle de equipos y servicios incluidos
        </Text>
      </View>
      {grouped.map(sectorGroup => (
        <View key={sectorGroup.sectorNombre || '__none__'}>
          {sectorGroup.sectorNombre && (
            <View style={cs.sectorHeader} wrap={false}>
              <View>
                <Text style={cs.sectorLabel}>Sector</Text>
                <Text style={cs.sectorName}>{sectorGroup.sectorNombre}</Text>
              </View>
            </View>
          )}
          {sectorGroup.sistemas.map(sistema => (
            <SistemaCard
              key={`${sectorGroup.sectorNombre}-${sistema.grupo}`}
              group={sistema}
              isMixta={isMixta}
              modulos={sistema.sistemaId ? data.modulosBySistema?.[sistema.sistemaId] : undefined}
              sinPrecios={sinPrecios}
            />
          ))}
        </View>
      ))}

      {/* El "Total anual del contrato" vive en la PORTADA (con IVA) — acá se
          eliminó porque re-informarlo al final generaba una hoja casi vacía
          (UAT contrato 2026-08-04). */}
    </View>
  );
}
