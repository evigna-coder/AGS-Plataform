import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTableCatalog } from '../../hooks/useTableCatalog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ImportJsonDialog } from '../../components/protocol-catalog/ImportJsonDialog';
import type { TableCatalogEntry } from '@ags/shared';

const SYS_TYPES = ['HPLC', 'GC', 'UV', 'OSMOMETRO', 'OTRO'];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-slate-100 text-slate-600',
};

const TABLE_TYPE_LABELS: Record<string, string> = {
  validation: 'Validación',
  informational: 'Informacional',
  instruments: 'Instrumentos',
  checklist: 'Checklist',
};

export const TableCatalogPage = () => {
  const navigate = useNavigate();
  const { tables, loading, error, listTables, archiveTable, cloneTable, importTables, deleteTable } =
    useTableCatalog();
  const [filterSysType, setFilterSysType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const reload = (sysType = filterSysType, status = filterStatus) => {
    setSelectedIds(new Set());
    listTables({ sysType: sysType || undefined, status: status || undefined });
  };

  useEffect(() => { reload(); }, [filterSysType, filterStatus]);

  // --- Selección ---
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = tables.length > 0 && selectedIds.size === tables.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tables.map(t => t.id)));
    }
  };

  // --- Acciones individuales ---
  const handleClone = async (entry: TableCatalogEntry) => {
    if (!confirm(`¿Clonar la tabla "${entry.name}"?`)) return;
    try {
      const newId = await cloneTable(entry.id);
      navigate(`/table-catalog/${newId}/edit`);
    } catch {
      alert('Error al clonar la tabla');
    }
  };

  const handleArchive = async (entry: TableCatalogEntry) => {
    if (!confirm(`¿Archivar "${entry.name}"? Ya no estará disponible para los técnicos.`)) return;
    try {
      await archiveTable(entry.id);
      reload();
    } catch {
      alert('Error al archivar la tabla');
    }
  };

  const handleDelete = async (entry: TableCatalogEntry) => {
    if (!confirm(`¿Eliminar permanentemente "${entry.name}"?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await deleteTable(entry.id);
      reload();
    } catch {
      alert('Error al eliminar la tabla');
    }
  };

  // --- Eliminación en lote ---
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`¿Eliminar permanentemente ${count} tabla(s) seleccionada(s)?\n\nEsta acción no se puede deshacer.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => deleteTable(id)));
      reload();
    } catch {
      alert('Error al eliminar las tablas seleccionadas');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleImport = async (imported: TableCatalogEntry[]) => {
    setShowImport(false);
    try {
      await importTables(imported);
      alert(`${imported.length} tabla(s) importada(s) correctamente como borrador.`);
      reload();
    } catch {
      alert('Error al importar las tablas');
    }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      {/* ─── Header sticky ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-3 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Biblioteca de Tablas</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Tablas de verificación individuales para protocolos de OT
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowImport(true)}>⬆ Importar JSON</Button>
            <Link to="/table-catalog/nuevo"><Button>+ Nueva tabla</Button></Link>
          </div>
        </div>

        {/* Filtros */}
        <Card>
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de sistema</label>
            <select value={filterSysType} onChange={e => setFilterSysType(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos</option>
              {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
          <Button variant="ghost" size="sm"
            onClick={() => { setFilterSysType(''); setFilterStatus(''); }}>
            Limpiar
          </Button>
        </div>
        </Card>
      </div>{/* /header sticky */}

      {/* ─── Contenido scrollable ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {/* Barra de acciones en lote — aparece solo si hay selección */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-sm font-bold text-red-800">
            {selectedIds.size} tabla(s) seleccionada(s)
          </span>
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              Deseleccionar todo
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="text-xs bg-red-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bulkDeleting ? 'Eliminando...' : `Eliminar ${selectedIds.size} tabla(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <p className="text-slate-400">Cargando...</p>
        </div>
      ) : error ? (
        <Card><p className="text-red-600 text-sm">{error}</p></Card>
      ) : tables.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400">No hay tablas. Creá una o importá desde JSON.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                      title="Seleccionar todo"
                    />
                  </th>
                  {['Nombre', 'SysType', 'Tipo', 'Cols', 'Filas', 'Default', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-slate-400 tracking-wider text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tables.map(t => {
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <tr key={t.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50/60' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(t.id)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{t.name}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{t.sysType || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{TABLE_TYPE_LABELS[t.tableType] ?? t.tableType}</td>
                      <td className="px-4 py-3 text-slate-600 text-center">{t.columns.length}</td>
                      <td className="px-4 py-3 text-slate-600 text-center">{t.templateRows.length}</td>
                      <td className="px-4 py-3 text-center">
                        {t.isDefault
                          ? <span className="text-green-600 font-bold text-xs">✓</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <Link to={`/table-catalog/${t.id}/edit`}>
                            <button className="text-blue-600 hover:underline font-medium text-xs">Editar</button>
                          </Link>
                          <button onClick={() => handleClone(t)}
                            className="text-slate-600 hover:underline font-medium text-xs">Clonar</button>
                          {t.status !== 'archived' && (
                            <button onClick={() => handleArchive(t)}
                              className="text-amber-600 hover:underline font-medium text-xs">Archivar</button>
                          )}
                          <button onClick={() => handleDelete(t)}
                            className="text-red-600 hover:underline font-medium text-xs">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showImport && (
        <ImportJsonDialog onClose={() => setShowImport(false)} onImport={handleImport} />
      )}
      </div>{/* /overflow-y-auto */}
    </div>
  );
};
