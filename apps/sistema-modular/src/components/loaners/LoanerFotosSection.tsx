import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/Button';
import { loanersService } from '../../services/loanersService';
import type { Loaner, FotoLoaner } from '@ags/shared';
import { useConfirm } from '../ui/ConfirmDialog';
import { pushEscape } from '../../utils/escapeStack';

const CONTEXTO_LABELS: Record<FotoLoaner['contexto'], string> = {
  general: 'gral',
  prestamo: 'prést',
  devolucion: 'dev',
};

const CONTEXTO_BADGE: Record<FotoLoaner['contexto'], string> = {
  general: 'bg-slate-500/90',
  prestamo: 'bg-blue-600/90',
  devolucion: 'bg-purple-600/90',
};

interface Props {
  loaner: Loaner;
}

/**
 * Galería de fotos del loaner (mismo patrón que FichaFotosSection: thumbs +
 * lightbox + borrar con confirm). Cada foto lleva el chip de su contexto
 * (general / salida de préstamo / devolución). El estado se refresca solo:
 * LoanerDetail está suscripto al doc.
 */
export function LoanerFotosSection({ loaner }: Props) {
  const confirm = useConfirm();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fotos = loaner.fotos ?? [];

  useEffect(() => {
    if (!expanded) return;
    return pushEscape(() => setExpanded(null));
  }, [expanded]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await loanersService.agregarFoto(loaner.id, file, { nombre: file.name, contexto: 'general' });
      }
    } catch (err) {
      console.error('Error subiendo foto del loaner:', err);
      alert('Error al subir la foto.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (foto: FotoLoaner) => {
    if (!await confirm('¿Eliminar esta foto?')) return;
    setDeleting(foto.id);
    try {
      await loanersService.eliminarFoto(loaner.id, foto.id);
    } catch (err) {
      console.error('Error eliminando foto del loaner:', err);
      alert('Error al eliminar la foto');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">
          Fotos {fotos.length > 0 && <span className="text-slate-400 font-normal">({fotos.length})</span>}
        </span>
        <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Subiendo…' : '+ Agregar'}
        </Button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      {fotos.length === 0 ? (
        <p className="text-xs text-slate-400 mt-2">Sin fotos registradas</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {fotos.map(foto => (
            <div key={foto.id} className="relative group">
              <img
                src={foto.url}
                alt={foto.nombre ?? 'Foto'}
                title={[foto.nombre, foto.descripcion].filter(Boolean).join(' — ')}
                className="w-full aspect-square object-cover rounded-md border border-slate-200 cursor-pointer"
                onClick={() => setExpanded(foto.url)}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="12">Error</text></svg>';
                }}
              />
              <span className={`absolute top-0.5 left-0.5 px-1 py-0 rounded text-white text-[8px] font-medium uppercase ${CONTEXTO_BADGE[foto.contexto] ?? CONTEXTO_BADGE.general}`}>
                {CONTEXTO_LABELS[foto.contexto] ?? foto.contexto}
              </span>
              <button
                onClick={() => handleDelete(foto)}
                disabled={deleting === foto.id}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >×</button>
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setExpanded(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-xl"
            aria-label="Cerrar"
            title="Cerrar (ESC)"
          >×</button>
          <img
            src={expanded}
            alt="Foto"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
