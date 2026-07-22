import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { fichasService, ordenesTrabajoService } from '../../services/firebaseService';
import type { FichaPropiedad, ItemFicha, WorkOrder } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
  item: ItemFicha;
  onUpdate: () => void;
}

/**
 * OT asignada al item: chip con link a la OT actual + asignación/cambio.
 * El selector lista las OTs del cliente de la ficha (solo hijas .NN todavía
 * accionables, más recientes primero) y admite tipear un número a mano
 * (creatable — OTs viejas o casos raros). La asignación valida existencia; si
 * el cliente no matchea avisa pero no bloquea. El historial del item se
 * alimenta solo: fichasService.syncCierreOT (cierre admin) y
 * avanzarOTAsignadaAHija (.01→.02).
 */
export function FichaItemOTSection({ ficha, item, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [otInput, setOtInput] = useState('');
  const [otsCliente, setOtsCliente] = useState<WorkOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cargar las OTs del cliente recién al entrar en modo edición (lazy).
  useEffect(() => {
    if (!editing || !ficha.clienteId) return;
    ordenesTrabajoService.getAll({ clienteId: ficha.clienteId })
      .then(setOtsCliente)
      .catch(err => console.error('[FichaItemOTSection] OTs del cliente:', err));
  }, [editing, ficha.clienteId]);

  // Solo hijas .NN accionables (sin cierre admin), ya ordenadas desc por getAll.
  const otOptions = useMemo(() => otsCliente
    .filter(o => o.otNumber.includes('.')
      && o.estadoAdmin !== 'CIERRE_ADMINISTRATIVO' && o.estadoAdmin !== 'FINALIZADO')
    .map(o => ({
      value: o.otNumber,
      label: `OT ${o.otNumber} — ${o.tipoServicio || 'Sin tipo de servicio'}`,
      subLabel: [
        o.estadoAdmin ? OT_ESTADO_LABELS[o.estadoAdmin] : 'Sin estado',
        o.sistema || null,
      ].filter(Boolean).join(' · '),
    })), [otsCliente]);

  // Si el valor actual no está en la lista (tipeado a mano o la OT asignada ya
  // se cerró), se inyecta como opción para que el select lo muestre elegido.
  const selectOptions = useMemo(() =>
    otInput && !otOptions.some(o => o.value === otInput)
      ? [{ value: otInput, label: `OT ${otInput}` }, ...otOptions]
      : otOptions,
    [otOptions, otInput]);

  const handleAsignar = async () => {
    const num = otInput.trim();
    if (!num) { setError('Elegí una OT de la lista o tipeá el número (ej: 29715.01)'); return; }
    setSaving(true);
    setError('');
    try {
      const ot = await ordenesTrabajoService.getByOtNumber(num);
      if (!ot) { setError(`La OT ${num} no existe`); return; }
      if (ot.clienteId && ficha.clienteId && ot.clienteId !== ficha.clienteId) {
        const seguir = window.confirm(
          `Atención: la OT ${num} figura a nombre de "${ot.razonSocial || ot.clienteId}", ` +
          `que no coincide con el cliente de esta ficha (${ficha.clienteNombre}).\n\n¿Asignarla igual?`,
        );
        if (!seguir) return;
      }
      await fichasService.asignarOTaItem(ficha.id, item.id, num);
      setEditing(false);
      setOtInput('');
      onUpdate();
    } catch (err) {
      console.error('Error asignando OT al item:', err);
      setError('Error al asignar la OT');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono mb-1">OT asignada</p>
      <div className="flex items-center gap-2 flex-wrap">
        {item.otAsignada ? (
          <Link
            to={`/ordenes-trabajo?busqueda=${encodeURIComponent(item.otAsignada)}&estadoAdmin=`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-mono font-semibold hover:bg-teal-100"
          >
            OT {item.otAsignada}
          </Link>
        ) : (
          <span className="text-xs text-slate-400 italic">Sin OT asignada</span>
        )}
        {!editing && item.estado !== 'entregado' && (
          <button
            onClick={() => { setEditing(true); setOtInput(item.otAsignada ?? ''); setError(''); }}
            className="text-[11px] text-teal-600 hover:text-teal-800 underline"
          >
            {item.otAsignada ? 'Cambiar' : 'Asignar OT'}
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-1.5 max-w-md">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SearchableSelect
                value={otInput}
                onChange={setOtInput}
                options={selectOptions}
                placeholder="Buscar OT del cliente o tipear número…"
                creatable
                createLabel="Usar número"
                emptyMessage="Sin OTs abiertas del cliente — tipeá el número"
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleAsignar} disabled={saving}>
              {saving ? 'Asignando…' : 'Asignar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setError(''); }} disabled={saving}>
              Cancelar
            </Button>
          </div>
          {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
          <p className="text-[10px] text-slate-400 mt-0.5">
            Al cierre administrativo de la OT, el informe y las partes usadas se anotan solos en el historial del item.
          </p>
        </div>
      )}
    </div>
  );
}
