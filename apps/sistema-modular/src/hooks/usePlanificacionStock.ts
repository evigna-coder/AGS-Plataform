import { useCallback, useEffect, useState } from 'react';
import type { Articulo, StockAmplio } from '@ags/shared';
import { articulosService } from '../services/stockService';
import { marcasService } from '../services/catalogService';
import { proveedoresService } from '../services/personalService';
import { fetchStockAmplioBulk, stockAmplioVacio } from '../services/stockAmplioService';

type Opcion = { id: string; nombre: string };

export interface StockAmplioResuelto {
  stockAmplio: StockAmplio | null;
  source: 'firestore' | 'computed' | null;
  loading: boolean;
}

/**
 * Datos de Planificación de stock (extraído de la página, 2026-09-11).
 *
 * Lecturas: UNA suscripción a los artículos activos (el mirror `resumenStock`
 * llega vivo por acá) + un cálculo en bloque de tres consultas para los
 * artículos sin mirror. Antes cada fila abría su propio listener al artículo
 * y, sin mirror, tres consultas: con ~4.000 artículos eran ~4.000 listeners y
 * ~6.000 consultas vacías por apertura. Sin serviceCache (STKP-04).
 */
export function usePlanificacionStock() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [marcas, setMarcas] = useState<Opcion[]>([]);
  const [proveedores, setProveedores] = useState<Opcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculado, setCalculado] = useState<Map<string, StockAmplio> | null>(null);

  useEffect(() => articulosService.subscribe(
    { activoOnly: true },
    arts => { setArticulos(arts); setLoading(false); },
    err => { console.error('[usePlanificacionStock] artículos:', err); setLoading(false); },
  ), []);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      marcasService.getAll(true).catch(() => [] as Opcion[]),
      proveedoresService.getAll(true).catch(() => [] as Opcion[]),
    ]).then(([ms, ps]) => {
      if (!vivo) return;
      setMarcas(ms.map((m: Opcion) => ({ id: m.id, nombre: m.nombre })));
      setProveedores(ps.map((p: Opcion) => ({ id: p.id, nombre: p.nombre })));
    });
    return () => { vivo = false; };
  }, []);

  // Fallback para artículos sin `resumenStock`: una pasada al abrir la pantalla.
  useEffect(() => {
    let vivo = true;
    fetchStockAmplioBulk()
      .then(m => { if (vivo) setCalculado(m); })
      .catch(err => { console.warn('[usePlanificacionStock] cálculo en bloque falló:', err); if (vivo) setCalculado(new Map()); });
    return () => { vivo = false; };
  }, []);

  const stockDe = useCallback((a: Articulo): StockAmplioResuelto => {
    if (a.resumenStock) return { stockAmplio: a.resumenStock, source: 'firestore', loading: false };
    if (!calculado) return { stockAmplio: null, source: null, loading: true };
    return { stockAmplio: calculado.get(a.id) ?? stockAmplioVacio(), source: 'computed', loading: false };
  }, [calculado]);

  return { articulos, marcas, proveedores, loading, calculado, stockDe };
}
