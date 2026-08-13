import { useEffect, useState } from 'react';
import type { Articulo } from '@ags/shared';
import { articulosService, unidadesService } from '../services/stockService';

export interface PresentacionAlerta {
  codigo: string;
  /** Artículo propio del catálogo que ya usa ese N° de parte. */
  articuloId: string;
  descripcion: string;
  /** Unidades activas cargadas en ese artículo (lo que habría que consolidar). */
  unidades: number;
}

/**
 * Avisa cuando un N° de parte declarado como presentación YA EXISTE como
 * artículo propio del catálogo (2026-08-13).
 *
 * El campo es texto a propósito —una presentación es otro código del MISMO
 * artículo, no una FK— pero mientras el catálogo tenga los duplicados sin
 * migrar hay dos cosas reclamando el mismo código: el artículo suelto (con su
 * stock) y la presentación. Escribirlo a ciegas es justo lo que produjo el
 * enredo; este aviso lo hace visible en el momento de cargarlo, con cuántas
 * unidades hay que consolidar.
 *
 * Solo informa: no bloquea el guardado — la consolidación es una migración
 * aparte (Fase 4 del plan presentaciones-de-compra).
 */
export function usePresentacionAlerta(
  codigos: string[],
  articuloIdActual: string | null,
): PresentacionAlerta[] {
  const [alertas, setAlertas] = useState<PresentacionAlerta[]>([]);
  // Clave estable: evita re-consultar mientras el usuario tipea otras columnas.
  const key = codigos.map(c => c.trim().toLowerCase()).filter(Boolean).sort().join('|');

  useEffect(() => {
    let cancelado = false;
    const limpios = key ? key.split('|') : [];
    if (limpios.length === 0) { setAlertas([]); return; }

    void (async () => {
      try {
        const todos = await articulosService.getAll({ activoOnly: false }) as Articulo[];
        const encontrados = todos.filter(a =>
          a.id !== articuloIdActual && limpios.includes((a.codigo ?? '').trim().toLowerCase()));
        if (encontrados.length === 0) { if (!cancelado) setAlertas([]); return; }

        const conStock = await Promise.all(encontrados.map(async a => {
          const us = await unidadesService.getAll({ articuloId: a.id }).catch(() => []);
          const unidades = us
            .filter(u => u.activo !== false && u.estado !== 'consumido' && u.estado !== 'entregado' && u.estado !== 'vendido' && u.estado !== 'baja')
            .reduce((acc, u) => acc + (u.cantidad ?? 1), 0);
          return { codigo: a.codigo, articuloId: a.id, descripcion: a.descripcion, unidades };
        }));
        if (!cancelado) setAlertas(conStock);
      } catch (err) {
        console.error('[usePresentacionAlerta] chequeo de duplicados falló:', err);
        if (!cancelado) setAlertas([]);
      }
    })();

    return () => { cancelado = true; };
  }, [key, articuloIdActual]);

  return alertas;
}
