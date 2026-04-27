import { useCallback, useState } from 'react';
import { collection, getDocs, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useBackgroundTasks } from '../../../contexts/BackgroundTasksContext';
import { useConfirm } from '../../../components/ui/ConfirmDialog';

interface DupSistemaGroup {
  key: string;          // nombre+clienteId
  nombre: string;
  clienteId: string;
  clienteNombre: string;
  sistemas: {
    id: string;
    nombre: string;
    codigoInterno: string;
    establecimientoId: string;
    moduloCount: number;
    modulos: { id: string; nombre: string; serie: string; data: Record<string, unknown> }[];
  }[];
  masterId: string;     // el que se queda (el que tiene más módulos)
}

interface UnifyTaskState {
  status: 'scanning' | 'scanned' | 'merging' | 'done';
  log: string[];
  groups: DupSistemaGroup[];
}

const UNIFY_TASK_ID = 'unify-sistemas';

export function UnificarSistemasDuplicados() {
  const confirm = useConfirm();
  const bg = useBackgroundTasks();
  const task = bg.getTask<UnifyTaskState>(UNIFY_TASK_ID);

  const taskData = task?.rows?.[0];
  const status = taskData?.status ?? 'idle';
  const log = taskData?.log ?? [];
  const groups = taskData?.groups ?? [];
  const isRunning = task?.running ?? false;

  // Local state for master selection changes
  const [masterOverrides, setMasterOverrides] = useState<Record<string, string>>({});

  const updateState = useCallback((partial: Partial<UnifyTaskState>) => {
    bg.updateRows<UnifyTaskState>(UNIFY_TASK_ID, prev => {
      const current = prev[0] || { status: 'scanning', log: [], groups: [] };
      return [{ ...current, ...partial }];
    });
  }, [bg]);

  const scan = async () => {
    bg.startTask<UnifyTaskState>(UNIFY_TASK_ID, [{ status: 'scanning', log: [], groups: [] }], 1);
    setMasterOverrides({});

    const addLog = (msg: string) => {
      bg.updateRows<UnifyTaskState>(UNIFY_TASK_ID, prev => {
        const current = prev[0];
        return [{ ...current, log: [...current.log, msg] }];
      });
    };

    addLog('Cargando sistemas...');
    const sistemasSnap = await getDocs(collection(db, 'sistemas'));
    const allSistemas = sistemasSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: (data.nombre || '') as string,
        clienteId: (data.clienteId || data.clienteCuit || '') as string,
        establecimientoId: (data.establecimientoId || '') as string,
        codigoInterno: (data.codigoInternoCliente || '') as string,
      };
    });
    addLog(`${allSistemas.length} sistemas encontrados.`);

    // Cargar nombres de clientes
    addLog('Cargando clientes...');
    const clientesSnap = await getDocs(collection(db, 'clientes'));
    const clienteNames = new Map<string, string>();
    clientesSnap.docs.forEach(d => {
      const data = d.data();
      clienteNames.set(d.id, (data.razonSocial || d.id) as string);
    });

    // Agrupar por nombre + clienteId + codigoInterno
    // Si tienen distinto código interno, son equipos diferentes (ej: HPLC 1100 con EV-001 vs CC-003)
    const byKey = new Map<string, typeof allSistemas>();
    for (const s of allSistemas) {
      if (!s.nombre || !s.clienteId) continue;
      const code = s.codigoInterno.trim().toLowerCase();
      const key = `${s.nombre.trim().toLowerCase()}|${s.clienteId}|${code}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(s);
    }

    // Filtrar solo grupos con duplicados
    const dupGroups = [...byKey.entries()].filter(([, arr]) => arr.length > 1);
    addLog(`${dupGroups.length} grupos de sistemas duplicados encontrados.`);

    if (dupGroups.length === 0) {
      updateState({ status: 'scanned', groups: [] });
      addLog('No hay sistemas duplicados.');
      bg.finishTask(UNIFY_TASK_ID);
      return;
    }

    // Para cada grupo, cargar módulos
    addLog('Cargando módulos de sistemas duplicados...');
    const resultGroups: DupSistemaGroup[] = [];
    let processed = 0;

    for (const [key, sistemas] of dupGroups) {
      if (bg.isCancelled(UNIFY_TASK_ID)) break;

      const parts = key.split('|');
      const clienteId = parts[1];
      const sistemasWithModulos = [];

      for (const s of sistemas) {
        const modulosSnap = await getDocs(collection(db, 'sistemas', s.id, 'modulos'));
        const modulos = modulosSnap.docs.map(d => ({
          id: d.id,
          nombre: (d.data().nombre || '') as string,
          serie: (d.data().serie || '') as string,
          data: d.data() as Record<string, unknown>,
        }));
        sistemasWithModulos.push({
          ...s,
          moduloCount: modulos.length,
          modulos,
        });
      }

      // Master = el que tiene más módulos, desempate por ID más corto (suele ser el original)
      sistemasWithModulos.sort((a, b) => b.moduloCount - a.moduloCount || a.id.length - b.id.length);
      const masterId = sistemasWithModulos[0].id;

      resultGroups.push({
        key,
        nombre: sistemas[0].nombre,
        clienteId,
        clienteNombre: clienteNames.get(clienteId) || clienteId,
        sistemas: sistemasWithModulos,
        masterId,
      });

      processed++;
      if (processed % 10 === 0) addLog(`${processed}/${dupGroups.length} grupos procesados...`);
    }

    updateState({ status: 'scanned', groups: resultGroups });
    const totalDups = resultGroups.reduce((sum, g) => sum + g.sistemas.length - 1, 0);
    addLog(`Escaneo completo: ${resultGroups.length} grupos, ${totalDups} sistemas duplicados para unificar.`);
    bg.finishTask(UNIFY_TASK_ID);
  };

  const getMasterId = (group: DupSistemaGroup) => masterOverrides[group.key] || group.masterId;

  const merge = async () => {
    const totalDups = groups.reduce((sum, g) => sum + g.sistemas.length - 1, 0);
    if (!await confirm(`¿Unificar ${groups.length} grupo(s) de sistemas?\n\n` +
      `Se moverán módulos al sistema maestro y se eliminarán ${totalDups} sistema(s) duplicado(s).\n\n` +
      `Esta acción no se puede deshacer.`)) return;

    updateState({ status: 'merging' });

    const addLog = (msg: string) => {
      bg.updateRows<UnifyTaskState>(UNIFY_TASK_ID, prev => {
        const current = prev[0];
        return [{ ...current, log: [...current.log, msg] }];
      });
    };

    let movedModulos = 0;
    let deletedSistemas = 0;

    for (const group of groups) {
      const masterId = getMasterId(group);
      const master = group.sistemas.find(s => s.id === masterId)!;
      const duplicates = group.sistemas.filter(s => s.id !== masterId);

      addLog(`--- ${group.nombre} (${group.clienteNombre}) → maestro: ${master.codigoInterno || master.id}`);

      // Obtener series ya existentes en el maestro para no duplicar
      const masterSeries = new Set(master.modulos.map(m => m.serie?.trim().toLowerCase()).filter(Boolean));

      for (const dup of duplicates) {
        // Mover módulos del duplicado al maestro
        for (const mod of dup.modulos) {
          const serieKey = mod.serie?.trim().toLowerCase();
          if (serieKey && masterSeries.has(serieKey)) {
            addLog(`  SKIP módulo "${mod.nombre}" S/N:${mod.serie} (ya existe en maestro)`);
            // Borrar el duplicado del módulo
            try {
              await deleteDoc(doc(db, 'sistemas', dup.id, 'modulos', mod.id));
            } catch (e) { /* ignore */ }
            continue;
          }

          try {
            // Crear en maestro
            const { ...modData } = mod.data;
            modData.sistemaId = masterId;
            await addDoc(collection(db, 'sistemas', masterId, 'modulos'), modData);
            // Borrar del duplicado
            await deleteDoc(doc(db, 'sistemas', dup.id, 'modulos', mod.id));
            movedModulos++;
            if (serieKey) masterSeries.add(serieKey);
          } catch (e) {
            addLog(`  ERROR moviendo módulo ${mod.id}: ${e}`);
          }
        }

        // Verificar que el sistema duplicado quedó vacío
        const remainingSnap = await getDocs(collection(db, 'sistemas', dup.id, 'modulos'));
        if (remainingSnap.empty) {
          try {
            await deleteDoc(doc(db, 'sistemas', dup.id));
            deletedSistemas++;
            addLog(`  Eliminado sistema duplicado ${dup.codigoInterno || dup.id}`);
          } catch (e) {
            addLog(`  ERROR eliminando sistema ${dup.id}: ${e}`);
          }
        } else {
          addLog(`  WARN: sistema ${dup.id} aún tiene ${remainingSnap.size} módulos, no se eliminó`);
        }
      }
    }

    addLog(`===`);
    addLog(`Unificación completa: ${movedModulos} módulos movidos, ${deletedSistemas} sistemas eliminados.`);
    updateState({ status: 'done', groups: [] });
  };

  const handleClear = () => {
    bg.clearTask(UNIFY_TASK_ID);
    setMasterOverrides({});
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-800 mb-2">Unificar sistemas duplicados</h2>
      <p className="text-xs text-slate-500 mb-3">
        Detecta sistemas con el mismo nombre para el mismo cliente. Unifica sus módulos bajo un solo sistema (maestro) y elimina los duplicados vacíos.
        Podés elegir cuál es el maestro para cada grupo.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={scan}
          disabled={isRunning || status === 'merging'}
          className="px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {isRunning ? 'Escaneando...' : 'Escanear duplicados'}
        </button>
        {groups.length > 0 && status === 'scanned' && (
          <button
            onClick={merge}
            className="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Unificar {groups.length} grupo(s)
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

      {groups.length > 0 && status === 'scanned' && (
        <div className="mt-3 space-y-3 max-h-[500px] overflow-y-auto">
          {groups.map(group => {
            const currentMaster = getMasterId(group);
            return (
              <div key={group.key} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-800">{group.nombre}</span>
                    <span className="text-[11px] text-slate-400 ml-2">{group.clienteNombre}</span>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {group.sistemas.length} duplicados
                  </span>
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-400 border-b">
                      <th className="text-center py-1 w-8">Maestro</th>
                      <th className="text-center py-1 pr-2">Código</th>
                      <th className="text-center py-1 pr-2">Establecimiento</th>
                      <th className="text-center py-1 pr-2">Módulos</th>
                      <th className="text-center py-1">Detalle módulos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sistemas.map(s => (
                      <tr key={s.id} className={`border-b border-slate-50 ${s.id === currentMaster ? 'bg-emerald-50' : ''}`}>
                        <td className="py-1">
                          <input
                            type="radio"
                            name={`master-${group.key}`}
                            checked={s.id === currentMaster}
                            onChange={() => setMasterOverrides(prev => ({ ...prev, [group.key]: s.id }))}
                            className="w-3.5 h-3.5"
                          />
                        </td>
                        <td className="py-1 pr-2 font-mono text-slate-700">{s.codigoInterno || <span className="text-slate-300 italic">sin código</span>}</td>
                        <td className="py-1 pr-2 text-slate-500 truncate max-w-[150px]">{s.establecimientoId ? s.establecimientoId.slice(0, 12) + '...' : '—'}</td>
                        <td className="py-1 pr-2 text-center font-semibold">{s.moduloCount}</td>
                        <td className="py-1 text-slate-400 truncate max-w-[200px]">
                          {s.modulos.length > 0
                            ? s.modulos.map(m => m.serie ? `${m.nombre}(${m.serie})` : m.nombre).join(', ')
                            : <span className="italic">vacío</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-3 bg-slate-900 rounded-lg p-3 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
          {log.map((line, i) => (
            <div key={i} className={
              line.startsWith('  SKIP') ? 'text-amber-400' :
              line.startsWith('  ERROR') ? 'text-red-400' :
              line.startsWith('  WARN') ? 'text-yellow-300' :
              line.startsWith('---') ? 'text-teal-400' :
              line.startsWith('===') ? 'text-emerald-400 font-medium' : ''
            }>
              {line}
            </div>
          ))}
          {(isRunning || status === 'merging') && (
            <div className="text-teal-400 animate-pulse mt-1">Procesando...</div>
          )}
        </div>
      )}

      {status === 'done' && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs font-medium text-emerald-800">Unificación completada.</p>
        </div>
      )}
    </div>
  );
}
