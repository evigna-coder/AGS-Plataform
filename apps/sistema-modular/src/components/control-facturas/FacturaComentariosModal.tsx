import { useEffect, useMemo, useState } from 'react';
import type { Factura, Posta } from '@ags/shared';
import { facturasService } from '../../services/facturasService';
import { leadsService } from '../../services/leadsService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface FacturaComentariosModalProps {
  factura: Factura;
  autor: string;
  onClose: () => void;
  onAdded?: () => void;
}

const formatFecha = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

/** Una entrada del hilo, venga de la factura o del ticket. */
interface Entrada {
  fecha: string;
  autor: string;
  texto: string;
  tipo?: string | null;
  origen: 'factura' | 'ticket';
  destino?: string | null;
}

export const FacturaComentariosModal = ({ factura, autor, onClose, onAdded }: FacturaComentariosModalProps) => {
  const [texto, setTexto] = useState('');
  const [saving, setSaving] = useState(false);
  const [postas, setPostas] = useState<Posta[]>([]);

  // El hilo de la factura y el del TICKET son el mismo asunto (2026-08-19).
  // Lo que se escribe al derivar el ticket —el detalle de qué abarca la
  // factura, por ejemplo— quedaba solo del lado del ticket, y desde Control de
  // Facturas parecía que el comentario se había perdido. Se juntan acá.
  useEffect(() => {
    if (!factura.ticketId) { setPostas([]); return; }
    let vivo = true;
    leadsService.getById(factura.ticketId)
      .then(t => { if (vivo) setPostas(t?.postas ?? []); })
      .catch(() => { if (vivo) setPostas([]); });
    return () => { vivo = false; };
  }, [factura.ticketId]);

  const hilo = useMemo<Entrada[]>(() => {
    const deFactura: Entrada[] = (factura.comentarios ?? []).map(c => ({
      fecha: c.fecha, autor: c.autor || 'Anónimo', texto: c.texto, tipo: c.tipo, origen: 'factura',
    }));
    const deTicket: Entrada[] = postas
      .map(p => ({
        fecha: p.fecha,
        autor: p.deUsuarioNombre || 'Sistema',
        texto: (p.comentario || p.evento || '').trim(),
        origen: 'ticket' as const,
        destino: p.aUsuarioNombre || null,
      }))
      .filter(e => e.texto.length > 0);
    return [...deFactura, ...deTicket]
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [factura.comentarios, postas]);

  const handleAdd = async () => {
    const t = texto.trim();
    if (!t) return;
    setSaving(true);
    try {
      await facturasService.agregarComentario(factura.id, t, autor);
      setTexto('');
      onAdded?.();
    } catch (err) {
      console.error('Error al agregar comentario:', err);
      alert('Error al agregar el comentario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Comentarios" subtitle={`${factura.numero ?? 'Factura'} · ${factura.proveedorNombre}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {hilo.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">Todavía no hay comentarios.</p>
          ) : (
            hilo.map((c, i) => (
              <div key={i} className={`border rounded-lg px-3 py-2 ${
                c.tipo === 'aprobacion' ? 'border-indigo-200 bg-indigo-50/50'
                : c.tipo === 'rechazo' ? 'border-red-200 bg-red-50/50'
                : c.origen === 'ticket' ? 'border-slate-200 bg-slate-50/70'
                : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{c.autor}</span>
                    {c.tipo === 'aprobacion' && (
                      <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-100 px-1.5 py-px rounded-full shrink-0">Aprobación</span>
                    )}
                    {c.tipo === 'rechazo' && (
                      <span className="text-[9px] font-semibold text-red-600 bg-red-100 px-1.5 py-px rounded-full shrink-0">Rechazo</span>
                    )}
                    {/* De dónde viene: el hilo del ticket es la conversación de
                        la validación, el de la factura son aprobación/rechazo. */}
                    {c.origen === 'ticket' && (
                      <span className="text-[9px] font-mono uppercase text-slate-500 bg-slate-200/70 px-1.5 py-px rounded-full shrink-0"
                        title={c.destino ? `Derivado a ${c.destino}` : 'Del ticket de validación'}>
                        ticket{c.destino ? ` → ${c.destino}` : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatFecha(c.fecha)}</span>
                </div>
                <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{c.texto}</p>
              </div>
            ))
          )}
        </div>

        <div>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3}
            placeholder="Escribí un comentario..."
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cerrar</Button>
          <Button size="sm" onClick={handleAdd} disabled={saving || !texto.trim()}>
            {saving ? 'Agregando...' : 'Agregar comentario'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
