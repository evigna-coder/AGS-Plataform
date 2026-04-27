import { useCallback } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useBackgroundTasks } from '../../../contexts/BackgroundTasksContext';
import { useConfirm } from '../../../components/ui/ConfirmDialog';

interface DedupRow {
  sistemaId: string;
  moduloId: string;
  serie: string;
  sistemaNombre: string;
}

interface DedupTaskState {
  status: 'scanning' | 'scanned' | 'deleting' | 'done';
  log: string[];
  duplicates: DedupRow[];
}

const DEDUP_TASK_ID = 'dedup-modulos';

export function DedupModulos() {
  const confirm = useConfirm();
  const bg = useBackgroundTasks();
  const task = bg.getTask<DedupTaskState>(DEDUP_TASK_ID);

  // Recover state from context if available
  const taskData = task?.rows?.[0];
  const status = taskData?.status ?? 'idle';
  const log = taskData?.log ?? [];
  const duplicates = taskData?.duplicates ?? [];
  const isRunning = task?.running ?? false;

  const updateState = useCallback((partial: Partial<DedupTaskState>) => {
    bg.updateRows<DedupTaskState>(DEDUP_TASK_ID, prev => {
      const current = prev[0] || { status: 'scanning', log: [], duplicates: [] };
      return [{ ...current, ...partial }];
    });
  }, [bg]);

  const scan = async () => {
    bg.startTask<DedupTaskState>(DEDUP_TASK_ID, [{ status: 'scanning', log: [], duplicates: [] }], 1);

    const addLog = (msg: string) => {
      bg.updateRows<DedupTaskState>(DEDUP_TASK_ID, prev => {
        const current = prev[0];
        return [{ ...current, log: [...current.log, msg] }];
      });
    };

    addLog('Cargando todos los sistemas...');

    const sistemasSnap = await getDocs(collection(db, 'sistemas'));
    const sistemas = sistemasSnap.docs.map(d => ({ id: d.id, nombre: (d.data().nombre || d.id) as string }));
    addLog(`${sistemas.length} sistemas encontrados. Escaneando modulos...`);

    const dupes: DedupRow[] = [];
    let totalModulos = 0;

    for (const sistema of sistemas) {
      if (bg.isCancelled(DEDUP_TASK_ID)) break;

      const modulosSnap = await getDocs(collection(db, 'sistemas', sistema.id, 'modulos'));
      const modulos = modulosSnap.docs.map(d => ({ id: d.id, serie: (d.data().serie || '') as string, createdAt: d.data().createdAt }));
      totalModulos += modulos.length;

      const bySerie = new Map<string, typeof modulos>();
      for (const m of modulos) {
        if (!m.serie) continue;
        const key = m.serie.trim().toLowerCase();
        if (!key) continue;
        if (!bySerie.has(key)) bySerie.set(key, []);
        bySerie.get(key)!.push(m);
      }

      for (const [serie, group] of bySerie) {
        if (group.length <= 1) continue;
        group.sort((a, b) => {
          const ta = a.createdAt?.seconds ?? 0;
          const tb = b.createdAt?.seconds ?? 0;
          return ta - tb;
        });
        for (let i = 1; i < group.length; i++) {
          dupes.push({ sistemaId: sistema.id, moduloId: group[i].id, serie, sistemaNombre: sistema.nombre });
        }
      }
    }

    updateState({ status: 'scanned', duplicates: dupes });
    addLog(`Escaneo completo: ${totalModulos} modulos totales, ${dupes.length} duplicados encontrados.`);
    bg.finishTask(DEDUP_TASK_ID);
  };

  const deleteDuplicates = async () => {
    if (!await confirm(`¿Eliminar ${duplicates.length} modulo(s) duplicados?\n\nEsta acción no se puede deshacer.`)) return;
    updateState({ status: 'deleting' });

    const addLog = (msg: string) => {
      bg.updateRows<DedupTaskState>(DEDUP_TASK_ID, prev => {
        const current = prev[0];
        return [{ ...current, log: [...current.log, msg] }];
      });
    };

    let deleted = 0;
    for (const d of duplicates) {
      try {
        await deleteDoc(doc(db, 'sistemas', d.sistemaId, 'modulos', d.moduloId));
        deleted++;
        if (deleted % 50 === 0) addLog(`${deleted}/${duplicates.length} eliminados...`);
      } catch (e) {
        addLog(`Error eliminando ${d.moduloId}: ${e}`);
      }
    }
    addLog(`Limpieza completa: ${deleted} modulos duplicados eliminados.`);
    updateState({ status: 'done', duplicates: [] });
  };

  const handleClear = () => {
    bg.clearTask(DEDUP_TASK_ID);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">Deduplicar modulos por numero de serie</h2>
        <p className="text-xs text-slate-500 mb-3">
          Escanea todos los sistemas buscando modulos con el mismo numero de serie. Conserva el mas antiguo y marca los demas para eliminacion.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={scan}
            disabled={isRunning || status === 'deleting'}
            className="px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {isRunning ? 'Escaneando...' : 'Escanear duplicados'}
          </button>
          {duplicates.length > 0 && status === 'scanned' && (
            <button
              onClick={deleteDuplicates}
              className="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Eliminar {duplicates.length} duplicados
            </button>
          )}
          {(status === 'scanned' || status === 'done') && !isRunning && (
            <button onClick={handleClear} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
              Limpiar
            </button>
          )}
        </div>
        {isRunning && (
          <p className="text-[10px] text-teal-600 mt-2 font-medium">
            Podés navegar a otra sección. El escaneo continuará en segundo plano.
          </p>
        )}
      </div>

      {duplicates.length > 0 && status === 'scanned' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">Duplicados encontrados ({duplicates.length})</h2>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="text-center py-1 pr-2">Sistema</th>
                  <th className="text-center py-1 pr-2">Serie</th>
                  <th className="text-center py-1">Modulo ID</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map((d, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1 pr-2 text-slate-600 truncate max-w-[200px]">{d.sistemaNombre}</td>
                    <td className="py-1 pr-2 font-mono text-slate-700">{d.serie}</td>
                    <td className="py-1 text-slate-400 truncate max-w-[180px]">{d.moduloId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-3 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
          {log.map((line, i) => <div key={i}>{line}</div>)}
          {(isRunning || status === 'deleting') && (
            <div className="text-teal-400 animate-pulse mt-1">Procesando...</div>
          )}
        </div>
      )}

      {status === 'done' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs font-medium text-emerald-800">Limpieza completada.</p>
        </div>
      )}
    </div>
  );
}
