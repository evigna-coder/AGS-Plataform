import { useState, useEffect, useMemo } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService, establecimientosService } from '../../services/firebaseService';
import { establecimientoUnicoId, establecimientoPerteneceACliente } from '@ags/shared';
import type { Cliente, Establecimiento } from '@ags/shared';

export interface DestinatarioSeleccion {
  clienteId: string;
  clienteNombre: string;
  establecimientoId: string | null;
  establecimientoNombre: string | null;
}

interface Props {
  value: DestinatarioSeleccion | null;
  onChange: (v: DestinatarioSeleccion | null) => void;
  /** Marca visual de requerido en el label del cliente. */
  requerido?: boolean;
}

/**
 * Selector cliente → establecimiento para remitos (2026-08-06). Aplica la regla
 * de autoselección de establecimiento único (.claude/rules). El domicilio
 * impreso en el remito sale del establecimiento si hay, si no del fiscal.
 */
export function RemitoDestinatarioPicker({ value, onChange, requerido }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);

  useEffect(() => {
    clientesService.getAll().then(setClientes).catch(console.error);
    establecimientosService.getAll().then(setEstablecimientos).catch(console.error);
  }, []);

  const clienteOptions = useMemo(
    () => clientes.map(c => ({ value: c.id, label: c.razonSocial })),
    [clientes],
  );

  const estabsDelCliente = useMemo(() => {
    if (!value?.clienteId) return [];
    return establecimientos.filter(e =>
      e.activo !== false && establecimientoPerteneceACliente(e, value.clienteId));
  }, [establecimientos, value?.clienteId]);

  const handleCliente = (clienteId: string) => {
    if (!clienteId) { onChange(null); return; }
    const cliente = clientes.find(c => c.id === clienteId);
    // Cambio de cliente: resetear establecimiento y autoseleccionar si hay uno solo.
    const lista = establecimientos.filter(e =>
      e.activo !== false && establecimientoPerteneceACliente(e, clienteId));
    const unico = establecimientoUnicoId(lista);
    onChange({
      clienteId,
      clienteNombre: cliente?.razonSocial ?? '',
      establecimientoId: unico || null,
      establecimientoNombre: unico ? (lista[0]?.nombre ?? null) : null,
    });
  };

  const handleEstab = (establecimientoId: string) => {
    if (!value) return;
    const est = estabsDelCliente.find(e => e.id === establecimientoId);
    onChange({
      ...value,
      establecimientoId: establecimientoId || null,
      establecimientoNombre: est?.nombre ?? null,
    });
  };

  const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={lbl}>Cliente {requerido ? '*' : <span className="text-slate-400">(para el destinatario impreso)</span>}</label>
        <SearchableSelect
          value={value?.clienteId ?? ''}
          onChange={handleCliente}
          options={clienteOptions}
          placeholder="Buscar cliente..."
        />
      </div>
      <div>
        <label className={lbl}>Establecimiento</label>
        <SearchableSelect
          value={value?.establecimientoId ?? ''}
          onChange={handleEstab}
          options={estabsDelCliente.map(e => ({ value: e.id, label: e.nombre }))}
          placeholder={!value?.clienteId ? 'Primero el cliente' : estabsDelCliente.length === 0 ? 'Sin establecimientos' : 'Seleccionar...'}
        />
      </div>
    </div>
  );
}
