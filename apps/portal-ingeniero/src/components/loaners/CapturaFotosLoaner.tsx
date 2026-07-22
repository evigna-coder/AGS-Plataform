import { useRef } from 'react';
import { FotoCard, FotoCardUploaded } from '../recepcion/FotoCard';
import { useUploadQueue, usePendingForLoaner } from '../../hooks/useUploadQueue';
import type { FotoLoaner } from '@ags/shared';

interface Props {
  loanerId: string;
  /** LNR-XXXX — se muestra en la cola/indicador global. */
  loanerCodigo: string;
  contexto: FotoLoaner['contexto'];
  prestamoId: string;
  /** Fotos ya confirmadas en Firestore (mismo contexto + préstamo). */
  fotosConfirmadas?: FotoLoaner[];
  titulo: string;
}

/**
 * Captura múltiple con cámara nativa (mismo patrón que recepcion/CapturaFotosStep):
 * las fotos se encolan en IndexedDB y la cola offline (uploadQueueManager) las
 * sube en background cuando hay señal. El usuario puede salir de la pantalla
 * con fotos pendientes sin problema — el drain les agrega su prestamoId.
 */
export function CapturaFotosLoaner({
  loanerId,
  loanerCodigo,
  contexto,
  prestamoId,
  fotosConfirmadas = [],
  titulo,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { enqueueLoaner, retry, discard } = useUploadQueue();
  const pending = usePendingForLoaner(loanerId).filter(
    p => p.contexto === contexto && p.prestamoId === prestamoId,
  );

  const total = fotosConfirmadas.length + pending.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await enqueueLoaner({
        loanerId,
        loanerCodigo,
        blob: file,
        filename: file.name || `foto_${Date.now()}.jpg`,
        contexto,
        prestamoId,
      });
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">{titulo}</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">
          {total} foto{total === 1 ? '' : 's'}
          {pending.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-amber-700">
              ({pending.length} en cola)
            </span>
          )}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={e => void handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl py-4 font-semibold flex items-center justify-center gap-2 shadow-sm"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Tomar foto
      </button>

      {total === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">
          No hay fotos todavía
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {fotosConfirmadas.map(f => (
            <FotoCardUploaded key={f.id} url={f.url} label={f.nombre ?? undefined} />
          ))}
          {pending.map(p => (
            <FotoCard
              key={p.id}
              pending={p}
              onRetry={() => void retry(p.id)}
              onDiscard={() => void discard(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
