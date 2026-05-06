import { useEffect, useMemo, useState } from 'react';
import type { FichaPropiedad, ItemFicha, Cliente, CondicionIva, Proveedor } from '@ags/shared';
import { fichasService } from '../services/fichasService';
import { clientesService } from '../services/clientesService';
import { proveedoresService } from '../services/personalService';
import { remitosService, type DatosTransportista } from '../services/stockService';
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

function destFromCliente(c: Cliente): DatosTransportista {
  return {
    razonSocial: c.razonSocial,
    domicilio: c.direccionFiscal ?? c.direccion ?? '',
    localidad: c.localidadFiscal ?? c.localidad ?? '',
    provincia: c.provinciaFiscal ?? c.provincia ?? '',
    iva: c.condicionIva ? (IVA_LABELS[c.condicionIva] ?? c.condicionIva) : '',
    cuit: c.cuit ?? '',
  };
}

export function itemDescripcion(it: ItemFicha, motivo: string, parentSubId?: string | null): string {
  const partes = [
    it.articuloDescripcion || it.descripcionLibre,
    it.articuloCodigo,
    it.serie ? `S/N ${it.serie}` : null,
    parentSubId ? `(de ${parentSubId})` : null,
  ].filter(Boolean) as string[];
  const equipo = partes.join(' · ') || it.subId;
  return `${equipo} · ${motivo}`;
}

interface Args {
  open: boolean;
  ficha: FichaPropiedad;
}

/**
 * Hook con todo el estado, carga inicial y handlers del modal de remito.
 * Mantiene `GenerarRemitoDevolucionModal.tsx` enfocado en presentación.
 */
export function useGenerarRemito({ open, ficha }: Args) {
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

  const elegibles = useMemo<ElegibleItem[]>(() => {
    const all = [ficha, ...otherFichas];
    const out: ElegibleItem[] = [];
    for (const f of all) {
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
    return out;
  }, [ficha, otherFichas]);

  useEffect(() => {
    if (!open) return;
    void clientesService.getById(ficha.clienteId).then(c => {
      if (!c) return;
      setCliente(c);
      setDestinatario(destFromCliente(c));
    });
    void fichasService.getAll({ clienteId: ficha.clienteId, activasOnly: true }).then(items => {
      setOtherFichas(items.filter(f => f.id !== ficha.id));
    });
    void proveedoresService.getAll(true).then(setProveedores);
    void remitosService.getProximoNumeroPreimpreso().then(setNumero);
    const preselect = new Set<string>();
    for (const it of ficha.items ?? []) {
      if (it.estado === 'listo_para_entrega') preselect.add(`${ficha.id}:${it.id}`);
    }
    setSelectedKeys(preselect);
    setModeByKey(new Map());
    setPartesByKey(new Map());
    setProveedorId('');
    setTipo('devolucion');
    setError(null);
  }, [open, ficha.id, ficha.clienteId, ficha.items]);

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
    setDestinatario({
      razonSocial: prov.nombre,
      domicilio: prov.direccion ?? '',
      cuit: prov.cuit ?? '',
      localidad: '', provincia: '', iva: '',
    });
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

  const isDerivacion = tipo === 'derivacion_proveedor';
  const numeroValido = NUMERO_REGEX.test(numero.trim());
  const selected = elegibles.filter(e => selectedKeys.has(e.key));
  const partesValidas = selected.every(({ key }) => {
    const mode = modeByKey.get(key) ?? 'completo';
    if (mode !== 'partes') return true;
    const partes = partesByKey.get(key) ?? [];
    return partes.length > 0 && partes.every(p => p.descripcion.trim().length > 0);
  });
  const canSubmit = numeroValido
    && destinatario.razonSocial.trim().length > 0
    && selected.length > 0
    && partesValidas
    && (!isDerivacion || proveedorId !== '');

  return {
    // state
    tipo, cliente, proveedores, proveedorId, numero, fecha, destinatario, transportista,
    observaciones, submitting, error, selectedKeys, modeByKey, partesByKey, elegibles, selected,
    // setters
    setNumero, setFecha, setDestinatario, setTransportista, setObservaciones, setSubmitting, setError,
    // handlers
    handleChangeTipo, handlePickProveedor, handleToggleItem, handleChangeMode, handleChangePartes,
    // derived flags
    isDerivacion, numeroValido, canSubmit,
  };
}
