/**
 * Unit tests — N° de serie en el remito armado desde el inventario del
 * ingeniero (2026-09-10).
 *
 * Run with: pnpm --filter @ags/sistema-modular test:inventario-remito
 *
 * El bug: la asignación guarda solo el id de la unidad de stock y la serie vive
 * en el doc de la unidad. `inventarioToRemitoItem` nunca estampaba `serie`, así
 * que el remito salía sin ella en pantalla y en el papel (el papel la imprime
 * desde `serie` vía `lineaDescripcionRemito`).
 */

import assert from 'node:assert/strict';
import type { InventarioItem } from '../../hooks/useInventarioIngeniero';
import { inventarioToRemitoItem, lineaDescripcionRemito } from '../inventarioToRemitoItem.js';

const base = (extra: Partial<InventarioItem>): InventarioItem => ({
  id: 'ai1', tipo: 'articulo', cantidad: 1, cantidadDevuelta: 0, cantidadConsumida: 0,
  estado: 'asignado', permanente: false, fechaAsignacion: '2026-09-01', fechaDevolucion: null,
  asignacionId: 'asg1', asignacionNumero: 'ASG-0001',
  ...extra,
} as InventarioItem);

// ── Unidad de stock con serie: la línea la lleva y el papel la imprime ──────
{
  const it = inventarioToRemitoItem(base({
    unidadId: 'u1', articuloId: 'a1', articuloCodigo: 'G7129A', articuloDescripcion: 'Inyector automático', serie: 'CN54321',
  }));
  assert.equal(it.serie, 'CN54321', 'la serie de la unidad viaja a la línea del remito');
  assert.equal(lineaDescripcionRemito(it), 'Inyector automático · S/N CN54321', 'el papel la imprime como S/N');
}

// ── Sin serie: nada raro ────────────────────────────────────────────────────
{
  const it = inventarioToRemitoItem(base({ unidadId: 'u2', articuloCodigo: '5190-1464', articuloDescripcion: 'Jeringa' }));
  assert.equal(it.serie, null);
  assert.equal(lineaDescripcionRemito(it), 'Jeringa');
}

// ── Columna: serie y vínculos propios ───────────────────────────────────────
{
  const it = inventarioToRemitoItem(base({
    tipo: 'columna', columnaId: 'c1', columnaCodigo: '993967-902', columnaDescripcion: 'ZORBAX SB-C18', columnaSerie: 'USKH0123',
  }));
  assert.equal(it.serie, 'USKH0123', 'la serie de la columna también');
  assert.equal(it.columnaId, 'c1', 'vínculo a la columna para la devolución');
  assert.equal(it.columnaSerie, 'USKH0123');
}

// ── Dispositivo: la serie ya es el código, no se repite como S/N ────────────
{
  const it = inventarioToRemitoItem(base({
    tipo: 'dispositivo', dispositivoId: 'd1', dispositivoDescripcion: 'Notebook Dell', dispositivoSerie: 'ABC123',
  }));
  assert.equal(it.dispositivoCodigo, 'ABC123');
  assert.equal(it.serie, null, 'sin S/N duplicado en la descripción');
}

// ── Patrón: vínculos para marcar la devolución ──────────────────────────────
{
  const it = inventarioToRemitoItem(base({ tipo: 'patron', patronId: 'p1', patronCodigo: 'KIT-01', patronDescripcion: 'Kit de pH', patronLote: 'L-77' }));
  assert.equal(it.patronId, 'p1');
  assert.equal(it.patronLote, 'L-77');
}

console.log('✓ inventarioRemitoSerie: la serie de la unidad llega al remito y al papel; columna/patrón conservan sus vínculos');
