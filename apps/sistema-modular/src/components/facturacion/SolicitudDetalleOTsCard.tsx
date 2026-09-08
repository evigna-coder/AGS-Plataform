import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { DetalleOTFila } from '../../hooks/useSolicitudDetalleOTs';

const th = 'text-[10px] font-mono uppercase tracking-wide text-slate-400 text-left py-1.5 px-2';
const fmt = (iso: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '—';
};

/**
 * Detalle de las OTs del aviso, con las columnas del PDF de certificación
 * (2026-09-07): quien factura ve qué se hizo, dónde y cuándo sin abrir cada OT.
 */
export function SolicitudDetalleOTsCard({ filas, loading }: { filas: DetalleOTFila[]; loading: boolean }) {
  const { pathname } = useLocation();
  if (!loading && filas.length === 0) return null;
  return (
    <Card>
      <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-2">
        Detalle de servicios ({filas.length})
      </p>
      {loading ? (
        <p className="text-xs text-slate-400">Cargando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={th}>Establecimiento</th>
                <th className={th}>N° de OT</th>
                <th className={th}>Equipo</th>
                <th className={th}>ID equipo</th>
                <th className={th}>Servicio realizado</th>
                <th className={th}>Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map(f => (
                <tr key={f.otNumber}>
                  <td className="py-1.5 px-2 text-xs text-slate-700">{f.establecimiento || '—'}</td>
                  <td className="py-1.5 px-2 text-xs">
                    <Link to={`/ordenes-trabajo/${f.otNumber}`} state={{ from: pathname }} className="font-mono text-teal-600 hover:underline">{f.otNumber}</Link>
                  </td>
                  <td className="py-1.5 px-2 text-xs text-slate-700">{f.equipo || '—'}</td>
                  <td className="py-1.5 px-2 text-xs font-mono text-slate-700">{f.equipoId || '—'}</td>
                  <td className="py-1.5 px-2 text-xs text-slate-700">
                    {f.servicio || '—'}
                    {f.partes.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Partes: {f.partes.map(p => `${[p.codigo, p.descripcion].filter(Boolean).join(' – ')} × ${p.cantidad}`).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-xs text-slate-500 whitespace-nowrap">{fmt(f.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
