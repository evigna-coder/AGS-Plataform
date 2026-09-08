import { useEffect, useMemo, useState } from 'react';
import type { Certificacion, Establecimiento, ItemCertificacion, ParteCertificada, WorkOrder } from '@ags/shared';
import { itemsDeCertificacion } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { establecimientosService } from '../../services/firebaseService';
import { certificacionesService } from '../../services/certificacionesService';
import { movimientosService } from '../../services/stockService';
import { partesDeConsumos } from '../../utils/partesDeConsumosOT';
import { CertificacionItemRow } from './CertificacionItemRow';
import { ExportarButton } from '../ui/ExportarButton';
import { CERTIFICACION_EXPORT_COLUMNS } from '../../utils/exports/exportCertificacion';

import { notify } from '../../utils/notify';
import { Select } from '../ui/Select';
interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  clienteId: string;
  clienteNombre: string;
  /** OTs retenidas del cliente, candidatas a entrar en el lote. */
  ots: WorkOrder[];
  /** Lotes del cliente pedidos y sin cerrar (2026-09-04): se puede sumar las
   *  OTs a uno en vez de abrir otro — cerró una OT más y el resumen ya salió. */
  lotesAbiertos?: Certificacion[];
}

const NUEVO = '__nuevo__';

function etiquetaLote(c: Certificacion): string {
  const n = itemsDeCertificacion(c).length;
  return `${c.periodo ? `Período ${c.periodo}` : `Lote del ${(c.fecha || '').slice(0, 10)}`} · ${n} OT${n !== 1 ? 's' : ''}${c.numero ? ` · N° ${c.numero}` : ''}`;
}

const lbl = 'text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1 block';
const mesActual = () => new Date().toISOString().slice(0, 7);

/**
 * Arma el PEDIDO de certificación por lote (2026-08-17).
 *
 * El circuito de las plantas que certifican mensualmente: se junta lo pendiente,
 * se manda el resumen —"nos debés certificación por estas 8 OTs"— y recién
 * cuando vuelve firmado se libera cada OT. Es lo contrario de registrar una
 * certificación que ya llegó, que es lo único que se podía hacer antes.
 *
 * La selección es LIBRE entre establecimientos: quien arma el resumen decide
 * qué entra, aunque venga de plantas distintas del mismo cliente.
 */
export function SolicitarCertificacionModal({ open, onClose, onCreated, clienteId, clienteNombre, ots, lotesAbiertos = [] }: Props) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  /** Líneas del resumen, ya redactadas para el cliente y editables. */
  const [lineas, setLineas] = useState<Record<string, ItemCertificacion>>({});
  const [periodo, setPeriodo] = useState(mesActual);
  const [observaciones, setObservaciones] = useState('');
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [guardando, setGuardando] = useState(false);
  /** A qué lote van: uno nuevo, o el id de uno abierto del cliente. */
  const [destino, setDestino] = useState(NUEVO);
  const loteDestino = destino === NUEVO ? null : lotesAbiertos.find(c => c.id === destino) ?? null;

  useEffect(() => {
    if (!open) return;
    setSeleccion(new Set(ots.map(o => o.otNumber)));
    setPeriodo(mesActual());
    setObservaciones('');
    // Si el lote del mes ya salió, lo más probable es que estas OTs vayan ahí.
    const delMes = lotesAbiertos.find(c => c.periodo === mesActual());
    setDestino(delMes?.id ?? NUEVO);
    establecimientosService.getAll()
      .then(async list => {
        setEstablecimientos(list);
        // Texto inicial tomado de la OT; a partir de acá se edita a mano.
        // Partes (2026-09-07): lo que se consumió de stock contra la OT.
        const consumos = await Promise.all(ots.map(o =>
          movimientosService.getAll({ otNumber: o.otNumber }).catch(() => [])));
        const base: Record<string, ItemCertificacion> = {};
        ots.forEach((o, i) => {
          base[o.otNumber] = {
            otNumber: o.otNumber,
            estado: 'pendiente',
            establecimientoNombre: list.find(e => e.id === o.establecimientoId)?.nombre ?? '',
            equipo: [o.sistema, o.moduloSerie ? `S/N ${o.moduloSerie}` : null].filter(Boolean).join(' · '),
            equipoId: o.codigoInternoCliente || '',
            descripcionServicio: o.tipoServicio || '',
            fechaServicio: (o.fechaInicio || o.fechaServicioAprox || '').slice(0, 10) || null,
            partes: partesDeConsumos(consumos[i]),
          };
        });
        setLineas(base);
      })
      .catch(() => setEstablecimientos([]));
  }, [open, ots, lotesAbiertos]);

  const nombreEst = (id?: string | null) =>
    establecimientos.find(e => e.id === id)?.nombre ?? 'Sin establecimiento';

  // Agrupadas por planta solo para leerlas cómodo — el lote puede mezclarlas.
  const grupos = useMemo(() => {
    const m = new Map<string, WorkOrder[]>();
    for (const ot of ots) {
      const k = ot.establecimientoId || '';
      (m.get(k) ?? m.set(k, []).get(k)!).push(ot);
    }
    return [...m.entries()];
  }, [ots]);

  const toggle = (n: string) =>
    setSeleccion(prev => {
      const s = new Set(prev);
      s.has(n) ? s.delete(n) : s.add(n);
      return s;
    });

  const elegidas = ots.filter(o => seleccion.has(o.otNumber));
  const itemsElegidos = elegidas.map(o => lineas[o.otNumber]).filter(Boolean);
  const editar = (n: string, campo: keyof ItemCertificacion, v: string) =>
    setLineas(prev => ({ ...prev, [n]: { ...prev[n], [campo]: v } }));
  const editarPartes = (n: string, partes: ParteCertificada[]) =>
    setLineas(prev => ({ ...prev, [n]: { ...prev[n], partes } }));

  const handleSubmit = async () => {
    if (elegidas.length === 0 || guardando) return;
    setGuardando(true);
    try {
      if (loteDestino) {
        const { agregadas } = await certificacionesService.agregarItems(loteDestino.id, itemsElegidos);
        notify.success(`Se sumaron ${agregadas.length} OT(s) al lote ${loteDestino.periodo ?? ''}. Volvé a mandar el resumen al cliente.`);
        onCreated();
        return;
      }
      const estIds = [...new Set(elegidas.map(o => o.establecimientoId).filter(Boolean))] as string[];
      const contrato = elegidas.find(o => o.contratoId);
      await certificacionesService.solicitar({
        clienteId, clienteNombre,
        contratoId: contrato?.contratoId ?? null,
        establecimientoIds: estIds,
        periodo: periodo || null,
        items: itemsElegidos,
        observaciones: observaciones.trim() || null,
      });
      onCreated();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'No se pudo armar el pedido');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl"
      title={loteDestino ? 'Agregar OTs a un lote pedido' : 'Solicitar certificación por lote'}
      subtitle={clienteNombre}
      footer={<>
        {/* Exportar ANTES de armar: el resumen se manda por mail y lo más
            probable es que se copie del Excel al cuerpo del mensaje. */}
        <ExportarButton
          columnas={CERTIFICACION_EXPORT_COLUMNS}
          data={itemsElegidos}
          titulo={`Certificación ${clienteNombre}${periodo ? ` — ${periodo}` : ''}`}
          filename={`certificacion-${periodo || 'lote'}`}
          subtitulo="Servicios ejecutados pendientes de certificación"
          orientacion="landscape"
        />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => void handleSubmit()} disabled={elegidas.length === 0 || guardando}>
          {guardando ? 'Guardando…' : loteDestino ? `Agregar al lote (${elegidas.length})` : `Armar pedido (${elegidas.length})`}
        </Button>
      </>}>
      <div className="space-y-4">
        {lotesAbiertos.length > 0 && (
          <div>
            <label className={lbl}>Destino</label>
            <Select value={destino} onChange={e => setDestino(e.target.value)}
              className="w-full">
              <option value={NUEVO}>Lote nuevo</option>
              {lotesAbiertos.map(c => (
                <option key={c.id} value={c.id}>Sumar a: {etiquetaLote(c)}</option>
              ))}
            </Select>
            {loteDestino && (
              <p className="text-[10px] text-slate-400 mt-1">
                Entran como pendientes junto a las {itemsDeCertificacion(loteDestino).length} que ya tiene. El resumen al cliente hay que reenviarlo.
              </p>
            )}
          </div>
        )}
        {!loteDestino && <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Período</label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className={lbl}>Observaciones</label>
            <input value={observaciones} onChange={e => setObservaciones(e.target.value)}
              placeholder="Referencia para el cliente…"
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
          </div>
        </div>}

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className={lbl}>OTs a certificar</span>
            <button onClick={() => setSeleccion(new Set(
              seleccion.size === ots.length ? [] : ots.map(o => o.otNumber)))}
              className="text-[11px] text-teal-600 hover:underline">
              {seleccion.size === ots.length ? 'Ninguna' : 'Todas'}
            </button>
          </div>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {grupos.map(([estId, lista]) => (
              <div key={estId || 'sin'}>
                <div className="px-2.5 py-1 bg-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
                    {nombreEst(estId)}
                  </span>
                  <span className="text-[10px] text-slate-400">{lista.length} OT{lista.length !== 1 ? 's' : ''}</span>
                </div>
                {lista.map(ot => (
                  <CertificacionItemRow key={ot.otNumber} ot={ot} linea={lineas[ot.otNumber]}
                    on={seleccion.has(ot.otNumber)} onToggle={() => toggle(ot.otNumber)}
                    onEditar={(campo, v) => editar(ot.otNumber, campo, v)}
                    onPartes={p => editarPartes(ot.otNumber, p)} />
                ))}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Las OTs quedan retenidas hasta que vuelva la certificación. Se resuelven de a una:
            el cliente puede certificar algunas y objetar otras. Las partes vienen de los
            consumos de stock de cada OT; se pueden corregir o declarar a mano.
          </p>
        </div>
      </div>
    </Modal>
  );
}
