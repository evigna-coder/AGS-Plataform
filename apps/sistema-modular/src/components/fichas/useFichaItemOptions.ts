import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  articulosService,
  sistemasService,
  modulosService,
} from '../../services/firebaseService';
import { consumiblesPorModuloService } from '../../services/consumiblesPorModuloService';
import type { Articulo, Sistema, ModuloSistema, ConsumiblesPorModulo, ItemFicha } from '@ags/shared';
import type { SearchableSelectOption } from '../ui/SearchableSelect';

/**
 * Draft de un item de ficha compartido entre CreateFichaModal y EditFichaModal.
 * `seleccion` es el valor del SearchableSelect unificado:
 *   - `mod:{sistemaId}:{moduloId}` → módulo de un equipo del cliente
 *   - `art:{articuloId}`           → artículo de stock
 *   - `cat:{catalogoId}`           → catálogo consumibles_por_modulo
 *   - ''                           → sin selección (texto libre va en descripcionLibre)
 */
export interface ItemFichaDraft {
  tempId: string;
  /** Si el item ya existe en la ficha, su id real; si es nuevo, null. */
  existingId: string | null;
  seleccion: string;
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  sistemaId: string;
  moduloId: string;
  descripcionLibre: string;
  serie: string;
  descripcionProblema: string;
}

export const newItemDraft = (): ItemFichaDraft => ({
  tempId: crypto.randomUUID(),
  existingId: null,
  seleccion: '',
  articuloId: '',
  articuloCodigo: '',
  articuloDescripcion: '',
  sistemaId: '',
  moduloId: '',
  descripcionLibre: '',
  serie: '',
  descripcionProblema: '',
});

export const draftFromItem = (it: ItemFicha): ItemFichaDraft => ({
  tempId: it.id,
  existingId: it.id,
  seleccion: it.moduloId && it.sistemaId
    ? `mod:${it.sistemaId}:${it.moduloId}`
    : it.articuloId ? `art:${it.articuloId}` : '',
  articuloId: it.articuloId ?? '',
  articuloCodigo: it.articuloCodigo ?? '',
  articuloDescripcion: it.articuloDescripcion ?? '',
  sistemaId: it.sistemaId ?? '',
  moduloId: it.moduloId ?? '',
  descripcionLibre: it.descripcionLibre ?? '',
  serie: it.serie ?? '',
  descripcionProblema: it.descripcionProblema ?? '',
});

/** Campos de identificación del item que salen del draft (para el payload Firestore). */
export const draftIdentityFields = (d: ItemFichaDraft) => ({
  articuloId: d.articuloId || null,
  articuloCodigo: d.articuloCodigo.trim() || null,
  articuloDescripcion: d.articuloDescripcion.trim() || null,
  descripcionLibre: d.descripcionLibre.trim() || null,
  serie: d.serie.trim() || null,
  sistemaId: d.sistemaId || null,
  moduloId: d.moduloId || null,
});

interface ModuloDelCliente {
  sistema: Sistema;
  modulo: ModuloSistema;
}

/**
 * Opciones agrupadas para el selector de artículo de un item de ficha, en orden
 * de utilidad: módulos de los equipos del cliente → artículos de stock →
 * catálogo consumibles_por_modulo. El texto libre entra por `creatable` del
 * SearchableSelect (se materializa en descripcionLibre vía applySeleccion).
 */
export function useFichaItemOptions(open: boolean, clienteId: string) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [catalogo, setCatalogo] = useState<ConsumiblesPorModulo[]>([]);
  const [sistemasCliente, setSistemasCliente] = useState<Sistema[]>([]);
  const [modulosCliente, setModulosCliente] = useState<ModuloDelCliente[]>([]);

  useEffect(() => {
    if (!open) return;
    articulosService.getAll({ activoOnly: true }).then(setArticulos);
    consumiblesPorModuloService.getAll()
      .then(cs => setCatalogo(cs.filter(c => c.activo)))
      .catch(err => console.error('[useFichaItemOptions] catálogo consumibles_por_modulo:', err));
  }, [open]);

  useEffect(() => {
    if (!open || !clienteId) { setSistemasCliente([]); setModulosCliente([]); return; }
    // Una sola query collectionGroup cacheada para TODOS los módulos + sistemas
    // del cliente; el join se hace en memoria (más barato que N getBySistema).
    Promise.all([
      sistemasService.getAll({ clienteCuit: clienteId }),
      modulosService.getAllGrouped(),
    ]).then(([sistemas, todosLosModulos]) => {
      const porSistema = new Map((sistemas as Sistema[]).map(s => [s.id, s]));
      setSistemasCliente(sistemas as Sistema[]);
      setModulosCliente(
        (todosLosModulos as ModuloSistema[])
          .filter(m => porSistema.has(m.sistemaId))
          .map(m => ({ sistema: porSistema.get(m.sistemaId)!, modulo: m })),
      );
    }).catch(err => {
      console.error('[useFichaItemOptions] módulos del cliente:', err);
      setSistemasCliente([]);
      setModulosCliente([]);
    });
  }, [open, clienteId]);

  /** Equipos (sistemas) del cliente para acotar los módulos de UN item. */
  const equipoOptions: SearchableSelectOption[] = useMemo(() => [
    { value: '', label: 'Todos los equipos del cliente' },
    ...sistemasCliente.map(s => ({
      value: s.id,
      label: `${s.nombre}${s.codigoInternoCliente ? ` · ${s.codigoInternoCliente}` : ''}`,
      subLabel: s.agsVisibleId ?? undefined,
    })),
  ], [sistemasCliente]);

  const moduloOptions = useMemo(() => modulosCliente.map(({ sistema, modulo }) => ({
    sistemaId: sistema.id,
    option: {
      value: `mod:${sistema.id}:${modulo.id}`,
      label: `🔧 [${sistema.nombre}] ${[modulo.nombre, modulo.descripcion].filter(Boolean).join(' — ')}`,
      subLabel: [
        modulo.serie ? `S/N ${modulo.serie}` : null,
        sistema.codigoInternoCliente || null,
      ].filter(Boolean).join(' · ') || undefined,
    } as SearchableSelectOption,
  })), [modulosCliente]);

  const otrasOptions: SearchableSelectOption[] = useMemo(() => [
    ...articulos.map(a => ({
      value: `art:${a.id}`,
      label: `📦 [Stock] ${a.codigo} — ${a.descripcion}`,
    })),
    ...catalogo.map(c => ({
      value: `cat:${c.id}`,
      label: `📇 [Catálogo] ${c.codigoModulo}${c.descripcion ? ` — ${c.descripcion}` : ''}`,
    })),
  ], [articulos, catalogo]);

  /**
   * Opciones del selector de artículo de un item. Con `equipoId` (sistema
   * elegido en "Equipo"), los módulos 🔧 se limitan a los de ESE equipo; stock
   * 📦 y catálogo 📇 aparecen siempre. Sin equipo: todos los módulos del cliente.
   */
  const getItemOptions = useCallback((equipoId: string): SearchableSelectOption[] => [
    ...moduloOptions.filter(m => !equipoId || m.sistemaId === equipoId).map(m => m.option),
    ...otrasOptions,
  ], [moduloOptions, otrasOptions]);

  /**
   * Aplica una selección del SearchableSelect al draft: setea los vínculos y
   * precarga descripción / código / serie según el origen. Un valor sin prefijo
   * conocido es texto libre (modo creatable) → va a descripcionLibre.
   */
  const applySeleccion = (draft: ItemFichaDraft, value: string): ItemFichaDraft => {
    const limpio = {
      ...draft,
      seleccion: value,
      articuloId: '', articuloCodigo: '', articuloDescripcion: '',
      sistemaId: '', moduloId: '',
    };
    if (!value) return limpio;
    if (value.startsWith('mod:')) {
      const [, sistemaId, moduloId] = value.split(':');
      const entry = modulosCliente.find(mc => mc.sistema.id === sistemaId && mc.modulo.id === moduloId);
      return {
        ...limpio,
        sistemaId,
        moduloId,
        descripcionLibre: entry
          ? [entry.modulo.nombre, entry.modulo.descripcion].filter(Boolean).join(' — ')
          : draft.descripcionLibre,
        serie: entry?.modulo.serie || draft.serie,
      };
    }
    if (value.startsWith('art:')) {
      const art = articulos.find(a => a.id === value.slice(4));
      return art
        ? { ...limpio, articuloId: art.id, articuloCodigo: art.codigo, articuloDescripcion: art.descripcion }
        : limpio;
    }
    if (value.startsWith('cat:')) {
      const cat = catalogo.find(c => c.id === value.slice(4));
      return cat
        ? { ...limpio, articuloCodigo: cat.codigoModulo, articuloDescripcion: cat.descripcion || cat.codigoModulo }
        : limpio;
    }
    // Texto libre (opción "Crear" del creatable, o commit-on-close)
    return { ...limpio, seleccion: '', descripcionLibre: value };
  };

  /**
   * Aplica el cambio del selector "Equipo" al draft. Si el módulo elegido no
   * pertenece al equipo nuevo, se limpia el vínculo de módulo (no se dejan
   * inconsistencias sistema↔módulo). Elegir un módulo directamente ya
   * autocompleta el equipo (applySeleccion setea sistemaId).
   */
  const applyEquipo = (draft: ItemFichaDraft, equipoId: string): ItemFichaDraft => {
    const clearModulo = draft.moduloId
      ? { moduloId: '', seleccion: draft.seleccion.startsWith('mod:') ? '' : draft.seleccion }
      : {};
    if (!equipoId) {
      // Sin equipo: si había módulo elegido, el vínculo pierde su sistema → se limpia.
      return { ...draft, ...clearModulo, sistemaId: '' };
    }
    const moduloSigue = draft.moduloId
      && modulosCliente.some(mc => mc.sistema.id === equipoId && mc.modulo.id === draft.moduloId);
    return moduloSigue
      ? { ...draft, sistemaId: equipoId }
      : { ...draft, ...clearModulo, sistemaId: equipoId };
  };

  return { equipoOptions, getItemOptions, applySeleccion, applyEquipo };
}
