import type { CategoriaPresupuesto } from '@ags/shared';

/** Preview de impuestos de una categoría sobre un subtotal (usado por la carga completa de items). */
export function PresupuestoTaxPreview({ categoria, subtotal, sym }: {
  categoria: CategoriaPresupuesto;
  subtotal: number;
  sym: string;
}) {
  let iva = 0, ganancias = 0, iibb = 0;
  if (categoria.incluyeIva && categoria.porcentajeIva) {
    iva = categoria.ivaReduccion && categoria.porcentajeIvaReduccion
      ? subtotal * (categoria.porcentajeIvaReduccion / 100)
      : subtotal * (categoria.porcentajeIva / 100);
  }
  if (categoria.incluyeGanancias && categoria.porcentajeGanancias) ganancias = (subtotal + iva) * (categoria.porcentajeGanancias / 100);
  if (categoria.incluyeIIBB && categoria.porcentajeIIBB) iibb = (subtotal + iva) * (categoria.porcentajeIIBB / 100);
  const total = subtotal + iva + ganancias + iibb;
  const fmt = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  return (
    <div className="mt-2 bg-teal-50 p-3 rounded-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">Calculo con "{categoria.nombre}":</p>
      <div className="space-y-0.5 text-slate-600">
        <p>Subtotal: {fmt(subtotal)}</p>
        {iva > 0 && <p>IVA ({categoria.ivaReduccion && categoria.porcentajeIvaReduccion ? categoria.porcentajeIvaReduccion : categoria.porcentajeIva}%): {fmt(iva)}</p>}
        {ganancias > 0 && <p>Ganancias ({categoria.porcentajeGanancias}%): {fmt(ganancias)}</p>}
        {iibb > 0 && <p>IIBB ({categoria.porcentajeIIBB}%): {fmt(iibb)}</p>}
        <p className="font-semibold text-teal-700 mt-1">Total: {fmt(total)}</p>
      </div>
    </div>
  );
}
