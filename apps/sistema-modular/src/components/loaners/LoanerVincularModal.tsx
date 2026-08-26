import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { fichasService } from '../../services/fichasService';
import { loanersService } from '../../services/loanersService';
import type { Loaner, PrestamoLoaner, WorkOrder, FichaPropiedad } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  loaner: Loaner;
  prestamo: PrestamoLoaner;
  onLinked: () => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

/**
 * Vincular a posteriori el préstamo activo con una OT y/o una ficha (2026-08-26).
 *
 * Caso típico: la visita deja el loaner en el cliente y se trae un módulo a
 * bench. El préstamo se registró primero, la ficha se crea después — y el
 * vínculo solo se podía declarar al crear cada pieza. Desde acá se ata todo:
 * préstamo → OT / ficha, loaner.otIds y ficha → loaner.
 */
export function LoanerVincularModal({ open, onClose, loaner, prestamo, onLinked }: Props) {
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [fichas, setFichas] = useState<FichaPropiedad[]>([]);
  const [otNumber, setOtNumber] = useState('');
  const [fichaId, setFichaId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOtNumber(prestamo.otNumber ?? '');
    setFichaId(prestamo.fichaId ?? '');
    ordenesTrabajoService.getAll({ clienteId: prestamo.clienteId }).then(setOts).catch(() => setOts([]));
    fichasService.getAll({ clienteId: prestamo.clienteId }).then(setFichas).catch(() => setFichas([]));
  }, [open, prestamo]);

  const otOptions = useMemo(
    () => ots.map(ot => ({ value: ot.otNumber, label: ot.sistema ? `${ot.otNumber} · ${ot.sistema}` : ot.otNumber })),
    [ots]);
  const fichaOptions = useMemo(
    () => fichas
      .filter(f => f.estado !== 'entregado')
      .map(f => ({
        value: f.id,
        label: `${f.numero} — ${(f.items ?? []).map(i => i.articuloDescripcion || i.descripcionLibre).filter(Boolean).join(', ').slice(0, 60) || 'sin items'}`,
        subLabel: f.loanerId && f.loanerId !== loaner.id ? `⚠ ya vinculada a otro loaner` : undefined,
      })),
    [fichas, loaner.id]);

  // Se permite re-confirmar los mismos valores (idempotente): sirve para armar
  // la cadena de ítems en vínculos hechos antes de que existiera (2026-08-26).
  const cambio = !!otNumber || !!fichaId;

  const guardar = async () => {
    setSaving(true);
    try {
      const ficha = fichaId ? fichas.find(f => f.id === fichaId) : null;
      await loanersService.vincularPrestamo(loaner.id, prestamo.id, {
        otNumber: otNumber || null,
        ficha: ficha ? { id: ficha.id, numero: ficha.numero } : null,
      });
      onLinked();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al vincular');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Vincular préstamo"
      subtitle={`${loaner.codigo} — en ${prestamo.clienteNombre}`} maxWidth="md"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => void guardar()} disabled={saving || !cambio}>
          {saving ? 'Vinculando…' : 'Vincular'}
        </Button>
      </>}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Ata este préstamo a la OT de la visita y/o a la ficha del equipo que se trajo a bench.
          El vínculo se estampa en las dos direcciones (préstamo, loaner y ficha).
        </p>
        <div>
          <label className={lbl}>OT de la visita</label>
          <SearchableSelect value={otNumber} onChange={setOtNumber} options={otOptions}
            placeholder={prestamo.otNumber ? `Actual: ${prestamo.otNumber}` : 'Sin OT — buscar…'} />
        </div>
        <div>
          <label className={lbl}>Ficha del equipo en bench</label>
          <SearchableSelect value={fichaId} onChange={setFichaId} options={fichaOptions}
            placeholder={prestamo.fichaNumero ? `Actual: ${prestamo.fichaNumero}` : 'Sin ficha — buscar…'} />
          <p className="text-[10px] text-slate-400 mt-0.5">
            Si la ficha todavía no existe, creala primero en Fichas Propiedad (con la OT de referencia) y volvé acá.
          </p>
        </div>
      </div>
    </Modal>
  );
}
