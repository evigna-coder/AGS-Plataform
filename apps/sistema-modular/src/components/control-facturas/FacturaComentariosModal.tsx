import { useState } from 'react';
import type { Factura } from '@ags/shared';
import { facturasService } from '../../services/facturasService';
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

export const FacturaComentariosModal = ({ factura, autor, onClose, onAdded }: FacturaComentariosModalProps) => {
  const [texto, setTexto] = useState('');
  const [saving, setSaving] = useState(false);

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
          {factura.comentarios.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">Todavía no hay comentarios.</p>
          ) : (
            factura.comentarios
              .slice()
              .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
              .map((c, i) => (
                <div key={i} className="border border-slate-200 rounded-lg px-3 py-2 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-600">{c.autor || 'Anónimo'}</span>
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
