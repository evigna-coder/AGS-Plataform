import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Articulo, PerfilConsumo } from '@ags/shared';
import {
  categoriasEquipoService, clientesService, contratosService, establecimientosService,
  importacionesService, modulosService, ordenesCompraService, ordenesTrabajoService,
  sistemasService, unidadesService, articulosService, agendaService,
} from '../services/firebaseService';
import { perfilesConsumoService } from '../services/perfilesConsumoService';
import { consumiblesPorModuloService } from '../services/consumiblesPorModuloService';
import { fechaLocalYMD } from '../utils/formatFecha';
import {
  ingresosPrevistos, mesesDesde, planificarInsumos,
  type EntradaMotor, type ResultadoMotor,
} from '../utils/planificacionInsumos';

/** Todo lo que el motor necesita menos el horizonte (que cambia sin recargar). */
type Datos = Omit<EntradaMotor, 'hoy' | 'horizonteMeses' | 'agenda'> & { agendaPorAnio: Map<number, EntradaMotor['agenda']> };

const hoyYMD = () => new Date().toISOString().slice(0, 10);

/**
 * Perfiles derivados del catálogo `consumibles_por_modulo` (anexo de consumibles
 * de los presupuestos): un módulo Agilent → sus consumibles con cantidad por
 * mantenimiento. Se usan como perfiles de módulo de solo lectura; solo cuentan
 * los códigos que hoy son artículos planificables.
 */
function perfilesDesdeCatalogo(catalogo: Awaited<ReturnType<typeof consumiblesPorModuloService.getAll>>, planificables: Articulo[]): PerfilConsumo[] {
  const porCodigo = new Map(planificables.map(a => [a.codigo.trim().toUpperCase(), a]));
  const out: PerfilConsumo[] = [];
  for (const c of catalogo) {
    if (!c.activo || !c.codigoModulo) continue;
    const items = c.consumibles
      .map(x => { const a = porCodigo.get(x.codigo.trim().toUpperCase()); return a ? { articuloId: a.id, articuloCodigo: a.codigo, cantidadPorServicio: x.cantidad, porPuerto: null } : null; })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (items.length === 0) continue;
    out.push({
      id: `cpm:${c.id}`, nombre: `${c.codigoModulo}${c.descripcion ? ` · ${c.descripcion}` : ''} (catálogo)`,
      criterio: { ambito: 'modulo', codigoModulo: c.codigoModulo }, items, activo: true,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
    });
  }
  return out;
}

export function usePlanificacionInsumos(horizonteMeses: number) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilConsumo[]>([]);
  const [perfilesCatalogo, setPerfilesCatalogo] = useState<PerfilConsumo[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion(v => v + 1), []);

  const recargarPerfiles = useCallback(async () => {
    const [propios, catalogo] = await Promise.all([perfilesConsumoService.getAll(), consumiblesPorModuloService.getAll()]);
    const planificables = await articulosService.getPlanificables();
    setPerfiles(propios);
    setPerfilesCatalogo(perfilesDesdeCatalogo(catalogo, planificables));
  }, []);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setError(null);
    const hoy = hoyYMD();
    const anios = new Set(mesesDesde(hoy, 12).map(m => Number(m.slice(0, 4))));
    (async () => {
      const [planificables, propios, catalogo, sistemas, modulos, categorias, establecimientos, clientes, ots, contratos, ocs, importaciones, disponibles, ...agendas] = await Promise.all([
        articulosService.getPlanificables(),
        perfilesConsumoService.getAll(),
        consumiblesPorModuloService.getAll(),
        sistemasService.getAll({ activosOnly: true }),
        modulosService.getAllGrouped(),
        categoriasEquipoService.getAll(),
        establecimientosService.getAll(),
        clientesService.getAll(),
        ordenesTrabajoService.getAll(),
        contratosService.getAll({ estado: 'activo' }),
        ordenesCompraService.getAll(),
        importacionesService.getAll(),
        unidadesService.getAll({ estado: 'disponible' }),
        ...[...anios].map(a => agendaService.getByAnio(a)),
      ]);
      if (!vivo) return;
      const idsPlan = new Set(planificables.map(a => a.id));
      const estById = new Map(establecimientos.map(e => [e.id, e]));
      const clienteNombre = new Map(clientes.map(c => [c.id, c.razonSocial]));
      const disponible = new Map<string, number>();
      for (const u of disponibles) {
        if (!idsPlan.has(u.articuloId)) continue;
        if ((u as { ubicacion?: { tipo?: string } }).ubicacion?.tipo === 'remito') continue;
        disponible.set(u.articuloId, (disponible.get(u.articuloId) ?? 0) + (u.cantidad ?? 1));
      }
      const agendaPorAnio = new Map<number, EntradaMotor['agenda']>();
      [...anios].forEach((a, i) => agendaPorAnio.set(a, (agendas[i] ?? []).map(e => ({ otNumber: e.otNumber, fechaInicio: e.fechaInicio, estadoAgenda: e.estadoAgenda }))));
      setArticulos(planificables);
      setPerfiles(propios);
      setPerfilesCatalogo(perfilesDesdeCatalogo(catalogo, planificables));
      setDatos({
        articulos: planificables,
        perfiles: [],
        sistemas: sistemas.map(s => {
          const est = estById.get(s.establecimientoId);
          const cliId = est?.clienteId ?? s.clienteId ?? null;
          return {
            id: s.id, nombre: s.nombre, categoriaId: s.categoriaId, activo: s.activo !== false,
            configuracionGC: s.configuracionGC ?? null, codigoInternoCliente: s.codigoInternoCliente ?? null,
            clienteNombre: (cliId && clienteNombre.get(cliId)) || est?.nombre || null,
          };
        }),
        modulos: modulos.map(m => ({ sistemaId: m.sistemaId, nombre: m.nombre, descripcion: m.descripcion, marca: m.marca })),
        categorias: categorias.map(c => ({ id: c.id, nombre: c.nombre })),
        ots: ots.map(ot => ({
          otNumber: ot.otNumber, tipoServicio: ot.tipoServicio,
          fecha: fechaLocalYMD(ot.fechaServicioAprox) || fechaLocalYMD(ot.fechaInicio) || fechaLocalYMD(ot.createdAt) || null,
          sistemaId: ot.sistemaId ?? null, sistemaTexto: ot.sistema ?? null,
          estadoAdmin: ot.estadoAdmin ?? null, status: ot.status ?? null, contratoId: ot.contratoId ?? null,
        })),
        contratos,
        disponible,
        ingresos: ingresosPrevistos(
          ocs.map(oc => ({ id: oc.id, numero: oc.numero, estado: oc.estado, fechaEntregaEstimada: oc.fechaEntregaEstimada ?? null, items: oc.items ?? [] })),
          importaciones.map(imp => ({ id: imp.id, numero: imp.numero, estado: imp.estado, ordenCompraId: imp.ordenCompraId ?? null, fechaEstimadaArribo: imp.fechaEstimadaArribo ?? null, items: imp.items ?? [] })),
          idsPlan,
        ),
        agendaPorAnio,
      });
      setLoading(false);
    })().catch(err => {
      console.error('[usePlanificacionInsumos]', err);
      if (vivo) { setError(err instanceof Error ? err.message : 'No se pudo cargar la planificación'); setLoading(false); }
    });
    return () => { vivo = false; };
  }, [version]);

  const resultado = useMemo<ResultadoMotor | null>(() => {
    if (!datos) return null;
    const hoy = hoyYMD();
    const agenda = [...datos.agendaPorAnio.values()].flat();
    const { agendaPorAnio: _a, ...resto } = datos;
    void _a;
    return planificarInsumos({ ...resto, hoy, horizonteMeses, agenda, perfiles: [...perfiles, ...perfilesCatalogo] });
  }, [datos, perfiles, perfilesCatalogo, horizonteMeses]);

  return { resultado, articulos, perfiles, perfilesCatalogo, categorias: datos?.categorias ?? [], loading, error, recargar, recargarPerfiles };
}
