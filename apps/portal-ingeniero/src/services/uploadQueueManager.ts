/**
 * Manager singleton: drena la cola IndexedDB hacia Firebase Storage + Firestore.
 *
 * - Uno solo en toda la app — montado por <UploadQueueProvider> en App.tsx.
 * - Escucha online/offline; intenta drenar al volver online.
 * - Concurrencia 1 (subimos foto por foto) para no saturar la red móvil.
 * - Backoff exponencial en errores (5s → 10s → 30s → 60s, capped).
 * - Emite snapshots a los suscriptores (UI usa useUploadQueue).
 */
import { uploadQueueDB, type PendingFoto } from './uploadQueueDB';
import { fotoStorageService } from './fotoStorageService';
import { fichasPropiedadService } from './fichasPropiedadService';
import { getCurrentUser } from './currentUser';
import type { FotoFicha } from '@ags/shared';

type Listener = (state: ManagerState) => void;

export interface ManagerState {
  pending: PendingFoto[];
  online: boolean;
  draining: boolean;
}

const BACKOFF_MS = [5_000, 10_000, 30_000, 60_000];
function backoffFor(intentos: number): number {
  return BACKOFF_MS[Math.min(intentos, BACKOFF_MS.length - 1)];
}

class UploadQueueManager {
  private listeners = new Set<Listener>();
  private state: ManagerState = { pending: [], online: navigator.onLine, draining: false };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    void this.refresh();
    void this.tick();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.timer) clearTimeout(this.timer);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }

  async enqueueBlob(input: {
    fichaId: string;
    fichaNumero: string;
    itemId: string;
    itemSubId: string;
    blob: Blob;
    filename: string;
    momento: 'ingreso' | 'egreso';
  }): Promise<void> {
    const user = getCurrentUser();
    const item: PendingFoto = {
      id: crypto.randomUUID(),
      fichaId: input.fichaId,
      fichaNumero: input.fichaNumero,
      itemId: input.itemId,
      itemSubId: input.itemSubId,
      blob: input.blob,
      filename: input.filename,
      momento: input.momento,
      capturaAt: new Date().toISOString(),
      intentos: 0,
      status: 'queued',
      subidoPor: user?.displayName,
    };
    await uploadQueueDB.enqueue(item);
    await this.refresh();
    void this.tick();
  }

  /** Reintentar manualmente uno con error. */
  async retry(id: string): Promise<void> {
    await uploadQueueDB.update(id, { status: 'queued', lastError: undefined });
    await this.refresh();
    void this.tick();
  }

  /**
   * Reintenta TODAS las fotos pendientes — útil cuando varias fallaron y están
   * atrapadas en el backoff de 60s. Cancela el timer pendiente, libera draining
   * (por si quedó atascado por un error fuera del try), y dispara tick inmediato.
   */
  async retryAll(): Promise<void> {
    const all = await uploadQueueDB.getAll();
    for (const f of all) {
      await uploadQueueDB.update(f.id, {
        status: 'queued',
        intentos: 0,
        lastError: undefined,
      });
    }
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    // Liberamos draining por si una falla previa lo dejó atascado en true.
    this.setState({ draining: false });
    await this.refresh();
    void this.tick();
  }

  /** Descartar uno con error. Solo borra la cola (la foto nunca llegó a Storage). */
  async discard(id: string): Promise<void> {
    await uploadQueueDB.remove(id);
    await this.refresh();
  }

  /**
   * Vacía la cola entera. Escape de emergencia cuando hay fotos atascadas que
   * no se pueden subir (versión vieja sin itemId, error persistente, etc.).
   * Las fotos se pierden — habrá que volver a tomarlas.
   */
  async clearAll(): Promise<void> {
    const all = await uploadQueueDB.getAll();
    for (const f of all) await uploadQueueDB.remove(f.id);
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.setState({ draining: false });
    await this.refresh();
  }

  private handleOnline = () => {
    this.setState({ online: true });
    void this.tick();
  };

  private handleOffline = () => {
    this.setState({ online: false });
  };

  private async refresh(): Promise<void> {
    const pending = await uploadQueueDB.getAll();
    this.setState({ pending });
  }

  private setState(patch: Partial<ManagerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l(this.state));
  }

  /** Toma una foto en estado 'queued' y la sube. Reagenda si quedan más. */
  private async tick(): Promise<void> {
    if (!this.state.online || this.state.draining) return;
    const next = (await uploadQueueDB.getQueued())[0];
    if (!next) return;

    this.setState({ draining: true });
    let success = false;
    try {
      await uploadQueueDB.update(next.id, { status: 'uploading' });
      await this.refresh();

      // Usamos el subId del item como subcarpeta. Para fotos legacy sin itemSubId
      // (cola pre-refactor multi-item), caemos al fichaNumero.
      const folder = next.itemSubId || next.fichaNumero;
      const { storagePath, url } = await fotoStorageService.upload(
        folder, next.blob, next.filename,
      );
      const fotoMeta: FotoFicha = {
        id: crypto.randomUUID(),
        driveFileId: null,
        storagePath,
        nombre: next.filename,
        url,
        viewUrl: url,
        fecha: next.capturaAt,
        subidoPor: next.subidoPor,
        momento: next.momento,
      };
      // addFoto requiere itemId — si la foto fue encolada antes del refactor
      // multi-item y no tiene itemId, fallamos explícito con mensaje útil.
      if (!next.itemId) {
        throw new Error('Foto sin itemId (encolada con versión vieja). Descartar y volver a tomar.');
      }
      await fichasPropiedadService.addFoto(next.fichaId, next.itemId, fotoMeta);
      await uploadQueueDB.remove(next.id);
      success = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const intentos = next.intentos + 1;
      console.error(
        `[uploadQueue] Falló subida foto ${next.filename} (item ${next.itemSubId ?? '—'}, intento ${intentos}):`,
        err,
      );
      try {
        await uploadQueueDB.update(next.id, { status: 'queued', intentos, lastError: msg });
      } catch (innerErr) {
        console.error('[uploadQueue] No se pudo persistir el error en IndexedDB:', innerErr);
      }
      // Backoff antes de reintentar
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => { void this.tick(); }, backoffFor(intentos));
    } finally {
      // CRÍTICO: liberamos draining SIEMPRE — si esto se omite (ej. por throw
      // fuera del try), todos los ticks siguientes se quedan congelados.
      this.setState({ draining: false });
      await this.refresh();
    }
    // Si fue exitoso, encadenamos con la próxima fuera del finally.
    if (success) void this.tick();
  }
}

export const uploadQueueManager = new UploadQueueManager();
