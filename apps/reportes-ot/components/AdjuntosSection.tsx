import { useState, useRef } from 'react';
import { FirebaseService } from '../services/firebaseService';
import type { AdjuntoMeta } from '../types/instrumentos';
import { useAdjuntoPdfThumbnails } from '../hooks/useAdjuntoPdfThumbnails';

interface Props {
  firebase: FirebaseService;
  otNumber: string;
  adjuntos: AdjuntoMeta[];
  setAdjuntos: (adjuntos: AdjuntoMeta[]) => void;
  readOnly?: boolean;
}

export const AdjuntosSection: React.FC<Props> = ({ firebase, otNumber, adjuntos, setAdjuntos, readOnly }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const pdfThumbnails = useAdjuntoPdfThumbnails(adjuntos, firebase);

  const handleFiles = async (files: File[]) => {
    if (!otNumber || files.length === 0) return;
    setUploading(true);
    let currentOrden = adjuntos.length > 0 ? Math.max(...adjuntos.map(a => a.orden)) + 1 : 0;
    const newAdjuntos: AdjuntoMeta[] = [];
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`${i + 1}/${files.length}`);
      try {
        const { url, path } = await firebase.uploadAdjuntoFile(otNumber, file);
        const tipo: 'foto' | 'archivo' = file.type.startsWith('image/') ? 'foto' : 'archivo';
        const id = await firebase.createAdjunto({
          otNumber,
          tipo,
          storagePath: path,
          url,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          caption: null,
          orden: currentOrden,
          uploadedAt: new Date().toISOString(),
        });
        newAdjuntos.push({ id, otNumber, tipo, storagePath: path, url, fileName: file.name, mimeType: file.type, sizeBytes: file.size, caption: null, orden: currentOrden, uploadedAt: new Date().toISOString() });
        currentOrden++;
      } catch (err) {
        console.error(`Error subiendo "${file.name}":`, err);
        failed.push(file.name);
      }
    }
    if (newAdjuntos.length > 0) setAdjuntos([...adjuntos, ...newAdjuntos]);
    if (failed.length > 0) alert(`No se pudieron subir: ${failed.join(', ')}`);
    setUploading(false);
    setUploadProgress('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) handleFiles(Array.from(fileList));
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

  const persistOrden = async (reordered: AdjuntoMeta[]) => {
    const updated = reordered.map((a, i) => ({ ...a, orden: i }));
    setAdjuntos(updated);
    try {
      await firebase.updateAdjuntosOrden(updated.map(a => ({ id: a.id, orden: a.orden })));
    } catch (err) {
      console.error('Error reordenando:', err);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= adjuntos.length) return;
    const reordered = [...adjuntos];
    [reordered[index], reordered[targetIdx]] = [reordered[targetIdx], reordered[index]];
    void persistOrden(reordered);
  };

  const handleDrop = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const sourceIdx = adjuntos.findIndex(a => a.id === sourceId);
    const targetIdx = adjuntos.findIndex(a => a.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const reordered = [...adjuntos];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    void persistOrden(reordered);
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
            {uploading ? `Subiendo${uploadProgress ? ` ${uploadProgress}` : ''}...` : 'Tomar foto'}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !otNumber}
            className="flex items-center gap-1.5 text-xs text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {uploading && uploadProgress ? `Subiendo ${uploadProgress}...` : 'Subir fotos / PDF / archivos'}
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple className="hidden" onChange={handleInputChange} />
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
          {adjuntos.map((adj, idx) => {
            const isImage = adj.mimeType.startsWith('image/');
            const isPdf = adj.mimeType === 'application/pdf';
            const pdfThumb = isPdf ? pdfThumbnails[adj.id] : undefined;
            const isDragging = draggingId === adj.id;
            const isDragOver = dragOverId === adj.id && draggingId !== adj.id;
            return (
            <div
              key={adj.id}
              draggable={!readOnly}
              onDragStart={(e) => {
                if (readOnly) return;
                setDraggingId(adj.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', adj.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                if (readOnly || !draggingId || draggingId === adj.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverId !== adj.id) setDragOverId(adj.id);
              }}
              onDragLeave={() => {
                if (dragOverId === adj.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                if (readOnly) return;
                e.preventDefault();
                const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
                if (sourceId) handleDrop(sourceId, adj.id);
                setDraggingId(null);
                setDragOverId(null);
              }}
              className={`border rounded-lg overflow-hidden bg-white transition-all ${
                isDragging ? 'opacity-40 scale-95' : ''
              } ${
                isDragOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
              } ${!readOnly ? 'cursor-move' : ''}`}
            >
              {/* Preview */}
              <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {isImage ? (
                  <img src={adj.url} alt={adj.caption || adj.fileName} className="w-full h-full object-cover pointer-events-none" />
                ) : pdfThumb ? (
                  <>
                    <img src={pdfThumb} alt={adj.caption || adj.fileName} className="w-full h-full object-cover pointer-events-none" />
                    <span className="absolute bottom-1 right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide pointer-events-none">PDF</span>
                  </>
                ) : (
                  <div className="text-center p-2 pointer-events-none">
                    {isPdf ? (
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6 text-slate-300 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] text-slate-400">Cargando…</span>
                      </div>
                    ) : (
                      <>
                        <svg className="w-8 h-8 mx-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase mt-1">
                          {adj.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px] mx-auto">{adj.fileName}</p>
                      </>
                    )}
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
            );
          })}
        </div>
      )}
    </div>
  );
};
