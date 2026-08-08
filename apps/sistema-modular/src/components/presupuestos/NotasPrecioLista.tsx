import { useState } from 'react';
import type { NotaPrecioCliente } from '@ags/shared';
import { notasPrecioService } from '../../services/notasPrecioService';
import { useConfirm } from '../ui/ConfirmDialog';
import { pareceTabular, alinearTsv, insertarEnCursor } from '../../utils/pegadoTabular';

const fmtFecha = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

interface Props {
  notas: NotaPrecioCliente[];
  loading: boolean;
  error: boolean;
  /** Solo el autor puede editar o borrar su nota. */
  usuarioId?: string | null;
  onChanged: () => void | Promise<void>;
}

/** Historial de notas de precio del cliente, más recientes primero. */
export const NotasPrecioLista: React.FC<Props> = ({ notas, loading, error, usuarioId, onChanged }) => {
  const confirm = useConfirm();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [acting, setActing] = useState(false);

  const guardar = async (id: string) => {
    if (!draft.trim()) return;
    setActing(true);
    try {
      await notasPrecioService.update(id, draft);
      setEditandoId(null);
      await onChanged();
    } catch (err) {
      console.error('[NotasPrecioLista] update:', err);
      alert('No se pudo guardar el cambio');
    } finally { setActing(false); }
  };

  const borrar = async (n: NotaPrecioCliente) => {
    if (!await confirm('¿Borrar esta nota? No se puede recuperar.')) return;
    setActing(true);
    try {
      await notasPrecioService.remove(n.id);
      await onChanged();
    } catch (err) {
      console.error('[NotasPrecioLista] remove:', err);
      alert('No se pudo borrar la nota');
    } finally { setActing(false); }
  };

  if (loading) return <p className="text-center text-[11px] text-slate-400 py-8">Cargando notas...</p>;
  if (error) return <p className="text-center text-[11px] text-red-500 py-8">No se pudieron cargar las notas.</p>;
  if (notas.length === 0) {
    return (
      <p className="text-center text-[11px] text-slate-400 py-8 px-4">
        Sin notas para este cliente todavía.<br />
        <span className="text-[10px]">Anotá cómo armaste el precio y la próxima vez lo tenés acá.</span>
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200/70">
      {notas.map(n => {
        const esAutor = !!usuarioId && n.createdBy === usuarioId;
        return (
          <li key={n.id} className="px-3 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[9px] font-mono text-slate-500 truncate">
                {fmtFecha(n.createdAt)}
                {n.presupuestoNumero && <span className="text-teal-700"> · {n.presupuestoNumero}</span>}
                {n.createdByName && <span className="text-slate-400"> · {n.createdByName}</span>}
              </span>
              {esAutor && editandoId !== n.id && (
                <span className="flex gap-1.5 shrink-0">
                  <button type="button" disabled={acting}
                    onClick={() => { setEditandoId(n.id); setDraft(n.texto); }}
                    className="text-[10px] text-slate-500 hover:text-teal-700 disabled:opacity-40">Editar</button>
                  <button type="button" disabled={acting} onClick={() => void borrar(n)}
                    className="text-[10px] text-slate-400 hover:text-red-600 disabled:opacity-40">Borrar</button>
                </span>
              )}
            </div>

            {editandoId === n.id ? (
              <>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
                  onPaste={e => {
                    const pegado = e.clipboardData.getData('text/plain');
                    if (!pareceTabular(pegado)) return;
                    e.preventDefault();
                    const { valor, cursor } = insertarEnCursor(e.currentTarget, alinearTsv(pegado));
                    const el = e.currentTarget;
                    setDraft(valor);
                    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = cursor; });
                  }}
                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-[11px] font-mono resize-y focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white" />
                <div className="flex justify-end gap-1.5 mt-1">
                  <button type="button" onClick={() => setEditandoId(null)}
                    className="text-[10px] text-slate-500 hover:text-slate-700 px-2 py-0.5">Cancelar</button>
                  <button type="button" onClick={() => void guardar(n.id)} disabled={acting || !draft.trim()}
                    className="text-[10px] font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded px-2 py-0.5">
                    Guardar
                  </button>
                </div>
              </>
            ) : (
              // Monoespaciada y con scroll propio: las notas suelen traer celdas
              // de Excel alineadas en columnas (2026-08-08).
              <div className="overflow-x-auto">
                <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap break-words m-0">{n.texto}</pre>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
