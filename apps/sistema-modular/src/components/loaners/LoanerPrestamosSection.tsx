import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { PrestamoLoaner } from '@ags/shared';

interface Props {
  prestamos: PrestamoLoaner[];
}

export function LoanerPrestamosSection({ prestamos }: Props) {
  const formatDate = (iso?: string | null) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };

  if (prestamos.length === 0) {
    return (
      <Card title="Historial de prestamos">
        <p className="text-sm text-slate-400">Sin prestamos registrados</p>
      </Card>
    );
  }

  const sorted = [...prestamos].sort((a, b) => new Date(b.fechaSalida).getTime() - new Date(a.fechaSalida).getTime());

  return (
    <Card title="Historial de prestamos">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-slate-400 tracking-wider">Cliente</th>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-slate-400 tracking-wider">Salida</th>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-slate-400 tracking-wider">Retorno</th>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-slate-400 tracking-wider">Ficha</th>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-slate-400 tracking-wider">Remito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-sm text-slate-700">
                  <Link to={`/clientes/${p.clienteId}`} className="text-indigo-600 hover:underline">{p.clienteNombre}</Link>
                  {p.establecimientoNombre && <span className="text-xs text-slate-400 block">{p.establecimientoNombre}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{formatDate(p.fechaSalida)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{formatDate(p.fechaRetornoReal)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    p.estado === 'activo' ? 'bg-blue-100 text-blue-800' :
                    p.estado === 'devuelto' ? 'bg-green-100 text-green-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {p.estado === 'activo' ? 'Activo' : p.estado === 'devuelto' ? 'Devuelto' : 'Cancelado'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.fichaId ? <Link to={`/fichas/${p.fichaId}`} className="text-indigo-600 hover:underline">{p.fichaNumero}</Link> : '-'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.remitoSalidaId ? <Link to={`/stock/remitos/${p.remitoSalidaId}`} className="text-indigo-600 hover:underline">{p.remitoSalidaNumero || 'Ver'}</Link> : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
