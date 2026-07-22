import { useEffect, useState } from 'react';
import { uploadQueueManager, type ManagerState } from '../services/uploadQueueManager';
import type { PendingFotoFicha, PendingFotoLoaner } from '../services/uploadQueueDB';

/**
 * Suscripción al singleton uploadQueueManager.
 * Devuelve estado vivo de la cola + helpers para enqueue/retry/discard.
 */
export function useUploadQueue() {
  const [state, setState] = useState<ManagerState>({
    pending: [],
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    draining: false,
  });

  useEffect(() => {
    return uploadQueueManager.subscribe(setState);
  }, []);

  return {
    pending: state.pending,
    online: state.online,
    draining: state.draining,
    enqueue: uploadQueueManager.enqueueBlob.bind(uploadQueueManager),
    enqueueLoaner: uploadQueueManager.enqueueLoanerBlob.bind(uploadQueueManager),
    retry: uploadQueueManager.retry.bind(uploadQueueManager),
    retryAll: uploadQueueManager.retryAll.bind(uploadQueueManager),
    clearAll: uploadQueueManager.clearAll.bind(uploadQueueManager),
    discard: uploadQueueManager.discard.bind(uploadQueueManager),
  };
}

/** Atajo: cuántas fotos quedan pendientes (para badge global). */
export function usePendingCount(): number {
  const { pending } = useUploadQueue();
  return pending.length;
}

/** Atajo: pendientes de una ficha específica. */
export function usePendingForFicha(fichaId: string): PendingFotoFicha[] {
  const { pending } = useUploadQueue();
  return pending.filter(
    (p): p is PendingFotoFicha => p.tipo === 'ficha' && p.fichaId === fichaId,
  );
}

/** Atajo: pendientes de un loaner específico. */
export function usePendingForLoaner(loanerId: string): PendingFotoLoaner[] {
  const { pending } = useUploadQueue();
  return pending.filter(
    (p): p is PendingFotoLoaner => p.tipo === 'loaner' && p.loanerId === loanerId,
  );
}
