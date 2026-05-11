import { useState, useRef, useEffect, memo } from 'react';
import type { TableProject } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useConfirm } from '../ui/ConfirmDialog';

// Sentinels para los valores especiales del SearchableSelect (que sólo acepta strings)
const ALL_VALUE = '__all__';
const NONE_VALUE = '__none__';

interface Props {
  projects: TableProject[];
  /** undefined = "Todas", null = "Sin proyecto", string = projectId específico */
  activeProjectId: string | null | undefined;
  onSelect: (projectId: string | null | undefined) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateSettings?: (id: string, data: { headerTitle: string | null; footerQF: string | null }) => Promise<void>;
  onBulkAddModelos?: (project: TableProject) => void;
}

export const ProjectSelector: React.FC<Props> = memo(({
  projects, activeProjectId, onSelect, onCreate, onRename, onDelete, onUpdateSettings, onBulkAddModelos,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [settingsProject, setSettingsProject] = useState<TableProject | null>(null);
  const [settingsHeaderTitle, setSettingsHeaderTitle] = useState('');
  const [settingsFooterQF, setSettingsFooterQF] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    if (!menuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuId]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await onCreate(newName.trim());
      setNewName('');
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await onRename(id, editName.trim());
    setEditId(null);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Eliminar este proyecto? Las tablas no se eliminan, solo se desvinculan.')) return;
    setMenuId(null);
    await onDelete(id);
    if (activeProjectId === id) onSelect(undefined);
  };

  const openSettings = (p: TableProject) => {
    setSettingsProject(p);
    setSettingsHeaderTitle(p.headerTitle || '');
    setSettingsFooterQF(p.footerQF || '');
    setMenuId(null);
  };

  const handleSaveSettings = async () => {
    if (!settingsProject || !onUpdateSettings) return;
    setSavingSettings(true);
    try {
      await onUpdateSettings(settingsProject.id, {
        headerTitle: settingsHeaderTitle.trim() || null,
        footerQF: settingsFooterQF.trim() || null,
      });
      setSettingsProject(null);
    } finally {
      setSavingSettings(false);
    }
  };

  // SearchableSelect mapping: string sentinels para "Todas" (undefined) y "Sin proyecto" (null)
  const dropdownValue =
    activeProjectId === undefined ? ALL_VALUE :
    activeProjectId === null ? NONE_VALUE :
    activeProjectId;
  const dropdownOptions = [
    { value: ALL_VALUE, label: 'Todas las tablas' },
    { value: NONE_VALUE, label: 'Sin proyecto asignado' },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ];
  const handleDropdownChange = (val: string) => {
    if (val === ALL_VALUE) onSelect(undefined);
    else if (val === NONE_VALUE) onSelect(null);
    else onSelect(val);
  };

  const activeProject = typeof activeProjectId === 'string'
    ? projects.find(p => p.id === activeProjectId) ?? null
    : null;
  const showProjectMenu = !!activeProject;
  const MANAGE_MENU_ID = '__manage__';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-medium text-slate-400 mr-1 whitespace-nowrap">Proyecto:</span>

      <div className="flex-1 min-w-[280px] max-w-[460px]">
        <SearchableSelect
          value={dropdownValue}
          onChange={handleDropdownChange}
          options={dropdownOptions}
          placeholder="Filtrar por proyecto..."
          size="sm"
        />
      </div>

      {/* Acciones del proyecto seleccionado (rename / settings / modelos / delete) */}
      {showProjectMenu && (
        <div className="relative">
          <button
            onClick={() => setMenuId(menuId === MANAGE_MENU_ID ? null : MANAGE_MENU_ID)}
            className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded px-2 py-1.5 font-medium"
            title="Gestionar este proyecto"
          >
            ⋮ Gestionar
          </button>
          {menuId === MANAGE_MENU_ID && activeProject && (
            <div ref={menuRef}
              className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[180px]">
              <button onClick={() => { setEditId(activeProject.id); setEditName(activeProject.name); setMenuId(null); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                Renombrar
              </button>
              {onUpdateSettings && (
                <button onClick={() => openSettings(activeProject)}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                  Encabezado / Pie
                </button>
              )}
              {onBulkAddModelos && (
                <button onClick={() => { onBulkAddModelos(activeProject); setMenuId(null); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                  Agregar modelos a tablas…
                </button>
              )}
              <button onClick={() => handleDelete(activeProject.id)}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                Eliminar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline rename del proyecto activo */}
      {editId && activeProject && editId === activeProject.id && (
        <div className="flex items-center gap-1">
          <input value={editName} onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(activeProject.id); if (e.key === 'Escape') setEditId(null); }}
            className="text-xs border border-teal-300 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-teal-400"
            autoFocus />
          <button onClick={() => handleRename(activeProject.id)} className="text-xs text-teal-600 font-medium">OK</button>
          <button onClick={() => setEditId(null)} className="text-xs text-slate-400">✕</button>
        </div>
      )}

      {/* Botón + */}
      <button onClick={() => setShowCreate(true)}
        className="text-xs text-teal-600 hover:text-teal-800 font-medium px-2 py-1.5 whitespace-nowrap">
        + Nuevo
      </button>

      {/* Modal crear proyecto */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo proyecto" maxWidth="sm"
        footer={<>
          <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? 'Creando...' : 'Crear'}
          </Button>
        </>}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del proyecto</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Ej: Calificación OQ HPLC"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
          </div>
        </div>
      </Modal>

      {/* Modal configurar encabezado/pie del proyecto */}
      <Modal open={!!settingsProject} onClose={() => setSettingsProject(null)}
        title="Encabezado / Pie de página" subtitle={settingsProject?.name} maxWidth="sm"
        footer={<>
          <Button variant="outline" onClick={() => setSettingsProject(null)}>Cancelar</Button>
          <Button onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? 'Guardando...' : 'Guardar'}
          </Button>
        </>}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Estos valores se aplican a todas las tablas del proyecto que no tengan su propio encabezado/pie definido.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título del protocolo (header)</label>
            <Input value={settingsHeaderTitle} onChange={e => setSettingsHeaderTitle(e.target.value)}
              placeholder="Ej: Protocolo de verificación GC-MS" inputSize="sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Número QF (footer)</label>
            <Input value={settingsFooterQF} onChange={e => setSettingsFooterQF(e.target.value)}
              placeholder="Ej: QF-AGS-012 Rev.01" inputSize="sm" />
          </div>
        </div>
      </Modal>
    </div>
  );
});
