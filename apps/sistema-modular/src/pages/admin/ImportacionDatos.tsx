import { useRef, useState } from 'react';
import { useExcelMigration, type ValidationIssue, type MigrationSummary } from '../../hooks/useExcelMigration';
import { useStockMigration, type StockMigrationSummary } from '../../hooks/useStockMigration';
import { useConceptosMigration, type ConceptosMigrationSummary } from '../../hooks/useConceptosMigration';
import { useStockPosicionesMigration, type PosicionesMigrationSummary } from '../../hooks/useStockPosicionesMigration';
import { useStockUnidadesMigration } from '../../hooks/useStockUnidadesMigration';
import { DedupModulos } from './migraciones/DedupModulos';
import { RepairSistemaEstablecimiento } from './migraciones/RepairSistemaEstablecimiento';
import { UnificarSistemasDuplicados } from './migraciones/UnificarSistemasDuplicados';

type ImportMode = 'clientes' | 'stock' | 'conceptos' | 'posiciones' | 'unidades' | 'limpieza';

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


function ConceptosImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { step, data, errors, warnings, summary, progressLog, errorMessage, parseFile, execute, reset } = useConceptosMigration();

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
          El archivo debe tener una hoja con columnas: <span className="font-medium">Codigo</span> (opcional), <span className="font-medium">Descripcion</span> (requerida).
          Los conceptos se crearan con <span className="font-medium">valor base 0 USD</span>, <span className="font-medium">factor 1</span> y categoria <span className="font-medium">"Iva 21%"</span>.
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
            <p className="text-2xl font-bold text-teal-700">{data.conceptos.length}</p>
            <p className="text-[11px] text-teal-600 font-medium">Conceptos</p>
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
        <ExecuteSection canExecute={canExecute} step={step} execute={execute} progressLog={progressLog} summary={summary} summaryKeys={['conceptos']} />
      )}

      {step === 'error' && <ErrorCard message={errorMessage} />}

      {step === 'idle' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Formato del Excel</h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div>
              <p className="font-medium text-slate-700 mb-1">Hoja "Conceptos" (o la primera hoja)</p>
              <p className="text-[11px] text-slate-500">Columnas: Codigo | Descripcion</p>
            </div>
            <div className="mt-2 p-2 bg-slate-50 rounded text-[11px] text-slate-500">
              Los conceptos existentes se detectan por codigo y no se duplican.
              Si el codigo esta vacio, el concepto se crea igual (sin posibilidad de dedup).
              La categoria <strong>"Iva 21%"</strong> debe existir en el catalogo de categorias de presupuesto.
              Si no se encuentra, los conceptos se crean sin categoria asignada y podras completarla manualmente.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PosicionesImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { step, data, errors, warnings, summary, progressLog, errorMessage, parseFile, execute, reset } = useStockPosicionesMigration();

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
          Columnas: <span className="font-medium">Codigo</span>, <span className="font-medium">Descripcion</span>, <span className="font-medium">Tipo</span> (cajonera/estante/deposito/vitrina/otro), <span className="font-medium">Posicion padre</span> (codigo del padre, opcional) y <span className="font-medium">Zona</span> (opcional).
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
            <p className="text-2xl font-bold text-teal-700">{data.posiciones.length}</p>
            <p className="text-[11px] text-teal-600 font-medium">Posiciones</p>
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
        <ExecuteSection canExecute={canExecute} step={step} execute={execute} progressLog={progressLog} summary={summary} summaryKeys={['posiciones']} />
      )}

      {step === 'error' && <ErrorCard message={errorMessage} />}

      {step === 'idle' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Formato del Excel</h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div>
              <p className="font-medium text-slate-700 mb-1">Hoja "Posiciones" (o la primera hoja)</p>
              <p className="text-[11px] text-slate-500">Columnas: Codigo | Descripcion | Tipo | Posicion padre | Zona</p>
            </div>
            <div className="mt-2 p-2 bg-slate-50 rounded text-[11px] text-slate-500">
              Las posiciones existentes se detectan por <strong>codigo</strong> y no se duplican.
              La <strong>Descripcion</strong> se guarda como nombre (display).
              El <strong>Tipo</strong> debe ser uno de: cajonera, estante, deposito, vitrina, otro (case-insensitive, acepta tildes).
              La <strong>Posicion padre</strong> se resuelve por codigo — el padre puede estar en el mismo Excel o ya en Firestore.
              Si no se encuentra el padre, la posicion queda como raiz (sin padre).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnidadesImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    step, data, errors, warnings, summary, previewCounts, progressLog, errorMessage,
    tag, setTag, wipePrevious, setWipePrevious,
    parseFile, execute, reset,
  } = useStockUnidadesMigration();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const canExecute = step === 'validated' && errors.length === 0 && tag.trim().length > 0;
  const isWorking = step === 'parsing' || step === 'validating' || step === 'writing';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">1. Seleccionar archivo Excel</h2>
        <p className="text-xs text-slate-500 mb-3">
          Columnas: <span className="font-medium">Código Depósito</span>, <span className="font-medium">Nombre Depósito</span> (informativo), <span className="font-medium">Código Artículo</span>, <span className="font-medium">Descripción</span> (informativo), <span className="font-medium">Cantidad</span>, <span className="font-medium">Nro. Serie</span> (opcional).
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
          <h2 className="text-sm font-semibold text-slate-800 mb-3">2. Datos leídos</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-teal-700">{data.unidades.length}</p>
              <p className="text-[11px] text-teal-600 font-medium">Filas en Excel</p>
            </div>
            {previewCounts && (
              <>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{previewCounts.unidadesACrear}</p>
                  <p className="text-[11px] text-emerald-600 font-medium">Unidades a crear</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{previewCounts.filasSinAsignar}</p>
                  <p className="text-[11px] text-amber-600 font-medium">Filas → SIN_ASIGNAR</p>
                </div>
              </>
            )}
          </div>
          <IssueTable title="Errores (bloquean filas individuales)" issues={errors} color="red" />
          <IssueTable title="Advertencias (no bloquean)" issues={warnings} color="amber" />
          {errors.length === 0 && step === 'validated' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-3">
              <p className="text-xs font-medium text-emerald-800">Validación exitosa. Configurá el tag y ejecutá la importación.</p>
            </div>
          )}
        </div>
      )}

      {(step === 'validated' || step === 'writing' || step === 'done') && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">3. Ejecutar importación</h2>
          <div className="space-y-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] uppercase tracking-wide font-mono text-slate-500 mb-1">Tag de tanda *</label>
                <input
                  type="text"
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                  disabled={step !== 'validated'}
                  placeholder="v1"
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs w-32 disabled:opacity-50 disabled:bg-slate-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">Se guarda como createdBy: <code>migracion-stock-{`{tag}`}</code></p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={wipePrevious}
                  onChange={e => setWipePrevious(e.target.checked)}
                  disabled={step !== 'validated'}
                  className="w-3.5 h-3.5 accent-amber-600 disabled:opacity-50"
                />
                Borrar unidades previas con este tag antes de importar
              </label>
            </div>
            {canExecute && (
              <div className="flex items-center gap-3">
                <button
                  onClick={execute}
                  className="px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Importar a Firestore
                </button>
                {wipePrevious && (
                  <p className="text-[11px] text-amber-600 font-medium">⚠ Se borrarán todas las unidades con tag "{tag.trim()}" antes de importar</p>
                )}
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
                <p className="text-sm font-semibold text-emerald-800 mb-2">Migración completada</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Filas</p>
                    <p className="text-lg font-bold text-slate-700">{summary.filas}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Unidades creadas</p>
                    <p className="text-lg font-bold text-emerald-700">{summary.unidadesCreadas}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Filas bloqueadas</p>
                    <p className="text-lg font-bold text-red-700">{summary.filasBloqueadas}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Filas SIN_ASIGNAR</p>
                    <p className="text-lg font-bold text-amber-700">{summary.filasSinAsignar}</p>
                  </div>
                  {summary.filasWipeadas > 0 && (
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Wipe previo</p>
                      <p className="text-lg font-bold text-slate-600">{summary.filasWipeadas}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'error' && <ErrorCard message={errorMessage} />}

      {step === 'idle' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Formato del Excel y reglas</h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div>
              <p className="font-medium text-slate-700 mb-1">Columnas esperadas (primera hoja)</p>
              <p className="text-[11px] text-slate-500">Código Depósito | Nombre Depósito | Código Artículo | Descripción | Cantidad | Nro. Serie</p>
            </div>
            <div className="mt-2 p-2 bg-slate-50 rounded text-[11px] text-slate-500 space-y-1">
              <p><strong>Nombre Depósito</strong> y <strong>Descripción</strong> son informativos — se usa el nombre del catálogo en Firestore.</p>
              <p>Si <strong>Nro. Serie</strong> viene → se crea <strong>1 unidad</strong> con ese serie (Cantidad debe ser 1 o vacía).</p>
              <p>Si <strong>Nro. Serie</strong> está vacío → se crean <strong>N unidades</strong> sin serie según <strong>Cantidad</strong>.</p>
              <p>Si el <strong>Código Depósito</strong> no se encuentra en posiciones → la unidad cae en la posición especial <code>SIN_ASIGNAR</code> (creada automáticamente).</p>
              <p>Si el <strong>Código Artículo</strong> no existe en el catálogo → la fila se bloquea.</p>
              <p>Defaults: <code>condicion: 'nuevo'</code>, <code>estado: 'disponible'</code>, costo y observaciones quedan vacíos.</p>
            </div>
          </div>
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
  summary: MigrationSummary | StockMigrationSummary | ConceptosMigrationSummary | PosicionesMigrationSummary | null;
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
              const val = (summary as unknown as Record<string, { created: number; skipped: number }>)[key];
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
  { key: 'conceptos', label: 'Conceptos de presupuesto', description: 'Catalogo de conceptos de servicio' },
  { key: 'posiciones', label: 'Posiciones de stock', description: 'Posiciones fisicas de almacenamiento' },
  { key: 'unidades', label: 'Stock (cantidades)', description: 'Unidades de stock en sus posiciones' },
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
        {mode === 'clientes' ? <ClientesImport /> : mode === 'stock' ? <StockImport /> : mode === 'conceptos' ? <ConceptosImport /> : mode === 'posiciones' ? <PosicionesImport /> : mode === 'unidades' ? <UnidadesImport /> : <LimpiezaTools />}
      </div>
    </div>
  );
}
