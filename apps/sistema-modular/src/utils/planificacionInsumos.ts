/**
 * Motor de la Planificación de insumos críticos (2026-09-28). Puro: recibe
 * listas ya leídas y devuelve la tabla artículo × mes. Sin Firestore, sin React.
 *
 * Reglas (acordadas con el usuario, ver .claude/plans/planificacion-insumos.md):
 *  - Solo cuenta el mantenimiento PREVENTIVO (tipo de servicio único).
 *  - Servicios previstos por mes y por categoría de equipo = el MAYOR entre
 *    (agendados + pendientes con fecha + proyección de contratos) y los
 *    realizados el mismo mes del año anterior.
 *  - Cada servicio consume según los PERFILES que matchean la configuración de
 *    su equipo (módulos, GC por marca/detector/puertos, categoría como fallback).
 *    Los servicios "extra" del año anterior consumen el perfil promedio de la
 *    categoría, porque no se sabe sobre qué equipo van a caer.
 *  - Oferta = disponible hoy + OCs e importaciones por fecha estimada. Lo que
 *    ya venció o no tiene fecha entra en el primer mes y se marca.
 *  - Sin plazo de entrega: eso vive en Importaciones.
 */
import { anioDeContrato, cantidadEnUnidadBase } from '@ags/shared';
import type {
  Articulo, Contrato, ConfiguracionGC, ModuloSistema, PerfilConsumo, PresentacionUsada,
} from '@ags/shared';

// ── Entradas ──────────────────────────────────────────────────────────────────

export interface SistemaPlan {
  id: string;
  nombre: string;
  categoriaId: string;
  activo: boolean;
  configuracionGC?: ConfiguracionGC | null;
  clienteNombre?: string | null;
  codigoInternoCliente?: string | null;
}

export type ModuloPlan = Pick<ModuloSistema, 'sistemaId' | 'nombre' | 'descripcion' | 'marca'>;

export interface CategoriaPlan { id: string; nombre: string }

/** Lo mínimo de una OT que el motor necesita. */
export interface OtPlan {
  otNumber: string;
  tipoServicio: string;
  /** 'YYYY-MM-DD' — fechaServicioAprox || fechaInicio || createdAt, ya resuelta por el caller. */
  fecha: string | null;
  sistemaId?: string | null;
  /** Texto libre del equipo (OTs viejas sin `sistemaId`). */
  sistemaTexto?: string | null;
  estadoAdmin?: string | null;
  status?: string | null;
  contratoId?: string | null;
}

export interface EntradaAgendaPlan { otNumber: string; fechaInicio: string; estadoAgenda: string }

export interface IngresoPrevisto {
  articuloId: string;
  cantidad: number;
  /** 'YYYY-MM-DD' o null si la OC/importación no tiene fecha estimada. */
  fecha: string | null;
  origen: 'oc' | 'importacion';
  referencia: string;
}

export interface EntradaMotor {
  hoy: string;
  horizonteMeses: number;
  articulos: Articulo[];
  perfiles: PerfilConsumo[];
  sistemas: SistemaPlan[];
  modulos: ModuloPlan[];
  categorias: CategoriaPlan[];
  ots: OtPlan[];
  agenda: EntradaAgendaPlan[];
  contratos: Contrato[];
  /** articuloId → unidades base disponibles hoy. */
  disponible: Map<string, number>;
  ingresos: IngresoPrevisto[];
}

// ── Salidas ───────────────────────────────────────────────────────────────────

export interface ServicioPrevisto {
  origen: 'agenda' | 'pendiente' | 'contrato' | 'anio_anterior';
  cantidad: number;
  sistemaId: string | null;
  sistemaNombre: string;
  otNumber?: string | null;
  /** Nombres de los perfiles que aportaron consumo (vacío = equipo sin perfil). */
  perfiles: string[];
  /** Consumo de ESTE artículo por este servicio. */
  consumo: number;
}

export interface CeldaMes {
  mes: string;
  demanda: number;
  ingresos: number;
  stockFin: number;
  servicios: ServicioPrevisto[];
  ingresosDetalle: IngresoPrevisto[];
}

export interface FilaPlan {
  articuloId: string;
  codigo: string;
  descripcion: string;
  grupo: string | null;
  stockInicial: number;
  stockMinimo: number;
  meses: CeldaMes[];
  /** Faltante máximo del horizonte (lo que hay que comprar), redondeado hacia arriba. */
  comprar: number;
  /** Primer mes con stock proyectado negativo. */
  mesQuiebre: string | null;
  /** Ingresos contados en el primer mes por no tener fecha estimada. */
  ingresosSinFecha: number;
}

export interface ResultadoMotor {
  meses: string[];
  filas: FilaPlan[];
  /** Equipos activos con servicio previsto y SIN ningún perfil que los cubra. */
  equiposSinPerfil: Array<{ sistemaId: string; sistemaNombre: string }>;
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

export const esPreventivo = (tipoServicio: string | null | undefined): boolean =>
  /preventiv/i.test(tipoServicio ?? '');

const mesDe = (fecha: string): string => fecha.slice(0, 7);

export function mesesDesde(hoy: string, cantidad: number): string[] {
  const [y, m] = hoy.slice(0, 7).split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const restarAnio = (mes: string): string => `${Number(mes.slice(0, 4)) - 1}${mes.slice(4)}`;

const sumarAnios = (fecha: string, anios: number): string =>
  `${Number(fecha.slice(0, 4)) + anios}${fecha.slice(4, 10)}`;

/** 'YYYY-MM-DD' del día anterior (para cerrar ventanas con fin exclusivo). */
const diaAnterior = (fecha: string): string => {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};

/** Cantidad de meses calendario de `desde` a `hasta` inclusive (claves 'YYYY-MM'). */
const mesesEntre = (desde: string, hasta: string): number => {
  const [y1, m1] = desde.split('-').map(Number);
  const [y2, m2] = hasta.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
};

const ESTADOS_REALIZADA = new Set(['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO']);
const otRealizada = (ot: OtPlan): boolean =>
  ESTADOS_REALIZADA.has(ot.estadoAdmin ?? '') || (!ot.estadoAdmin && ot.status === 'FINALIZADO');
const otCancelada = (ot: OtPlan): boolean => ot.estadoAdmin === 'CANCELADA';

// ── Perfiles ↔ equipo ─────────────────────────────────────────────────────────

const norm = (s: string | null | undefined): string => (s ?? '').toUpperCase().replace(/\s+/g, '');

const inletsDe = (cfg?: ConfiguracionGC | null) =>
  [cfg?.puertoInyeccionFront, cfg?.puertoInyeccionBack, cfg?.puertoInyeccionAux].filter(Boolean) as string[];
const detectoresDe = (cfg?: ConfiguracionGC | null) =>
  [cfg?.detectorFront, cfg?.detectorBack, cfg?.detectorAux].filter(Boolean) as string[];

/**
 * Consumo por servicio de un equipo: articuloId → cantidad, más los perfiles
 * que aportaron. Un perfil de módulo se aplica una vez por módulo que matchea
 * (dos bombas iguales consumen el doble).
 */
export function consumoPorServicio(
  sistema: SistemaPlan,
  modulos: ModuloPlan[],
  perfiles: PerfilConsumo[],
): { consumo: Map<string, number>; perfiles: string[] } {
  const consumo = new Map<string, number>();
  const usados: string[] = [];
  const sumar = (perfil: PerfilConsumo, veces: number, puertos: number) => {
    if (veces <= 0) return;
    usados.push(perfil.nombre);
    for (const it of perfil.items) {
      const porServicio = it.cantidadPorServicio * (it.porPuerto ? Math.max(puertos, 1) : 1) * veces;
      consumo.set(it.articuloId, (consumo.get(it.articuloId) ?? 0) + porServicio);
    }
  };
  const inlets = inletsDe(sistema.configuracionGC);
  const detectores = detectoresDe(sistema.configuracionGC);
  const marcasEquipo = norm(sistema.nombre) + '|' + modulos.map(m => norm(m.marca)).join('|');

  for (const p of perfiles) {
    if (!p.activo) continue;
    const c = p.criterio;
    if (c.ambito === 'modulo') {
      const pref = norm(c.codigoModulo);
      if (!pref) continue;
      const veces = modulos.filter(m => norm(m.nombre).startsWith(pref) || norm(m.descripcion).includes(pref)).length;
      sumar(p, veces, inlets.length);
    } else if (c.ambito === 'gc') {
      if (c.marca && !marcasEquipo.includes(norm(c.marca))) continue;
      if (c.detector && !detectores.includes(c.detector)) continue;
      const puertos = c.inlet ? inlets.filter(i => i === c.inlet).length : inlets.length;
      if (c.inlet && puertos === 0) continue;
      sumar(p, 1, puertos);
    } else if (c.ambito === 'categoria') {
      if (c.categoriaId && c.categoriaId === sistema.categoriaId) sumar(p, 1, inlets.length);
    }
  }
  return { consumo, perfiles: usados };
}

// ── Categoría de una OT vieja sin equipo ──────────────────────────────────────

/** Mapea texto libre ("HPLC 1260", "Cromatógrafo gaseoso 7890") a una categoría por nombre. */
function categoriaPorTexto(texto: string | null | undefined, categorias: CategoriaPlan[]): string | null {
  const t = (texto ?? '').toLowerCase();
  if (!t) return null;
  const grupo = /gase|\bgc\b/.test(t) ? 'gc' : /hplc|uhplc|l[ií]quid/.test(t) ? 'hplc' : null;
  if (!grupo) return null;
  const cat = categorias.find(c => grupo === 'gc' ? /gase|\bgc\b/i.test(c.nombre) : /l[ií]quid|hplc/i.test(c.nombre));
  return cat?.id ?? null;
}

// ── Motor ─────────────────────────────────────────────────────────────────────

export function planificarInsumos(e: EntradaMotor): ResultadoMotor {
  const meses = mesesDesde(e.hoy, Math.max(1, e.horizonteMeses));
  const mesActual = meses[0];
  const setMeses = new Set(meses);
  const sistemaById = new Map(e.sistemas.map(s => [s.id, s]));
  const modulosPor = new Map<string, ModuloPlan[]>();
  for (const m of e.modulos) {
    const arr = modulosPor.get(m.sistemaId) ?? [];
    arr.push(m);
    modulosPor.set(m.sistemaId, arr);
  }
  const consumoDe = new Map<string, { consumo: Map<string, number>; perfiles: string[] }>();
  const consumoSistema = (id: string) => {
    let c = consumoDe.get(id);
    if (!c) {
      const s = sistemaById.get(id);
      c = s ? consumoPorServicio(s, modulosPor.get(id) ?? [], e.perfiles) : { consumo: new Map(), perfiles: [] };
      consumoDe.set(id, c);
    }
    return c;
  };

  // Perfil promedio por categoría: para los servicios "extra" del año anterior.
  const promedioCategoria = new Map<string, Map<string, number>>();
  for (const cat of e.categorias) {
    const equipos = e.sistemas.filter(s => s.activo && s.categoriaId === cat.id);
    const acumulado = new Map<string, number>();
    let conPerfil = 0;
    for (const s of equipos) {
      const c = consumoSistema(s.id);
      if (c.consumo.size === 0) continue;
      conPerfil++;
      for (const [art, q] of c.consumo) acumulado.set(art, (acumulado.get(art) ?? 0) + q);
    }
    if (conPerfil > 0) for (const [art, q] of acumulado) acumulado.set(art, q / conPerfil);
    promedioCategoria.set(cat.id, acumulado);
  }

  const preventivas = e.ots.filter(ot => esPreventivo(ot.tipoServicio) && !otCancelada(ot));
  const otByNumber = new Map(preventivas.map(ot => [ot.otNumber, ot]));
  const categoriaDeOt = (ot: OtPlan): string | null =>
    (ot.sistemaId && sistemaById.get(ot.sistemaId)?.categoriaId) || categoriaPorTexto(ot.sistemaTexto, e.categorias);

  // 1. Concretos: agenda (por OT) + pendientes con fecha no agendadas.
  type Concreto = { mes: string; ot: OtPlan; origen: 'agenda' | 'pendiente' };
  const concretos: Concreto[] = [];
  const agendadas = new Set<string>();
  for (const en of e.agenda) {
    if (en.estadoAgenda === 'cancelado') continue;
    const ot = otByNumber.get(en.otNumber);
    if (!ot || agendadas.has(en.otNumber)) continue;
    const mes = mesDe(en.fechaInicio);
    if (!setMeses.has(mes)) continue;
    agendadas.add(en.otNumber);
    concretos.push({ mes, ot, origen: 'agenda' });
  }
  for (const ot of preventivas) {
    if (agendadas.has(ot.otNumber) || otRealizada(ot) || !ot.fecha) continue;
    const mes = mesDe(ot.fecha);
    if (setMeses.has(mes)) concretos.push({ mes, ot, origen: 'pendiente' });
  }

  // 2. Contratos: cupo anual restante repartido en los meses que quedan del año de contrato.
  type Fraccion = { mes: string; sistemaId: string; cantidad: number; contratoNumero: string };
  const fracciones: Fraccion[] = [];
  const ultimoMes = meses[meses.length - 1];
  for (const c of e.contratos) {
    if (c.estado !== 'activo' || !c.fechaInicio) continue;
    const anual = (c.serviciosIncluidos ?? [])
      .filter(s => esPreventivo(s.tipoServicioNombre) && s.cantidadAnualPorEquipo != null)
      .reduce((acc, s) => acc + (s.cantidadAnualPorEquipo ?? 0), 0);
    if (anual <= 0) continue;
    const finContrato = c.fechaFin ? mesDe(c.fechaFin) : ultimoMes;
    for (const sistemaId of c.sistemaIds ?? []) {
      // Año de contrato vigente: consumido = realizadas o concretas en la ventana.
      let anio = anioDeContrato(c.fechaInicio, e.hoy);
      let inicioVentana = sumarAnios(c.fechaInicio, anio);
      while (mesDe(inicioVentana) <= ultimoMes && mesDe(inicioVentana) <= finContrato) {
        const finVentana = sumarAnios(inicioVentana, 1); // exclusivo
        const mesUltimoVentana = mesDe(diaAnterior(finVentana));
        const mesFinVentana = mesUltimoVentana <= finContrato ? mesUltimoVentana : finContrato;
        const desdeMes = mesDe(inicioVentana) > mesActual ? mesDe(inicioVentana) : mesActual;
        const consumidas = preventivas.filter(ot => ot.sistemaId === sistemaId && ot.fecha
          && ot.fecha >= inicioVentana && ot.fecha < finVentana
          && (otRealizada(ot) || concretos.some(k => k.ot.otNumber === ot.otNumber))).length;
        const restantes = Math.max(0, anual - consumidas);
        const nMeses = Math.max(1, mesesEntre(desdeMes, mesFinVentana));
        if (restantes > 0) {
          for (const mes of meses) {
            if (mes < desdeMes || mes > mesFinVentana) continue;
            fracciones.push({ mes, sistemaId, cantidad: restantes / nMeses, contratoNumero: c.numero });
          }
        }
        anio += 1;
        inicioVentana = finVentana;
      }
    }
  }

  // 3. Año anterior por categoría y mes.
  const anteriorPorCatMes = new Map<string, number>();
  for (const ot of preventivas) {
    if (!otRealizada(ot) || !ot.fecha) continue;
    const mes = mesDe(ot.fecha);
    const cat = categoriaDeOt(ot);
    if (!cat) continue;
    const clave = `${cat}|${mes}`;
    anteriorPorCatMes.set(clave, (anteriorPorCatMes.get(clave) ?? 0) + 1);
  }

  // 4. Demanda artículo × mes con detalle de servicios.
  const demanda = new Map<string, Map<string, { total: number; servicios: ServicioPrevisto[] }>>();
  const celda = (art: string, mes: string) => {
    let porMes = demanda.get(art);
    if (!porMes) { porMes = new Map(); demanda.set(art, porMes); }
    let c = porMes.get(mes);
    if (!c) { c = { total: 0, servicios: [] }; porMes.set(mes, c); }
    return c;
  };
  const equiposSinPerfil = new Map<string, string>();
  const aplicar = (mes: string, consumo: Map<string, number>, base: Omit<ServicioPrevisto, 'consumo'>) => {
    for (const [art, q] of consumo) {
      const c = celda(art, mes);
      const total = q * base.cantidad;
      c.total += total;
      c.servicios.push({ ...base, consumo: total });
    }
  };
  const nombreSistema = (id: string | null | undefined, texto?: string | null) => {
    const s = id ? sistemaById.get(id) : null;
    if (!s) return texto || 'Equipo sin identificar';
    return [s.nombre, s.codigoInternoCliente ? `(${s.codigoInternoCliente})` : null, s.clienteNombre ? `· ${s.clienteNombre}` : null].filter(Boolean).join(' ');
  };

  const concretosPorCatMes = new Map<string, number>();
  for (const k of concretos) {
    const cat = categoriaDeOt(k.ot);
    if (cat) { const clave = `${cat}|${k.mes}`; concretosPorCatMes.set(clave, (concretosPorCatMes.get(clave) ?? 0) + 1); }
    const consumo = k.ot.sistemaId ? consumoSistema(k.ot.sistemaId) : { consumo: (cat && promedioCategoria.get(cat)) || new Map<string, number>(), perfiles: [] as string[] };
    if (k.ot.sistemaId && consumo.consumo.size === 0) equiposSinPerfil.set(k.ot.sistemaId, nombreSistema(k.ot.sistemaId));
    aplicar(k.mes, consumo.consumo, {
      origen: k.origen, cantidad: 1, sistemaId: k.ot.sistemaId ?? null,
      sistemaNombre: nombreSistema(k.ot.sistemaId, k.ot.sistemaTexto), otNumber: k.ot.otNumber, perfiles: consumo.perfiles,
    });
  }
  for (const f of fracciones) {
    const s = sistemaById.get(f.sistemaId);
    const cat = s?.categoriaId;
    if (cat) { const clave = `${cat}|${f.mes}`; concretosPorCatMes.set(clave, (concretosPorCatMes.get(clave) ?? 0) + f.cantidad); }
    const consumo = consumoSistema(f.sistemaId);
    if (consumo.consumo.size === 0) equiposSinPerfil.set(f.sistemaId, nombreSistema(f.sistemaId));
    aplicar(f.mes, consumo.consumo, {
      origen: 'contrato', cantidad: f.cantidad, sistemaId: f.sistemaId,
      sistemaNombre: nombreSistema(f.sistemaId), otNumber: f.contratoNumero, perfiles: consumo.perfiles,
    });
  }
  // El mayor: si el año anterior tuvo más servicios que lo previsto, los extra
  // consumen el perfil promedio de la categoría.
  for (const cat of e.categorias) {
    const promedio = promedioCategoria.get(cat.id);
    if (!promedio || promedio.size === 0) continue;
    for (const mes of meses) {
      const anterior = anteriorPorCatMes.get(`${cat.id}|${restarAnio(mes)}`) ?? 0;
      const previsto = concretosPorCatMes.get(`${cat.id}|${mes}`) ?? 0;
      const extra = anterior - previsto;
      if (extra <= 0) continue;
      aplicar(mes, promedio, {
        origen: 'anio_anterior', cantidad: extra, sistemaId: null,
        sistemaNombre: `${cat.nombre}: ${anterior} el año pasado vs ${Math.round(previsto * 10) / 10} previstos`, perfiles: ['perfil promedio'],
      });
    }
  }

  // 5. Oferta y proyección por artículo.
  const ingresosPor = new Map<string, IngresoPrevisto[]>();
  for (const ing of e.ingresos) {
    const arr = ingresosPor.get(ing.articuloId) ?? [];
    arr.push(ing);
    ingresosPor.set(ing.articuloId, arr);
  }
  const filas: FilaPlan[] = e.articulos.map(art => {
    const inicial = e.disponible.get(art.id) ?? 0;
    let stock = inicial;
    let comprarMax = 0;
    let mesQuiebre: string | null = null;
    let sinFecha = 0;
    const celdas: CeldaMes[] = meses.map(mes => {
      const d = demanda.get(art.id)?.get(mes);
      const ings = (ingresosPor.get(art.id) ?? []).filter(i => {
        if (!i.fecha) return mes === mesActual;
        const m = mesDe(i.fecha);
        if (m < mesActual) return mes === mesActual;
        return m === mes;
      });
      if (mes === mesActual) sinFecha = ings.filter(i => !i.fecha).reduce((a, i) => a + i.cantidad, 0);
      const ingresos = ings.reduce((a, i) => a + i.cantidad, 0);
      const dem = d?.total ?? 0;
      stock = stock + ingresos - dem;
      if (stock < 0) {
        comprarMax = Math.max(comprarMax, -stock);
        if (!mesQuiebre) mesQuiebre = mes;
      }
      return { mes, demanda: dem, ingresos, stockFin: stock, servicios: d?.servicios ?? [], ingresosDetalle: ings };
    });
    return {
      articuloId: art.id, codigo: art.codigo, descripcion: art.descripcion,
      grupo: art.grupoPlanificacion ?? null, stockInicial: inicial, stockMinimo: art.stockMinimo ?? 0,
      meses: celdas, comprar: Math.ceil(comprarMax - 1e-9), mesQuiebre, ingresosSinFecha: sinFecha,
    };
  });

  return {
    meses, filas,
    equiposSinPerfil: [...equiposSinPerfil].map(([sistemaId, sistemaNombre]) => ({ sistemaId, sistemaNombre })),
  };
}

// ── Ingresos: OCs e importaciones sin duplicar ────────────────────────────────

interface OcLike {
  id: string; numero: string; estado: string; fechaEntregaEstimada?: string | null;
  items: Array<{ articuloId?: string | null; cantidad: number; cantidadRecibida?: number | null; presentacion?: PresentacionUsada | null }>;
}
interface ImportacionLike {
  id: string; numero: string; estado: string; ordenCompraId?: string | null; fechaEstimadaArribo?: string | null;
  items?: Array<{ articuloId?: string | null; cantidadPedida: number; cantidadRecibida?: number | null; presentacion?: PresentacionUsada | null }> | null;
}

/** OCs "compradas" (no borrador ni cerradas) — mismo criterio de abiertas que el stock amplio, sin `borrador`. */
export const OC_ESTADOS_COMPRA = new Set(['enviada_proveedor', 'embarcada', 'confirmada', 'en_transito', 'recibida_parcial', 'aprobada', 'pendiente_aprobacion']);
export const IMPORTACION_ESTADOS_EN_CURSO = new Set(['preparacion', 'en_origen', 'embarcado', 'en_transito', 'en_aduana', 'despachado']);

/**
 * Los ítems de una importación son un subconjunto de su OC: lo que ya está
 * embarcado se cuenta por la importación (con su fecha de arribo) y se resta
 * del pendiente de la OC para no contarlo dos veces.
 */
export function ingresosPrevistos(ocs: OcLike[], importaciones: ImportacionLike[], soloArticulos: Set<string>): IngresoPrevisto[] {
  const out: IngresoPrevisto[] = [];
  const embarcadoPorOc = new Map<string, Map<string, number>>();
  for (const imp of importaciones) {
    if (!IMPORTACION_ESTADOS_EN_CURSO.has(imp.estado)) continue;
    for (const it of imp.items ?? []) {
      if (!it.articuloId || !soloArticulos.has(it.articuloId)) continue;
      const pend = cantidadEnUnidadBase(Math.max(0, (it.cantidadPedida ?? 0) - (it.cantidadRecibida ?? 0)), it.presentacion);
      if (pend <= 0) continue;
      out.push({ articuloId: it.articuloId, cantidad: pend, fecha: imp.fechaEstimadaArribo?.slice(0, 10) || null, origen: 'importacion', referencia: imp.numero });
      if (imp.ordenCompraId) {
        const m = embarcadoPorOc.get(imp.ordenCompraId) ?? new Map<string, number>();
        m.set(it.articuloId, (m.get(it.articuloId) ?? 0) + pend);
        embarcadoPorOc.set(imp.ordenCompraId, m);
      }
    }
  }
  for (const oc of ocs) {
    if (!OC_ESTADOS_COMPRA.has(oc.estado)) continue;
    const embarcado = embarcadoPorOc.get(oc.id);
    for (const it of oc.items ?? []) {
      if (!it.articuloId || !soloArticulos.has(it.articuloId)) continue;
      let pend = cantidadEnUnidadBase(Math.max(0, (it.cantidad ?? 0) - (it.cantidadRecibida ?? 0)), it.presentacion);
      const yaEmbarcado = embarcado?.get(it.articuloId) ?? 0;
      if (yaEmbarcado > 0) {
        const resta = Math.min(pend, yaEmbarcado);
        pend -= resta;
        embarcado!.set(it.articuloId, yaEmbarcado - resta);
      }
      if (pend <= 0) continue;
      out.push({ articuloId: it.articuloId, cantidad: pend, fecha: oc.fechaEntregaEstimada?.slice(0, 10) || null, origen: 'oc', referencia: oc.numero });
    }
  }
  return out;
}

// ── Formato (compartido por tabla, drawer y export) ───────────────────────────

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM' → 'oct 26'. */
export const labelMes = (mes: string): string =>
  `${MESES_CORTOS[Number(mes.slice(5, 7)) - 1] ?? mes} ${mes.slice(2, 4)}`;

/** Enteros sin decimales; fracciones (contratos prorrateados) con uno. */
export const fmtCantidad = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

export const ORIGEN_LABEL: Record<ServicioPrevisto['origen'], string> = {
  agenda: 'Agendado', pendiente: 'Pendiente con fecha', contrato: 'Contrato', anio_anterior: 'Año anterior',
};
