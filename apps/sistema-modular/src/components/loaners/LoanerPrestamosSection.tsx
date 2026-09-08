import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { ParteLoanerPrestada, PrestamoLoaner } from '@ags/shared';
import { esPrestamoDeParte } from '@ags/shared';
import { diasDesde, semaforoPrestamoCls } from '../../utils/loanerSemaforo';
import { LoanerPrestamoPartesCell } from './LoanerPrestamoPartesCell';

interface Props {
  prestamos: PrestamoLoaner[];
  /**
   * Partes prestadas (2026-09-04; dos pasos desde 2026-09-08): cada parte
   * "vuelve a la base" y después "se reinstala". Las acciones viven en la
   * fila del historial: puede haber varias partes afuera a la vez.
   */
  onVueltaBase?: (prestamo: PrestamoLoaner, parteId: string, parte: ParteLoanerPrestada) => void;
  onReinstalar?: (prestamo: PrestamoLoaner, parteId: string, parte: ParteLoanerPrestada) => void;
}

const th = 'px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 tracking-wider';

export function LoanerPrestamosSection({ prestamos, onVueltaBase, onReinstalar }: Props) {
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
              <th className={th}>Destino</th>
              <th className={th}>Qué</th>
              <th className={th}>OT</th>
              <th className={th}>Salida</th>
              <th className={th}>Retorno</th>
              <th className={th}>Estado</th>
              <th className={th}>Ficha</th>
              <th className={th}>Remito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-sm text-slate-700">
                  {p.destino === 'ingeniero' ? (
                    // Parte en poder de un IST (2026-09-08): está en su inventario.
                    <>
                      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-sky-100 text-sky-800 mr-1">Ingeniero</span>
                      {p.ingenieroNombre}
                      {p.asignacionId && (
                        <Link to={`/stock/asignaciones/${p.asignacionId}`} state={fromState} className="block text-xs text-teal-600 hover:underline">
                          Asignación {p.asignacionNumero || 'ver'}
                        </Link>
                      )}
                    </>
                  ) : (
                    <>
                      <Link to={`/clientes/${p.clienteId}`} state={fromState} className="text-teal-600 hover:underline">{p.clienteNombre}</Link>
                      {p.establecimientoNombre && <span className="text-xs text-slate-400 block">{p.establecimientoNombre}</span>}
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {esPrestamoDeParte(p)
                    ? <LoanerPrestamoPartesCell prestamo={p} onVueltaBase={onVueltaBase} onReinstalar={onReinstalar} />
                    : <span className="text-slate-400">Módulo</span>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.otNumber
                    ? <Link to={`/ordenes-trabajo/${p.otNumber}`} state={fromState} className="font-mono text-teal-600 hover:underline">{p.otNumber}</Link>
                    : p.motivo ? <span className="text-slate-400" title={p.motivo}>—</span> : '-'}
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
                  {/* Préstamo activo: días afuera con semáforo (2026-08-27). */}
                  {p.estado === 'activo' && (() => {
                    const dias = diasDesde(p.fechaSalida);
                    return dias != null && (
                      <span className={`ml-1.5 text-[10px] font-bold ${semaforoPrestamoCls(dias)}`} title={`${dias} día(s) desde la salida`}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
