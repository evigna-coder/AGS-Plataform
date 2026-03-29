import { useRef, useState, useCallback } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useExcelMigration, type ValidationIssue } from '../../hooks/useExcelMigration';
import { useStockMigration } from '../../hooks/useStockMigration';
import { useBackgroundTasks } from '../../contexts/BackgroundTasksContext';

type ImportMode = 'clientes' | 'stock' | 'limpieza';

function IssueTable({ title, issues, color }: { title: string; issues: ValidationIssue[]; color: 'red' | 'amber' }) {
  if (issues.length === 0) return null;
  const bg = color === 'red' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const text = color === 'red' ? 'text-red-800' : 'text-amber-800';
  const textSub = color === 'red' ? 'text-red-700' : 'text-amber-700';
  return (
    <div className={`${bg} border rounded-lg p-3 mt-3`}>
      <p className={`text-xs font-medium ${text}`}>{title} ({issues.length})</p>
      <div className="mt-2 max-h-48 overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className={`${textSub} border-b border-current/20`}>
              <th className="text-center py-1 pr-2 w-28">Hoja</th>
              <th className="text-center py-1 pr-2 w-12">Fila</th>
              <th className="text-center py-1 pr-2 w-32">Columna</th>
              <th className="text-center py-1">Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, i) => (
              <tr key={i} className={`${textSub} border-b border-current/10`}>
                <td className="py-1 pr-2">{issue.sheet}</td>
                <td className="py-1 pr-2">{issue.row}</td>
                <td className="py-1 pr-2">{issue.column}</td>
                <td className="py-1">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientesImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { step, data, errors, warnings, summary, progressLog, errorMessage, parseFile, execute, reset } = useExcelMigration();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const canExecute = step === 'validated' && errors.length === 0;
  const isWorking = step === 'parsing' || step === 'validating' || step === 'writing';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">1. Seleccionar archivo Excel</h2>
        <p className="text-xs text-slate-500 mb-3">
          El archivo debe tener 4 hojas: <span className="font-medium">Clientes</span>, <span className="font-medium">Establecimientos</span>, <span className="font-medium">Sistemas</span>, <span className="font-medium">Modulos</span>.
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isWorking}
            className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer disabled:opacity-50"
          />
          {step !== 'idle' && (
            <button onClick={() => { reset(); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
              Reiniciar
            </button>
          )}
        </div>
      </div>

      {data && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">2. Datos leidos</h2>
          <div className="grid grid-cols-4 gap-3">
            {([
              ['Clientes', data.clientes.length, 'teal'],
              ['Establecimientos', data.establecimientos.length, 'emerald'],
              ['Sistemas', data.sistemas.length, 'amber'],
              ['Modulos', data.modulos.length, 'slate'],
            ] as const).map(([label, count, color]) => (
              <div key={label} className={`bg-${color}-50 rounded-lg p-3 text-center`}>
                <p className={`text-2xl font-bold text-${color}-700`}>{count}</p>
                <p className={`text-[11px] text-${color}-600 font-medium`}>{label}</p>
              </div>
            ))}
          </div>
          <IssueTable title="Errores (bloquean la importacion)" issues={errors} color="red" />
          <IssueTable title="Advertencias (no bloquean)" issues={warnings} color="amber" />
          {errors.length === 0 && step === 'validated' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-3">
              <p className="text-xs font-medium text-emerald-800">Validacion exitosa. Listo para importar.</p>
            </div>
          )}
        </div>
      )}

      {(canExecute || step === 'writing' || step === 'done') && (
        <ExecuteSection canExecute={canExecute} step={step} execute={execute} progressLog={progressLog} summary={summary} summaryKeys={['clientes', 'establecimientos', 'sistemas', 'modulos']} />
      )}

      {step === 'error' && <ErrorCard message={errorMessage} />}

      {step === 'idle' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Formato del Excel</h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div>
              <p className="font-medium text-slate-700 mb-1">Hoja "Clientes"</p>
              <p className="text-[11px] text-slate-500">Columnas: CUIT | Razon Social | Pais | Rubro | Direccion Fiscal | Localidad | Provincia | Condicion IVA | Notas</p>
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-1">Hoja "Establecimientos"</p>
              <p className="text-[11px] text-slate-500">Columnas: CUIT Cliente | Nombre | Direccion | Localidad | Provincia | Codigo Postal | Tipo | Latitud | Longitud</p>
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-1">Hoja "Sistemas"</p>
              <p className="text-[11px] text-slate-500">Columnas: CUIT Cliente | Establecimiento | Categoria ID | Nombre Sistema | Codigo Interno | Software | Observaciones | GC Puerto Front | GC Puerto Back | GC Detector Front | GC Detector Back</p>
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-1">Hoja "Modulos"</p>
              <p className="text-[11px] text-slate-500">Columnas: CUIT Cliente | Establecimiento | Codigo Sistema | Nombre Modulo | Numero Serie | Firmware | Marca | Observaciones</p>
            </div>
            <div className="mt-2 p-2 bg-slate-50 rounded text-[11px] text-slate-500">
              Los registros existentes en Firestore se detectan automaticamente y no se duplican.
              El CUIT es la clave de deduplicacion para clientes, CUIT+Nombre para establecimientos,
              CUIT+Codigo para sistemas, y Sistema+Serie para modulos.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { step, data, errors, warnings, summary, progressLog, errorMessage, parseFile, execute, reset } = useStockMigration();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const canExecute = step === 'validated' && errors.length === 0;
  const isWorking = step === 'parsing' || step === 'validating' || step === 'writing';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">1. Seleccionar archivo Excel</h2>
        <p className="text-xs text-slate-500 mb-3">
          El archivo debe tener una hoja con columnas: <span className="font-medium">Codigo</span> (o Nro. de Parte), <span className="font-medium">Descripcion</span>, <span className="font-medium">Posicion Arancelaria</span>, <span className="font-medium">Marca</span>, <span className="font-medium">Origen</span> (opcional).
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isWorking}
            className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer disabled:opacity-50"
          />
          {step !== 'idle' && (
            <button onClick={() => { reset(); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
              Reiniciar
            </button>
          )}
        </div>
      </div>

      {data && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">2. Datos leidos</h2>
          <div className="bg-teal-50 rounded-lg p-3 text-center inline-block min-w-[120px]">
            <p className="text-2xl font-bold text-teal-700">{data.articulos.length}</p>
            <p className="text-[11px] text-teal-600 font-medium">Articulos</p>
          </div>
          <IssueTable title="Errores (bloquean la importacion)" issues={errors} color="red" />
          <IssueTable title="Advertencias (no bloquean)" issues={warnings} color="amber" />
          {errors.length === 0 && step === 'validated' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-3">
              <p className="text-xs font-medium text-emerald-800">Validacion exitosa. Listo para importar.</p>
            </div>
          )}
        </div>
      )}

      {(canExecute || step === 'writing' || step === 'done') && (
        <ExecuteSection canExecute={canExecute} step={step} execute={execute} progressLog={progressLog} summary={summary} summaryKeys={['articulos']} />
      )}

      {step === 'error' && <ErrorCard message={errorMessage} />}

      {step === 'idle' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Formato del Excel</h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div>
              <p className="font-medium text-slate-700 mb-1">Hoja "Articulos" o "Stock" (o la primera hoja)</p>
              <p className="text-[11px] text-slate-500">Columnas: Codigo (o Nro. de Parte) | Descripcion | Posicion Arancelaria | Marca | Origen</p>
            </div>
            <div className="mt-2 p-2 bg-slate-50 rounded text-[11px] text-slate-500">
              Los articulos existentes se detectan por codigo y no se duplican.
              Los campos Posicion Arancelaria y Marca son opcionales.
              El resto de los datos del articulo (categoria, proveedor, stock, etc.) se completan desde el sistema.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

function DedupModulos() {
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
    if (!confirm(`¿Eliminar ${duplicates.length} modulo(s) duplicados?\n\nEsta acción no se puede deshacer.`)) return;
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

function RepairSistemaEstablecimiento() {
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

    addLog('Cargando sistemas y establecimientos...');

    const sistemasSnap = await getDocs(collection(db, 'sistemas'));
    const sistemas = sistemasSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: (data.nombre || '') as string,
        establecimientoId: (data.establecimientoId || '') as string,
        clienteId: (data.clienteId || data.clienteCuit || '') as string,
      };
    });
    addLog(`${sistemas.length} sistemas cargados.`);

    const sinEstablecimiento = sistemas.filter(s => !s.establecimientoId);
    addLog(`${sinEstablecimiento.length} sistemas sin establecimiento asignado.`);

    if (sinEstablecimiento.length === 0) {
      addLog('Verificando establecimientos asignados...');
      const estSnap = await getDocs(collection(db, 'establecimientos'));
      const estIds = new Set(estSnap.docs.map(d => d.id));
      const invalidos = sistemas.filter(s => s.establecimientoId && !estIds.has(s.establecimientoId));
      if (invalidos.length === 0) {
        addLog('Todos los sistemas tienen establecimiento válido.');
        updateState({ status: 'scanned' });
        bg.finishTask(REPAIR_TASK_ID);
        return;
      }
      addLog(`${invalidos.length} sistemas con establecimientoId inválido.`);
    }

    const estSnap = await getDocs(collection(db, 'establecimientos'));
    const establecimientos = estSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: (data.nombre || '') as string,
        clienteCuit: (data.clienteCuit || data.clienteId || '') as string,
      };
    });
    addLog(`${establecimientos.length} establecimientos cargados.`);

    const estByCliente = new Map<string, typeof establecimientos>();
    for (const e of establecimientos) {
      if (!e.clienteCuit) continue;
      if (!estByCliente.has(e.clienteCuit)) estByCliente.set(e.clienteCuit, []);
      estByCliente.get(e.clienteCuit)!.push(e);
    }

    const pendingFixes: RepairFix[] = [];
    const problemSistemas = sistemas.filter(s => !s.establecimientoId || s.establecimientoId === '');

    for (const s of problemSistemas) {
      if (bg.isCancelled(REPAIR_TASK_ID)) break;
      if (!s.clienteId) {
        addLog(`SKIP: Sistema "${s.nombre}" (${s.id}) sin clienteId`);
        continue;
      }
      const clienteEstabs = estByCliente.get(s.clienteId) || [];
      if (clienteEstabs.length === 0) {
        addLog(`SKIP: Sistema "${s.nombre}" - cliente ${s.clienteId} sin establecimientos`);
        continue;
      }
      if (clienteEstabs.length === 1) {
        pendingFixes.push({
          sistemaId: s.id,
          sistemaNombre: s.nombre,
          clienteId: s.clienteId,
          oldEstId: s.establecimientoId,
          newEstId: clienteEstabs[0].id,
          newEstNombre: clienteEstabs[0].nombre,
        });
      } else {
        addLog(`MANUAL: Sistema "${s.nombre}" - cliente tiene ${clienteEstabs.length} establecimientos: ${clienteEstabs.map(e => e.nombre).join(', ')}`);
      }
    }

    updateState({ status: 'scanned', fixes: pendingFixes });
    addLog(`---`);
    addLog(`${pendingFixes.length} sistemas se pueden reasignar automaticamente (clientes con 1 solo establecimiento).`);
    addLog(`Los sistemas de clientes con multiples establecimientos requieren asignacion manual.`);
    bg.finishTask(REPAIR_TASK_ID);
  };

  const applyFixes = async () => {
    if (!confirm(`¿Reasignar ${fixes.length} sistema(s) a su establecimiento correcto?`)) return;
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
        await updateDoc(doc(db, 'sistemas', f.sistemaId), { establecimientoId: f.newEstId });
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

function UnificarSistemasDuplicados() {
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
    if (!confirm(`¿Unificar ${groups.length} grupo(s) de sistemas?\n\n` +
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

function LimpiezaTools() {
  return (
    <div className="space-y-4">
      <UnificarSistemasDuplicados />
      <RepairSistemaEstablecimiento />
      <DedupModulos />
    </div>
  );
}

function ExecuteSection({ canExecute, step, execute, progressLog, summary, summaryKeys }: {
  canExecute: boolean;
  step: string;
  execute: () => void;
  progressLog: string[];
  summary: Record<string, { created: number; skipped: number }> | null;
  summaryKeys: string[];
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-800 mb-3">3. Ejecutar importacion</h2>
      {canExecute && (
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={execute}
            className="px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            Importar a Firestore
          </button>
          <p className="text-[11px] text-slate-400">Los registros existentes se omiten automaticamente (no se duplican).</p>
        </div>
      )}
      {progressLog.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-3 font-mono text-[11px] text-slate-300 max-h-64 overflow-y-auto">
          {progressLog.map((line, i) => (
            <div key={i} className={line.startsWith('ERROR') ? 'text-red-400' : line.startsWith('---') ? 'text-teal-400 font-medium' : ''}>
              {line}
            </div>
          ))}
          {step === 'writing' && (
            <div className="text-teal-400 animate-pulse mt-1">Procesando...</div>
          )}
        </div>
      )}
      {summary && step === 'done' && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-2">Migracion completada</p>
          <div className={`grid grid-cols-${summaryKeys.length} gap-3`}>
            {summaryKeys.map(key => {
              const val = (summary as Record<string, { created: number; skipped: number }>)[key];
              if (!val) return null;
              return (
                <div key={key} className="text-center">
                  <p className="text-xs font-medium text-slate-700 capitalize">{key}</p>
                  <p className="text-lg font-bold text-emerald-700">{val.created}</p>
                  <p className="text-[10px] text-slate-500">creados</p>
                  {val.skipped > 0 && (
                    <p className="text-[10px] text-amber-600">{val.skipped} existentes</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <p className="text-xs font-medium text-red-800">Error</p>
      <p className="text-xs text-red-700 mt-1">{message}</p>
    </div>
  );
}

const TABS: { key: ImportMode; label: string; description: string }[] = [
  { key: 'clientes', label: 'Clientes y Sistemas', description: 'Clientes, Establecimientos, Sistemas y Modulos' },
  { key: 'stock', label: 'Stock (Articulos)', description: 'Catalogo de articulos y repuestos' },
  { key: 'limpieza', label: 'Limpieza', description: 'Herramientas de limpieza de datos' },
];

export function ImportacionDatos() {
  const [mode, setMode] = useState<ImportMode>('clientes');

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col">
      <div className="shrink-0 bg-white border-b border-slate-200 px-5 pt-4 pb-0">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Importacion de Datos</h1>
        <p className="text-xs text-slate-400 mb-3">Migrar datos desde Excel a Firestore</p>
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md border border-b-0 transition-colors ${
                mode === tab.key
                  ? 'bg-white text-teal-700 border-slate-200'
                  : 'bg-slate-50 text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {mode === 'clientes' ? <ClientesImport /> : mode === 'stock' ? <StockImport /> : <LimpiezaTools />}
      </div>
    </div>
  );
}
