import { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService, establecimientosService, remitosService, ordenesTrabajoService } from '../../services/firebaseService';
import type { Cliente, Establecimiento, Loaner, WorkOrder } from '@ags/shared';
import { establecimientoUnicoId } from '@ags/shared';
import { imprimirRemitoStock } from '../../utils/remitoImprimir';

interface Props {
  open: boolean;
  onClose: () => void;
  loaner: Loaner;
  onConfirm: (data: {
    clienteId: string;
    clienteNombre: string;
    establecimientoId: string | null;
    establecimientoNombre: string | null;
    otNumber: string | null;
    fechaRetornoPrevista: string | null;
    remitoSalidaId: string | null;
    remitoSalidaNumero: string | null;
    /** Fotos del estado de salida (opcionales) — se suben con contexto 'prestamo'. */
    fotos: File[];
  }) => Promise<void>;
}

/** Fecha local (no UTC) a `YYYY-MM-DD` para el input date. */
function toDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function LoanerPrestamoModal({ open, onClose, loaner, onConfirm }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [ots, setOts] = useState<WorkOrder[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [otNumber, setOtNumber] = useState('');
  const [fechaRetorno, setFechaRetorno] = useState('');
  const [generarRemito, setGenerarRemito] = useState(true);
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

  const handleConfirm = async () => {
    if (!clienteId) return;
    setSaving(true);
    try {
      let remitoId: string | null = null;
      const remitoNumero: string | null = null;

      if (generarRemito) {
        // El item del loaner es DOCUMENTAL (sin unidadId, con tipoEntidad):
        // el remito no mueve stock, pero el papel detalla qué salió.
        remitoId = await remitosService.create({
          tipo: 'loaner_salida',
          estado: 'borrador',
          ingenieroId: '',
          ingenieroNombre: 'AGS Taller',
          clienteId,
          clienteNombre: selectedCliente?.razonSocial || '',
          establecimientoId: establecimientoId || null,
          establecimientoNombre: selectedEstab?.nombre || null,
          otNumbers: otNumber ? [otNumber] : [],
          loanerId: loaner.id,
          loanerCodigo: loaner.codigo,
          items: [{
            id: crypto.randomUUID(),
            cantidad: 1,
            tipoItem: 'sale_y_vuelve',
            devuelto: false,
            tipoEntidad: 'loaner',
            loanerId: loaner.id,
            loanerCodigo: loaner.codigo,
            loanerDescripcion: loaner.descripcion,
            serie: loaner.serie ?? null,
          }],
          observaciones: `Loaner ${loaner.codigo}${otNumber ? ` · OT ${otNumber}` : ''}`,
        });

        // Imprimir por el MISMO camino que el resto de los remitos (2026-08-06:
        // imprimía RemitoOverlayPDF pelado, sin la calibración contra el papel
        // preimpreso — salía todo corrido). imprimirRemitoStock aplica los
        // offsets calibrados, resuelve el domicilio de entrega por
        // establecimiento, imprime el triplicado en silencio (fallback abrir
        // PDF) y marca el remito como impreso. Best-effort: no bloquea el préstamo.
        const remitoCreado = await remitosService.getById(remitoId);
        if (remitoCreado) {
          await imprimirRemitoStock(remitoCreado)
            .catch(err => console.warn('[LoanerPrestamoModal] impresión de remito falló:', err));
        }
      }

      await onConfirm({
        clienteId,
        clienteNombre: selectedCliente?.razonSocial || '',
        establecimientoId: establecimientoId || null,
        establecimientoNombre: selectedEstab?.nombre || null,
        otNumber: otNumber || null,
        fechaRetornoPrevista: fechaRetorno ? new Date(fechaRetorno).toISOString() : null,
        remitoSalidaId: remitoId,
        remitoSalidaNumero: remitoNumero,
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
    setGenerarRemito(true);
    setFotos([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar prestamo" maxWidth="md" footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!clienteId || saving}>
          {saving ? 'Registrando...' : 'Confirmar prestamo'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
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
