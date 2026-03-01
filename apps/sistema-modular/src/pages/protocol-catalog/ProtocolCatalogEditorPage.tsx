import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTableCatalog } from '../../hooks/useTableCatalog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { TableEditor } from '../../components/protocol-catalog/TableEditor';
import { TablePreview } from '../../components/protocol-catalog/TablePreview';
import { ChecklistEditor } from '../../components/protocol-catalog/ChecklistEditor';
import type { TableCatalogEntry } from '@ags/shared';

const SYS_TYPES = ['HPLC', 'GC', 'UV', 'OSMOMETRO', 'OTRO'];

const SERVICIO_TYPES = [
  'Calibración',
  'Calificación de instalación',
  'Calificación de operación',
  'Calificación de software',
  'Limpieza de fuente de Iones',
  'Mantenimiento preventivo con consumibles',
  'Mantenimiento preventivo sin consumibles',
  'Mantenimiento preventivo sin consumibles, incluye limpieza de módulos',
  'Recalificación post reparación',
];

function emptyEntry(): TableCatalogEntry {
  return {
    id: '',
    name: '',
    description: null,
    sysType: '',
    isDefault: false,
    tableType: 'informational',
    columns: [],
    templateRows: [],
    validationRules: [],
    checklistItems: [],
    tipoServicio: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  };
}

function validateForPublish(entry: TableCatalogEntry): string[] {
  const errors: string[] = [];
  if (!entry.name.trim()) errors.push('Nombre vacío');
  if (!entry.sysType) errors.push('SysType no asignado');
  if (entry.tableType === 'checklist') {
    if (!entry.checklistItems || entry.checklistItems.length === 0)
      errors.push('El checklist no tiene ítems');
    entry.checklistItems?.forEach((item, i) => {
      if (!item.label.trim()) errors.push(`Ítem ${i + 1}: texto vacío`);
    });
  } else if (entry.columns.length === 0) errors.push('La tabla no tiene columnas');
  if (entry.tableType === 'validation') {
    entry.validationRules.forEach((r, i) => {
      if (!r.operator || r.factoryThreshold === '' || !r.targetColumn || !r.valueIfPass || !r.valueIfFail) {
        errors.push(`Regla ${i + 1}: campos incompletos`);
      }
    });
  }
  return errors;
}

export const TableCatalogEditorPage = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { getTable, saveDraft, publishTable, loading } = useTableCatalog();

  const [entry, setEntry] = useState<TableCatalogEntry>(emptyEntry());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (tableId) {
      getTable(tableId).then(data => { if (data) setEntry(data); });
    }
  }, [tableId]);

  const setMeta = (key: keyof TableCatalogEntry, value: any) =>
    setEntry(prev => ({ ...prev, [key]: value }));

  const handleSaveDraft = async () => {
    try {
      const id = await saveDraft(entry);
      if (!entry.id && id) {
        setEntry(prev => ({ ...prev, id }));
        navigate(`/table-catalog/${id}/edit`, { replace: true });
      }
      alert('Borrador guardado correctamente');
    } catch {
      alert('Error al guardar el borrador');
    }
  };

  const handlePublish = async () => {
    const errors = validateForPublish(entry);
    if (errors.length) {
      setValidationErrors(errors);
      if (!confirm(`Hay ${errors.length} advertencia(s).\n\n${errors.join('\n')}\n\n¿Publicar de todas formas?`)) return;
    }
    try {
      const id = await saveDraft(entry);
      const targetId = entry.id || id;
      if (targetId) await publishTable(targetId);
      setEntry(prev => ({ ...prev, id: targetId, status: 'published' }));
      setValidationErrors([]);
      alert('Tabla publicada correctamente');
    } catch {
      alert('Error al publicar la tabla');
    }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      {/* ─── Header sticky ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-3 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              {tableId ? 'Editar Tabla' : 'Nueva Tabla'}
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Estado:{' '}
              {entry.status === 'draft' ? 'Borrador' :
               entry.status === 'published' ? '✅ Publicado' : 'Archivado'}
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/table-catalog')}>← Volver</Button>
            <Button variant="secondary" onClick={handleSaveDraft} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar borrador'}
            </Button>
            <Button onClick={handlePublish} disabled={loading || entry.status === 'published'}>
              Publicar
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Contenido scrollable ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {/* Validation warnings */}
      {validationErrors.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <h4 className="text-xs font-semibold text-yellow-800 tracking-wider uppercase mb-2">Advertencias de publicación</h4>
          <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
            {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Card>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-3 gap-6 items-start">
        {/* Metadata panel — sticky dentro del scroll container */}
        <div className="sticky top-0">
        <Card>
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">Metadatos</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <Input value={entry.name} onChange={e => setMeta('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <Input value={entry.description ?? ''} onChange={e => setMeta('description', e.target.value || null)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de sistema *</label>
              <select value={entry.sysType} onChange={e => setMeta('sysType', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de tabla</label>
              <select value={entry.tableType} onChange={e => setMeta('tableType', e.target.value as TableCatalogEntry['tableType'])}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="informational">Informacional</option>
                <option value="validation">Validación</option>
                <option value="instruments">Instrumentos</option>
                <option value="checklist">Checklist</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input type="checkbox" checked={entry.isDefault}
                onChange={e => setMeta('isDefault', e.target.checked)} />
              Tabla por defecto para este sysType
            </label>

            {/* Tipos de servicio */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Tipos de servicio
                <span className="ml-1 font-normal text-slate-400 normal-case">(uno o más)</span>
              </label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {SERVICIO_TYPES.map(st => {
                  const selected = (entry.tipoServicio ?? []).includes(st);
                  return (
                    <label key={st} className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const current = entry.tipoServicio ?? [];
                          setMeta(
                            'tipoServicio',
                            selected ? current.filter(s => s !== st) : [...current, st]
                          );
                        }}
                        className="mt-0.5 accent-blue-600 shrink-0"
                      />
                      <span className="text-xs text-slate-700 group-hover:text-slate-900 leading-tight">
                        {st}
                      </span>
                    </label>
                  );
                })}
              </div>
              {(entry.tipoServicio ?? []).length === 0 && (
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  Sin asignar — aparecerá en todos los servicios del catálogo.
                </p>
              )}
            </div>
          </div>
        </Card>
        </div>{/* /sticky */}

        {/* Editor panel — tabla o checklist según tipo */}
        <div className="col-span-2">
          {entry.tableType === 'checklist'
            ? <ChecklistEditor entry={entry} onChange={setEntry} />
            : <TableEditor table={entry} onChange={setEntry} />
          }
        </div>
      </div>

      {/* Vista previa (solo para tipos tabla; no aplica a checklist) */}
      {entry.tableType !== 'checklist' && <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPreview(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
            Vista previa de la tabla
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {showPreview ? '▲ Ocultar' : '▼ Mostrar'}
          </span>
        </button>
        {showPreview && (
          <div className="p-4 bg-white">
            {entry.columns.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Agregá columnas y filas para ver la vista previa.
              </p>
            ) : (
              <TablePreview table={entry} />
            )}
          </div>
        )}
      </div>}
      </div>{/* /overflow-y-auto */}
    </div>
  );
};
