import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { LoanerDerivacion } from '@ags/shared';

interface Props {
  derivaciones: LoanerDerivacion[];
}

/**
 * Historial de derivaciones a proveedor del loaner (2026-08-12) — espejo de
 * LoanerPrestamosSection. Solo se monta cuando hay al menos una derivación
 * (los loaners que nunca salieron a proveedor no muestran la sección vacía).
 */
export function LoanerDerivacionesSection({ derivaciones }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
  const formatDate = (iso?: string | null) => {
    if (!iso) return '-';
    try { return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };

  if (derivaciones.length === 0) return null;

  const sorted = [...derivaciones].sort((a, b) => (b.fechaEnvio || '').localeCompare(a.fechaEnvio || ''));

  return (
    <Card title="Historial de derivaciones a proveedor">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Proveedor</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Alcance</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Envío</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Retorno</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Remito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-sm text-slate-700">{d.proveedorNombre || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500" title={d.parteDescripcion ?? undefined}>
                  {d.alcance === 'parte' ? `Parte${d.parteDescripcion ? `: ${d.parteDescripcion}` : ''}` : 'Módulo completo'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(d.fechaEnvio)}</td>
                <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(d.fechaRetorno)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    d.fechaRetorno ? 'bg-green-100 text-green-800' : 'bg-fuchsia-100 text-fuchsia-800'
                  }`}>
                    {d.fechaRetorno ? 'Recibido' : 'En proveedor'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  <Link to={`/stock/remitos/${d.remitoId}`} state={fromState} className="text-teal-600 hover:underline">
                    {d.remitoNumero || 'Ver'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
