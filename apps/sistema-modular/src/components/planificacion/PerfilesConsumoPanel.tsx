import { useState } from 'react';
import type { Articulo, PerfilConsumo } from '@ags/shared';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { confirmar } from '../ui/ConfirmDialog';
import { perfilesConsumoService } from '../../services/perfilesConsumoService';
import { notify } from '../../utils/notify';
import { PerfilConsumoModal } from './PerfilConsumoModal';
import type { ModeloModuloOpcion } from '../../hooks/usePlanificacionInsumos';

interface Props {
  perfiles: PerfilConsumo[];
  /** Derivados de `consumibles_por_modulo`: se muestran pero se editan en su catálogo. */
  perfilesCatalogo: PerfilConsumo[];
  articulos: Articulo[];
  categorias: Array<{ id: string; nombre: string }>;
  modelosModulo: ModeloModuloOpcion[];
  marcas: string[];
  onChanged: () => void;
  /** Se marcaron artículos nuevos como planificables: recargar la planificación. */
  onPlanificablesChanged: () => void;
}

function describirCriterio(p: PerfilConsumo, categorias: Props['categorias']): string {
  const c = p.criterio;
  if (c.ambito === 'modulo') return `Módulo ${c.codigoModulo ?? '?'}`;
  if (c.ambito === 'categoria') return `Categoría ${categorias.find(x => x.id === c.categoriaId)?.nombre ?? '?'}`;
  return ['GC', c.marca, c.detector && `detector ${c.detector}`, c.inlet && `puerto ${c.inlet}`].filter(Boolean).join(' · ');
}

/** Lista de perfiles de consumo con alta, edición y baja. */
export function PerfilesConsumoPanel({ perfiles, perfilesCatalogo, articulos, categorias, modelosModulo, marcas, onChanged, onPlanificablesChanged }: Props) {
  const [editando, setEditando] = useState<PerfilConsumo | null | undefined>(undefined); // undefined = cerrado, null = nuevo

  const borrar = async (p: PerfilConsumo) => {
    if (!await confirmar({ title: 'Eliminar perfil', message: `¿Eliminar "${p.nombre}"? Los equipos que lo usaban dejan de tener ese consumo.`, danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      await perfilesConsumoService.delete(p.id);
      notify.success('Perfil eliminado');
      onChanged();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  };

  const Fila = ({ p, soloLectura }: { p: PerfilConsumo; soloLectura?: boolean }) => (
    <div className={`grid grid-cols-[1fr_220px_1fr_auto] gap-3 items-center px-3 py-2 border-b border-slate-100 ${p.activo ? '' : 'opacity-50'}`}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{p.nombre}{!p.activo && <span className="ml-1 text-[9px] font-mono uppercase text-slate-400">inactivo</span>}</p>
        {p.notas && <p className="text-[10px] text-slate-400 truncate">{p.notas}</p>}
      </div>
      <span className="text-[11px] text-slate-500 truncate">{describirCriterio(p, categorias)}</span>
      <span className="text-[11px] font-mono text-slate-600 truncate" title={p.items.map(i => `${i.articuloCodigo} × ${i.cantidadPorServicio}${i.porPuerto ? '/puerto' : ''}`).join('\n')}>
        {p.items.map(i => `${i.articuloCodigo}×${i.cantidadPorServicio}${i.porPuerto ? 'p' : ''}`).join(' · ')}
      </span>
      <div className="flex gap-1 justify-end">
        {soloLectura ? (
          <span className="text-[10px] text-slate-400 italic">catálogo de módulos</span>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditando(p)}>Editar</Button>
            <Button variant="ghost" size="sm" onClick={() => borrar(p)}>Eliminar</Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Un perfil dice qué insumos críticos consume un mantenimiento preventivo según la configuración del equipo. Un servicio suma todos los perfiles que le matchean.
        </p>
        <Button size="sm" onClick={() => setEditando(null)}>+ Nuevo perfil</Button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl border border-slate-200 shadow-sm">
        {perfiles.length === 0 && perfilesCatalogo.length === 0 ? (
          <EmptyState inline message="Todavía no hay perfiles de consumo" hint="Creá el primero: por ejemplo, bomba G1311 → sellos × 2." />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_220px_1fr_auto] gap-3 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-mono uppercase tracking-wide text-slate-400">
              <span>Perfil</span><span>Aplica a</span><span>Insumos × cantidad</span><span></span>
            </div>
            {perfiles.map(p => <Fila key={p.id} p={p} />)}
            {perfilesCatalogo.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-slate-50 border-y border-slate-200 text-[10px] font-mono uppercase tracking-wide text-slate-400">
                  Desde el catálogo de consumibles por módulo (solo códigos planificables)
                </div>
                {perfilesCatalogo.map(p => <Fila key={p.id} p={p} soloLectura />)}
              </>
            )}
          </>
        )}
      </div>
      <PerfilConsumoModal open={editando !== undefined} onClose={() => setEditando(undefined)} onSaved={onChanged}
        perfil={editando ?? null} articulos={articulos} categorias={categorias} modelosModulo={modelosModulo} marcas={marcas}
        onPlanificablesChanged={onPlanificablesChanged} />
    </div>
  );
}
