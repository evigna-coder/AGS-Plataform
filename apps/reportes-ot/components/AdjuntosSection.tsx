import { useState, useRef } from 'react';
import { FirebaseService } from '../services/firebaseService';
import type { AdjuntoMeta } from '../types/instrumentos';

interface Props {
  firebase: FirebaseService;
  otNumber: string;
  adjuntos: AdjuntoMeta[];
  setAdjuntos: (adjuntos: AdjuntoMeta[]) => void;
  readOnly?: boolean;
}

export const AdjuntosSection: React.FC<Props> = ({ firebase, otNumber, adjuntos, setAdjuntos, readOnly }) => {
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!otNumber) return;
    setUploading(true);
    try {
      const { url, path } = await firebase.uploadAdjuntoFile(otNumber, file);
      const tipo: 'foto' | 'archivo' = file.type.startsWith('image/') ? 'foto' : 'archivo';
      const newOrden = adjuntos.length > 0 ? Math.max(...adjuntos.map(a => a.orden)) + 1 : 0;
      const id = await firebase.createAdjunto({
        otNumber,
        tipo,
        storagePath: path,
        url,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        caption: null,
        orden: newOrden,
        uploadedAt: new Date().toISOString(),
      });
      setAdjuntos([...adjuntos, { id, otNumber, tipo, storagePath: path, url, fileName: file.name, mimeType: file.type, sizeBytes: file.size, caption: null, orden: newOrden, uploadedAt: new Date().toISOString() }]);
    } catch (err) {
      console.error('Error subiendo adjunto:', err);
      alert('Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const handleDelete = async (adj: AdjuntoMeta) => {
    if (!confirm(`¿Eliminar "${adj.fileName}"?`)) return;
    try {
      await firebase.deleteAdjunto(adj.id, adj.storagePath);
      setAdjuntos(adjuntos.filter(a => a.id !== adj.id));
    } catch (err) {
      console.error('Error eliminando adjunto:', err);
      alert('Error al eliminar');
    }
  };

  const handleCaptionChange = async (adj: AdjuntoMeta, caption: string) => {
    setAdjuntos(adjuntos.map(a => a.id === adj.id ? { ...a, caption } : a));
    try {
      await firebase.updateAdjuntoCaption(adj.id, caption);
    } catch (err) {
      console.error('Error actualizando caption:', err);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= adjuntos.length) return;
    const reordered = [...adjuntos];
    [reordered[index], reordered[targetIdx]] = [reordered[targetIdx], reordered[index]];
    const updated = reordered.map((a, i) => ({ ...a, orden: i }));
    setAdjuntos(updated);
    try {
      await firebase.updateAdjuntosOrden(updated.map(a => ({ id: a.id, orden: a.orden })));
    } catch (err) {
      console.error('Error reordenando:', err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Botones de acción */}
      {!readOnly && (
        <div className="flex gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploading || !otNumber}
            className="flex items-center gap-1.5 text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {uploading ? 'Subiendo...' : 'Tomar foto'}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !otNumber}
            className="flex items-center gap-1.5 text-xs text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Subir archivo
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleInputChange} />
        </div>
      )}

      {/* Grid de adjuntos */}
      {adjuntos.length === 0 ? (
        !readOnly && (
          <p className="text-xs text-slate-400 text-center py-3">
            Sin adjuntos. Usá los botones para agregar fotos o archivos.
          </p>
        )
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {adjuntos.map((adj, idx) => (
            <div key={adj.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              {/* Preview */}
              <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
                {adj.mimeType.startsWith('image/') ? (
                  <img src={adj.url} alt={adj.caption || adj.fileName} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2">
                    <svg className="w-8 h-8 mx-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-[10px] text-slate-500 mt-1 truncate">{adj.fileName}</p>
                  </div>
                )}
              </div>
              {/* Caption + acciones */}
              <div className="p-2 space-y-1.5">
                {readOnly ? (
                  adj.caption && <p className="text-[11px] text-slate-600">{adj.caption}</p>
                ) : (
                  <input
                    type="text"
                    value={adj.caption || ''}
                    onChange={e => handleCaptionChange(adj, e.target.value)}
                    placeholder="Descripción..."
                    className="w-full text-[11px] border border-slate-200 rounded px-2 py-1 text-slate-700 placeholder-slate-400"
                  />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{formatSize(adj.sizeBytes)}</span>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <button onClick={() => handleMove(idx, -1)} disabled={idx === 0}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-0.5" title="Mover arriba">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button onClick={() => handleMove(idx, 1)} disabled={idx === adjuntos.length - 1}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-0.5" title="Mover abajo">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(adj)}
                        className="text-red-400 hover:text-red-600 p-0.5" title="Eliminar">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
