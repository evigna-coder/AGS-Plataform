import { useCallback } from 'react';
import { sistemasService } from '../../../services/equiposService';
import { useBackgroundTasks } from '../../../contexts/BackgroundTasksContext';
import { useConfirm } from '../../../components/ui/ConfirmDialog';

interface RepairFix {
  sistemaId: string;
  sistemaNombre: string;
  clienteId: string;
  oldEstId: string;
  newEstId: string;
  newEstNombre: string;
}

interface RepairTaskState {
  status: 'scanning' | 'scanned' | 'fixing' | 'done';
  log: string[];
  fixes: RepairFix[];
}

const REPAIR_TASK_ID = 'repair-sistema-est';

export function RepairSistemaEstablecimiento() {
  const confirm = useConfirm();
  const bg = useBackgroundTasks();
  const task = bg.getTask<RepairTaskState>(REPAIR_TASK_ID);

  const taskData = task?.rows?.[0];
  const status = taskData?.status ?? 'idle';
  const log = taskData?.log ?? [];
  const fixes = taskData?.fixes ?? [];
  const isRunning = task?.running ?? false;

  const updateState = useCallback((partial: Partial<RepairTaskState>) => {
    bg.updateRows<RepairTaskState>(REPAIR_TASK_ID, prev => {
      const current = prev[0] || { status: 'scanning', log: [], fixes: [] };
      return [{ ...current, ...partial }];
    });
  }, [bg]);

  const scan = async () => {
    bg.startTask<RepairTaskState>(REPAIR_TASK_ID, [{ status: 'scanning', log: [], fixes: [] }], 1);

    const addLog = (msg: string) => {
      bg.updateRows<RepairTaskState>(REPAIR_TASK_ID, prev => {
        const current = prev[0];
        return [{ ...current, log: [...current.log, msg] }];
      });
    };

    const { pendingFixes } = await sistemasService.scanOrphanedEstablecimientos({
      onProgress: addLog,
      isCancelled: () => bg.isCancelled(REPAIR_TASK_ID),
    });

    updateState({ status: 'scanned', fixes: pendingFixes });
    addLog('---');
    addLog(`${pendingFixes.length} sistemas se pueden reasignar automaticamente (clientes con 1 solo establecimiento).`);
    addLog('Los sistemas de clientes con multiples establecimientos requieren asignacion manual.');
    bg.finishTask(REPAIR_TASK_ID);
  };

  const applyFixes = async () => {
    if (!await confirm(`¿Reasignar ${fixes.length} sistema(s) a su establecimiento correcto?`)) return;
    updateState({ status: 'fixing' });

    const addLog = (msg: string) => {
      bg.updateRows<RepairTaskState>(REPAIR_TASK_ID, prev => {
        const current = prev[0];
        return [{ ...current, log: [...current.log, msg] }];
      });
    };

    let fixed = 0;
    for (const f of fixes) {
      try {
        await sistemasService.update(f.sistemaId, { establecimientoId: f.newEstId });
        fixed++;
        if (fixed % 20 === 0) addLog(`${fixed}/${fixes.length} reasignados...`);
      } catch (e) {
        addLog(`Error en ${f.sistemaId}: ${e}`);
      }
    }
    addLog(`Reasignacion completa: ${fixed} sistemas actualizados.`);
    updateState({ status: 'done', fixes: [] });
  };

  const handleClear = () => {
    bg.clearTask(REPAIR_TASK_ID);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-800 mb-2">Reasignar sistemas a establecimientos</h2>
      <p className="text-xs text-slate-500 mb-3">
        Busca sistemas sin establecimiento asignado y los liga al establecimiento correcto del cliente.
        Para clientes con un solo establecimiento se asigna automaticamente.
        Para clientes con multiples establecimientos se lista para revision manual.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={scan}
          disabled={isRunning || status === 'fixing'}
          className="px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {isRunning ? 'Escaneando...' : 'Escanear sistemas'}
        </button>
        {fixes.length > 0 && status === 'scanned' && (
          <button
            onClick={applyFixes}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Reasignar {fixes.length} sistemas
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

      {fixes.length > 0 && status === 'scanned' && (
        <div className="mt-3 max-h-48 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-500 border-b">
                <th className="text-center py-1 pr-2">Sistema</th>
                <th className="text-center py-1 pr-2">Establecimiento destino</th>
              </tr>
            </thead>
            <tbody>
              {fixes.map((f, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1 pr-2 text-slate-600">{f.sistemaNombre}</td>
                  <td className="py-1 text-emerald-700 font-medium">{f.newEstNombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-3 bg-slate-900 rounded-lg p-3 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
          {log.map((line, i) => (
            <div key={i} className={line.startsWith('SKIP') ? 'text-amber-400' : line.startsWith('MANUAL') ? 'text-yellow-300' : line.startsWith('---') ? 'text-teal-400' : ''}>
              {line}
            </div>
          ))}
          {(isRunning || status === 'fixing') && (
            <div className="text-teal-400 animate-pulse mt-1">Procesando...</div>
          )}
        </div>
      )}

      {status === 'done' && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs font-medium text-emerald-800">Reasignacion completada.</p>
        </div>
      )}
    </div>
  );
}
