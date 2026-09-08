import { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { remitosService } from '../../services/firebaseService';
import type { Loaner, ParteLoanerPrestada } from '@ags/shared';
import { loanerEstaIncompleto, loanerPartesFaltantes } from '@ags/shared';
import { NUMERO_REGEX } from '../../hooks/useGenerarRemito';
import { TRANSPORTISTA_AGS } from '../../utils/remitoImprimir';
import { crearEImprimirRemitoSalidaLoaner } from '../../utils/loanerRemitoSalida';
import { LoanerPrestamoParteFields, PARTE_VACIA } from './LoanerPrestamoParteFields';
import { LoanerPrestamoDestinoFields, DESTINO_VACIO, type DestinoPrestamo } from './LoanerPrestamoDestinoFields';

export interface PrestamoLoanerDatos {
  clienteId: string;
  clienteNombre: string;
  establecimientoId: string | null;
  establecimientoNombre: string | null;
  otNumber: string | null;
  fechaRetornoPrevista: string | null;
  remitoSalidaId: string | null;
  remitoSalidaNumero: string | null;
  /** Módulo entero o partes (2026-09-04). */
  alcance: 'modulo' | 'parte';
  /** Legacy: la primera parte. */
  parte: ParteLoanerPrestada | null;
  /** Todas las partes del movimiento (2026-09-08). */
  partes: ParteLoanerPrestada[];
  /** A dónde va (2026-09-08): al cliente con remito, o al inventario de un ingeniero. */
  destino: 'cliente' | 'ingeniero';
  ingenieroId: string | null;
  ingenieroNombre: string | null;
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function LoanerPrestamoModal({ open, onClose, loaner, onConfirm }: Props) {
  const [destino, setDestino] = useState<DestinoPrestamo>(DESTINO_VACIO);
  const [fechaRetorno, setFechaRetorno] = useState('');
  const [alcance, setAlcance] = useState<'modulo' | 'parte'>('modulo');
  const [partes, setPartes] = useState<ParteLoanerPrestada[]>([PARTE_VACIA()]);
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
    // Fecha de retorno probable por defecto: hoy + 20 días (editable).
    const d = new Date();
    d.setDate(d.getDate() + 20);
    setFechaRetorno(toDateInput(d));
    // Prefill con el próximo número del talonario preimpreso (2026-08-26).
    remitosService.getProximoNumeroPreimpreso()
      .then(n => setNumeroRemito(prev => prev || n))
      .catch(() => {});
  }, [open]);

  const esParte = alcance === 'parte';
  const aIngeniero = esParte && destino.destino === 'ingeniero';
  // El módulo entero siempre va a un cliente: si se vuelve a "módulo", el destino se corrige solo.
  useEffect(() => { if (!esParte && destino.destino === 'ingeniero') setDestino(d => ({ ...d, destino: 'cliente' })); }, [esParte, destino.destino]);
  const conRemito = generarRemito && !aIngeniero;

  const partesValidas = !esParte || partes.every(p => p.descripcion.trim().length > 0);
  const destinoValido = aIngeniero ? !!destino.ingenieroId : !!destino.clienteId;
  const puedeConfirmar = destinoValido && partesValidas && !saving && (!conRemito || numeroValido);

  const handleConfirm = async () => {
    if (!puedeConfirmar) return;
    setSaving(true);
    try {
      const partesFinales: ParteLoanerPrestada[] = esParte
        ? partes.map(p => ({ ...p, id: p.id ?? crypto.randomUUID(), descripcion: p.descripcion.trim(), dejaInoperativo: p.dejaInoperativo !== false }))
        : [];
      let remitoSalidaId: string | null = null;
      let remitoSalidaNumero: string | null = null;
      if (conRemito) {
        const r = await crearEImprimirRemitoSalidaLoaner({
          loaner,
          numero: numeroRemito,
          clienteId: destino.clienteId,
          clienteNombre: destino.clienteNombre,
          establecimientoId: destino.establecimientoId || null,
          establecimientoNombre: destino.establecimientoNombre || null,
          otNumber: destino.otNumber || null,
          partes: partesFinales,
        });
        remitoSalidaId = r.remitoId;
        remitoSalidaNumero = r.remitoNumero;
      }

      await onConfirm({
        clienteId: aIngeniero ? '' : destino.clienteId,
        clienteNombre: aIngeniero ? '' : destino.clienteNombre,
        establecimientoId: aIngeniero ? null : destino.establecimientoId || null,
        establecimientoNombre: aIngeniero ? null : destino.establecimientoNombre || null,
        otNumber: aIngeniero ? null : destino.otNumber || null,
        fechaRetornoPrevista: fechaRetorno ? new Date(fechaRetorno).toISOString() : null,
        remitoSalidaId,
        remitoSalidaNumero,
        alcance,
        parte: partesFinales[0] ?? null,
        partes: partesFinales,
        destino: aIngeniero ? 'ingeniero' : 'cliente',
        ingenieroId: aIngeniero ? destino.ingenieroId : null,
        ingenieroNombre: aIngeniero ? destino.ingenieroNombre : null,
        fotos,
      });

      onClose();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setDestino(DESTINO_VACIO);
    setFechaRetorno('');
    setAlcance('modulo');
    setPartes([PARTE_VACIA()]);
    setGenerarRemito(true);
    setFotos([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar prestamo" maxWidth="md" footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!puedeConfirmar}>
          {saving ? 'Registrando...' : esParte ? `Confirmar prestamo de ${partes.length > 1 ? `${partes.length} partes` : 'la parte'}` : 'Confirmar prestamo'}
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
        <LoanerPrestamoParteFields alcance={alcance} onAlcanceChange={setAlcance} partes={partes} onPartesChange={setPartes} />
        <LoanerPrestamoDestinoFields value={destino} onChange={setDestino} permitirIngeniero={esParte} />
        <Input label="Fecha de retorno prevista" type="date" value={fechaRetorno} onChange={e => setFechaRetorno(e.target.value)} />
        {!aIngeniero && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={generarRemito} onChange={e => setGenerarRemito(e.target.checked)} className="rounded border-slate-300" />
            Generar remito de salida
          </label>
        )}
        {conRemito && (
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
