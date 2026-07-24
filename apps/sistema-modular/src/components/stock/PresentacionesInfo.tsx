import type { Presentacion } from '@ags/shared';

/**
 * Lectura de las presentaciones del artículo en el modal de detalle. Muestra cada N° de parte
 * con su factor y el stock base expresado en esa presentación (`stockBase / factor`).
 */
export const PresentacionesInfo: React.FC<{ presentaciones: Presentacion[]; stockBase: number }> = ({ presentaciones, stockBase }) => {
  const activas = presentaciones.filter(p => p.activo !== false && p.codigoParte);
  if (activas.length === 0) return null;
  return (
    <>
      <hr className="border-[#E5E5E5]" />
      <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">
        Presentaciones (N° de parte)
      </p>
      <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#F0F0F0] text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-1.5 px-2 text-left">N° de parte</th>
              <th className="py-1.5 px-2 text-left">Descripción</th>
              <th className="py-1.5 px-2 text-right w-16">Factor</th>
              <th className="py-1.5 px-2 text-right w-28">Equivale a</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activas.map((p, i) => (
              <tr key={`${p.codigoParte}:${i}`} className="hover:bg-slate-50">
                <td className="px-2 py-1.5 font-mono text-teal-700 font-semibold">{p.codigoParte}</td>
                <td className="px-2 py-1.5 text-slate-600 truncate">{p.descripcion || '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">×{p.factor}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                  {p.factor > 0 ? (stockBase / p.factor).toFixed(2) : '—'} u.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
