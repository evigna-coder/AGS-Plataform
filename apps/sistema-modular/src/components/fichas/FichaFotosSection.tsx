import { useState, useRef, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { fotoStorageService } from '../../services/fotoStorageService';
import { googleDriveService } from '../../services/googleDriveService';
import { fichasService } from '../../services/firebaseService';
import type { FichaPropiedad, ItemFicha, FotoFicha } from '@ags/shared';
import { useConfirm } from '../ui/ConfirmDialog';
import { pushEscape } from '../../utils/escapeStack';

interface Props {
  ficha: FichaPropiedad;
  /** Item al que pertenecen las fotos. */
  item: ItemFicha;
  readOnly?: boolean;
  onUpdate: () => void;
}

/**
 * Sección de fotos de un item específico. Las nuevas fotos suben a Firebase Storage
 * (mismo path `fotosFichas/{itemSubId}/...` que el portal-ingeniero móvil). Las
 * fotos legacy con `driveFileId` siguen visibles vía su `url` guardada.
 */
export function FichaFotosSection({ ficha, item, readOnly, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fotos = item.fotos || [];

  // ESC cierra el lightbox via escape-stack global: cuando el lightbox se monta
  // queda en la cima del stack, así un drawer abierto debajo no se cierra.
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
        const result = await fotoStorageService.upload(item.subId || ficha.numero, file, file.name);
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
      await fichasService.updateItem(ficha.id, item.id, {
        fotos: [...fotos, ...newFotos],
      });
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
      // Borrado del binario según dónde viva la foto
      if (foto.storagePath) {
        await fotoStorageService.remove(foto.storagePath);
      } else if (foto.driveFileId) {
        await googleDriveService.deleteFile(foto.driveFileId);
      }
      await fichasService.updateItem(ficha.id, item.id, {
        fotos: fotos.filter(f => f.id !== foto.id),
      });
      onUpdate();
    } catch (err) {
      console.error('Error eliminando foto:', err);
      alert('Error al eliminar la foto');
    } finally {
      setDeleting(null);
    }
  };

  const canUpload = !readOnly;

  return (
    <Card
      title={`Fotos${fotos.length > 0 ? ` (${fotos.length})` : ''}`}
      actions={
        canUpload && (
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : '+ Agregar foto'}
          </Button>
        )
      }
    >
      {canUpload && (
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      )}

      {fotos.length === 0 ? (
        <p className="text-sm text-slate-400">Sin fotos registradas</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-1.5">
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
              {!readOnly && (
                <button
                  onClick={() => handleDelete(foto)}
                  disabled={deleting === foto.id}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar foto"
                >
                  &times;
                </button>
              )}
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
          >
            ×
          </button>
          <img
            src={expanded}
            alt="Foto"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Card>
  );
}
