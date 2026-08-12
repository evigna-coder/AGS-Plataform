import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { calificacionesService, promedioPonderado } from '../../services/calificacionesService';
import type { CalificacionProveedor, EstadoCalificacion } from '@ags/shared';
import { ORIGEN_CALIFICACION_LABELS } from '@ags/shared';

const ESTADO_COLORS: Record<EstadoCalificacion, string> = {
  aprobado: 'bg-emerald-100 text-emerald-700',
  condicional: 'bg-amber-100 text-amber-700',
  no_aprobado: 'bg-red-100 text-red-700',
  sin_datos: 'bg-slate-100 text-slate-500',
};
const ESTADO_LABELS: Record<EstadoCalificacion, string> = {
  aprobado: 'Aprobado', condicional: 'Condicional', no_aprobado: 'No aprobado', sin_datos: 'Sin datos',
};

/**
 * Panel de calificación del proveedor (2026-08-12): promedio histórico
 * ponderado por antigüedad + últimas 5 calificaciones. Solo consultivo — el
 * dato queda a mano para la reevaluación anual ISO (planilla: fase posterior).
 */
export function ProveedorCalificacionPanel({ proveedorId }: { proveedorId: string }) {
  const [items, setItems] = useState<CalificacionProveedor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    calificacionesService.getAll({ proveedorId })
      .then(data => { if (alive) setItems(data); })
      .catch(err => console.error('[ProveedorCalificacionPanel]', err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [proveedorId]);

  const calificadas = items.filter(c => (c.estadoCiclo ?? 'calificada') === 'calificada' && typeof c.puntajeTotal === 'number');
  const resumen = promedioPonderado(items);
  const ultimas = calificadas.slice(0, 5);

  return (
    <Card compact title="Calificación">
      {loading ? (
        <p className="text-xs text-slate-400">Cargando...</p>
      ) : resumen.count === 0 ? (
        <p className="text-xs text-slate-400">Sin calificaciones registradas.</p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-bold text-slate-800">{resumen.promedio}</span>
            <div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLORS[resumen.estado]}`}>
                {ESTADO_LABELS[resumen.estado]}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">{resumen.count} calificación{resumen.count === 1 ? '' : 'es'} · ponderado por antigüedad</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {ultimas.map(c => (
              <div key={c.id} className="flex items-center justify-between py-1.5 gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-mono">{c.fechaRecepcion}</p>
                  <p className="text-xs text-slate-600 truncate" title={c.origenLabel ?? ''}>
                    {ORIGEN_CALIFICACION_LABELS[c.origen ?? 'manual']}{c.origenLabel ? ` · ${c.origenLabel}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${c.estado ? ESTADO_COLORS[c.estado] : 'bg-slate-100 text-slate-500'}`}>
                  {c.puntajeTotal}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
