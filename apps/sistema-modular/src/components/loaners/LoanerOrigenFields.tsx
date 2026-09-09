import { useEffect, useMemo, useState } from 'react';
import type { Cliente, OrigenLoaner, Proveedor, TipoOrigenLoaner } from '@ags/shared';
import { TIPO_ORIGEN_LOANER_LABELS } from '@ags/shared';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService } from '../../services/firebaseService';
import { proveedoresService } from '../../services/personalService';

interface Props {
  value: OrigenLoaner | null;
  onChange: (v: OrigenLoaner | null) => void;
  size?: 'sm' | 'md';
}

const TIPOS = Object.keys(TIPO_ORIGEN_LOANER_LABELS) as TipoOrigenLoaner[];

/**
 * De dónde salió el loaner (2026-09-09): comprado a un proveedor, a un
 * cliente, tomado en parte de pago, equipo propio… Es un dato del alta que
 * faltaba; para los que ya están cargados se completa desde Editar.
 */
export function LoanerOrigenFields({ value, onChange, size = 'md' }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const tipo = value?.tipo ?? '';
  const set = (patch: Partial<OrigenLoaner>) => onChange({ ...(value ?? { tipo: 'otro' }), ...patch });

  useEffect(() => {
    if (tipo === 'compra_cliente' || tipo === 'canje') clientesService.getAll().then(c => setClientes(c.filter(x => x.activo))).catch(() => setClientes([]));
    if (tipo === 'compra_proveedor') proveedoresService.getAll().then(setProveedores).catch(() => setProveedores([]));
  }, [tipo]);

  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.razonSocial })), [clientes]);
  const proveedorOptions = useMemo(() => proveedores.map(p => ({ value: p.id, label: p.nombre })), [proveedores]);
  const lbl = size === 'sm' ? 'block text-[11px] font-medium text-slate-500 mb-1' : 'block text-sm font-medium text-slate-700 mb-1';
  const inputSize = size === 'sm' ? 'sm' : 'md';

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${size === 'sm' ? 'gap-3' : 'gap-4'}`}>
      <div>
        <label className={lbl}>Origen</label>
        <Select value={tipo} selectSize={size === 'sm' ? 'sm' : 'md'} className="w-full"
          onChange={e => {
            const t = e.target.value as TipoOrigenLoaner | '';
            if (!t) { onChange(null); return; }
            // Cambiar de tipo limpia la contraparte: un proveedor no es un cliente.
            onChange({ ...(value ?? {}), tipo: t, clienteId: null, clienteNombre: null, proveedorId: null, proveedorNombre: null });
          }}>
          <option value="">Sin declarar</option>
          {TIPOS.map(t => <option key={t} value={t}>{TIPO_ORIGEN_LOANER_LABELS[t]}</option>)}
        </Select>
      </div>
      {(tipo === 'compra_cliente' || tipo === 'canje') && (
        <div>
          <label className={lbl}>Cliente</label>
          <SearchableSelect size="sm" value={value?.clienteId ?? ''} options={clienteOptions} placeholder="Buscar cliente…"
            onChange={v => set({ clienteId: v || null, clienteNombre: clientes.find(c => c.id === v)?.razonSocial ?? null })} />
        </div>
      )}
      {tipo === 'compra_proveedor' && (
        <div>
          <label className={lbl}>Proveedor</label>
          <SearchableSelect size="sm" value={value?.proveedorId ?? ''} options={proveedorOptions} placeholder="Buscar proveedor…"
            onChange={v => set({ proveedorId: v || null, proveedorNombre: proveedores.find(p => p.id === v)?.nombre ?? null })} />
        </div>
      )}
      {tipo && (
        <>
          <Input inputSize={inputSize} label="Fecha" type="date" value={value?.fecha ?? ''} onChange={e => set({ fecha: e.target.value || null })} />
          <Input inputSize={inputSize} label="Referencia" value={value?.referencia ?? ''} onChange={e => set({ referencia: e.target.value || null })}
            placeholder="Factura, remito, OC…" />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input inputSize={inputSize} label="Costo" type="number" min={0} step="any" value={value?.costo ?? ''}
                onChange={e => set({ costo: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Opcional" />
            </div>
            <div className="w-24">
              <label className={lbl}>Moneda</label>
              <Select value={value?.moneda ?? 'USD'} selectSize={size === 'sm' ? 'sm' : 'md'} className="w-full"
                onChange={e => set({ moneda: e.target.value as 'ARS' | 'USD' })}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </Select>
            </div>
          </div>
          <Input inputSize={inputSize} label="Observaciones" value={value?.observaciones ?? ''} onChange={e => set({ observaciones: e.target.value || null })}
            placeholder="Opcional" />
        </>
      )}
    </div>
  );
}
