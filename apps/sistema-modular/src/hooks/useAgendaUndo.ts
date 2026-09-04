import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgendaEntry } from '@ags/shared';
import {
  registrarAccion, valoresPrevios, etiquetaDeshacer, describirPaso, datosParaRecrear,
  type AccionAgenda, type PasoDeshacer,
} from '../utils/agendaUndo';
import { reasignarOTDesdeAgenda, propagarEstadoAgendaAOT } from '../utils/agendaOTSync';

type DatosCrear = Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'updatedBy' | 'updatedByName'>;

interface Ops {
  entries: AgendaEntry[];
  createEntry: (data: DatosCrear) => Promise<string>;
  updateEntry: (id: string, data: Partial<AgendaEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

/**
 * Ctrl+Z en la agenda (2026-09-04, pedido de coordinación): envuelve las tres
 * escrituras de `useAgenda` para anotar cómo revertir cada una, y deshace de a
 * un paso (un gesto: pegar varias OTs o cambiar toda una celda cuenta como uno).
 * Hasta 10 pasos, ver `agendaUndo.ts`.
 *
 * Lo que la agenda hace de más sobre la OT también se revierte: al recrear una
 * entrada borrada la OT vuelve a quedar asignada con ingeniero y fecha; al
 * deshacer un cambio de estado, la OT acompaña dentro de su banda. Borrar una
 * entrada creada por error ya revierte la OT por el camino normal de
 * `deleteEntry` (con sus guards).
 *
 * Una entrada recreada tiene id NUEVO: se guarda el alias viejo→nuevo para
 * que un paso anterior que la nombraba siga encontrándola.
 */
export function useAgendaUndo({ entries, createEntry, updateEntry, deleteEntry }: Ops) {
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const pilaRef = useRef<PasoDeshacer[]>([]);
  const deshaciendoRef = useRef(false);
  const aliasRef = useRef(new Map<string, string>());
  const [pasos, setPasos] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const resolverId = (id: string): string => {
    let cur = id;
    for (let i = 0; i < 20 && aliasRef.current.has(cur); i++) cur = aliasRef.current.get(cur)!;
    return cur;
  };

  const anotar = (accion: AccionAgenda) => {
    if (deshaciendoRef.current) return;
    pilaRef.current = registrarAccion(pilaRef.current, accion, Date.now());
    setPasos(pilaRef.current.length);
  };

  const create = useCallback(async (data: DatosCrear) => {
    const id = await createEntry(data);
    // '' = bloqueada por feriado / finde / día AGS: no hubo alta que deshacer.
    if (id) anotar({ tipo: 'crear', id, etiqueta: etiquetaDeshacer(data), otNumber: data.otNumber || null });
    return id;
  }, [createEntry]);

  const update = useCallback(async (id: string, data: Partial<AgendaEntry>) => {
    const actual = entriesRef.current.find(e => e.id === id);
    await updateEntry(id, data);
    if (actual) {
      anotar({ tipo: 'editar', id, antes: valoresPrevios(actual, data), etiqueta: etiquetaDeshacer(actual), otNumber: actual.otNumber || null });
    }
  }, [updateEntry]);

  const remove = useCallback(async (id: string) => {
    const actual = entriesRef.current.find(e => e.id === id);
    await deleteEntry(id);
    if (actual) anotar({ tipo: 'borrar', entry: actual, etiqueta: etiquetaDeshacer(actual) });
  }, [deleteEntry]);

  const undo = useCallback(async () => {
    const paso = pilaRef.current[pilaRef.current.length - 1];
    if (!paso || deshaciendoRef.current) return;
    pilaRef.current = pilaRef.current.slice(0, -1);
    setPasos(pilaRef.current.length);
    deshaciendoRef.current = true;
    try {
      // En orden inverso: lo último que se hizo es lo primero que se revierte.
      for (const a of [...paso.acciones].reverse()) {
        if (a.tipo === 'crear') {
          await deleteEntry(resolverId(a.id));
        } else if (a.tipo === 'editar') {
          const id = resolverId(a.id);
          await updateEntry(id, a.antes);
          if (a.otNumber) {
            const e = entriesRef.current.find(x => x.id === id);
            const movio = 'fechaInicio' in a.antes || 'ingenieroId' in a.antes;
            if (movio && e) {
              reasignarOTDesdeAgenda(a.otNumber, {
                ingenieroId: a.antes.ingenieroId ?? e.ingenieroId,
                ingenieroNombre: a.antes.ingenieroNombre ?? e.ingenieroNombre,
                fecha: a.antes.fechaInicio ?? e.fechaInicio,
              }, 'agenda.undo');
            }
            if (a.antes.estadoAgenda) propagarEstadoAgendaAOT(a.otNumber, a.antes.estadoAgenda);
          }
        } else {
          const datos = datosParaRecrear(a.entry);
          const nuevo = await createEntry(datos);
          if (nuevo) {
            aliasRef.current.set(a.entry.id, nuevo);
            if (datos.otNumber) {
              reasignarOTDesdeAgenda(datos.otNumber, {
                ingenieroId: datos.ingenieroId, ingenieroNombre: datos.ingenieroNombre, fecha: datos.fechaInicio,
              }, 'agenda.undo');
            }
          }
        }
      }
      setAviso(describirPaso(paso));
    } catch (err) {
      console.error('[agenda] deshacer falló:', err);
      setAviso('No se pudo deshacer');
    } finally {
      deshaciendoRef.current = false;
    }
  }, [createEntry, updateEntry, deleteEntry]);

  // Ctrl+Z global, salvo cuando se está escribiendo en un campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      e.preventDefault();
      void undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  // El aviso se va solo.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2500);
    return () => clearTimeout(t);
  }, [aviso]);

  return { createEntry: create, updateEntry: update, deleteEntry: remove, undo, pasosDeshacer: pasos, avisoDeshacer: aviso };
}
