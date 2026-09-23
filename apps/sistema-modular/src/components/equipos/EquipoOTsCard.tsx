import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkOrder } from '@ags/shared';
import { OT_ESTADO_COLORS, OT_ESTADO_LABELS } from '@ags/shared';
import { ordenesTrabajoService } from '../../services/otService';
import { Card } from '../ui/Card';

/**
 * Órdenes de trabajo del equipo (2026-09-22). La tarjeta era un placeholder
 * que contaba `sistema.otIds`, un campo que ninguna OT escribe: siempre decía
 * "No hay OTs vinculadas". Las OT guardan `sistemaId` desde el go-live, así
 * que se listan por ahí (las anteriores, sin equipo vinculado, no aparecen).
 */
const fecha = (v: unknown): string => {
  const iso = typeof v === 'string' ? v : (v as { toDate?: () => Date } | null)?.toDate?.()?.toISOString?.();
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

export function EquipoOTsCard({ sistemaId }: { sistemaId: string }) {
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    ordenesTrabajoService.getAll({ sistemaId })
      .then(list => {
        if (!vivo) return;
        // Solo hijas .NN (el padre es un agrupador); las más nuevas primero.
        setOts(list.filter(o => o.otNumber.includes('.')).sort((a, b) => b.otNumber.localeCompare(a.otNumber)));
      })
      .catch(err => console.error('[EquipoOTsCard] OTs del equipo:', err))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [sistemaId]);

  const visibles = verTodas ? ots : ots.slice(0, 8);

  return (
    <Card compact>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Ordenes de Trabajo</p>
        {ots.length > 0 && <span className="text-[10px] font-mono text-slate-400">{ots.length}</span>}
      </div>
      {loading ? (
        <p className="text-xs text-slate-400">Cargando…</p>
      ) : ots.length === 0 ? (
        <p className="text-xs text-slate-400">No hay OTs vinculadas a este equipo</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {visibles.map(o => (
              <li key={o.otNumber} className="py-1.5 flex items-center gap-2 text-xs">
                <Link to={`/ordenes-trabajo/${o.otNumber}`} className="font-mono text-teal-700 hover:underline shrink-0">{o.otNumber}</Link>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{fecha(o.fechaServicioAprox ?? o.createdAt)}</span>
                <span className="flex-1 min-w-0 truncate text-slate-600" title={o.tipoServicio ?? ''}>{o.tipoServicio || '—'}</span>
                {o.estadoAdmin && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${OT_ESTADO_COLORS[o.estadoAdmin] ?? 'bg-slate-100 text-slate-600'}`}>
                    {OT_ESTADO_LABELS[o.estadoAdmin] ?? o.estadoAdmin}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {ots.length > 8 && (
            <button type="button" onClick={() => setVerTodas(v => !v)} className="mt-1.5 text-[11px] text-teal-700 hover:underline">
              {verTodas ? 'Ver menos' : `Ver las ${ots.length}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
