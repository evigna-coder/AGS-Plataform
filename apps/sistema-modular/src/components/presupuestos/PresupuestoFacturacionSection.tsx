import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { presupuestosService } from '../../services/presupuestosService';

interface Props {
  presupuestoId: string;
  otsListasParaFacturar: string[];
  total: number;
  onAvisoCreated: () => void;
}

/**
 * Sección del EditPresupuestoModal que muestra las OTs listas para facturar
 * y permite al admin generar una solicitudFacturacion agrupando las OTs elegidas.
 *
 * Visible solo cuando otsListasParaFacturar.length > 0.
 * Estilo Editorial Teal coherente con el resto del sistema.
 */
export const PresupuestoFacturacionSection: React.FC<Props> = ({
  presupuestoId,
  otsListasParaFacturar,
  total,
  onAvisoCreated,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(otsListasParaFacturar));
  const [monto, setMonto] = useState<string>(total > 0 ? String(total) : '');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleOT = (otNumber: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(otNumber)) {
        next.delete(otNumber);
      } else {
        next.add(otNumber);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelected(new Set(otsListasParaFacturar));
  };

  const handleDeselectAll = () => {
    setSelected(new Set());
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      setError('Seleccioná al menos una OT para generar el aviso.');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const montoNum = monto.trim() ? parseFloat(monto.replace(/,/g, '.')) : undefined;
      const result = await presupuestosService.generarAvisoFacturacion(
        presupuestoId,
        Array.from(selected),
        {
          monto: montoNum,
          observaciones: observaciones.trim() || undefined,
        },
      );
      setSuccess(`Aviso generado correctamente (solicitud ${result.solicitudId.slice(0, 8)}…)`);
      setSelected(new Set());
      setObservaciones('');
      onAvisoCreated();
    } catch (err: any) {
      setError(err?.message || 'Error al generar el aviso de facturación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* Tabla de OTs */}
      <div className="border border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === otsListasParaFacturar.length && otsListasParaFacturar.length > 0}
                  onChange={selected.size === otsListasParaFacturar.length ? handleDeselectAll : handleSelectAll}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                OT
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {otsListasParaFacturar.map(otNumber => (
              <tr
                key={otNumber}
                className={`transition-colors ${selected.has(otNumber) ? 'bg-teal-50' : 'bg-white hover:bg-slate-50'}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(otNumber)}
                    onChange={() => toggleOT(otNumber)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-slate-800">{otNumber}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800">
                    Lista para facturar
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Monto y observaciones */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Monto a facturar
          </label>
          <input
            type="number"
            step="0.01"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            placeholder="Monto (default: total del ppto)"
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Observaciones
          </label>
          <input
            type="text"
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Notas para el aviso (opcional)"
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{success}</p>
      )}

      {/* Acción */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {selected.size} de {otsListasParaFacturar.length} OT{otsListasParaFacturar.length !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={loading || selected.size === 0}
        >
          {loading ? 'Generando...' : 'Generar aviso de facturación'}
        </Button>
      </div>
    </div>
  );
};
