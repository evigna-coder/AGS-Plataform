import { useEffect, useMemo, useState } from 'react';
import type { Cliente, CondicionIva, Establecimiento } from '@ags/shared';
import { clientesService } from '../services/clientesService';
import { establecimientosService } from '../services/firebaseService';
import { proveedoresService } from '../services/personalService';
import { partyFromProveedor } from '../components/remitos/RemitoTransportistaPicker';
import { razonSocialConEstablecimiento } from '../utils/razonSocialRemito';
import { ordenesTrabajoService } from '../services/otService';
import {
  remitosService,
  type DatosTransportista,
  type RemitoServicioLinea,
} from '../services/stockService';
import type { RemitoOverlayItem } from '../components/remitos/pdf/RemitoOverlayPDF';

/** Formato del número preimpreso del papel (ej. "0001-00017091"). */
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
 * Destinatario del papel. El domicilio es el de ENTREGA: el del establecimiento
 * si se conoce, y recién si no el fiscal del cliente (2026-08-12) — mismo
 * criterio que `imprimirRemitoStock`. Sin esto la provincia salía vacía en los
 * clientes que la tienen cargada solo en la planta (caso YPF).
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

export interface RemitoServicioPrefill {
  clienteId?: string;
  clienteNombre?: string;
  /** Planta a la que se entrega: domicilio impreso + "(nombre)" en la razón social. */
  establecimientoId?: string;
  sistemaId?: string;
  sistemaNombre?: string;
  sistemaCodigoInterno?: string;
}

/** Una línea de servicio editable en el modal (seleccionable). */
export interface LineaUI {
  key: string;
  selected: boolean;
  otNumberOrigen: string | null;
  servicioDescripcion: string;
  presupuestoNumero: string;
  ocNumero: string;
}

/**
 * Arma los items del overlay a imprimir: una fila-cabecera (equipo + orden del
 * cliente + dato interno) y una fila por servicio con sus refs comerciales inline.
 * Todo cae en las 4 columnas ya calibradas del papel (item · cant · producto · desc).
 */
export function buildOverlayItems(args: {
  sistemaCodigoInterno?: string;
  sistemaNombre?: string;
  ordenClienteNumero: string;
  datoInternoCliente: string;
  lineas: RemitoServicioLinea[];
}): RemitoOverlayItem[] {
  const equipo = args.sistemaCodigoInterno || args.sistemaNombre || '';
  const ref = [
    args.ordenClienteNumero.trim() && `Orden cliente: ${args.ordenClienteNumero.trim()}`,
    args.datoInternoCliente.trim() && `Ref: ${args.datoInternoCliente.trim()}`,
  ].filter(Boolean).join('   ·   ');
  const header: RemitoOverlayItem = {
    numero: '', cantidad: '',
    producto: equipo ? `Equipo: ${equipo}` : '',
    descripcion: ref || args.sistemaNombre || '',
  };
  const rows: RemitoOverlayItem[] = args.lineas.map((l, i) => {
    const refs = [
      l.presupuestoNumero?.trim() && `Ppto ${l.presupuestoNumero!.trim()}`,
      l.ocNumero?.trim() && `OC ${l.ocNumero!.trim()}`,
    ].filter(Boolean).join(' · ');
    return {
      numero: i + 1,
      cantidad: 1,
      producto: l.servicioCode ?? '',
      descripcion: refs ? `${l.servicioDescripcion} — ${refs}` : l.servicioDescripcion,
    };
  });
  return [header, ...rows];
}

interface Args {
  open: boolean;
  prefill: RemitoServicioPrefill;
}

/**
 * Estado + carga + handlers del modal de remito de servicio. Consolida N OTs del
 * mismo equipo en un solo remito (una OT ≈ un servicio); el usuario elige cuáles
 * incluir, edita las refs comerciales y agrega líneas manuales si hace falta.
 */
export function useRemitoServicio({ open, prefill }: Args) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  // Transportista SIEMPRE AGS Analítica (2026-08-12): en un remito de servicio
  // el traslado lo hace AGS, no un flete. Sale del catálogo de proveedores para
  // no hardcodear domicilio/CUIT; si no está cargado, el bloque va vacío igual
  // que antes (no bloquea la emisión).
  const [transportista, setTransportista] = useState<DatosTransportista | null>(null);
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinatario, setDestinatario] = useState<DatosTransportista>(EMPTY_DEST);
  const [ordenClienteNumero, setOrdenClienteNumero] = useState('');
  const [datoInternoCliente, setDatoInternoCliente] = useState('');
  const [lineas, setLineas] = useState<LineaUI[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setOrdenClienteNumero('');
    setDatoInternoCliente('');
    setObservaciones('');
    void remitosService.getProximoNumeroPreimpreso().then(setNumero);

    if (prefill.clienteId) {
      void Promise.all([
        clientesService.getById(prefill.clienteId),
        prefill.establecimientoId
          ? establecimientosService.getById(prefill.establecimientoId).catch(() => null)
          : Promise.resolve(null),
      ]).then(([c, est]) => {
        if (!c) return;
        setCliente(c);
        setDestinatario(destFromCliente(c, est));
      });
    }

    // Transportista fijo: AGS Analítica del catálogo de proveedores.
    void proveedoresService.getAll().then(provs => {
      const ags = provs.find(p => /ags\s*anal[íi]tica/i.test(p.nombre ?? ''))
        ?? provs.find(p => /^ags\b/i.test((p.nombre ?? '').trim()));
      setTransportista(ags ? partyFromProveedor(ags) : null);
    }).catch(err => console.error('[useRemitoServicio] proveedor AGS no resuelto:', err));

    // Candidatos = OTs del mismo equipo; cada una aporta una línea de servicio.
    if (prefill.clienteId && prefill.sistemaId) {
      void ordenesTrabajoService.getAll({ clienteId: prefill.clienteId, sistemaId: prefill.sistemaId })
        .then(ots => {
          // El PADRE es solo el agrupador visual (regla del proyecto): el
          // trabajo vive en las hijas .NN. Sin este filtro la lista mostraba el
          // padre además de sus items y el remito duplicaba el servicio
          // (2026-08-12). Un número sin punto que NO tenga hijas es una OT
          // vieja legítima y se mantiene.
          const conHijas = new Set(
            ots.filter(o => o.otNumber.includes('.')).map(o => o.otNumber.split('.')[0]),
          );
          const candidatas = ots.filter(o =>
            o.estadoAdmin !== 'CANCELADA' && !conHijas.has(o.otNumber));
          setLineas(candidatas.map(ot => ({
            key: ot.otNumber,
            selected: true,
            otNumberOrigen: ot.otNumber,
            servicioDescripcion: ot.tipoServicio || 'Servicio',
            presupuestoNumero: ot.budgets?.[0] ?? '',
            ocNumero: ot.ordenCompra || ot.ordenesCompra?.[0] || '',
          })));
        });
    } else {
      setLineas([]);
    }
  }, [open, prefill.clienteId, prefill.establecimientoId, prefill.sistemaId]);

  const toggleLinea = (key: string) =>
    setLineas(prev => prev.map(l => l.key === key ? { ...l, selected: !l.selected } : l));

  const updateLinea = (key: string, patch: Partial<LineaUI>) =>
    setLineas(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));

  const addLineaManual = () =>
    setLineas(prev => [...prev, {
      key: crypto.randomUUID(),
      selected: true,
      otNumberOrigen: null,
      servicioDescripcion: '',
      presupuestoNumero: '',
      ocNumero: '',
    }]);

  const removeLinea = (key: string) =>
    setLineas(prev => prev.filter(l => l.key !== key));

  const seleccionadas = useMemo(
    () => lineas.filter(l => l.selected && l.servicioDescripcion.trim().length > 0),
    [lineas],
  );

  const numeroValido = NUMERO_REGEX.test(numero.trim());
  const canSubmit = numeroValido
    && destinatario.razonSocial.trim().length > 0
    && seleccionadas.length > 0;

  return {
    // state
    cliente, numero, fecha, destinatario, transportista, ordenClienteNumero, datoInternoCliente,
    lineas, observaciones, submitting, error, seleccionadas,
    // setters
    setNumero, setFecha, setDestinatario, setOrdenClienteNumero, setDatoInternoCliente,
    setObservaciones, setSubmitting, setError,
    // handlers
    toggleLinea, updateLinea, addLineaManual, removeLinea,
    // derived
    numeroValido, canSubmit,
  };
}
