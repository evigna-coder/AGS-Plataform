import { useEffect, useMemo, useState } from 'react';
import type { FichaPropiedad, ItemFicha, Cliente, CondicionIva, Establecimiento, Proveedor, WorkOrder, Loaner, UnidadStock } from '@ags/shared';
import { fichasService } from '../services/fichasService';
import { clientesService } from '../services/clientesService';
import { establecimientosService } from '../services/firebaseService';
import { razonSocialConEstablecimiento } from '../utils/razonSocialRemito';
import { proveedoresService } from '../services/personalService';
import { ordenesTrabajoService } from '../services/firebaseService';
import { loanersService } from '../services/loanersService';
import { proveedorEsCategoria } from '@ags/shared';
import { remitosService, unidadesService, type DatosTransportista } from '../services/stockService';
import { partyFromProveedor } from '../components/remitos/RemitoTransportistaPicker';
import type { UnidadSalida } from '../components/remitos/RemitoStockPicker';
import type { ElegibleItem, ItemMode, ParteInput } from '../components/remitos/RemitoItemPicker';
import type { TipoRemito } from '../components/remitos/RemitoTipoToggle';

export const NUMERO_REGEX = /^\d{4}-\d{8}$/;

const EMPTY_DEST: DatosTransportista = {
  razonSocial: '', domicilio: '', localidad: '', provincia: '', iva: '', cuit: '',
};

const IVA_LABELS: Partial<Record<CondicionIva, string>> = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
};

/**
 * Destinatario del papel. La ficha ya sabe a qué planta pertenece el equipo, así
 * que el nombre del establecimiento va entre paréntesis en la razón social y su
 * domicilio manda sobre el fiscal (2026-08-12) — mismo criterio que el resto de
 * los remitos. No hace falta selector: el dato ya está en la ficha.
 */
function destFromCliente(c: Cliente, est?: Establecimiento | null): DatosTransportista {
  return {
    razonSocial: razonSocialConEstablecimiento(c.razonSocial, est?.nombre),
    domicilio: est?.direccion || c.direccionFiscal || c.direccion || '',
    localidad: est?.localidad || c.localidadFiscal || c.localidad || '',
    provincia: est?.provincia || c.provinciaFiscal || c.provincia || '',
    iva: c.condicionIva ? (IVA_LABELS[c.condicionIva] ?? c.condicionIva) : '',
    cuit: c.cuit ?? '',
  };
}

/**
 * Descripción de la línea del remito: equipo + serie (+ módulo de origen si es
 * una parte) + a quién pertenece.
 *
 * - El código de artículo NO va acá (2026-08-06): tiene su propia columna
 *   ("Producto" / N° de parte).
 * - El NÚMERO DE FICHA no se declara nunca (2026-08-07, pedido del dueño): es
 *   interno de AGS y no le dice nada al destinatario.
 * - `sufijo` (2026-08-07): antes decía el motivo ("Derivación a proveedor"),
 *   redundante con el tipo del remito. Ahora se usa para el CLIENTE dueño del
 *   equipo, que es el dato que falta cuando el remito lleva equipos de varios.
 */
export function itemDescripcion(it: ItemFicha, sufijo?: string | null, parentDescripcion?: string | null): string {
  const partes = [
    it.articuloDescripcion || it.descripcionLibre,
    it.serie ? `S/N ${it.serie}` : null,
    parentDescripcion ? `(de ${parentDescripcion})` : null,
  ].filter(Boolean) as string[];
  const equipo = partes.join(' · ');
  const qty = (it.cantidad ?? 1) > 1 ? `${it.cantidad} × ` : '';
  return [`${qty}${equipo}`.trim(), sufijo?.trim() || null].filter(Boolean).join(' · ');
}

interface Args {
  open: boolean;
  /**
   * Ficha desde la que se abre el modal. `null` = modo LOTE A PROVEEDOR
   * (2026-08-06, desde el listado de fichas): derivación con items de todas
   * las fichas activas, de CUALQUIER cliente — el destinatario es el
   * proveedor, así que mezclar clientes es válido.
   */
  ficha: FichaPropiedad | null;
  /** Loaner desde el que se abre (2026-08-06): derivación individual del
   *  módulo AGS, preseleccionado; mismos modos que ficha (completo/partes). */
  loaner?: Loaner | null;
}

/** Key con prefijo para distinguir loaners de items de ficha en la selección. */
export const loanerKey = (id: string) => `loaner:${id}`;

/**
 * Un loaner presentado como ElegibleItem (2026-08-06): mismo picker, misma
 * selección y partes que los items de ficha. Solo se leen subId /
 * articuloDescripcion / serie / numero / clienteNombre — shapes sintéticos.
 */
function loanerToElegible(l: Loaner): ElegibleItem {
  return {
    key: loanerKey(l.id),
    ficha: { id: loanerKey(l.id), numero: l.codigo, clienteNombre: 'Loaner AGS' } as unknown as FichaPropiedad,
    item: {
      id: l.id,
      subId: l.codigo,
      // Código para la columna Producto: el MODELO real del equipo, no el LNR
      // interno (mismo criterio que el número de ficha — 2026-08-07).
      articuloCodigo: l.articuloCodigo || l.moduloCodigo || null,
      articuloDescripcion: l.descripcion,
      serie: l.serie ?? null,
    } as unknown as ItemFicha,
  };
}

/**
 * Hook con todo el estado, carga inicial y handlers del modal de remito.
 * Mantiene `GenerarRemitoDevolucionModal.tsx` enfocado en presentación.
 */
export function useGenerarRemito({ open, ficha, loaner = null }: Args) {
  const [tipo, setTipo] = useState<TipoRemito>('devolucion');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [otherFichas, setOtherFichas] = useState<FichaPropiedad[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [modeByKey, setModeByKey] = useState<Map<string, ItemMode>>(new Map());
  const [partesByKey, setPartesByKey] = useState<Map<string, ParteInput[]>>(new Map());
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinatario, setDestinatario] = useState<DatosTransportista>(EMPTY_DEST);
  const [transportista, setTransportista] = useState<DatosTransportista>(EMPTY_DEST);
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // OTs seleccionables (2026-08-06): antes el remito heredaba ficha.otIds sin
  // opción de elegir. Se listan las OTs abiertas del cliente (hijas, sin cierre
  // administrativo) + las ya vinculadas a la ficha, prefill = ficha.otIds.
  const [otsCliente, setOtsCliente] = useState<WorkOrder[]>([]);
  const [otsSeleccionadas, setOtsSeleccionadas] = useState<Set<string>>(new Set());
  /** Loaners derivables (en base) — solo entran a elegibles en derivación. */
  const [loanersBase, setLoanersBase] = useState<Loaner[]>([]);
  /** Unidades de stock propias disponibles para mandar al proveedor (2026-08-07). */
  const [unidadesStock, setUnidadesStock] = useState<UnidadStock[]>([]);
  const [unidadesSel, setUnidadesSel] = useState<UnidadSalida[]>([]);
  /** Transportistas = proveedores con esa categoría (2026-08-07). Antes era una
   *  colección suelta; ahora son proveedores y entran a la calificación. */
  const transportistas = useMemo(
    () => proveedores.filter(p => proveedorEsCategoria(p, 'transportista')),
    [proveedores],
  );

  const elegibles = useMemo<ElegibleItem[]>(() => {
    const all = ficha ? [ficha, ...otherFichas] : otherFichas;
    const out: ElegibleItem[] = [];
    for (const f of all) {
      if (!f.items) continue;
      for (const it of (f.items ?? [])) {
        // Estados terminales / en tránsito de salida: nunca elegibles.
        if (it.estado === 'entregado') continue;
        if (it.estado === 'en_envio') continue;
        // Para `derivado_proveedor` no nos basamos en el badge: el estado puede
        // quedar stuck por data legacy o si la transición automática al recibir
        // no corrió. Lo que importa es si hay alguna derivación todavía afuera.
        // Si todas están recibidas, el item está físicamente en planta y puede
        // re-derivarse en otro remito.
        const tieneDerivacionAfuera = it.derivaciones.some(d => d.estado === 'enviado');
        if (tieneDerivacionAfuera) continue;
        out.push({ ficha: f, item: it, key: `${f.id}:${it.id}` });
      }
    }
    // Loaners (2026-08-06): módulos AGS derivables — solo en derivación a
    // proveedor (en devolución al cliente no aplican).
    if (tipo === 'derivacion_proveedor') {
      for (const l of loanersBase) out.push(loanerToElegible(l));
    }
    return out;
  }, [ficha, otherFichas, loanersBase, tipo]);

  useEffect(() => {
    if (!open) return;
    if (ficha) {
      void Promise.all([
        clientesService.getById(ficha.clienteId),
        ficha.establecimientoId
          ? establecimientosService.getById(ficha.establecimientoId).catch(() => null)
          : Promise.resolve(null),
      ]).then(([c, est]) => {
        if (!c) return;
        setCliente(c);
        setDestinatario(destFromCliente(c, est));
      });
      void fichasService.getAll({ clienteId: ficha.clienteId, activasOnly: true }).then(items => {
        setOtherFichas(items.filter(f => f.id !== ficha.id));
      });
      void ordenesTrabajoService.getAll({ clienteId: ficha.clienteId }).then(ots => {
        const vinculadas = new Set(ficha.otIds ?? []);
        const seleccionables = (ots as WorkOrder[]).filter(o =>
          o.otNumber.includes('.') &&
          (vinculadas.has(o.otNumber) ||
            !['CIERRE_ADMINISTRATIVO', 'FINALIZADO'].includes(o.estadoAdmin ?? '')));
        seleccionables.sort((a, b) => b.otNumber.localeCompare(a.otNumber));
        setOtsCliente(seleccionables);
      }).catch(console.error);
    } else {
      // Modo lote a proveedor: todas las fichas activas, cualquier cliente.
      // Modo loaner individual: sin fichas, foco en los loaners.
      setCliente(null);
      setDestinatario(EMPTY_DEST);
      if (loaner) setOtherFichas([]);
      else void fichasService.getAll({ activasOnly: true }).then(setOtherFichas);
      setOtsCliente([]);
    }
    // Loaners derivables: en base y activos (+ el loaner de entrada, siempre).
    if (!ficha) {
      void loanersService.getAll({ activoOnly: true }).then(ls => {
        const base = ls.filter(l => l.estado === 'en_base' || l.id === loaner?.id);
        if (loaner && !base.some(l => l.id === loaner.id)) base.unshift(loaner);
        setLoanersBase(base);
      }).catch(console.error);
    } else {
      setLoanersBase([]);
    }
    void proveedoresService.getAll(true).then(setProveedores);
    void remitosService.getProximoNumeroPreimpreso().then(setNumero);
    // Unidades propias que pueden salir al proveedor: disponibles en depósito.
    void unidadesService.getAll({ estado: 'disponible', activoOnly: true })
      .then(setUnidadesStock).catch(console.error);
    setUnidadesSel([]);
    setOtsSeleccionadas(new Set(ficha?.otIds ?? []));
    const preselect = new Set<string>();
    for (const it of ficha?.items ?? []) {
      if (it.estado === 'listo_para_entrega') preselect.add(`${ficha!.id}:${it.id}`);
    }
    if (loaner) preselect.add(loanerKey(loaner.id));
    setSelectedKeys(preselect);
    setModeByKey(new Map());
    setPartesByKey(new Map());
    setProveedorId('');
    setTipo(ficha ? 'devolucion' : 'derivacion_proveedor');
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ficha?.id, ficha?.clienteId, ficha?.items, loaner?.id]);

  const handleChangeTipo = (next: TipoRemito) => {
    setTipo(next);
    setSelectedKeys(new Set());
    setModeByKey(new Map());
    setPartesByKey(new Map());
    setError(null);
    if (next === 'devolucion' && cliente) {
      setDestinatario(destFromCliente(cliente));
      setProveedorId('');
    } else {
      setDestinatario(EMPTY_DEST);
    }
  };

  const handlePickProveedor = (id: string) => {
    setProveedorId(id);
    const prov = proveedores.find(p => p.id === id);
    if (!prov) return;
    // partyFromProveedor usa los campos reales (localidad/provincia/condicionIva,
    // 2026-08-11) — el mapeo inline anterior los dejaba VACÍOS aunque el
    // proveedor los tuviera cargados (caso ELS desde ficha de cliente).
    setDestinatario(partyFromProveedor(prov));
  };

  const handleToggleItem = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setModeByKey(m => { const n = new Map(m); n.delete(key); return n; });
        setPartesByKey(m => { const n = new Map(m); n.delete(key); return n; });
      } else {
        next.add(key);
        setModeByKey(m => { const n = new Map(m); n.set(key, 'completo'); return n; });
      }
      return next;
    });
  };

  const handleChangeMode = (key: string, mode: ItemMode) => {
    setModeByKey(m => { const n = new Map(m); n.set(key, mode); return n; });
    setPartesByKey(m => {
      const n = new Map(m);
      if (mode === 'partes' && (n.get(key)?.length ?? 0) === 0) {
        n.set(key, [{ tempId: crypto.randomUUID(), articuloId: null, articuloCodigo: null, descripcion: '', serie: null }]);
      } else if (mode === 'completo') {
        n.delete(key);
      }
      return n;
    });
  };

  const handleChangePartes = (key: string, partes: ParteInput[]) => {
    setPartesByKey(m => { const n = new Map(m); n.set(key, partes); return n; });
  };

  /** Autocompletar el transportista desde el proveedor elegido. */
  const handlePickTransportista = (id: string) => {
    const t = transportistas.find(x => x.id === id);
    if (!t) return;
    setTransportista({
      razonSocial: t.nombre, domicilio: t.direccion ?? '', localidad: t.localidad ?? '',
      provincia: t.provincia ?? '', iva: t.condicionIva ?? '', cuit: t.cuit ?? '',
    });
  };

  /** Partes de stock (2026-08-07): agregar / editar motivo / quitar. */
  const handleAddUnidad = (unidadId: string) => {
    const u = unidadesStock.find(x => x.id === unidadId);
    if (!u) return;
    setUnidadesSel(prev => prev.some(s => s.unidadId === unidadId) ? prev : [...prev, {
      unidadId: u.id,
      articuloId: u.articuloId,
      articuloCodigo: u.articuloCodigo,
      articuloDescripcion: u.articuloDescripcion,
      serie: u.nroSerie ?? null,
      cantidad: u.cantidad ?? 1,
      motivo: '',
    }]);
  };
  const handleUpdateUnidad = (unidadId: string, patch: Partial<UnidadSalida>) => {
    setUnidadesSel(prev => prev.map(s => s.unidadId === unidadId ? { ...s, ...patch } : s));
  };
  const handleRemoveUnidad = (unidadId: string) => {
    setUnidadesSel(prev => prev.filter(s => s.unidadId !== unidadId));
  };

  const handleToggleOt = (otNumber: string) => {
    setOtsSeleccionadas(prev => {
      const n = new Set(prev);
      if (n.has(otNumber)) n.delete(otNumber); else n.add(otNumber);
      return n;
    });
  };

  const isDerivacion = tipo === 'derivacion_proveedor';
  const numeroValido = NUMERO_REGEX.test(numero.trim());
  const selected = elegibles.filter(e => selectedKeys.has(e.key));
  const partesValidas = selected.every(({ key }) => {
    const mode = modeByKey.get(key) ?? 'completo';
    if (mode !== 'partes') return true;
    const partes = partesByKey.get(key) ?? [];
    return partes.length > 0 && partes.every(p => p.descripcion.trim().length > 0);
  });
  // Un remito puede llevar SOLO partes de stock (sin items de ficha ni loaners):
  // es el caso "pieza propia que va al proveedor y vuelve".
  const unidadesEnviadas = isDerivacion ? unidadesSel : [];
  const canSubmit = numeroValido
    && destinatario.razonSocial.trim().length > 0
    && (selected.length > 0 || unidadesEnviadas.length > 0)
    && partesValidas
    && (!isDerivacion || proveedorId !== '');

  return {
    // state
    tipo, cliente, proveedores, proveedorId, numero, fecha, destinatario, transportista,
    observaciones, submitting, error, selectedKeys, modeByKey, partesByKey, elegibles, selected,
    otsCliente, otsSeleccionadas, transportistas, unidadesStock, unidadesSel: unidadesEnviadas,
    // setters
    setNumero, setFecha, setDestinatario, setTransportista, setObservaciones, setSubmitting, setError,
    // handlers
    handleChangeTipo, handlePickProveedor, handleToggleItem, handleChangeMode, handleChangePartes,
    handleToggleOt, handlePickTransportista,
    handleAddUnidad, handleUpdateUnidad, handleRemoveUnidad,
    // derived flags
    isDerivacion, numeroValido, canSubmit,
  };
}
