import { useEffect, useMemo, useState } from 'react';
import type { Articulo, CriterioPerfilConsumo, DetectorType, InletType, PerfilConsumo, PerfilConsumoItem } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { perfilesConsumoService } from '../../services/perfilesConsumoService';
import { articulosService } from '../../services/stockService';
import { notify } from '../../utils/notify';
import type { ModeloModuloOpcion } from '../../hooks/usePlanificacionInsumos';
import { useFeedbackGuardado } from '../../hooks/useFeedbackGuardado';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  perfil: PerfilConsumo | null;
  /** Insumos planificables: los que ya están en la planificación. */
  articulos: Articulo[];
  categorias: Array<{ id: string; nombre: string }>;
  /** Modelos de módulo y marcas legibles desde Equipos (catálogo + módulos cargados). */
  modelosModulo: ModeloModuloOpcion[];
  marcas: string[];
  /** Avisar que hubo artículos nuevos marcados planificables al guardar. */
  onPlanificablesChanged?: () => void;
}

const DETECTORES: DetectorType[] = ['FID', 'NCD', 'NPD', 'FPD', 'ECD', 'uECD', 'SCD', 'TCD', 'MSD'];
const INLETS: InletType[] = ['SSL', 'COC', 'PTV', 'PP', 'UNIS'];
const lbl = 'text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-0.5 block';
const inp = 'w-full border rounded-lg px-2.5 py-1 text-xs bg-white border-slate-300';

const VACIO: CriterioPerfilConsumo = { ambito: 'modulo', codigoModulo: '' };

/**
 * Alta/edición de un perfil de consumo: a qué equipos aplica (módulo, GC por
 * marca/detector/puerto, o categoría) y qué insumos críticos consume cada
 * mantenimiento preventivo. Solo se eligen artículos planificables.
 */
export function PerfilConsumoModal({ open, onClose, onSaved, perfil, articulos, categorias, modelosModulo, marcas, onPlanificablesChanged }: Props) {
  const [nombre, setNombre] = useState('');
  const [criterio, setCriterio] = useState<CriterioPerfilConsumo>(VACIO);
  const [items, setItems] = useState<PerfilConsumoItem[]>([]);
  const [notas, setNotas] = useState('');
  const [activo, setActivo] = useState(true);
  const fb = useFeedbackGuardado();
  const saving = fb.estado !== 'idle';
  // Insumos y partes legibles desde el catálogo de stock (2026-09-28): el perfil
  // se arma con cualquier artículo, no solo con los ya planificables. El que se
  // agrega y no era planificable se marca al guardar (sin grupo).
  const [catalogo, setCatalogo] = useState<Articulo[]>([]);
  useEffect(() => {
    if (!open) return;
    articulosService.getAll().then(setCatalogo).catch(err => console.error('[PerfilConsumoModal] catálogo:', err));
  }, [open]);
  const catalogoById = useMemo(() => {
    const m = new Map(catalogo.map(a => [a.id, a]));
    for (const a of articulos) m.set(a.id, a);
    return m;
  }, [catalogo, articulos]);

  useEffect(() => {
    if (!open) return;
    setNombre(perfil?.nombre ?? '');
    setCriterio(perfil?.criterio ?? VACIO);
    setItems(perfil?.items ?? []);
    setNotas(perfil?.notas ?? '');
    setActivo(perfil?.activo ?? true);
  }, [open, perfil]);

  const setC = <K extends keyof CriterioPerfilConsumo>(k: K, v: CriterioPerfilConsumo[K]) => setCriterio(prev => ({ ...prev, [k]: v }));
  const cambiarAmbito = (ambito: CriterioPerfilConsumo['ambito']) => setCriterio({ ambito });

  const agregarItem = (articuloId: string) => {
    const a = catalogoById.get(articuloId);
    if (!a || items.some(i => i.articuloId === articuloId)) return;
    setItems(prev => [...prev, { articuloId: a.id, articuloCodigo: a.codigo, cantidadPorServicio: 1, porPuerto: null }]);
  };
  const setItem = (articuloId: string, patch: Partial<PerfilConsumoItem>) =>
    setItems(prev => prev.map(i => i.articuloId === articuloId ? { ...i, ...patch } : i));

  const criterioValido = criterio.ambito === 'modulo' ? !!criterio.codigoModulo?.trim()
    : criterio.ambito === 'categoria' ? !!criterio.categoriaId
    : !!(criterio.marca?.trim() || criterio.detector || criterio.inlet);
  const puede = nombre.trim().length > 0 && criterioValido && items.length > 0 && items.every(i => i.cantidadPorServicio > 0);

  const guardar = async () => {
    if (!puede || saving) return;
    try {
      await fb.correr(async () => {
      const data = {
        nombre: nombre.trim(),
        criterio: {
          ambito: criterio.ambito,
          codigoModulo: criterio.ambito === 'modulo' ? criterio.codigoModulo?.trim().toUpperCase() ?? null : null,
          marca: criterio.ambito === 'gc' ? criterio.marca?.trim() || null : null,
          detector: criterio.ambito === 'gc' ? criterio.detector ?? null : null,
          inlet: criterio.ambito === 'gc' ? criterio.inlet ?? null : null,
          categoriaId: criterio.ambito === 'categoria' ? criterio.categoriaId ?? null : null,
        },
        items: items.map(i => ({ ...i, cantidadPorServicio: Number(i.cantidadPorServicio), porPuerto: i.porPuerto ? true : null })),
        notas: notas.trim() || null,
        activo,
      };
      if (perfil) await perfilesConsumoService.update(perfil.id, data);
      else await perfilesConsumoService.create(data);
      // Lo que entra a un perfil pasa a ser planificable: si no, la tabla no lo mostraría.
      const nuevos = items.filter(i => !articulos.some(a => a.id === i.articuloId));
      if (nuevos.length > 0) {
        await Promise.all(nuevos.map(i => articulosService.update(i.articuloId, { planificable: true })));
        notify.info(`${nuevos.length} artículo${nuevos.length === 1 ? '' : 's'} marcado${nuevos.length === 1 ? '' : 's'} como planificable${nuevos.length === 1 ? '' : 's'} (sin grupo)`);
        onPlanificablesChanged?.();
      }
      notify.success(perfil ? 'Perfil actualizado' : 'Perfil creado');
      }, () => { onSaved(); onClose(); });
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'No se pudo guardar el perfil');
    }
  };

  const disponibles = useMemo(() => {
    const elegidos = new Set(items.map(i => i.articuloId));
    const planificables = new Set(articulos.map(a => a.id));
    const base = catalogo.length > 0 ? catalogo : articulos;
    // Planificables primero, después el resto del catálogo.
    return [...base].filter(a => !elegidos.has(a.id) && a.activo !== false)
      .sort((a, b) => Number(planificables.has(b.id)) - Number(planificables.has(a.id)) || a.codigo.localeCompare(b.codigo))
      .map(a => ({ value: a.id, label: `${a.codigo} · ${a.descripcion}`, subLabel: planificables.has(a.id) ? 'planificable' : undefined }));
  }, [catalogo, articulos, items]);
  const esGc = criterio.ambito === 'gc';

  return (
    <Modal open={open} onClose={onClose} title={perfil ? 'Editar perfil de consumo' : 'Nuevo perfil de consumo'} maxWidth="lg"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={!puede} estado={fb.estado}>Guardar</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input inputSize="sm" label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Bomba G1311 · preventivo" />
          </div>
          <div>
            <label className={lbl}>Aplica a</label>
            <Select value={criterio.ambito} onChange={e => cambiarAmbito(e.target.value as CriterioPerfilConsumo['ambito'])} className="w-full">
              <option value="modulo">Módulo (por modelo)</option>
              <option value="gc">GC (marca / detector / puerto)</option>
              <option value="categoria">Categoría de equipo</option>
            </Select>
          </div>
        </div>

        {criterio.ambito === 'modulo' && (
          <div>
            <label className={lbl}>Modelo de módulo</label>
            <SearchableSelect value={criterio.codigoModulo ?? ''} onChange={v => setC('codigoModulo', v)} size="sm" creatable createLabel="Usar código"
              placeholder="Elegí un modelo (catálogo o cargado en equipos)…"
              options={modelosModulo.map(m => ({
                value: m.codigo,
                label: `${m.codigo} · ${m.descripcion}`,
                subLabel: [m.marca, m.enEquipos > 0 ? `${m.enEquipos} en equipos` : 'solo catálogo'].filter(Boolean).join(' · '),
              }))} />
            <p className="text-[10px] text-slate-400 mt-1">Aplica a todo módulo cuyo nombre o descripción empiece con ese código: G1311 cubre G1311A y G1311B. Dos módulos iguales consumen el doble.</p>
          </div>
        )}
        {esGc && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Marca</label>
              <SearchableSelect value={criterio.marca ?? ''} onChange={v => setC('marca', v || null)} size="sm" creatable createLabel="Usar marca"
                placeholder="Cualquiera" options={[{ value: '', label: 'Cualquiera' }, ...marcas.map(m => ({ value: m, label: m }))]} />
            </div>
            <div>
              <label className={lbl}>Detector</label>
              <Select value={criterio.detector ?? ''} onChange={e => setC('detector', (e.target.value || null) as DetectorType | null)} className="w-full">
                <option value="">Cualquiera</option>
                {DETECTORES.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <label className={lbl}>Puerto de inyección</label>
              <Select value={criterio.inlet ?? ''} onChange={e => setC('inlet', (e.target.value || null) as InletType | null)} className="w-full">
                <option value="">Cualquiera</option>
                {INLETS.map(i => <option key={i} value={i}>{i}</option>)}
              </Select>
            </div>
            <p className="col-span-3 text-[10px] text-slate-400">
              Se lee la configuración GC del equipo (marca de sus módulos, detectores y puertos de inyección front / back / aux). Un ítem "por puerto"
              se multiplica por la cantidad de puertos cargados en el equipo: con 2 puertos son 2 unidades por servicio (o solo los del tipo elegido).
            </p>
          </div>
        )}
        {criterio.ambito === 'categoria' && (
          <div>
            <label className={lbl}>Categoría</label>
            <SearchableSelect value={criterio.categoriaId ?? ''} onChange={v => setC('categoriaId', v || null)}
              options={categorias.map(c => ({ value: c.id, label: c.nombre }))} placeholder="Seleccionar…" />
            <p className="text-[10px] text-slate-400 mt-1">Aditivo: se suma a los perfiles de módulo o GC del mismo equipo. Útil mientras la configuración no esté cargada.</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Insumos por servicio</span>
            <div className="w-72">
              <SearchableSelect value="" onChange={agregarItem} size="sm" placeholder="+ Agregar insumo o parte del catálogo…"
                options={disponibles} emptyMessage="Sin resultados en el catálogo" />
            </div>
          </div>
          {items.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">Agregá al menos un insumo.</p>
          ) : (
            <div className="space-y-1">
              {items.map(i => {
                const a = catalogoById.get(i.articuloId);
                return (
                  <div key={i.articuloId} className={`grid ${esGc ? 'grid-cols-[1fr_90px_100px_24px]' : 'grid-cols-[1fr_90px_24px]'} gap-2 items-center`}>
                    <span className="text-xs text-slate-700 truncate"><span className="font-mono">{i.articuloCodigo}</span> <span className="text-slate-400">{a?.descripcion}</span></span>
                    <input type="number" min={0} step="any" value={i.cantidadPorServicio}
                      onChange={e => setItem(i.articuloId, { cantidadPorServicio: Number(e.target.value) || 0 })} className={`${inp} font-mono text-right`} title="Cantidad por servicio" />
                    {esGc && (
                      <label className="flex items-center gap-1 text-[10px] text-slate-500">
                        <input type="checkbox" checked={!!i.porPuerto} onChange={e => setItem(i.articuloId, { porPuerto: e.target.checked ? true : null })} /> por puerto
                      </label>
                    )}
                    <button onClick={() => setItems(prev => prev.filter(x => x.articuloId !== i.articuloId))} className="text-red-400 hover:text-red-600 text-xs justify-self-center">×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Input inputSize="sm" label="Notas" value={notas} onChange={e => setNotas(e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-1.5">
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} /> Activo
          </label>
        </div>
      </div>
    </Modal>
  );
}
