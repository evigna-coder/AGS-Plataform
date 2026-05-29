import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EstadoImportacion, Disponibilidad } from '@ags/shared';
import { ESTADO_IMPORTACION_COLORS, ESTADO_IMPORTACION_LABELS, DISPONIBILIDAD_COLORS, DISPONIBILIDAD_LABELS } from '@ags/shared';
import type { EntregaRow as Row } from '../../utils/entregasResolver';
import { SEMAFORO_COLORS, SEMAFORO_LABELS } from '../../utils/entregasResolver';

interface Props {
  row: Row;
  onUpdateOtNumero: (otNumero: string | null) => Promise<void>;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  } catch {
    return '—';
  }
};

const formatMoney = (n: number, m: 'USD' | 'ARS' | 'EUR' | null): string => {
  const prefix = m === 'ARS' ? '$' : m === 'EUR' ? '€' : 'U$D';
  return `${prefix} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const EntregaRowComponent: React.FC<Props> = ({ row, onUpdateOtNumero }) => {
  const [otDraft, setOtDraft] = useState(row.otNumeroVinculada ?? '');
  const [saving, setSaving] = useState(false);

  const commitOt = async () => {
    const trimmed = otDraft.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next === (row.otNumeroVinculada ?? null)) return; // no change
    setSaving(true);
    try {
      await onUpdateOtNumero(next);
    } catch (err) {
      console.error('[EntregaRow] OT save failed', err);
      setOtDraft(row.otNumeroVinculada ?? ''); // revert on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-3 py-2 text-xs font-semibold text-teal-700 truncate max-w-[160px]">
        {row.clienteNombre}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[220px]" title={row.descripcion}>
        {row.descripcion}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 text-right font-mono">
        {row.cantidad}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 text-right font-mono whitespace-nowrap">
        {formatMoney(row.precioUnitario, row.moneda)}
      </td>
      <td className="px-3 py-2 text-xs">
        <Link to={`/presupuestos/${row.presupuestoId}`} className="text-teal-700 hover:underline font-mono">
          {row.presupuestoNumero}
        </Link>
      </td>
      <td className="px-3 py-2 text-xs">
        <input
          type="text"
          value={otDraft}
          onChange={(e) => setOtDraft(e.target.value)}
          onBlur={commitOt}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="OT#"
          disabled={saving}
          className="w-20 text-xs font-mono border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
          data-testid={`ot-input-${row.itemId}`}
        />
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 font-mono">
        {row.ocNumero ?? '—'}
      </td>
      <td className="px-3 py-2 text-xs">
        {row.importacionNumero ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-slate-600">{row.importacionNumero}</span>
            {row.importacionEstado && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[row.importacionEstado as EstadoImportacion] ?? 'bg-slate-100 text-slate-500'}`}>
                {ESTADO_IMPORTACION_LABELS[row.importacionEstado as EstadoImportacion] ?? row.importacionEstado}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {row.disponibilidad ? (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DISPONIBILIDAD_COLORS[row.disponibilidad as Disponibilidad] ?? 'bg-slate-100 text-slate-500'}`}>
            {DISPONIBILIDAD_LABELS[row.disponibilidad as Disponibilidad] ?? row.disponibilidad}
          </span>
        ) : (
          <span className="text-slate-300 text-[10px]">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap font-mono">
        {row.etaFecha ? formatDate(row.etaFecha) : (
          <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full text-[9px]">Sin ETA</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">
        {row.semaforo === 'sin_eta' ? (
          <span className="text-slate-300 text-[10px]">—</span>
        ) : (
          <span className={`font-mono font-medium ${SEMAFORO_COLORS[row.semaforo]}`}>
            {row.diasRestantes != null ? `${row.diasRestantes}d` : '—'}
          </span>
        )}
        <span className="ml-1.5 text-[9px] text-slate-400">{SEMAFORO_LABELS[row.semaforo]}</span>
      </td>
    </tr>
  );
};
