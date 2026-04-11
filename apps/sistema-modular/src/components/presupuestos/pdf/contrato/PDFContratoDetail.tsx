import { View, Text } from '@react-pdf/renderer';
import { cs, COLS_SINGLE, COLS_MIXTA } from './pdfContratoStyles';
import { groupItems, totalsByCurrency, fmtNum, type SistemaGroup } from './pdfContratoHelpers';
import type { PresupuestoItem, ModuloSistema } from '@ags/shared';
import type { PresupuestoPDFData } from '../PresupuestoPDFEstandar';

function ItemRow({ item, isMixta }: { item: PresupuestoItem; isMixta: boolean }) {
  const COLS = isMixta ? COLS_MIXTA : COLS_SINGLE;
  const isSL = item.esSinCargo === true;
  const isBonif = item.esBonificacion === true;
  const rowStyle = [cs.itemRow, isSL && cs.itemRowSL, isBonif && cs.itemRowBonif].filter(Boolean);
  const cellStyle = isSL ? [cs.itemCell, cs.itemCellSL] : [cs.itemCell];

  return (
    <View wrap={false}>
      <View style={rowStyle as any}>
        <Text style={[...cellStyle, { width: COLS.num }] as any}>{item.subItem || '—'}</Text>
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
        {isMixta && (
          <Text style={[...cellStyle, cs.itemCellCenter, { width: COLS_MIXTA.mon }] as any}>
            {isSL ? '—' : (item.moneda || 'USD')}
          </Text>
        )}
        <Text style={[...cellStyle, cs.itemCellRight, { width: COLS.precio }] as any}>
          {isSL ? '—' : fmtNum(item.precioUnitario)}
        </Text>
        <Text
          style={[
            ...cellStyle,
            cs.itemCellRight,
            { width: COLS.subtotal, fontWeight: 600 },
          ] as any}
        >
          {isSL ? '—' : fmtNum(item.subtotal)}
        </Text>
      </View>
      {item.itemNotasAdicionales && (
        <View style={cs.itemNoteRow}>
          <Text style={cs.itemNoteText}>→ {item.itemNotasAdicionales}</Text>
        </View>
      )}
    </View>
  );
}

function SistemaCard({ group, isMixta, modulos }: { group: SistemaGroup; isMixta: boolean; modulos?: ModuloSistema[] }) {
  const COLS = isMixta ? COLS_MIXTA : COLS_SINGLE;
  const subtotals = totalsByCurrency(group.items);

  // NOTE: do NOT wrap={false} on the outer card — con 21 sistemas y módulos,
  // el contenido no entra en una sola página y react-pdf estaba saltando las
  // cards enteras. Permitimos que se dividan entre páginas, pero mantenemos
  // wrap={false} en el header + módulos + tableHead para que al menos el
  // encabezado del sistema no quede huérfano al pie de página.
  return (
    <View style={cs.sistemaCard}>
      <View wrap={false}>
        <View style={cs.sistemaCardHeader}>
          <Text style={cs.sistemaCardNum}>{group.grupo}.</Text>
          <Text style={cs.sistemaCardName}>{group.sistemaNombre}</Text>
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
          {isMixta && (
            <Text style={[cs.itemTableHeadCell, cs.itemCellCenter, { width: COLS_MIXTA.mon }]}>Mon.</Text>
          )}
          <Text style={[cs.itemTableHeadCell, cs.itemCellRight, { width: COLS.precio }]}>Precio</Text>
          <Text style={[cs.itemTableHeadCell, cs.itemCellRight, { width: COLS.subtotal }]}>Subtotal</Text>
        </View>
      </View>

      {group.items.map(item => (
        <ItemRow key={item.id} item={item} isMixta={isMixta} />
      ))}

      {Object.keys(subtotals).length > 0 && (
        <View style={cs.sistemaSubtotal} wrap={false}>
          {Object.entries(subtotals).map(([cur, tot]) => (
            <View key={cur} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={cs.sistemaSubtotalLabel}>Subtotal {cur}</Text>
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
  const grandTotals = totalsByCurrency(data.presupuesto.items);

  return (
    <View>
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
            />
          ))}
        </View>
      ))}

      <View style={cs.grandTotalsWrap} wrap={false}>
        <Text style={[cs.sectorLabel, { marginBottom: 6 }]}>Total anual del contrato</Text>
        <View style={cs.grandTotalsRow}>
          {Object.keys(grandTotals).length === 0 ? (
            <Text style={cs.grandTotalValue}>—</Text>
          ) : (
            Object.entries(grandTotals).map(([cur, tot]) => (
              <View key={cur} style={cs.grandTotalBox}>
                <Text style={cs.grandTotalLabel}>Total {cur}</Text>
                <Text style={cs.grandTotalValue}>{cur} {fmtNum(tot)}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}
