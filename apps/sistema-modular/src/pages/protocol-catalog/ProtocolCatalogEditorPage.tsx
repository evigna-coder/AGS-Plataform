import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTableCatalog } from '../../hooks/useTableCatalog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { TableEditor } from '../../components/protocol-catalog/TableEditor';
import type { TableCatalogEntry } from '@ags/shared';

const SYS_TYPES = ['HPLC', 'GC', 'UV', 'OSMOMETRO', 'OTRO'];

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
  if (entry.columns.length === 0) errors.push('La tabla no tiene columnas');
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {tableId ? 'Editar Tabla' : 'Nueva Tabla'}
          </h2>
          <span className="text-xs text-slate-500 uppercase font-bold">
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

      {/* Validation warnings */}
      {validationErrors.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <h4 className="text-xs font-black text-yellow-800 uppercase mb-2">Advertencias de publicación</h4>
          <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
            {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Card>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-3 gap-6 items-start">
        {/* Metadata panel */}
        <Card>
          <h3 className="text-xs font-black text-slate-600 uppercase mb-4">Metadatos</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre *</label>
              <Input value={entry.name} onChange={e => setMeta('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Descripción</label>
              <Input value={entry.description ?? ''} onChange={e => setMeta('description', e.target.value || null)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tipo de sistema *</label>
              <select value={entry.sysType} onChange={e => setMeta('sysType', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tipo de tabla</label>
              <select value={entry.tableType} onChange={e => setMeta('tableType', e.target.value as TableCatalogEntry['tableType'])}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="informational">Informacional</option>
                <option value="validation">Validación</option>
                <option value="instruments">Instrumentos</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase cursor-pointer">
              <input type="checkbox" checked={entry.isDefault}
                onChange={e => setMeta('isDefault', e.target.checked)} />
              Tabla por defecto para este sysType
            </label>
          </div>
        </Card>

        {/* Table editor panel */}
        <div className="col-span-2">
          <TableEditor table={entry} onChange={setEntry} />
        </div>
      </div>
    </div>
  );
};
