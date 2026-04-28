import { useRef } from 'react';
import { Button } from '../ui/Button';
import { FotoCard, FotoCardUploaded } from './FotoCard';
import { useUploadQueue, usePendingForFicha } from '../../hooks/useUploadQueue';
import type { FotoFicha, MomentoFotoFicha } from '@ags/shared';

interface Props {
  fichaId: string;
  fichaNumero: string;
  momento: MomentoFotoFicha;
  /** Fotos ya confirmadas en Firestore (para egreso o re-entrada). */
  fotosConfirmadas?: FotoFicha[];
  onDone?: () => void;
  doneLabel?: string;
}

/**
 * Pantalla de captura: cámara nativa móvil via <input capture="environment">.
 * Múltiples fotos se encolan en IndexedDB y la sincronización es independiente
 * de esta pantalla — el usuario puede salir con fotos en cola sin problema.
 */
export function CapturaFotosStep({
  fichaId,
  fichaNumero,
  momento,
  fotosConfirmadas = [],
  onDone,
  doneLabel = 'Listo',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { enqueue, retry, discard } = useUploadQueue();
  const pending = usePendingForFicha(fichaId).filter(p => p.momento === momento);

  const fotosDelMomento = fotosConfirmadas.filter(f => f.momento === momento);
  const totalFotos = fotosDelMomento.length + pending.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await enqueue({
        fichaId,
        fichaNumero,
        blob: file,
        filename: file.name || `foto_${Date.now()}.jpg`,
        momento,
      });
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">
            {momento === 'ingreso' ? 'Fotos de ingreso' : 'Fotos de egreso (pre-embalaje)'}
          </p>
          <p className="text-base font-semibold text-slate-800 mt-0.5">
            {fichaNumero} · {totalFotos} foto{totalFotos === 1 ? '' : 's'}
          </p>
        </div>
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

      {totalFotos === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">
          No hay fotos todavía
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {fotosDelMomento.map(f => (
            <FotoCardUploaded key={f.id} url={f.url} label={f.nombre} />
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

      {onDone && (
        <Button onClick={onDone} size="lg" className="w-full mt-2">
          {doneLabel}
        </Button>
      )}
    </div>
  );
}
