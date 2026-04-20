import { useState, useEffect } from 'react';
import type { PresupuestoItem, Sistema, ModuloSistema } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

export const ALL_SISTEMAS_VALUE = '__ALL_SISTEMAS__';

interface EquipoLinkPanelProps {
  newItem: Partial<PresupuestoItem>;
  setNewItem: (v: Partial<PresupuestoItem>) => void;
  sistemas: Sistema[];
  loadModulos: (sistemaId: string) => Promise<ModuloSistema[]>;
}

/**
 * Panel "Vincular a equipo" — Sistema + Módulo selectors + servicio/sub-item inputs.
 * Extraído de AddItemModal.tsx (Plan 07-01) para mantener el budget <250 LOC y
 * para que el gate por tipoPresupuesto viva en un solo lugar.
 *
 * Solo se renderiza cuando tipoPresupuesto === 'contrato'.
 */
export const EquipoLinkPanel = ({ newItem, setNewItem, sistemas, loadModulos }: EquipoLinkPanelProps) => {
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [loadingModulos, setLoadingModulos] = useState(false);

  // Load módulos when sistema changes (skip for "all systems")
  useEffect(() => {
    if (!newItem.sistemaId || newItem.sistemaId === ALL_SISTEMAS_VALUE) {
      setModulos([]);
      return;
    }
    setLoadingModulos(true);
    loadModulos(newItem.sistemaId)
      .then(setModulos)
      .catch(() => setModulos([]))
      .finally(() => setLoadingModulos(false));
  }, [newItem.sistemaId, loadModulos]);

  const handleSistemaChange = (sistemaId: string) => {
    if (sistemaId === ALL_SISTEMAS_VALUE) {
      setNewItem({
        ...newItem,
        sistemaId: ALL_SISTEMAS_VALUE,
        sistemaNombre: 'Todos los sistemas/equipos',
        moduloId: null,
        moduloNombre: null,
        moduloSerie: null,
        moduloMarca: null,
      });
      return;
    }
    const sistema = sistemas.find(s => s.id === sistemaId);
    setNewItem({
      ...newItem,
      sistemaId: sistemaId || null,
      sistemaNombre: sistema?.nombre || null,
      sistemaCodigoInterno: sistema?.codigoInternoCliente || null,
      moduloId: null,
      moduloNombre: null,
      moduloSerie: null,
      moduloMarca: null,
    });
  };

  const handleModuloChange = (moduloId: string) => {
    const modulo = modulos.find(m => m.id === moduloId);
    setNewItem({
      ...newItem,
      moduloId: moduloId || null,
      moduloNombre: modulo?.nombre || null,
      moduloSerie: modulo?.serie || null,
      moduloMarca: modulo?.marca || null,
    });
  };

  return (
    <div className="bg-blue-50 p-3 rounded-lg space-y-2">
      <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Vincular a equipo</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Sistema/Equipo</label>
          <SearchableSelect
            value={newItem.sistemaId || ''}
            onChange={handleSistemaChange}
            options={[
              { value: '', label: 'Sin equipo' },
              { value: ALL_SISTEMAS_VALUE, label: 'Todos los sistemas/equipos' },
              ...sistemas.map(s => ({ value: s.id, label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}` })),
            ]}
            placeholder="Seleccionar equipo..."
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Módulo</label>
          {newItem.sistemaId === ALL_SISTEMAS_VALUE ? (
            <span className="text-[11px] text-blue-500 block py-1.5 italic">Aplica a todos</span>
          ) : loadingModulos ? (
            <span className="text-xs text-slate-400 block py-1.5">Cargando...</span>
          ) : (
            <SearchableSelect
              value={newItem.moduloId || ''}
              onChange={handleModuloChange}
              options={[
                { value: '', label: 'Sin módulo' },
                ...modulos.map(m => ({ value: m.id, label: `${m.nombre}${m.serie ? ` — ${m.serie}` : ''}` })),
              ]}
              placeholder="Seleccionar módulo..."
            />
          )}
        </div>
      </div>
      {newItem.moduloSerie && (
        <p className="text-[10px] text-blue-600">Serie: {newItem.moduloSerie} | Marca: {newItem.moduloMarca || '-'}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Cod. servicio</label>
          <input value={newItem.servicioCode || ''} onChange={(e) => setNewItem({ ...newItem, servicioCode: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="Ej: ATI_BAS_00C" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Sub-item</label>
          <input value={newItem.subItem || ''} onChange={(e) => setNewItem({ ...newItem, subItem: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="Ej: 1.1" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={newItem.esBonificacion || false}
          onChange={(e) => setNewItem({ ...newItem, esBonificacion: e.target.checked })}
          className="rounded border-slate-300" />
        Es bonificación (descuento 100%)
      </label>
    </div>
  );
};
