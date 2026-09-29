/**
 * Inventario anual valorizado (2026-09-29). Puro: arma una fila por artículo a
 * partir de las unidades en stock, con precio EXW promedio y valor en USD.
 *
 * Reglas acordadas con el usuario:
 *  - Entran unidades activas disponibles, reservadas y asignadas (las asignadas
 *    pueden volver). Lo que está en clientes, proveedores, tránsito o remito, no.
 *  - Las posiciones determinan qué es vendible en primera instancia: se filtra
 *    por una o varias posiciones (o todas).
 *  - Segundo criterio, doble: el código que termina en B o C (con o sin guion)
 *    marca usado/reacondicionado (B) o desguace (C), y la `condicion` de la
 *    unidad cargada al alta. Ambos excluyen, y lo excluido se lista aparte para
 *    que el usuario lo confirme.
 *  - Precio EXW = costo de la tanda ÷ factor de importación (sin el costo de
 *    importar), promedio ponderado por cantidad. Sin factor no se puede separar
 *    y la tanda no aporta precio. Moneda USD.
 */
import type { CondicionUnidad, EstadoUnidad, TipoUbicacionStock } from '@ags/shared';

export interface UnidadInv {
  articuloId: string;
  cantidad?: number | null;
  estado: EstadoUnidad | string;
  condicion?: CondicionUnidad | string | null;
  activo?: boolean;
  ubicacion?: { tipo: TipoUbicacionStock | string; referenciaId: string; referenciaNombre?: string | null } | null;
  costoUnitario?: number | null;
  monedaCosto?: string | null;
  factorImportacion?: number | null;
  factorImportacionReal?: number | null;
  costoUnitarioReal?: number | null;
}

export interface ArticuloInv {
  id: string;
  codigo: string;
  descripcion: string;
  marcaId?: string | null;
  categoriaEquipo?: string | null;
  activo?: boolean;
  /** Confirmado vendible por el usuario: ignora sufijo B/C y condición. */
  vendibleConfirmado?: boolean | null;
}

export interface PosicionInv { id: string; codigo: string; nombre: string; parentId?: string | null }

export interface FiltrosInventario {
  /** Ids de posición elegidos; vacío = todas. Un depósito incluye sus estantes y cajones. */
  posicionIds: string[];
  /** Posiciones a sacar (también sus hijas): depósitos enteros que no entran. */
  posicionesExcluidas: string[];
  /** Artículos quitados a mano desde la tabla. */
  articulosExcluidos: string[];
  /** Incluir unidades fuera de una posición (minikits armados, asignadas a ingenieros). */
  incluirFueraDePosicion: boolean;
  excluirSufijo: boolean;
  excluirCondicion: boolean;
}

export type MotivoExclusion = 'sufijo' | 'condicion' | 'manual';

export interface FilaInventario {
  articuloId: string;
  codigo: string;
  descripcion: string;
  marca: string;
  categoria: string;
  cantidad: number;
  /** Nombres de posición / ubicación donde hay unidades. */
  ubicaciones: string[];
  /** Promedio ponderado, USD, sin costo de importación. null = nadie tiene precio. */
  precioExw: number | null;
  tandasConPrecio: number;
  tandasSinPrecio: number;
  valor: number | null;
  sufijoNoVendible: boolean;
  /** El usuario lo confirmó vendible pese al sufijo o la condición. */
  vendibleConfirmado: boolean;
  /** Condiciones distintas presentes en las unidades (nuevo, reacondicionado…). */
  condiciones: string[];
  /** Por qué quedó fuera del listado vendible (null = entra). */
  excluida: MotivoExclusion | null;
}

export interface ResultadoInventario {
  vendibles: FilaInventario[];
  excluidas: FilaInventario[];
  totalValor: number;
  totalCantidad: number;
  sinPrecio: number;
}

export const ESTADOS_INVENTARIO = new Set<string>(['disponible', 'reservado', 'asignado']);
export const UBICACIONES_EN_STOCK = new Set<string>(['posicion', 'minikit', 'ingeniero']);
/** Condiciones que NO se venden como nuevas. `vendible` y `nuevo` entran. */
export const CONDICIONES_NO_VENDIBLES = new Set<string>(['reacondicionado', 'scrap', 'bien_de_uso']);

/** "…B", "…C", "…-B", "…-C", "… B": termina en B o C. */
export const tieneSufijoNoVendible = (codigo: string): boolean => /[BC]$/i.test(codigo.trim());

/** true si `id` es alguna de `raices` o está debajo de alguna (cadena de `parentId`). */
export function estaBajo(id: string, raices: Set<string>, posiciones: Map<string, PosicionInv>): boolean {
  let actual: string | null | undefined = id;
  let guard = 0;
  while (actual && guard++ < 8) {
    if (raices.has(actual)) return true;
    actual = posiciones.get(actual)?.parentId ?? null;
  }
  return false;
}

/** Ruta legible de una posición: "Depósito 1 / Estante 3 / Cajón 2". */
export function rutaPosicion(id: string, posiciones: Map<string, PosicionInv>): string {
  const partes: string[] = [];
  let actual = posiciones.get(id);
  let guard = 0;
  while (actual && guard++ < 6) {
    partes.unshift(actual.nombre || actual.codigo);
    actual = actual.parentId ? posiciones.get(actual.parentId) : undefined;
  }
  return partes.join(' / ');
}

/** Precio EXW de una tanda o null si no se puede separar del costo de importación. */
export function precioExwTanda(u: UnidadInv): number | null {
  const costo = u.costoUnitarioReal ?? u.costoUnitario;
  const factor = u.factorImportacionReal ?? u.factorImportacion;
  if (!costo || costo <= 0 || !factor || factor <= 0) return null;
  if (u.monedaCosto && u.monedaCosto !== 'USD') return null;
  return costo / factor;
}

export function armarInventario(
  unidades: UnidadInv[],
  articulos: ArticuloInv[],
  posiciones: PosicionInv[],
  marcas: Map<string, string>,
  filtros: FiltrosInventario,
): ResultadoInventario {
  const posById = new Map(posiciones.map(p => [p.id, p]));
  const artById = new Map(articulos.map(a => [a.id, a]));
  const elegidas = new Set(filtros.posicionIds);
  const excluidasPos = new Set(filtros.posicionesExcluidas);
  const excluidosArt = new Set(filtros.articulosExcluidos);

  type Acc = { cantidad: number; ubic: Set<string>; conPrecio: number; sinPrecio: number; sumaValor: number; cantConPrecio: number; condiciones: Set<string> };
  const acc = new Map<string, Acc>();

  for (const u of unidades) {
    if (u.activo === false) continue;
    if (!ESTADOS_INVENTARIO.has(u.estado)) continue;
    const tipo = u.ubicacion?.tipo ?? '';
    if (!UBICACIONES_EN_STOCK.has(tipo)) continue;
    if (tipo === 'posicion') {
      const posId = u.ubicacion?.referenciaId ?? '';
      if (elegidas.size > 0 && !estaBajo(posId, elegidas, posById)) continue;
      if (excluidasPos.size > 0 && estaBajo(posId, excluidasPos, posById)) continue;
    } else if (!filtros.incluirFueraDePosicion) {
      continue;
    }
    const art = artById.get(u.articuloId);
    if (!art) continue;
    const cant = u.cantidad ?? 1;
    let a = acc.get(art.id);
    if (!a) { a = { cantidad: 0, ubic: new Set(), conPrecio: 0, sinPrecio: 0, sumaValor: 0, cantConPrecio: 0, condiciones: new Set() }; acc.set(art.id, a); }
    a.cantidad += cant;
    a.ubic.add(tipo === 'posicion'
      ? (rutaPosicion(u.ubicacion?.referenciaId ?? '', posById) || u.ubicacion?.referenciaNombre || 'Posición')
      : tipo === 'minikit' ? `Minikit ${u.ubicacion?.referenciaNombre ?? ''}`.trim() : `Asignado a ${u.ubicacion?.referenciaNombre ?? 'ingeniero'}`);
    if (u.condicion) a.condiciones.add(u.condicion);
    const exw = precioExwTanda(u);
    if (exw == null) a.sinPrecio += 1;
    else { a.conPrecio += 1; a.sumaValor += exw * cant; a.cantConPrecio += cant; }
  }

  const filas: FilaInventario[] = [];
  for (const [id, a] of acc) {
    const art = artById.get(id)!;
    const precio = a.cantConPrecio > 0 ? a.sumaValor / a.cantConPrecio : null;
    const sufijo = tieneSufijoNoVendible(art.codigo);
    const condNoVendible = [...a.condiciones].some(c => CONDICIONES_NO_VENDIBLES.has(c));
    const confirmado = art.vendibleConfirmado === true;
    const excluida: MotivoExclusion | null =
      excluidosArt.has(id) ? 'manual'
      : confirmado ? null
      : filtros.excluirSufijo && sufijo ? 'sufijo'
      : filtros.excluirCondicion && condNoVendible ? 'condicion' : null;
    filas.push({
      articuloId: id, codigo: art.codigo, descripcion: art.descripcion,
      marca: (art.marcaId && marcas.get(art.marcaId)) || '', categoria: art.categoriaEquipo ?? '',
      cantidad: a.cantidad, ubicaciones: [...a.ubic].sort(),
      precioExw: precio, tandasConPrecio: a.conPrecio, tandasSinPrecio: a.sinPrecio,
      valor: precio == null ? null : precio * a.cantidad,
      sufijoNoVendible: sufijo, vendibleConfirmado: confirmado, condiciones: [...a.condiciones].sort(), excluida,
    });
  }
  filas.sort((x, y) => x.codigo.localeCompare(y.codigo));
  const vendibles = filas.filter(f => !f.excluida);
  return {
    vendibles,
    excluidas: filas.filter(f => f.excluida),
    totalValor: vendibles.reduce((s, f) => s + (f.valor ?? 0), 0),
    totalCantidad: vendibles.reduce((s, f) => s + f.cantidad, 0),
    sinPrecio: vendibles.filter(f => f.precioExw == null).length,
  };
}
