import { useState, useRef } from 'react';
import type { AdjuntoLead } from '@ags/shared';
import { LEAD_MAX_ADJUNTOS } from '@ags/shared';
import { leadsService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';

interface Props {
  leadId: string;
  adjuntos: AdjuntoLead[];
  onUpdated: () => void;
  readOnly?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(adj: AdjuntoLead): boolean {
  return adj.tipo === 'imagen';
}

export const LeadAdjuntosSection = ({ leadId, adjuntos, onUpdated, readOnly }: Props) => {

  const confirm = useConfirm();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const remaining = LEAD_MAX_ADJUNTOS - adjuntos.length;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > remaining) {
      alert(`Podés adjuntar ${remaining} archivo(s) más (máximo ${LEAD_MAX_ADJUNTOS}).`);
    }

    setUploading(true);
    try {
      await leadsService.uploadAdjuntos(leadId, Array.from(files), adjuntos.length);
      onUpdated();
    } catch (err) {
      console.error('Error subiendo adjuntos:', err);
      alert('Error al subir archivos');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async (adj: AdjuntoLead) => {
    if (!await confirm(`Eliminar "${adj.nombre}"?`)) return;
    try {
      await leadsService.removeAdjunto(leadId, adj, adjuntos);
      onUpdated();
    } catch (err) {
      console.error('Error eliminando adjunto:', err);
      alert('Error al eliminar');
    }
  };

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-medium text-slate-400">
            Adjuntos ({adjuntos.length}/{LEAD_MAX_ADJUNTOS})
          </h3>
          {!readOnly && remaining > 0 && (
            <div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Subiendo...' : '+ Adjuntar archivos'}
              </Button>
            </div>
          )}
        </div>

        {adjuntos.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin adjuntos</p>
        )}

        {adjuntos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {adjuntos.map(adj => (
              <div
                key={adj.id}
                className="group relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50"
              >
                {isImage(adj) ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(adj.url)}
                    className="w-full aspect-square"
                  >
                    <img
                      src={adj.url}
                      alt={adj.nombre}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <a
                    href={adj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full aspect-square flex flex-col items-center justify-center gap-1 hover:bg-slate-100"
                  >
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span className="text-[10px] text-slate-500 truncate max-w-full px-1">{adj.nombre.split('.').pop()?.toUpperCase()}</span>
                  </a>
                )}
                <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                  <p className="text-[10px] text-slate-600 truncate" title={adj.nombre}>{adj.nombre}</p>
                  <p className="text-[9px] text-slate-400">{formatSize(adj.size)}</p>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => handleRemove(adj)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image preview overlay */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 bg-white text-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-lg shadow-lg hover:bg-slate-100"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};
