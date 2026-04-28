import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/Button';
import { fotoStorageService } from '../../services/fotoStorageService';
import { googleDriveService } from '../../services/googleDriveService';
import { fichasService } from '../../services/firebaseService';
import type { FichaPropiedad, FotoFicha } from '@ags/shared';
import { useConfirm } from '../ui/ConfirmDialog';
import { pushEscape } from '../../utils/escapeStack';

interface Props {
  ficha: FichaPropiedad;
  readOnly?: boolean;
  onUpdate: () => void;
  /** Si true, no incluye Card wrapper — se renderiza pelado para encajar en sidebar. */
  embedded?: boolean;
  /** Si true, arranca colapsada (solo header). Click expande. Default: false. */
  collapsible?: boolean;
}

/**
 * Sección de fotos a nivel ficha. Las fotos del paquete recibido + las del egreso
 * pre-embalaje viven todas acá; no están atadas a un item específico.
 *
 * `embedded` para uso en sidebar (sin card wrapper).
 * `collapsible` para que arranque cerrada y se expanda con click.
 */
export function FichaFotosSection({ ficha, readOnly, onUpdate, embedded, collapsible }: Props) {
  const [uploading, setUploading] = useState(false);
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(!collapsible);
  const inputRef = useRef<HTMLInputElement>(null);

  const fotos = ficha.fotos || [];

  useEffect(() => {
    if (!expanded) return;
    return pushEscape(() => setExpanded(null));
  }, [expanded]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newFotos: FotoFicha[] = [];
      for (const file of Array.from(files)) {
        const result = await fotoStorageService.upload(ficha.numero, file, file.name);
        newFotos.push({
          id: crypto.randomUUID(),
          driveFileId: null,
          storagePath: result.storagePath,
          nombre: file.name,
          url: result.url,
          viewUrl: result.url,
          fecha: new Date().toISOString(),
        });
      }
      await fichasService.update(ficha.id, { fotos: [...fotos, ...newFotos] });
      onUpdate();
    } catch (err) {
      console.error('Error subiendo foto:', err);
      alert('Error al subir la foto.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (foto: FotoFicha) => {
    if (!await confirm('Eliminar esta foto?')) return;
    setDeleting(foto.id);
    try {
      if (foto.storagePath) {
        await fotoStorageService.remove(foto.storagePath);
      } else if (foto.driveFileId) {
        await googleDriveService.deleteFile(foto.driveFileId);
      }
      await fichasService.update(ficha.id, { fotos: fotos.filter(f => f.id !== foto.id) });
      onUpdate();
    } catch (err) {
      console.error('Error eliminando foto:', err);
      alert('Error al eliminar la foto');
    } finally {
      setDeleting(null);
    }
  };

  const canUpload = !readOnly;
  const ingresoCount = fotos.filter(f => f.momento !== 'egreso').length;
  const egresoCount = fotos.filter(f => f.momento === 'egreso').length;

  const Header = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        className={`flex-1 text-left flex items-center gap-2 ${collapsible ? 'cursor-pointer' : ''}`}
      >
        {collapsible && (
          <svg className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        )}
        <span className="text-sm font-semibold text-slate-700">
          Fotos {fotos.length > 0 && <span className="text-slate-400 font-normal">({fotos.length})</span>}
        </span>
        {fotos.length > 0 && (
          <span className="text-[10px] text-slate-400 font-mono ml-1">
            {ingresoCount} ing · {egresoCount} egr
          </span>
        )}
      </button>
      {canUpload && (
        <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? '…' : '+'}
        </Button>
      )}
    </div>
  );

  const Body = (
    <>
      {canUpload && (
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      )}
      {fotos.length === 0 ? (
        <p className="text-xs text-slate-400 mt-2">Sin fotos registradas</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {fotos.map(foto => (
            <div key={foto.id} className="relative group">
              <img
                src={foto.url}
                alt={foto.nombre}
                className="w-full aspect-square object-cover rounded-md border border-slate-200 cursor-pointer"
                onClick={() => setExpanded(foto.viewUrl || foto.url)}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="12">Error</text></svg>';
                }}
              />
              {foto.momento === 'egreso' && (
                <span className="absolute top-0.5 left-0.5 px-1 py-0 rounded bg-cyan-600/90 text-white text-[8px] font-medium uppercase">egr</span>
              )}
              {!readOnly && (
                <button
                  onClick={() => handleDelete(foto)}
                  disabled={deleting === foto.id}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  const Lightbox = expanded && (
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
  );

  // Pelado para sidebar — sin Card wrapper
  if (embedded) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-3">
        {Header}
        {open && Body}
        {Lightbox}
      </div>
    );
  }

  // Wrapper estándar (ahora también compacto, sin Card componente)
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4">
      {Header}
      {open && Body}
      {Lightbox}
    </div>
  );
}
