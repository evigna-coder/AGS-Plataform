import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { PrestamoLoaner } from '@ags/shared';
import { esPrestamoDeParte } from '@ags/shared';
import { diasDesde, semaforoPrestamoCls } from '../../utils/loanerSemaforo';

interface Props {
  prestamos: PrestamoLoaner[];
  /**
   * Retorno de una PARTE prestada (2026-09-04): la acción vive en la fila del
   * historial, no en la cabecera — puede haber varias partes afuera a la vez
   * y el módulo sigue en base.
   */
  onRetornoParte?: (prestamo: PrestamoLoaner) => void;
}

export function LoanerPrestamosSection({ prestamos, onRetornoParte }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
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
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Cliente</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Qué</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Salida</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Retorno</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Ficha</th>
              <th className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider">Remito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-sm text-slate-700">
                  <Link to={`/clientes/${p.clienteId}`} state={fromState} className="text-teal-600 hover:underline">{p.clienteNombre}</Link>
                  {p.establecimientoNombre && <span className="text-xs text-slate-400 block">{p.establecimientoNombre}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {esPrestamoDeParte(p) ? (
                    <>
                      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-violet-100 text-violet-800 mr-1">Parte</span>
                      {p.parte?.descripcion}
                      {p.parte?.serie && <span className="text-slate-400"> · S/N {p.parte.serie}</span>}
                    </>
                  ) : <span className="text-slate-400">Módulo</span>}
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
                  {/* Préstamo activo: días en cliente con semáforo (2026-08-27). */}
                  {p.estado === 'activo' && (() => {
                    const dias = diasDesde(p.fechaSalida);
                    return dias != null && (
                      <span className={`ml-1.5 text-[10px] font-bold ${semaforoPrestamoCls(dias)}`} title={`${dias} día(s) en cliente`}>
                        {dias}d
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.fichaId ? <Link to={`/fichas/${p.fichaId}`} state={fromState} className="text-teal-600 hover:underline">{p.fichaNumero}</Link> : '-'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.remitoSalidaId ? <Link to={`/stock/remitos/${p.remitoSalidaId}`} state={fromState} className="text-teal-600 hover:underline">{p.remitoSalidaNumero || 'Ver'}</Link> : '-'}
                  {onRetornoParte && p.estado === 'activo' && esPrestamoDeParte(p) && (
                    <button
                      type="button"
                      onClick={() => onRetornoParte(p)}
                      className="ml-2 text-[10px] font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2"
                    >
                      Registrar retorno
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
