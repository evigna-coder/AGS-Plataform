import { type FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ESTADO_AGENDA_LABELS, ESTADO_AGENDA_COLORS } from '@ags/shared';
import type { AgendaEntry, EstadoAgenda } from '@ags/shared';
import type { SelectedCell } from '../../utils/agendaDateUtils';
import { esTrabajoEnBench } from '../../utils/agendaCellColor';

const ESTADO_ORDER: EstadoAgenda[] = ['pendiente', 'tentativo', 'tentativo_interior', 'confirmado', 'confirmado_interior', 'en_progreso', 'en_progreso_interior', 'completado', 'completado_interior', 'cancelado'];

interface AgendaInfoBarProps {
  selectedCell: SelectedCell | null;
  clipboardLabel?: string | null;
  onDeleteEntry?: (entryId: string) => void;
  onExtendEntry?: (entryId: string) => void;
  onShrinkEntry?: (entryId: string) => void;
  onSelectEntry?: (entry: AgendaEntry) => void;
  onChangeEstado?: (entryId: string, estado: EstadoAgenda) => void;
  /** Pago adelantado (2026-08-04): flag ortogonal — aplica a toda la celda. */
  onTogglePagoAdelantado?: (entryId: string, valor: boolean) => void;
  /** Requiere inducción (2026-08-05): flag ortogonal — SOLO la entrada marcada. */
  onToggleRequiereInduccion?: (entryId: string, valor: boolean) => void;
  onToggleVentaConcretada?: (entryId: string, valor: boolean) => void;
  onTogglePerIncident?: (entryId: string, valor: boolean) => void;
  /** Espera importación (2026-08-20): flag ortogonal — celda ENTERA azul fuerte. */
  onToggleEsperaImportacion?: (entryId: string, valor: boolean) => void;
  /** Detalle de la falla en trabajos de bench (2026-08-12) — escribe `notas`. */
  onChangeNotas?: (entryId: string, notas: string | null) => void;
}

/**
 * Detalle técnico de un trabajo en bench: qué problema/falla tiene el módulo
 * que está en el taller. Solo aparece en entradas de bench — en una visita a
 * planta el dato relevante es el cliente, no la falla. Editable acá porque las
 * entradas que nacen de arrastrar una OT no traen notas.
 */
function BenchDetalle({ entry, onChange }: {
  entry: AgendaEntry;
  onChange: (entryId: string, notas: string | null) => void;
}) {
  const [valor, setValor] = useState(entry.notas ?? '');
  // Al cambiar de entrada (o si la edita otra PC) recargar el texto.
  useEffect(() => { setValor(entry.notas ?? ''); }, [entry.id, entry.notas]);

  const guardar = () => {
    const limpio = valor.trim();
    if (limpio === (entry.notas ?? '')) return;
    onChange(entry.id, limpio || null);
  };

  return (
    <label className="flex items-center gap-1 min-w-0 flex-1 max-w-[420px]"
      title="Problema / falla inicial del módulo en bench">
      <span className="text-[10px] font-mono uppercase tracking-wide text-[#7a6420] shrink-0">Falla</span>
      <input
        value={valor}
        onChange={e => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={e => {
          if (e.key === 'Enter') { guardar(); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') setValor(entry.notas ?? '');
        }}
        placeholder="Problema / falla inicial…"
        className="min-w-0 flex-1 text-[11px] bg-[#e0c878]/25 border border-[#e0c878] rounded px-1.5 py-0.5
                   text-[#4a3c10] placeholder:text-[#a08c50] focus:outline-none focus:ring-1 focus:ring-[#c9ab53]"
      />
    </label>
  );
}

function EntryRange({ entry }: { entry: AgendaEntry }) {
  if (entry.fechaInicio === entry.fechaFin) {
    return <span className="text-[10px] text-slate-400">Q{entry.quarterStart}-Q{entry.quarterEnd}</span>;
  }
  return <span className="text-[10px] text-slate-400">{entry.fechaInicio} Q{entry.quarterStart} → {entry.fechaFin} Q{entry.quarterEnd}</span>;
}

export const AgendaInfoBar: FC<AgendaInfoBarProps> = ({
  selectedCell,
  clipboardLabel,
  onDeleteEntry,
  onExtendEntry,
  onShrinkEntry,
  onSelectEntry,
  onChangeEstado,
  onTogglePagoAdelantado,
  onToggleRequiereInduccion,
  onToggleVentaConcretada,
  onTogglePerIncident,
  onToggleEsperaImportacion,
  onChangeNotas,
}) => {
  const entry = selectedCell?.entry ?? null;
  const allEntries = selectedCell?.allEntries ?? [];
  const hasMultiple = allEntries.length > 1;

  return (
    <div className={`shrink-0 border-b px-4 flex items-center gap-3 h-7 ${
      entry ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
    }`}>
      {selectedCell ? (
        entry ? (
          <>
            {hasMultiple && (
              <div className="flex items-center gap-0.5 border-r border-teal-200 pr-2 mr-1">
                {allEntries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEntry?.(e)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      e.id === entry.id
                        ? 'bg-teal-200 text-teal-800'
                        : 'text-teal-400 hover:text-teal-600 hover:bg-teal-100'
                    }`}
                  >
                    {e.otNumber || e.titulo || '—'}
                  </button>
                ))}
              </div>
            )}

            {entry.otNumber ? (
              <Link
                to={`/ordenes-trabajo/${entry.otNumber}`}
                className="text-[11px] font-semibold text-teal-700 hover:underline shrink-0"
                title="Ver OT"
              >
                OT-{entry.otNumber}
              </Link>
            ) : (
              <span className="text-[11px] font-semibold text-slate-700 shrink-0">
                {entry.titulo || 'Tarea'}
              </span>
            )}
            {entry.clienteNombre && <span className="text-[11px] text-slate-600 truncate">{entry.clienteNombre}</span>}
            {entry.tipoServicio && <span className="text-[11px] text-slate-500 truncate">{entry.tipoServicio}</span>}
            {entry.sistemaNombre && <span className="text-[11px] text-slate-400 truncate">{entry.sistemaNombre}</span>}
            {entry.equipoAgsId && <span className="text-[11px] font-mono text-slate-500 shrink-0">{entry.equipoAgsId}</span>}

            {/* Estado dropdown */}
            <select
              value={entry.estadoAgenda}
              onChange={e => onChangeEstado?.(entry.id, e.target.value as EstadoAgenda)}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border-0 cursor-pointer ${ESTADO_AGENDA_COLORS[entry.estadoAgenda]}`}
            >
              {ESTADO_ORDER.map(est => (
                <option key={est} value={est}>{ESTADO_AGENDA_LABELS[est]}</option>
              ))}
            </select>

            {/* Pago adelantado — diagonal azul marino en la celda */}
            {onTogglePagoAdelantado && (
              <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500 cursor-pointer shrink-0 select-none"
                title="El cliente tiene pago adelantado — la celda se marca con diagonal azul marino">
                <input
                  type="checkbox"
                  checked={!!entry.pagoAdelantado}
                  onChange={e => onTogglePagoAdelantado(entry.id, e.target.checked)}
                  className="w-3 h-3 accent-[#1e3a8a]"
                />
                <span className={entry.pagoAdelantado ? 'text-[#1e3a8a] font-semibold' : ''}>Pago adelantado</span>
              </label>
            )}

            {/* Requiere inducción — mitad inferior negra, SOLO esta entrada (2026-08-05) */}
            {onToggleRequiereInduccion && (
              <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500 cursor-pointer shrink-0 select-none"
                title="La planta exige inducción/examen de ingreso — la celda se marca con la mitad negra (solo esta entrada)">
                <input
                  type="checkbox"
                  checked={!!entry.requiereInduccion}
                  onChange={e => onToggleRequiereInduccion(entry.id, e.target.checked)}
                  className="w-3 h-3 accent-black"
                />
                <span className={entry.requiereInduccion ? 'text-black font-semibold' : ''}>Requiere inducción</span>
              </label>
            )}

            {/* Venta concretada (2026-08-09): pinta la celda ENTERA de verde
                agua — a diferencia de los otros dos flags, que son diagonales. */}
            {onToggleVentaConcretada && (
              <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500 cursor-pointer shrink-0 select-none"
                title="La visita corresponde a una venta concretada — la celda entera se pinta de verde agua">
                <input
                  type="checkbox"
                  checked={!!entry.ventaConcretada}
                  onChange={e => onToggleVentaConcretada(entry.id, e.target.checked)}
                  className="w-3 h-3 accent-[#0D6E6E]"
                />
                <span className={entry.ventaConcretada ? 'text-[#0D6E6E] font-semibold' : ''}>Venta concretada</span>
              </label>
            )}

            {/* Per Incident (2026-08-12): celda ENTERA verde oliva, mismo
                comportamiento que venta concretada. */}
            {onTogglePerIncident && (
              <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500 cursor-pointer shrink-0 select-none"
                title="Visita Per Incident — la celda entera se pinta de verde oliva">
                <input
                  type="checkbox"
                  checked={!!entry.perIncident}
                  onChange={e => onTogglePerIncident(entry.id, e.target.checked)}
                  className="w-3 h-3 accent-[#7C9A4F]"
                />
                <span className={entry.perIncident ? 'text-[#5c7539] font-semibold' : ''}>Per Incident</span>
              </label>
            )}

            {/* Espera importación (2026-08-20): el trabajo no se puede hacer
                hasta que llegue la importación. Celda ENTERA azul fuerte. */}
            {onToggleEsperaImportacion && (
              <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500 cursor-pointer shrink-0 select-none"
                title="El trabajo espera una importación para poder hacerse — la celda entera se pinta de azul fuerte">
                <input
                  type="checkbox"
                  checked={!!entry.esperaImportacion}
                  onChange={e => onToggleEsperaImportacion(entry.id, e.target.checked)}
                  className="w-3 h-3 accent-[#1D4ED8]"
                />
                <span className={entry.esperaImportacion ? 'text-[#1D4ED8] font-semibold' : ''}>Espera importación</span>
              </label>
            )}

            <EntryRange entry={entry} />

            {/* Bench (2026-08-12): el detalle técnico va acá arriba y también
                en la card del hover — sin esto había que abrir la OT. */}
            {esTrabajoEnBench(entry.tipoServicio) && onChangeNotas ? (
              <BenchDetalle entry={entry} onChange={onChangeNotas} />
            ) : (
              <div className="flex-1" />
            )}

            {clipboardLabel && (
              <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium shrink-0">
                Ctrl+V: {clipboardLabel}
              </span>
            )}

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onShrinkEntry?.(entry.id)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
                title="Reducir 1 cuarto"
              >
                ←
              </button>
              <button
                onClick={() => onExtendEntry?.(entry.id)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
                title="Extender 1 cuarto"
              >
                →
              </button>
              <button
                onClick={() => onDeleteEntry?.(entry.id)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                // Nombra la entrada (2026-08-12): con varios servicios en la
                // celda, el botón se lleva el SELECCIONADO y eso no era obvio.
                title={hasMultiple
                  ? `Eliminar ${entry.otNumber ? `OT ${entry.otNumber}` : (entry.titulo || 'la tarea')} — hay ${allEntries.length} servicios en esta celda (Del)`
                  : 'Eliminar asignación (Del)'}
              >
                ✕
              </button>
            </div>

            <span className="text-[11px] text-slate-400 shrink-0">{selectedCell.ingenieroNombre}</span>
          </>
        ) : (
          <>
            <span className="text-[11px] font-medium text-slate-600">{selectedCell.ingenieroNombre}</span>
            <span className="text-[11px] text-slate-400">{selectedCell.fecha} Q{selectedCell.quarter}</span>
            {clipboardLabel ? (
              <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                Ctrl+V para pegar {clipboardLabel}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 italic">Sin asignacion</span>
            )}
          </>
        )
      ) : (
        <span className="text-[11px] text-slate-400">Seleccione una celda para ver detalles</span>
      )}
    </div>
  );
};
