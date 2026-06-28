import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { proveedoresService } from '../../services/personalService';
import { remitosService, type DatosTransportista } from '../../services/stockService';
import { instrumentosService } from '../../services/firebaseService';
import { useInstrumentos } from '../../hooks/useInstrumentos';
import { RemitoOverlayPDF } from '../remitos/pdf/RemitoOverlayPDF';
import { DerivarInstrumentosPicker, instrumentoResumen } from './DerivarInstrumentosPicker';
import { openRemitoPdfInNewTab } from '../../utils/remitoPdfActions';
import { formatFechaAR } from '../../utils/formatFecha';
import type { InstrumentoPatron, Proveedor } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  instrumento: InstrumentoPatron;
  onDerivado: () => void;
}

const NUMERO_REGEX = /^\d{4}-\d{8}$/;
const EMPTY_PARTY: DatosTransportista = {
  razonSocial: '', domicilio: '', localidad: '', provincia: '', iva: '', cuit: '',
};

function fromProveedor(p: Proveedor): DatosTransportista {
  return {
    razonSocial: p.nombre,
    domicilio: p.direccion ?? '',
    localidad: '',
    provincia: p.pais ?? '',
    iva: p.tipo === 'internacional' ? 'Exterior' : '',
    cuit: p.cuit ?? '',
  };
}

export function DerivarCalibracionModal({ open, onClose, instrumento, onDerivado }: Props) {
  const { derivarACalibracion } = useInstrumentos();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinatario, setDestinatario] = useState<DatosTransportista>(EMPTY_PARTY);
  const [observaciones, setObservaciones] = useState('');
  const [disponibles, setDisponibles] = useState<InstrumentoPatron[]>([]);
  const [seleccionados, setSeleccionados] = useState<InstrumentoPatron[]>([instrumento]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setObservaciones('');
    setSeleccionados([instrumento]);
    proveedoresService.getAll().then(setProveedores).catch(() => setError('Error cargando proveedores'));
    remitosService.getProximoNumeroPreimpreso().then(setNumero).catch(() => { /* el usuario edita manual */ });
    instrumentosService.getAll({ activoOnly: true })
      .then(all => setDisponibles(all.filter(i => i.estadoCalibracion !== 'en_calibracion')))
      .catch(() => { /* el seed siempre está disponible */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instrumento.id]);

  const addInstrumento = (i: InstrumentoPatron) => setSeleccionados(prev => [...prev, i]);
  const removeInstrumento = (id: string) => setSeleccionados(prev => prev.filter(x => x.id !== id));

  const handlePickProveedor = (id: string) => {
    setProveedorId(id);
    const p = proveedores.find(x => x.id === id);
    if (p) setDestinatario(fromProveedor(p));
  };

  const proveedorOptions = useMemo(
    () => proveedores.map(p => ({ value: p.id, label: p.nombre })),
    [proveedores],
  );

  const numeroValido = NUMERO_REGEX.test(numero);
  const canSubmit = !!proveedorId && numeroValido && !!destinatario.razonSocial.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const proveedor = proveedores.find(p => p.id === proveedorId);
      if (!proveedor) throw new Error('Proveedor no encontrado');
      if (seleccionados.length === 0) throw new Error('Agregá al menos un instrumento');

      const motivo = 'Derivación para recalibración';

      const remitoId = await remitosService.create({
        numero,
        tipo: 'derivacion_proveedor',
        estado: 'en_transito',
        ingenieroId: '',
        ingenieroNombre: '',
        items: seleccionados.map(i => ({
          id: crypto.randomUUID(),
          cantidad: 1,
          tipoItem: 'sale_y_vuelve' as const,
          devuelto: false,
          instrumentoId: i.id,
          instrumentoCodigo: i.nombre,
          instrumentoDescripcion: instrumentoResumen(i),
        })),
        observaciones: observaciones.trim() || null,
        fechaSalida: fecha,
        proveedorId: proveedor.id,
        proveedorNombre: proveedor.nombre,
      });

      await Promise.all(seleccionados.map(i => derivarACalibracion(i.id, {
        proveedorId: proveedor.id,
        proveedorNombre: proveedor.nombre,
        remitoId,
        remitoNumero: numero,
        fechaEnvio: fecha,
        observaciones: observaciones.trim() || null,
      })));

      await openRemitoPdfInNewTab(
        <RemitoOverlayPDF
          fecha={formatFechaAR(fecha)}
          destinatario={destinatario}
          items={seleccionados.map((i, idx) => ({
            numero: idx + 1,
            cantidad: 1,
            producto: i.nombre,
            descripcion: `${instrumentoResumen(i)} · ${motivo}`,
          }))}
        />,
      );
      onDerivado();
      onClose();
    } catch (err) {
      console.error('Error derivando a calibración:', err);
      setError(err instanceof Error ? err.message : 'No se pudo derivar el instrumento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Derivar a calibración"
      subtitle={instrumento.nombre}
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
            {submitting ? 'Generando…' : 'Generar remito y derivar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
        )}

        <div>
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Proveedor *</p>
          <SearchableSelect
            value={proveedorId}
            onChange={handlePickProveedor}
            options={proveedorOptions}
            placeholder="Seleccionar proveedor…"
          />
        </div>

        <DerivarInstrumentosPicker
          seleccionados={seleccionados}
          disponibles={disponibles}
          seedId={instrumento.id}
          onAdd={addInstrumento}
          onRemove={removeInstrumento}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            inputSize="sm"
            label="N° Remito (preimpreso) *"
            value={numero}
            onChange={e => setNumero(e.target.value)}
            placeholder="0001-00000001"
            error={numero && !numeroValido ? 'Formato 0001-00000001' : undefined}
          />
          <Input inputSize="sm" label="Fecha *" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>

        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500">Destinatario (proveedor)</p>
          <Input inputSize="sm" label="Razón social" value={destinatario.razonSocial}
            onChange={e => setDestinatario({ ...destinatario, razonSocial: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input inputSize="sm" label="Domicilio" value={destinatario.domicilio}
              onChange={e => setDestinatario({ ...destinatario, domicilio: e.target.value })} />
            <Input inputSize="sm" label="Localidad" value={destinatario.localidad}
              onChange={e => setDestinatario({ ...destinatario, localidad: e.target.value })} />
            <Input inputSize="sm" label="Provincia" value={destinatario.provincia}
              onChange={e => setDestinatario({ ...destinatario, provincia: e.target.value })} />
            <Input inputSize="sm" label="IVA" value={destinatario.iva}
              onChange={e => setDestinatario({ ...destinatario, iva: e.target.value })} />
            <Input inputSize="sm" label="CUIT" value={destinatario.cuit}
              onChange={e => setDestinatario({ ...destinatario, cuit: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Ej: Recalibración anual, contactar a Juan Pérez."
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Se generará un remito tipo «derivación a proveedor» con {seleccionados.length === 1 ? 'el instrumento' : `los ${seleccionados.length} instrumentos`} como items «sale y vuelve», se marcarán como <strong>En calibración</strong>, y se abrirá el PDF para imprimir sobre el papel preimpreso.
        </p>
      </div>
    </Modal>
  );
}
