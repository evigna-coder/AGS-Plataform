import { useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService, establecimientosService, ordenesTrabajoService, ingenierosService } from '../../services/firebaseService';
import type { Cliente, Establecimiento, Ingeniero, WorkOrder } from '@ags/shared';
import { establecimientoUnicoId } from '@ags/shared';

export interface DestinoPrestamo {
  destino: 'cliente' | 'ingeniero';
  clienteId: string;
  clienteNombre: string;
  establecimientoId: string;
  establecimientoNombre: string;
  otNumber: string;
  ingenieroId: string;
  ingenieroNombre: string;
}

export const DESTINO_VACIO: DestinoPrestamo = {
  destino: 'cliente', clienteId: '', clienteNombre: '', establecimientoId: '', establecimientoNombre: '',
  otNumber: '', ingenieroId: '', ingenieroNombre: '',
};

interface Props {
  value: DestinoPrestamo;
  onChange: (v: DestinoPrestamo) => void;
  /** Solo las PARTES pueden ir a un ingeniero; el módulo entero va a un cliente. */
  permitirIngeniero: boolean;
}

/**
 * A dónde va lo prestado (2026-09-08). Al cliente: como siempre, con remito.
 * A un ingeniero: la parte pasa a su inventario como una asignación, sin
 * papel del cliente — el IST la lleva en el bolso hasta que la instala.
 */
export function LoanerPrestamoDestinoFields({ value, onChange, permitirIngeniero }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const set = (patch: Partial<DestinoPrestamo>) => onChange({ ...value, ...patch });

  useEffect(() => {
    clientesService.getAll().then(c => setClientes(c.filter(x => x.activo))).catch(() => setClientes([]));
    ingenierosService.getAll().then(list => setIngenieros(list.filter(i => i.activo))).catch(() => setIngenieros([]));
  }, []);

  useEffect(() => {
    if (!value.clienteId) { setEstablecimientos([]); setOts([]); return; }
    establecimientosService.getByCliente(value.clienteId).then(ests => {
      setEstablecimientos(ests);
      // Regla del proyecto: cliente con un único establecimiento (activo) → autoseleccionarlo.
      const unico = establecimientoUnicoId(ests.filter(e => e.activo));
      if (unico && !value.establecimientoId) {
        const e = ests.find(x => x.id === unico);
        onChange({ ...value, establecimientoId: unico, establecimientoNombre: e?.nombre ?? '' });
      }
    });
    ordenesTrabajoService.getAll({ clienteId: value.clienteId }).then(setOts).catch(() => setOts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.clienteId]);

  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.razonSocial })), [clientes]);
  const establecimientoOptions = useMemo(
    () => establecimientos.filter(e => e.activo).map(e => ({ value: e.id, label: e.nombre })), [establecimientos]);
  const otOptions = useMemo(
    () => ots.map(ot => ({ value: ot.otNumber, label: ot.sistema ? `${ot.otNumber} · ${ot.sistema}` : ot.otNumber })), [ots]);
  const ingenieroOptions = useMemo(() => ingenieros.map(i => ({ value: i.id, label: i.nombre })), [ingenieros]);

  return (
    <div className="space-y-4">
      {permitirIngeniero && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">A dónde va</label>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {([['cliente', 'A un cliente'], ['ingeniero', 'A un ingeniero']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => set({ destino: v })}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  value.destino === v ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
          {value.destino === 'ingeniero' && (
            <p className="text-[11px] text-slate-400 mt-1">
              Pasa al inventario del ingeniero como una asignación, sin remito. Cuando la devuelve, la parte vuelve a la base pendiente de reinstalar.
            </p>
          )}
        </div>
      )}
      {value.destino === 'ingeniero' ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ingeniero *</label>
          <SearchableSelect value={value.ingenieroId}
            onChange={v => set({ ingenieroId: v, ingenieroNombre: ingenieros.find(i => i.id === v)?.nombre ?? '' })}
            options={ingenieroOptions} placeholder="Seleccionar ingeniero" size="sm" />
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
            <SearchableSelect value={value.clienteId}
              onChange={v => onChange({ ...value, clienteId: v, clienteNombre: clientes.find(c => c.id === v)?.razonSocial ?? '', establecimientoId: '', establecimientoNombre: '', otNumber: '' })}
              options={clienteOptions} placeholder="Seleccionar cliente" size="sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Establecimiento</label>
            <SearchableSelect value={value.establecimientoId}
              onChange={v => set({ establecimientoId: v, establecimientoNombre: establecimientos.find(e => e.id === v)?.nombre ?? '' })}
              options={establecimientoOptions} placeholder="Seleccionar" size="sm" disabled={!value.clienteId} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Orden de Trabajo <span className="text-slate-400 font-normal">(opcional)</span></label>
            <SearchableSelect value={value.otNumber} onChange={v => set({ otNumber: v })} options={otOptions}
              placeholder={!value.clienteId ? 'Seleccioná primero el cliente' : otOptions.length === 0 ? 'El cliente no tiene OTs' : 'Buscar OT...'}
              size="sm" disabled={!value.clienteId} />
          </div>
        </>
      )}
    </div>
  );
}
