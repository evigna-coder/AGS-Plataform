import { useEffect, useMemo, useState } from 'react';
import type { WorkOrder } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ordenesTrabajoService } from '../../services/firebaseService';

interface Props {
  /** Cliente del presupuesto: acota la lista a sus OTs. Sin cliente, todas las abiertas. */
  clienteId: string | null | undefined;
  /** OTs ya vinculadas: no se vuelven a ofrecer. */
  excluir?: string[];
  value: string;
  onChange: (otNumber: string, ot: WorkOrder | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const CERRADAS = new Set(['FINALIZADO', 'CANCELADA']);

/** OTs abiertas: sin finalizar ni cancelar, y sin los padres que ya tienen hijas (el trabajo vive en las `.NN`). */
export function otsAbiertas(ots: WorkOrder[]): WorkOrder[] {
  const padresConHijas = new Set(ots.filter(o => o.otNumber.includes('.')).map(o => o.otNumber.split('.')[0]));
  return ots
    .filter(o => !CERRADAS.has(o.estadoAdmin ?? ''))
    .filter(o => o.otNumber.includes('.') || !padresConHijas.has(o.otNumber))
    .sort((a, b) => b.otNumber.localeCompare(a.otNumber, undefined, { numeric: true }));
}

/** "OT-30281.01 · Visita de diagnóstico · ID A0376 · WM.H2.400 (S/N …) · Cierre técnico": número, servicio, ID de equipo y modelo (pedido 2026-09-09). */
export const etiquetaOT = (o: WorkOrder) =>
  [
    `OT-${o.otNumber}`,
    o.tipoServicio,
    o.codigoInternoCliente ? `ID ${o.codigoInternoCliente}` : null,
    [o.sistema, o.moduloModelo].filter(Boolean).join(' '),
    o.moduloSerie ? `S/N ${o.moduloSerie}` : null,
    o.estadoAdmin ? OT_ESTADO_LABELS[o.estadoAdmin] : null,
  ].filter(Boolean).join(' · ');

/**
 * Buscador de OTs abiertas para ligar a un presupuesto (2026-09-09). Antes el
 * selector de "Origen: OT" del alta listaba las primeras 50 OTs de toda la
 * base, sin filtrar por cliente ni por estado: en la práctica no servía, y
 * los presupuestos creados a mano quedaban sin vincular a su OT.
 */
export function VincularOTSelect({ clienteId, excluir = [], value, onChange, placeholder, disabled }: Props) {
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let alive = true;
    setCargando(true);
    ordenesTrabajoService.getAll(clienteId ? { clienteId } : undefined)
      .then(list => { if (alive) setOts(otsAbiertas(list)); })
      .catch(err => console.error('[VincularOTSelect] OTs:', err))
      .finally(() => { if (alive) setCargando(false); });
    return () => { alive = false; };
  }, [clienteId]);

  const opciones = useMemo(
    () => ots.filter(o => !excluir.includes(o.otNumber)).map(o => ({ value: o.otNumber, label: etiquetaOT(o) })),
    [ots, excluir],
  );

  return (
    <SearchableSelect
      value={value}
      onChange={v => onChange(v, ots.find(o => o.otNumber === v) ?? null)}
      options={opciones}
      size="sm"
      disabled={disabled}
      placeholder={cargando ? 'Buscando OTs…' : opciones.length === 0 ? (clienteId ? 'El cliente no tiene OTs abiertas' : 'Sin OTs abiertas') : (placeholder ?? 'Buscar OT abierta por número, cliente o equipo…')}
    />
  );
}
