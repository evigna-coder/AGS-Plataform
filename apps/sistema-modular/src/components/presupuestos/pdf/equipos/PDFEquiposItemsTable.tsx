import { View, Text } from '@react-pdf/renderer';
import type { PresupuestoItem, PresupuestoSubItem } from '@ags/shared';
import { COLORS } from '../pdfStyles';
import { fmt } from '../PresupuestoPDFEstandar';

/** Anchos fijos de columnas — Descripción toma el resto con flex:1 (modelo JAS170-C). */
const W = { item: 32, producto: 82, cantidad: 34, precio: 62, total: 70 };

const cellText = { fontSize: 8, color: COLORS.text } as const;

function SubItemRow({ sub, numero }: { sub: PresupuestoSubItem; numero: string }) {
  const total = sub.precioUnitario != null ? (sub.cantidad || 0) * sub.precioUnitario : null;
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight }} wrap={false}>
      <Text style={[cellText, { width: W.item, textAlign: 'center', color: COLORS.textMuted }]}>{numero}</Text>
      <Text style={[cellText, { width: W.producto, paddingRight: 4 }]}>{sub.codigo || ''}</Text>
      <Text style={[cellText, { width: W.cantidad, textAlign: 'center' }]}>{sub.cantidad || ''}</Text>
      <Text style={[cellText, { flex: 1, paddingRight: 6, color: COLORS.textMuted }]}>{sub.descripcion}</Text>
      <Text style={[cellText, { width: W.precio, textAlign: 'right' }]}>
        {sub.precioUnitario != null ? fmt(sub.precioUnitario) : ''}
      </Text>
      <Text style={[cellText, { width: W.total, textAlign: 'right' }]}>
        {total != null ? fmt(total) : ''}
      </Text>
    </View>
  );
}

function ItemPrincipalRow({ item, numero }: { item: PresupuestoItem; numero: number }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.rowAlt }} wrap={false}>
      <Text style={[cellText, { width: W.item, textAlign: 'center', fontWeight: 700 }]}>{numero}</Text>
      <Text style={[cellText, { width: W.producto, fontWeight: 700, paddingRight: 4 }]}>{item.codigoProducto || ''}</Text>
      <Text style={[cellText, { width: W.cantidad, textAlign: 'center' }]}>{fmt(item.cantidad).replace(',00', '')}</Text>
      <Text style={[cellText, { flex: 1, paddingRight: 6, fontWeight: item.codigoProducto ? 400 : 700 }]}>{item.descripcion}</Text>
      <Text style={[cellText, { width: W.precio, textAlign: 'right' }]}>
        {item.precioUnitario > 0 ? fmt(item.precioUnitario) : ''}
      </Text>
      <Text style={[cellText, { width: W.total, textAlign: 'right', fontWeight: 700 }]}>
        {item.subtotal > 0 ? fmt(item.subtotal) : ''}
      </Text>
    </View>
  );
}

/**
 * Tabla de items del presupuesto tipo 'ventas' (Equipos) — réplica del formato
 * JAS170-C: item principal, fila "Detalles:", sub-ítems N.1, N.2… (precio vacío
 * si no tienen) e items simples. Los totales NO van acá (2026-08-27): el
 * template usa la misma caja "TOTAL sin IVA" del estándar (PDFTotalesNeto) —
 * antes cerraba con una barra de total final propia y quedaba desalineado del
 * formato D+B que resalta el valor sin IVA.
 */
export function PDFEquiposItemsTable({ items }: {
  items: PresupuestoItem[];
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', backgroundColor: COLORS.cardBg, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1.5, borderBottomColor: COLORS.primary }}>
        <Text style={{ width: W.item, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' }}>Item</Text>
        <Text style={{ width: W.producto, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text }}>Producto</Text>
        <Text style={{ width: W.cantidad, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' }}>Cant.</Text>
        <Text style={{ flex: 1, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text }}>Descripción</Text>
        <Text style={{ width: W.precio, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, textAlign: 'right' }}>Precio unit.</Text>
        <Text style={{ width: W.total, fontSize: 7.5, fontWeight: 'bold', color: COLORS.text, textAlign: 'right' }}>Precio total</Text>
      </View>

      {items.map((item, i) => (
        <View key={item.id}>
          <ItemPrincipalRow item={item} numero={i + 1} />
          {(item.subItems?.length ?? 0) > 0 && (
            <>
              <View style={{ flexDirection: 'row', paddingVertical: 2.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight }}>
                <Text style={{ width: W.item }}></Text>
                <Text style={{ fontSize: 7.5, fontWeight: 700, color: COLORS.textMuted, fontStyle: 'italic' }}>Detalles:</Text>
              </View>
              {item.subItems!.map((sub, j) => (
                <SubItemRow key={sub.id} sub={sub} numero={`${i + 1}.${j + 1}`} />
              ))}
            </>
          )}
        </View>
      ))}

    </View>
  );
}
