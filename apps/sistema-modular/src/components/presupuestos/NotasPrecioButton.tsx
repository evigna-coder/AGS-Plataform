import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NotaPrecioCliente } from '@ags/shared';
import { notasPrecioService } from '../../services/notasPrecioService';
import { useFloatingBubble, BUBBLE_RESIZE_CORNER_CLASS } from '../../hooks/useFloatingBubble';
import { pareceTabular, alinearTsv, insertarEnCursor } from '../../utils/pegadoTabular';
import { useAuth } from '../../contexts/AuthContext';
import { NotasPrecioLista } from './NotasPrecioLista';

interface Props {
  clienteId: string | null | undefined;
  clienteNombre?: string;
  /** Presupuesto desde el que se escribe — queda como contexto de la nota. */
  presupuestoId?: string | null;
  presupuestoNumero?: string | null;
  variant?: 'inline' | 'pill';
}

/**
 * Libreta de notas de armado de precio del cliente (2026-08-08).
 *
 * Mismo lugar y misma burbuja flotante que "Factores anteriores": quien cotiza
 * anota con qué criterio compuso el valor y al preparar el próximo presupuesto
 * lo tiene a mano, sin salir del form.
 */
export const NotasPrecioButton: React.FC<Props> = ({
  clienteId, clienteNombre, presupuestoId, presupuestoNumero, variant = 'inline',
}) => {
  const { usuario } = useAuth();
  const [open, setOpen] = useState(false);
  const [notas, setNotas] = useState<NotaPrecioCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const { pos, dragHandlers, resizeHandlers, bubbleStyle } = useFloatingBubble(open, () => setOpen(false));

  const recargar = async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(false);
    try { setNotas(await notasPrecioService.getByCliente(clienteId)); }
    catch { setError(true); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open || !clienteId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    notasPrecioService.getByCliente(clienteId)
      .then(d => { if (!cancelled) setNotas(d); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, clienteId]);

  const agregar = async () => {
    if (!clienteId || !draft.trim()) return;
    setSaving(true);
    try {
      await notasPrecioService.create({
        clienteId, texto: draft, presupuestoId: presupuestoId ?? null,
        presupuestoNumero: presupuestoNumero ?? null,
      });
      setDraft('');
      await recargar();
    } catch (err) {
      console.error('[NotasPrecioButton] agregar:', err);
      alert('No se pudo guardar la nota');
    } finally { setSaving(false); }
  };

  if (!clienteId) return null;

  const btnClass = variant === 'pill'
    ? 'inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md px-2 py-1 transition-colors'
    : 'inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-900 hover:underline';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnClass}
        title="Notas de cómo se armó el precio para este cliente">
        📝 Notas de precio{notas.length > 0 ? ` (${notas.length})` : ''}
      </button>

      {open && pos && createPortal(
        <div
          className="fixed z-[95] w-[420px] max-w-[92vw] max-h-[94vh] flex flex-col rounded-xl border border-white/30 bg-white/55 backdrop-blur-md shadow-2xl ring-1 ring-black/5 overflow-hidden"
          style={bubbleStyle}
        >
          <div {...dragHandlers}
            className="flex items-center justify-between px-4 py-2 bg-teal-700/75 text-white cursor-move select-none shrink-0">
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-widest text-teal-100">⠿ Notas de precio · arrastrá · estirá la esquina · Esc cierra</p>
              <p className="text-xs font-serif truncate">{clienteNombre || 'Cliente'}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-teal-100 hover:text-white text-lg leading-none shrink-0 ml-2">&times;</button>
          </div>

          {/* Nueva nota */}
          <div className="px-3 py-2 bg-white/70 border-b border-[#E5E5E5] shrink-0">
            {/* Pegar desde Excel (2026-08-08): el TSV se alinea en columnas para
                que las celdas se lean; ver utils/pegadoTabular. */}
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onPaste={e => {
                const pegado = e.clipboardData.getData('text/plain');
                if (!pareceTabular(pegado)) return;
                e.preventDefault();
                const { valor, cursor } = insertarEnCursor(e.currentTarget, alinearTsv(pegado));
                const el = e.currentTarget;
                setDraft(valor);
                requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = cursor; });
              }}
              rows={4}
              placeholder="Ej.: G7129A — partí del costo de la última impo (factor 1.42) + 18%. Comparan con Ivax, no pasar de 1900.&#10;Se pueden pegar celdas de Excel."
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-[11px] font-mono resize-y focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] text-slate-400">
                {presupuestoNumero ? `Se guarda con ${presupuestoNumero}` : 'Sin presupuesto asociado'}
              </span>
              <button type="button" onClick={() => void agregar()} disabled={saving || !draft.trim()}
                className="text-[11px] font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded px-2.5 py-1">
                {saving ? 'Guardando…' : 'Agregar nota'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#FAFAFA]/30">
            <NotasPrecioLista
              notas={notas}
              loading={loading}
              error={error}
              usuarioId={usuario?.id}
              onChanged={recargar}
            />
          </div>

          <div className="px-4 py-1.5 bg-[#F0F0F0]/55 border-t border-[#E5E5E5] shrink-0">
            <span className="text-[9px] font-mono text-slate-400">
              {notas.length} nota{notas.length === 1 ? '' : 's'} · las ve todo el equipo
            </span>
          </div>

          {/* Esquina de resize */}
          <div {...resizeHandlers} className={BUBBLE_RESIZE_CORNER_CLASS} title="Estirar" />
        </div>,
        document.body,
      )}
    </>
  );
};
