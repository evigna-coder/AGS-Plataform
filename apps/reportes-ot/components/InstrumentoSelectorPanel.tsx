import { useState, useEffect } from 'react';
import { FirebaseService } from '../services/firebaseService';
import type { InstrumentoPatronOption } from '../types/instrumentos';

/** Calcula estado del certificado (espejo simplificado de @ags/shared) */
function estadoCert(vencimiento: string | null | undefined): 'vigente' | 'por_vencer' | 'vencido' | 'sin_cert' {
  if (!vencimiento) return 'sin_cert';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(vencimiento); v.setHours(0, 0, 0, 0);
  if (v < hoy) return 'vencido';
  const diff = Math.ceil((v.getTime() - hoy.getTime()) / 86400000);
  return diff <= 30 ? 'por_vencer' : 'vigente';
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-700' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-700' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-700' },
  sin_cert: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

interface Props {
  firebase: FirebaseService;
  selected: InstrumentoPatronOption[];
  onApply: (instrumentos: InstrumentoPatronOption[]) => void;
  readOnly?: boolean;
}

export const InstrumentoSelectorPanel: React.FC<Props> = ({ firebase, selected, onApply, readOnly }) => {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<InstrumentoPatronOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selected.map(i => i.id)));

  useEffect(() => {
    setChecked(new Set(selected.map(i => i.id)));
  }, [selected]);

  const handleOpen = async () => {
    if (readOnly) return;
    setOpen(true);
    if (available.length > 0) return;
    setLoading(true);
    try {
      const data = await firebase.getActiveInstrumentos();
      setAvailable(data);
    } catch (err) {
      console.error('Error cargando instrumentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    const sel = available.filter(i => checked.has(i.id));
    onApply(sel);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        disabled={readOnly}
        className="flex items-center gap-2 text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {selected.length > 0
          ? `Editar instrumentos (${selected.length})`
          : 'Seleccionar instrumentos / patrones'
        }
      </button>
    );
  }

  return (
    <div className="border border-indigo-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-200">
        <div>
          <p className="text-sm font-semibold text-indigo-900">Instrumentos y patrones utilizados</p>
          <p className="text-xs text-indigo-600 mt-0.5">Seleccioná los instrumentos/patrones usados en este servicio</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-indigo-400 hover:text-indigo-600 p-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Lista */}
      <div className="px-4 py-3 max-h-72 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-4">Cargando instrumentos...</p>
        ) : available.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            No hay instrumentos/patrones activos registrados.
          </p>
        ) : (
          <div className="space-y-1.5">
            {available.map(inst => {
              const isChecked = checked.has(inst.id);
              const estado = estadoCert(inst.certificadoVencimiento);
              const badge = ESTADO_BADGE[estado];
              return (
                <label
                  key={inst.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isChecked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(inst.id)}
                    className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${isChecked ? 'text-indigo-900' : 'text-slate-800'}`}>
                      {inst.nombre}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${
                        inst.tipo === 'patron' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {inst.tipo === 'patron' ? 'Patrón' : 'Instrumento'}
                      </span>
                      {inst.marca && (
                        <span className="text-[10px] text-slate-500">{inst.marca} {inst.modelo}</span>
                      )}
                      {inst.serie && (
                        <span className="text-[10px] text-slate-400 font-mono">S/N: {inst.serie}</span>
                      )}
                      <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          {checked.size > 0
            ? `${checked.size} ${checked.size === 1 ? 'seleccionado' : 'seleccionados'}`
            : 'Ninguno seleccionado'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen(false)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Confirmar selección
          </button>
        </div>
      </div>
    </div>
  );
};
