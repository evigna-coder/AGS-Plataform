import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import type { ActividadUsuario } from '@ags/shared';
import { actividadStore } from '../services/actividadStore';

/** Actividad del usuario (más usadas y recientes), en vivo. */
export function useActividad(): ActividadUsuario {
  return useSyncExternalStore(actividadStore.suscribir, actividadStore.get);
}

/**
 * Anota el documento abierto en "Recientes" de la pestaña nueva (2026-10-01).
 * Va en cada página de detalle; `titulo` en null mientras carga.
 * Ej.: `useTituloReciente('OT', ot ? \`OT ${ot.otNumber}\` : null)`.
 */
export function useDocumentoReciente(path: string | null, tipo: string, titulo: string | null | undefined) {
  useEffect(() => {
    if (path && titulo?.trim()) actividadStore.registrarReciente({ path, titulo, tipo });
  }, [path, titulo, tipo]);
}

/** Igual que `useDocumentoReciente` con la ruta actual de la pestaña (páginas de detalle). */
export function useTituloReciente(tipo: string, titulo: string | null | undefined) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (titulo?.trim()) actividadStore.registrarReciente({ path: pathname, titulo, tipo });
  }, [pathname, titulo, tipo]);
}
