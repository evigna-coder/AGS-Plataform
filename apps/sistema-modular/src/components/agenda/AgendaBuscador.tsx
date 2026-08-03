import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgendaEntry } from '@ags/shared';
import { agendaService } from '../../services/agendaService';

interface AgendaBuscadorProps {
  /** Entradas del rango visible — resultado instantáneo mientras carga todo. */
  entries: AgendaEntry[];
  onJump: (entry: AgendaEntry) => void;
  onClose: () => void;
}

const formatFecha = (iso: string) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return iso; }
};

/**
 * Buscador con salto a celda (pedido 2026-08-03): número de OT, cliente o
 * código de equipo → la agenda navega a la fecha y selecciona la celda.
 * Se abre con Ctrl+B (o el botón del header); acepta pegar desde Excel.
 */
export const AgendaBuscador = ({ entries, onJump, onClose }: AgendaBuscadorProps) => {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Búsqueda sobre TODA la agenda (2026-08-03): la suscripción trae solo el
  // rango visible — se carga la colección completa al abrir; mientras tanto
  // se busca sobre lo visible para que el resultado sea instantáneo.
  const [todas, setTodas] = useState<AgendaEntry[] | null>(null);
  useEffect(() => {
    let cancel = false;
    agendaService.listAll()
      .then(list => { if (!cancel) setTodas(list); })
      .catch(err => console.error('Error cargando agenda completa para buscar:', err));
    return () => { cancel = true; };
  }, []);
  const universo = todas ?? entries;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    // Pegado desde Excel: puede venir con salto de línea/tab al final — se
    // busca solo la primera "celda".
    const q = query.split(/[\n\t]/)[0].trim().toLowerCase();
    if (q.length < 2) return [];
    return universo
      .filter(e =>
        e.otNumber?.toLowerCase().includes(q) ||
        e.clienteNombre?.toLowerCase().includes(q) ||
        e.equipoAgsId?.toLowerCase().includes(q) ||
        e.sistemaNombre?.toLowerCase().includes(q) ||
        e.equipoModelo?.toLowerCase().includes(q) ||
        e.titulo?.toLowerCase().includes(q))
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
      .slice(0, 12);
  }, [universo, query]);

  useEffect(() => { setHighlight(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); return; }
    if (e.key === 'Enter' && results[highlight]) { e.preventDefault(); onJump(results[highlight]); }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={onClose}>
      <div
        className="absolute top-16 left-1/2 -translate-x-1/2 w-[480px] max-w-[calc(100vw-32px)] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="OT, cliente o código de equipo…"
            className="flex-1 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none"
          />
          <span className="text-[9px] font-mono text-slate-300 border border-slate-200 rounded px-1 py-px shrink-0">Esc</span>
        </div>
        {query.trim().length >= 2 && (
          results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-400 italic">Sin resultados en la agenda.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    onClick={() => onJump(r)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 ${i === highlight ? 'bg-teal-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {r.otNumber
                          ? <span className="text-[11px] font-bold text-teal-600 shrink-0">OT {r.otNumber}</span>
                          : <span className="text-[11px] font-bold text-slate-700 truncate">{r.titulo || 'Tarea'}</span>}
                        {r.equipoAgsId && <span className="text-[11px] font-mono font-semibold text-slate-700 shrink-0">{r.equipoAgsId}</span>}
                        {(r.sistemaNombre || r.equipoModelo) && <span className="text-[11px] text-slate-400 truncate">{r.sistemaNombre || r.equipoModelo}</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{r.clienteNombre}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-medium text-slate-600">{formatFecha(r.fechaInicio)}</div>
                      <div className="text-[9px] text-slate-400">{r.ingenieroNombre}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
};
