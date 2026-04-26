import { useEffect, useState } from 'react';
import type { PendingFoto } from '../../services/uploadQueueDB';

interface Props {
  pending: PendingFoto;
  onRetry?: () => void;
  onDiscard?: () => void;
}

/** Preview de una foto en cola, con badge de estado. */
export function FotoCard({ pending, onRetry, onDiscard }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(pending.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending.blob]);

  const showRetry = pending.lastError && pending.status === 'queued';

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-200">
      {previewUrl && (
        <img
          src={previewUrl}
          alt={pending.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}
      <div className="absolute top-1 right-1 flex gap-1">
        {pending.status === 'uploading' && (
          <span className="px-1.5 py-0.5 rounded bg-teal-600/90 text-white text-[10px] font-medium">
            Subiendo
          </span>
        )}
        {pending.status === 'queued' && !pending.lastError && (
          <span className="px-1.5 py-0.5 rounded bg-slate-700/80 text-white text-[10px] font-medium">
            En cola
          </span>
        )}
        {showRetry && (
          <span className="px-1.5 py-0.5 rounded bg-red-600/90 text-white text-[10px] font-medium">
            Error
          </span>
        )}
      </div>
      {showRetry && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1.5 flex justify-between items-center">
          <button
            onClick={onRetry}
            className="text-[11px] font-semibold text-white"
            type="button"
          >
            Reintentar
          </button>
          <button
            onClick={onDiscard}
            className="text-[11px] text-red-300"
            type="button"
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

/** Mini-version mostrando una foto subida (metadata desde Firestore). */
export function FotoCardUploaded({ url, label }: { url: string; label?: string }) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-200">
      <img src={url} alt={label ?? ''} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute top-1 right-1">
        <span className="px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[10px] font-medium">
          ✓
        </span>
      </div>
    </div>
  );
}
