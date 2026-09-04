import { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService, establecimientosService, remitosService, ordenesTrabajoService } from '../../services/firebaseService';
import type { Cliente, Establecimiento, Loaner, ParteLoanerPrestada, WorkOrder } from '@ags/shared';
import { establecimientoUnicoId, loanerEstaIncompleto, loanerPartesFaltantes } from '@ags/shared';
import { NUMERO_REGEX } from '../../hooks/useGenerarRemito';
import { TRANSPORTISTA_AGS } from '../../utils/remitoImprimir';
import { crearEImprimirRemitoSalidaLoaner } from '../../utils/loanerRemitoSalida';
import { LoanerPrestamoParteFields } from './LoanerPrestamoParteFields';

export interface PrestamoLoanerDatos {
  clienteId: string;
  clienteNombre: string;
  establecimientoId: string | null;
  establecimientoNombre: string | null;
  otNumber: string | null;
  fechaRetornoPrevista: string | null;
  remitoSalidaId: string | null;
  remitoSalidaNumero: string | null;
  /** Módulo entero o una parte (2026-09-04). */
  alcance: 'modulo' | 'parte';
  parte: ParteLoanerPrestada | null;
  /** Fotos del estado de salida (opcionales) — se suben con contexto 'prestamo'. */
  fotos: File[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  loaner: Loaner;
  onConfirm: (data: PrestamoLoanerDatos) => Promise<void>;
}

/** Fecha local (no UTC) a `YYYY-MM-DD` para el input date. */
function toDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const PARTE_VACIA: ParteLoanerPrestada = { descripcion: '', codigoArticulo: null, articuloId: null, serie: null, dejaInoperativo: true };

export function LoanerPrestamoModal({ open, onClose, loaner, onConfirm }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [otNumber, setOtNumber] = useState('');
  const [fechaRetorno, setFechaRetorno] = useState('');
  const [alcance, setAlcance] = useState<'modulo' | 'parte'>('modulo');
  const [parte, setParte] = useState<ParteLoanerPrestada>(PARTE_VACIA);
  const [generarRemito, setGenerarRemito] = useState(true);
  /**
   * N° del talonario preimpreso (2026-08-23). El préstamo era el ÚNICO flujo
   * que no lo pedía: generaba un `REM-00xx` interno para un papel que se lleva
   * el cliente.
   */
  const [numeroRemito, setNumeroRemito] = useState('');
  const numeroValido = NUMERO_REGEX.test(numeroRemito.trim());
  const [fotos, setFotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    clientesService.getAll().then(c => setClientes(c.filter(x => x.activo)));
    // Fecha de retorno probable por defecto: hoy + 20 días (editable).
    const d = new Date();
    d.setDate(d.getDate() + 20);
    setFechaRetorno(toDateInput(d));
    // Prefill con el próximo número del talonario preimpreso (2026-08-26).
    remitosService.getProximoNumeroPreimpreso()
      .then(n => setNumeroRemito(prev => prev || n))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!clienteId) { setEstablecimientos([]); setOts([]); return; }
    establecimientosService.getByCliente(clienteId).then(ests => {
      setEstablecimientos(ests);
      // Regla del proyecto: cliente con un único establecimiento (activo) → autoseleccionarlo.
      const unico = establecimientoUnicoId(ests.filter(e => e.activo));
      if (unico) setEstablecimientoId(unico);
    });
    // OTs del cliente para el selector (reemplaza el "motivo" libre).
    ordenesTrabajoService.getAll({ clienteId }).then(setOts).catch(() => setOts([]));
  }, [clienteId]);

  const selectedCliente = clientes.find(c => c.id === clienteId);
  const selectedEstab = establecimientos.find(e => e.id === establecimientoId);

  const clienteOptions = useMemo(
    () => clientes.map(c => ({ value: c.id, label: c.razonSocial })),
    [clientes],
  );
  const establecimientoOptions = useMemo(
    () => establecimientos.filter(e => e.activo).map(e => ({ value: e.id, label: e.nombre })),
    [establecimientos],
  );
  const otOptions = useMemo(
    () => ots.map(ot => ({ value: ot.otNumber, label: ot.sistema ? `${ot.otNumber} · ${ot.sistema}` : ot.otNumber })),
    [ots],
  );

  const esParte = alcance === 'parte';
  const parteValida = !esParte || parte.descripcion.trim().length > 0;
  const puedeConfirmar = !!clienteId && parteValida && !saving && (!generarRemito || numeroValido);

  const handleConfirm = async () => {
    if (!puedeConfirmar) return;
    setSaving(true);
    try {
      const parteFinal: ParteLoanerPrestada | null = esParte
        ? { ...parte, descripcion: parte.descripcion.trim(), dejaInoperativo: parte.dejaInoperativo !== false }
        : null;
      let remitoSalidaId: string | null = null;
      let remitoSalidaNumero: string | null = null;
      if (generarRemito) {
        const r = await crearEImprimirRemitoSalidaLoaner({
          loaner,
          numero: numeroRemito,
          clienteId,
          clienteNombre: selectedCliente?.razonSocial || '',
          establecimientoId: establecimientoId || null,
          establecimientoNombre: selectedEstab?.nombre || null,
          otNumber: otNumber || null,
          parte: parteFinal,
        });
        remitoSalidaId = r.remitoId;
        remitoSalidaNumero = r.remitoNumero;
      }

      await onConfirm({
        clienteId,
        clienteNombre: selectedCliente?.razonSocial || '',
        establecimientoId: establecimientoId || null,
        establecimientoNombre: selectedEstab?.nombre || null,
        otNumber: otNumber || null,
        fechaRetornoPrevista: fechaRetorno ? new Date(fechaRetorno).toISOString() : null,
        remitoSalidaId,
        remitoSalidaNumero,
        alcance,
        parte: parteFinal,
        fotos,
      });

      onClose();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setClienteId('');
    setEstablecimientoId('');
    setOtNumber('');
    setFechaRetorno('');
    setAlcance('modulo');
    setParte(PARTE_VACIA);
    setGenerarRemito(true);
    setFotos([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar prestamo" maxWidth="md" footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!puedeConfirmar}>
          {saving ? 'Registrando...' : esParte ? 'Confirmar prestamo de la parte' : 'Confirmar prestamo'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
        {/* Aviso de loaner incompleto (2026-08-20): el punto de todo el circuito
            es que el dato frene la decision, no que quede lindo en la ficha.
            No bloquea — a veces se presta igual y se avisa al cliente. */}
        {loanerEstaIncompleto(loaner) && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-800">Este loaner esta INCOMPLETO</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Falta reponer: {loanerPartesFaltantes(loaner)}. Si se presta asi, el equipo no va a estar operativo en el cliente.
            </p>
          </div>
        )}
        <LoanerPrestamoParteFields alcance={alcance} onAlcanceChange={setAlcance} parte={parte} onParteChange={setParte} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
          <SearchableSelect value={clienteId} onChange={v => { setClienteId(v); setEstablecimientoId(''); setOtNumber(''); }} options={clienteOptions} placeholder="Seleccionar cliente" size="sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Establecimiento</label>
          <SearchableSelect value={establecimientoId} onChange={v => setEstablecimientoId(v)} options={establecimientoOptions} placeholder="Seleccionar" size="sm" disabled={!clienteId} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Orden de Trabajo <span className="text-slate-400 font-normal">(opcional)</span></label>
          <SearchableSelect value={otNumber} onChange={v => setOtNumber(v)} options={otOptions}
            placeholder={!clienteId ? 'Seleccioná primero el cliente' : otOptions.length === 0 ? 'El cliente no tiene OTs' : 'Buscar OT...'}
            size="sm" disabled={!clienteId} />
        </div>
        <Input label="Fecha de retorno prevista" type="date" value={fechaRetorno} onChange={e => setFechaRetorno(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={generarRemito} onChange={e => setGenerarRemito(e.target.checked)} className="rounded border-slate-300" />
          Generar remito de salida
        </label>
        {generarRemito && (
          <div className="border-l-2 border-teal-200 pl-3 space-y-2">
            <Input
              label="N° Remito (preimpreso) *"
              value={numeroRemito}
              onChange={e => setNumeroRemito(e.target.value)}
              placeholder="0001-00000001"
              error={numeroRemito && !numeroValido ? 'Formato 0001-00000001' : undefined}
              description="El del papel que vas a usar. Es el número que ve el cliente."
            />
            {/* El transporte de un préstamo lo hace AGS: no hay nada que elegir,
                pero tiene que verse (2026-08-23). */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Transportista</label>
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                {TRANSPORTISTA_AGS.razonSocial}
                <span className="text-slate-400"> · CUIT {TRANSPORTISTA_AGS.cuit}</span>
              </div>
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fotos de salida <span className="text-slate-400 font-normal">(opcional)</span></label>
          <input ref={fileRef} type="file" accept="image/*" multiple
            onChange={e => setFotos(Array.from(e.target.files ?? []))}
            className="block w-full text-xs text-slate-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:text-xs file:font-medium hover:file:bg-teal-100" />
          {fotos.length > 0 && (
            <p className="text-[11px] text-slate-400 mt-1">{fotos.length} foto(s) seleccionada(s)</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
