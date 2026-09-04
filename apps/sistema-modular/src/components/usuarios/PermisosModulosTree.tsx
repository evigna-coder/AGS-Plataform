import { useMemo } from 'react';
import type { ModuloId } from '@ags/shared';
import { arbolDePermisos, type PermisoGrupo } from '../layout/navigation';

interface Props {
  modulos: ModuloId[];
  roleDefaults: ModuloId[];
  /** Con el override apagado los checks se ven pero no se tocan. */
  editable: boolean;
  onToggle: (mod: ModuloId) => void;
  onSetMany: (mods: ModuloId[], on: boolean) => void;
}

/**
 * Checks de módulos del editor de usuario, con la forma exacta del sidebar
 * (2026-09-04): grupos, sub-grupos (Stock › Operación / Compras / Activos /
 * Catálogos) y una entrada por pantalla. "Todos / Ninguno" por bloque, porque
 * con una pantalla por permiso son muchos clicks.
 */
export function PermisosModulosTree({ modulos, roleDefaults, editable, onToggle, onSetMany }: Props) {
  const arbol = useMemo(arbolDePermisos, []);
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Modulos</p>
      <div className="space-y-3">
        {arbol.map(g => (
          <Grupo key={g.label} grupo={g} nivel={0} modulos={modulos} roleDefaults={roleDefaults}
            editable={editable} onToggle={onToggle} onSetMany={onSetMany} />
        ))}
      </div>
    </div>
  );
}

function idsDe(g: PermisoGrupo): ModuloId[] {
  return [...g.modulos.map(m => m.id), ...g.subgrupos.flatMap(idsDe)];
}

function Grupo({ grupo, nivel, modulos, roleDefaults, editable, onToggle, onSetMany }: Props & { grupo: PermisoGrupo; nivel: number }) {
  const ids = idsDe(grupo);
  const marcados = ids.filter(id => modulos.includes(id)).length;
  return (
    <div className={nivel > 0 ? 'ml-3 pl-3 border-l border-slate-200' : ''}>
      <div className="flex items-center gap-2 mb-1.5">
        <p className={`font-semibold uppercase tracking-wider ${nivel > 0 ? 'text-[9px] text-slate-400' : 'text-[10px] text-slate-500'}`}>
          {grupo.label}
        </p>
        <span className="text-[9px] text-slate-400">{marcados}/{ids.length}</span>
        {editable && ids.length > 1 && (
          <span className="text-[9px] text-teal-700 ml-auto">
            <button type="button" onClick={() => onSetMany(ids, true)} className="hover:underline">Todos</button>
            <span className="text-slate-300"> · </span>
            <button type="button" onClick={() => onSetMany(ids, false)} className="hover:underline">Ninguno</button>
          </span>
        )}
      </div>
      {grupo.modulos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {grupo.modulos.map(m => {
            const isChecked = modulos.includes(m.id);
            const isRoleDefault = roleDefaults.includes(m.id);
            return (
              <label key={m.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                !editable ? 'opacity-60 cursor-not-allowed' : ''
              } ${isChecked ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <input type="checkbox" checked={isChecked} disabled={!editable} onChange={() => onToggle(m.id)}
                  className="w-3.5 h-3.5 accent-teal-600 rounded" />
                <span className="text-[11px] text-slate-700 truncate" title={m.label}>{m.label}</span>
                {editable && isChecked !== isRoleDefault && (
                  <span className={`ml-auto text-[8px] font-bold ${isChecked ? 'text-emerald-500' : 'text-red-400'}`}>
                    {isChecked ? '+' : '-'}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
      {grupo.subgrupos.map(sg => (
        <Grupo key={sg.label} grupo={sg} nivel={nivel + 1} modulos={modulos} roleDefaults={roleDefaults}
          editable={editable} onToggle={onToggle} onSetMany={onSetMany} />
      ))}
    </div>
  );
}
