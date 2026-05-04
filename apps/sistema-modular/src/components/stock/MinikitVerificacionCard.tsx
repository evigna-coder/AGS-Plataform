import { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import type { MinikitRequeridoItem, MinikitVerificacion, UnidadStock, EstadoMinikit } from '@ags/shared';

const formatRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'hace 1 día';
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'hace 1 mes';
  return `hace ${months} meses`;
};

interface Props {
  estado: EstadoMinikit;
  requeridos: MinikitRequeridoItem[];
  unidades: UnidadStock[];
  ultimaVerificacion: MinikitVerificacion | null;
  /** Si es admin/admin_soporte muestra UI editable cuando estado=en_revision. */
  canVerify: boolean;
  saving: boolean;
  onCerrarVerificacion: (observaciones: string | null) => Promise<void>;
  /** Abre el modal de reposición preseleccionando el artículo faltante. */
  onReponer: (req: MinikitRequeridoItem, deficit: number) => void;
}

export const MinikitVerificacionCard = ({
  estado, requeridos, unidades, ultimaVerificacion, canVerify, saving, onCerrarVerificacion, onReponer,
}: Props) => {
  const [presentes, setPresentes] = useState<Record<string, boolean>>({});
  const [observaciones, setObservaciones] = useState('');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const u of unidades) {
      out[u.articuloId] = (out[u.articuloId] ?? 0) + 1;
    }
    return out;
  }, [unidades]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requeridos;
    return requeridos.filter(r =>
      r.articuloCodigo.toLowerCase().includes(q) ||
      r.articuloDescripcion.toLowerCase().includes(q) ||
      (r.sector ?? '').toLowerCase().includes(q)
    );
  }, [requeridos, search]);

  const allFilteredChecked = filtered.length > 0 && filtered.every(r => presentes[r.articuloId] === true);
  const handleToggleAllFiltered = () => {
    const target = !allFilteredChecked;
    setPresentes(prev => {
      const next = { ...prev };
      for (const r of filtered) next[r.articuloId] = target;
      return next;
    });
  };

  if (estado === 'en_revision') {
    if (!canVerify) {
      return (
        <Card compact title="Control físico pendiente">
          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded">
            Este minikit está esperando control físico de admin_soporte antes de volver a base.
          </p>
        </Card>
      );
    }

    return (
      <Card
        compact
        title="Control físico"
        actions={
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            En revisión
          </span>
        }
      >
        <p className="text-xs text-slate-500 mb-3">
          Constatá físicamente que los artículos del minikit coinciden con lo que indica el sistema.
          Si falta algo, usá <span className="font-medium">+ Reponer</span> para asignar unidades nuevas. Los consumos del campo se registran como Movimiento de stock al cerrar la OT.
        </p>

        {requeridos.length === 0 ? (
          <p className="text-xs text-slate-400 py-2 text-center">
            El minikit no tiene artículos requeridos configurados.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2 mb-2">
              <div className="flex-1">
                <Input
                  inputSize="sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar artículo, código o sector..."
                />
              </div>
              <Button size="sm" variant="outline" onClick={handleToggleAllFiltered} disabled={filtered.length === 0}>
                {allFilteredChecked ? 'Desmarcar todas' : 'Marcar todas'}
                {search && filtered.length !== requeridos.length && (
                  <span className="ml-1 text-[10px] opacity-60">({filtered.length})</span>
                )}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Artículo</th>
                    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Presente</th>
                    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Mínimo</th>
                    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Sistema</th>
                    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="text-xs text-slate-400 py-3 text-center">Sin resultados.</td></tr>
                  ) : filtered.map(r => {
                    const actual = counts[r.articuloId] ?? 0;
                    const falta = actual < r.cantidadMinima;
                    return (
                      <tr key={r.articuloId} className="border-b border-slate-50 last:border-0">
                        <td className="text-xs py-2 pr-3">
                          <span className="font-mono text-teal-600 font-semibold">{r.articuloCodigo}</span>
                          <span className="text-slate-600 ml-1.5">{r.articuloDescripcion}</span>
                        </td>
                        <td className="py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!presentes[r.articuloId]}
                            onChange={e => setPresentes(prev => ({ ...prev, [r.articuloId]: e.target.checked }))}
                            className="w-4 h-4 accent-teal-600"
                          />
                        </td>
                        <td className="text-xs py-2 text-center text-slate-500">{r.cantidadMinima}</td>
                        <td className={`text-xs py-2 text-center font-medium ${falta ? 'text-red-600' : 'text-slate-700'}`}>{actual}</td>
                        <td className="text-xs py-2 text-center">
                          {falta ? (
                            <button
                              type="button"
                              onClick={() => onReponer(r, r.cantidadMinima - actual)}
                              className="text-teal-600 hover:underline font-medium text-[11px]"
                            >
                              + Reponer
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-3">
          <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Observaciones (opcional)</label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Detalle o discrepancias detectadas..."
            rows={2}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none"
          />
        </div>

        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            onClick={() => onCerrarVerificacion(observaciones.trim() || null)}
            disabled={saving}
          >
            {saving ? 'Cerrando...' : 'Cerrar verificación → en base'}
          </Button>
        </div>
      </Card>
    );
  }

  // estado != en_revision: read-only de la última verificación si existe
  if (!ultimaVerificacion) return null;

  return (
    <Card compact title="Última verificación">
      <div className="text-xs text-slate-600">
        <span className="font-medium text-slate-900">{ultimaVerificacion.byName}</span>
        {' · '}
        <span className="text-slate-500">{formatRelative(ultimaVerificacion.fecha)}</span>
        {' · '}
        <span className="text-slate-400">{new Date(ultimaVerificacion.fecha).toLocaleDateString('es-AR')}</span>
      </div>
      {ultimaVerificacion.observaciones && (
        <p className="text-xs text-slate-500 mt-1.5 italic">"{ultimaVerificacion.observaciones}"</p>
      )}
    </Card>
  );
};
