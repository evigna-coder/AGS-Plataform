import { useEffect, useMemo, useState } from 'react';
import type { GastoEnvio, Remito } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DateInput } from '../ui/DateInput';
import { MoneyInput } from '../ui/MoneyInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { remitosService } from '../../services/firebaseService';
import { cotizacionesService } from '../../services/cotizacionesService';
import { arsAUsd } from '../../utils/poolEnvios';
import { hoyLocalISODate } from '../../utils/formatFecha';
import { notify } from '../../utils/notify';

export interface PptoEnvioOption { id: string; numero: string; clienteNombre: string }

interface Props {
  open: boolean;
  onClose: () => void;
  onRegistrar: (data: Omit<GastoEnvio, 'id' | 'createdAt' | 'updatedAt'>) => Promise<unknown>;
  /** Presupuestos con entregas en curso, para vincular el viaje. */
  pptoOptions: PptoEnvioOption[];
}

const label = 'block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1';
const fmtUSD = (n: number) => `U$S ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

/**
 * Un VIAJE de entrega a cliente (2026-09-23): puede llevar varios remitos y
 * OT. Se carga en pesos; el tipo de cambio se sugiere con el BNA vendedor del
 * día y queda guardado con el gasto, junto al equivalente en dólares que
 * descuenta del pool.
 */
export function RegistrarEnvioModal({ open, onClose, onRegistrar, pptoOptions }: Props) {
  const [fecha, setFecha] = useState(hoyLocalISODate());
  const [montoARS, setMontoARS] = useState<number | null>(null);
  const [tipoCambio, setTipoCambio] = useState('');
  const [tcFuente, setTcFuente] = useState<string | null>(null);
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [remitosSel, setRemitosSel] = useState<Remito[]>([]);
  const [pptosSel, setPptosSel] = useState<PptoEnvioOption[]>([]);
  const [transportista, setTransportista] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFecha(hoyLocalISODate()); setMontoARS(null); setRemitosSel([]); setPptosSel([]); setTransportista(''); setNotas('');
    setTcFuente(null);
    void cotizacionesService.oficial().then(c => {
      if (!c) { setTcFuente('No se pudo obtener el BNA: cargalo a mano'); return; }
      setTipoCambio(String(c.venta));
      setTcFuente(`BNA vendedor ${c.fecha ? c.fecha.slice(0, 10).split('-').reverse().join('/') : 'del día'}`);
    });
    // Remitos de entrega a cliente, los más recientes primero.
    void remitosService.getAll({ tipo: 'entrega_cliente' })
      .then(rs => setRemitos([...rs].sort((a, b) => (b.fechaSalida ?? '').localeCompare(a.fechaSalida ?? '')).slice(0, 300)))
      .catch(err => console.error('[RegistrarEnvioModal] remitos:', err));
  }, [open]);

  const tc = Number(tipoCambio.replace(',', '.')) || 0;
  const usd = montoARS && tc > 0 ? arsAUsd(montoARS, tc) : 0;
  const remitoOptions = useMemo(() => remitos
    .filter(r => !remitosSel.some(s => s.id === r.id))
    .map(r => ({ value: r.id, label: `${r.numero} — ${r.clienteNombre ?? '—'}${r.otNumbers?.length ? ` · OT ${r.otNumbers.join(', ')}` : ''}` })), [remitos, remitosSel]);
  const pptoSelectOptions = useMemo(() => pptoOptions
    .filter(p => !pptosSel.some(s => s.id === p.id))
    .map(p => ({ value: p.id, label: `${p.numero} — ${p.clienteNombre}` })), [pptoOptions, pptosSel]);
  const otNumbers = Array.from(new Set(remitosSel.flatMap(r => r.otNumbers ?? []))).sort();
  const puedeGuardar = !!fecha && !!montoARS && montoARS > 0 && tc > 0 && !saving;

  const guardar = async () => {
    if (!puedeGuardar || !montoARS) return;
    setSaving(true);
    try {
      await onRegistrar({
        fecha, montoARS, tipoCambio: tc, montoUSD: usd,
        remitoIds: remitosSel.map(r => r.id), remitoNumeros: remitosSel.map(r => r.numero),
        otNumbers,
        presupuestoIds: pptosSel.map(p => p.id), presupuestoNumeros: pptosSel.map(p => p.numero),
        clienteNombre: remitosSel[0]?.clienteNombre ?? pptosSel[0]?.clienteNombre ?? null,
        transportista: transportista.trim() || null,
        notas: notas.trim() || null,
      });
      notify.success(`Envío registrado: ${fmtUSD(usd)} descontados del pool`);
      onClose();
    } catch (err) {
      console.error('[RegistrarEnvioModal] guardar:', err);
      notify.error('No se pudo registrar el envío');
    } finally {
      setSaving(false);
    }
  };

  const chips = <T,>(items: T[], texto: (t: T) => string, quitar: (t: T) => void) => items.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">
          {texto(it)}
          <button type="button" onClick={() => quitar(it)} className="text-slate-400 hover:text-red-600" title="Quitar">×</button>
        </span>
      ))}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Registrar envío" subtitle="Un viaje de entrega: se descuenta del pool de envíos" maxWidth="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={guardar} disabled={!puedeGuardar}>{saving ? 'Guardando…' : 'Registrar'}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className={label}>Fecha del viaje</label><DateInput value={fecha} onChange={setFecha} /></div>
        <div><label className={label}>Costo en pesos</label><MoneyInput value={montoARS} onChange={setMontoARS} placeholder="0,00" /></div>
        <div>
          <label className={label}>Tipo de cambio (ARS por U$S)</label>
          <input type="text" inputMode="decimal" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-mono" />
          <p className="text-[10px] text-slate-400 mt-0.5">{tcFuente ?? 'Consultando BNA…'}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">Equivalente: <span className="font-mono font-semibold text-teal-700">{fmtUSD(usd)}</span></p>

      <div className="mt-4">
        <label className={label}>Remitos del viaje</label>
        <SearchableSelect value="" onChange={v => { const r = remitos.find(x => x.id === v); if (r) setRemitosSel(prev => [...prev, r]); }}
          options={remitoOptions} placeholder="Agregar remito de entrega…" size="sm" />
        {chips(remitosSel, r => r.numero, r => setRemitosSel(prev => prev.filter(x => x.id !== r.id)))}
        {otNumbers.length > 0 && <p className="text-[10px] text-slate-400 mt-1">OT: {otNumbers.join(', ')}</p>}
      </div>
      <div className="mt-3">
        <label className={label}>Presupuestos (opcional)</label>
        <SearchableSelect value="" onChange={v => { const p = pptoOptions.find(x => x.id === v); if (p) setPptosSel(prev => [...prev, p]); }}
          options={pptoSelectOptions} placeholder="Vincular presupuesto…" size="sm" />
        {chips(pptosSel, p => p.numero, p => setPptosSel(prev => prev.filter(x => x.id !== p.id)))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div><label className={label}>Transportista</label>
          <input type="text" value={transportista} onChange={e => setTransportista(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm" placeholder="Opcional" /></div>
        <div><label className={label}>Notas</label>
          <input type="text" value={notas} onChange={e => setNotas(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm" placeholder="Garantía, devolución, etc." /></div>
      </div>
    </Modal>
  );
}
