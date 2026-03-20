import { useState, useRef, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { googleDriveService } from '../../services/googleDriveService';
import { fichasService } from '../../services/firebaseService';
import type { FichaPropiedad, FotoFicha } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
  readOnly?: boolean;
  onUpdate: () => void;
}

export function FichaFotosSection({ ficha, readOnly, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [driveReady, setDriveReady] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fotos = ficha.fotos || [];

  useEffect(() => {
    googleDriveService.isAvailable().then(setDriveReady);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newFotos: FotoFicha[] = [];
      for (const file of Array.from(files)) {
        const result = await googleDriveService.uploadFile(ficha.numero, file);
        newFotos.push({
          id: crypto.randomUUID(),
          driveFileId: result.driveFileId,
          nombre: file.name,
          url: result.url,
          viewUrl: result.viewUrl,
          fecha: new Date().toISOString(),
        });
      }
      await fichasService.update(ficha.id, {
        fotos: [...fotos, ...newFotos],
      });
      onUpdate();
    } catch (err) {
      console.error('Error subiendo foto a Drive:', err);
      alert('Error al subir la foto. Verifique la configuracion de Google Drive.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (foto: FotoFicha) => {
    if (!confirm('Eliminar esta foto?')) return;
    setDeleting(foto.id);
    try {
      await googleDriveService.deleteFile(foto.driveFileId);
      await fichasService.update(ficha.id, {
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

  const canUpload = !readOnly && driveReady;

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

      {driveReady === false && !readOnly && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            Google Drive no configurado. Coloque <code className="bg-amber-100 px-1 rounded">service-account.json</code> en <code className="bg-amber-100 px-1 rounded">~/.ags/</code> y reinicie la app.
          </p>
        </div>
      )}

      {fotos.length === 0 ? (
        <p className="text-sm text-slate-400">Sin fotos registradas</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map(foto => (
            <div key={foto.id} className="relative group">
              <img
                src={foto.url}
                alt={foto.nombre}
                className="w-full h-24 object-cover rounded-lg border border-slate-200 cursor-pointer"
                onClick={() => setExpanded(foto.viewUrl)}
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
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{foto.nombre}</p>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-8" onClick={() => setExpanded(null)}>
          <iframe src={expanded} title="Foto" className="w-full h-full rounded-lg bg-white" />
        </div>
      )}
    </Card>
  );
}
