import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { reservasService } from '../../services/stockService';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import type { UnidadStock } from '@ags/shared';

interface Props {
  minikit: { id: string; codigo: string; nombre: string };
  unidad: UnidadStock;
  onClose: () => void;
  onDone: (res: { consumida: boolean; reservaSaldada: boolean; error?: string }) => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';
const ctrl = 'w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700';

/**
 * Registra que el ingeniero consumió una parte de su minikit (baja real, atada a la OT)
 * y, si hay una reserva viva para el mismo cliente+artículo, la salda reponiendo el kit
 * con la unidad reservada. Match por cliente (resuelto desde la OT) + artículo de la unidad.
 */
export const ConsumirUnidadMinikitModal: React.FC<Props> = ({ minikit, unidad, onClose, onDone }) => {
  const { usuario, firebaseUser } = useAuth();
  const [otNumber, setOtNumber] = useState('');
  const [clienteNombre, setClienteNombre] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [reservas, setReservas] = useState<UnidadStock[]>([]);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolver OT → cliente → reservas del artículo para ese cliente (debounced).
  useEffect(() => {
    const ot = otNumber.trim();
    if (!ot) { setClienteId(null); setClienteNombre(null); setReservas([]); setReservaId(null); return; }
    let alive = true;
    setResolving(true);
    const t = setTimeout(async () => {
      try {
        const otDoc = await ordenesTrabajoService.getByOtNumber(ot);
        if (!alive) return;
        const cid = otDoc?.clienteId ?? null;
        setClienteId(cid);
        setClienteNombre(otDoc?.razonSocial ?? null);
        if (cid && unidad.articuloId) {
          const rs = await reservasService.getReservadasByClienteArticulo(cid, unidad.articuloId);
          if (!alive) return;
          setReservas(rs);
          setReservaId(rs[0]?.id ?? null);
        } else { setReservas([]); setReservaId(null); }
      } catch {
        if (alive) { setReservas([]); setReservaId(null); }
      } finally { if (alive) setResolving(false); }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [otNumber, unidad.articuloId]);

  const confirmar = async () => {
    setSaving(true);
    setError(null);
    try {
      const reservaUnidad = reservas.find(r => r.id === reservaId) ?? null;
      const res = await reservasService.saldarConsumoMinikit({
        unidadKit: unidad,
        minikitId: minikit.id,
        minikitNombre: `${minikit.codigo} - ${minikit.nombre}`,
        otNumber: otNumber.trim() || null,
        clienteId,
        clienteNombre,
        reservaUnidad,
        solicitadoPorNombre: usuario?.displayName ?? usuario?.email ?? firebaseUser?.email ?? 'Admin',
      });
      onDone(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consumir la unidad');
      setSaving(false);
    }
  };

  const reservaSel = reservas.find(r => r.id === reservaId) ?? null;

  return (
    <Modal open onClose={onClose} title="Consumir del minikit" maxWidth="sm"
      subtitle={`${unidad.articuloCodigo} — ${minikit.codigo} ${minikit.nombre}`}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button size="sm" onClick={confirmar} disabled={saving}>
          {saving ? 'Registrando...' : reservaSel ? 'Consumir y saldar reserva' : 'Consumir'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
          <p className="font-mono text-teal-700 font-semibold">{unidad.articuloCodigo}</p>
          <p className="truncate">{unidad.articuloDescripcion}</p>
          {unidad.nroSerie && <p className="mt-0.5 font-mono text-[11px] text-slate-400">S/N: {unidad.nroSerie}</p>}
        </div>

        <div>
          <label className={lbl}>Nº de OT</label>
          <input className={ctrl} value={otNumber} onChange={e => setOtNumber(e.target.value)}
            placeholder="Ej. 12345.01 — resuelve el cliente y la reserva" autoFocus />
          {resolving && <p className="mt-1 text-[11px] text-slate-400">Buscando OT…</p>}
          {!resolving && otNumber.trim() && (
            <p className="mt-1 text-[11px] text-slate-500">
              {clienteNombre ? `Cliente: ${clienteNombre}` : 'OT no encontrada — se consume sin saldar reserva'}
            </p>
          )}
        </div>

        {reservas.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-[11px] font-medium text-amber-800 mb-1.5">
              Hay {reservas.length} unidad{reservas.length !== 1 ? 'es' : ''} reservada{reservas.length !== 1 ? 's' : ''} para este cliente y artículo.
              Saldar la reserva repone este kit con la unidad reservada (queda a −1 neto).
            </p>
            {reservas.length === 1 ? (
              <p className="text-[11px] text-amber-700">
                Reserva ppto <span className="font-mono">{reservaSel?.reservadoParaPresupuestoNumero ?? '—'}</span> → repone el kit.
              </p>
            ) : (
              <select className={ctrl + ' bg-white'} value={reservaId ?? ''} onChange={e => setReservaId(e.target.value || null)}>
                <option value="">No saldar ninguna reserva</option>
                {reservas.map(r => (
                  <option key={r.id} value={r.id}>
                    Ppto {r.reservadoParaPresupuestoNumero ?? '—'}{r.nroSerie ? ` · S/N ${r.nroSerie}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </Modal>
  );
};
