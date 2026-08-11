import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { proveedoresService } from '../../services/personalService';
import { remitosService, type DatosTransportista } from '../../services/stockService';
import { instrumentosService } from '../../services/firebaseService';
import { useInstrumentos } from '../../hooks/useInstrumentos';
import { RemitoPartyFields } from '../remitos/RemitoPartyFields';
import { RemitoTransportistaPicker, EMPTY_PARTY, partyFromProveedor } from '../remitos/RemitoTransportistaPicker';
import { DerivarInstrumentosPicker, instrumentoDescripcionRemito } from './DerivarInstrumentosPicker';
import { imprimirRemitoOverlay } from '../../utils/remitoImprimir';
import { formatFechaAR } from '../../utils/formatFecha';
import type { InstrumentoPatron, Proveedor } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  instrumento: InstrumentoPatron;
  onDerivado: () => void;
}

const NUMERO_REGEX = /^\d{4}-\d{8}$/;

export function DerivarCalibracionModal({ open, onClose, instrumento, onDerivado }: Props) {
  const { derivarACalibracion } = useInstrumentos();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinatario, setDestinatario] = useState<DatosTransportista>(EMPTY_PARTY);
  // Transportista (2026-08-09): el bloque del papel preimpreso salía vacío en las
  // derivaciones. Mismo criterio que el resto de los remitos — proveedores con la
  // categoría "transportista"; elegir uno autocompleta los campos.
  const [transportista, setTransportista] = useState<DatosTransportista>(EMPTY_PARTY);
  const [transportistaId, setTransportistaId] = useState('');
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
    if (p) setDestinatario(partyFromProveedor(p));
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
          // `nombre` ES el identificador del instrumento (TER-01, FLO-08): va
          // como código. La descripción dice qué es, sin repetirlo.
          instrumentoCodigo: i.nombre,
          instrumentoDescripcion: instrumentoDescripcionRemito(i),
        })),
        observaciones: observaciones.trim() || null,
        fechaSalida: fecha,
        proveedorId: proveedor.id,
        proveedorNombre: proveedor.nombre,
        transportistaId: transportistaId || null,
        transportistaNombre: transportista.razonSocial.trim() || null,
        // Snapshot completo para reimpresión (2026-08-11): sin esto, un flete
        // cargado a mano perdía domicilio/CUIT al reimprimir desde la lista.
        transportista: transportista.razonSocial.trim() ? transportista : null,
      });

      await Promise.all(seleccionados.map(i => derivarACalibracion(i.id, {
        proveedorId: proveedor.id,
        proveedorNombre: proveedor.nombre,
        remitoId,
        remitoNumero: numero,
        fechaEnvio: fecha,
        observaciones: observaciones.trim() || null,
      })));

      // Pipeline calibrado, igual que ficha y loaner (2026-08-09): triplicado
      // silencioso con los offsets del papel preimpreso. Antes usaba
      // `openRemitoPdfInNewTab`, que abría/descargaba el PDF SIN los offsets —
      // no imprimía solo y encima salía corrido sobre el papel.
      await imprimirRemitoOverlay({
        fecha: formatFechaAR(fecha),
        destinatario,
        transportista: transportista.razonSocial.trim() ? transportista : null,
        items: seleccionados.map((i, idx) => ({
          numero: idx + 1,
          cantidad: 1,
          producto: i.nombre,
          // Producto ya lleva el identificador (TER-01): acá va QUÉ es el equipo.
          descripcion: `${instrumentoDescripcionRemito(i)} · ${motivo}`,
        })),
        observaciones: observaciones.trim() || null,
      }).catch(err => console.warn('[DerivarCalibracion] impresión falló:', err));
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

        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
          <RemitoPartyFields title="Destinatario (proveedor)" value={destinatario} onChange={setDestinatario} />
        </div>

        <RemitoTransportistaPicker
          proveedores={proveedores}
          selectedId={transportistaId}
          value={transportista}
          onChange={({ id, datos }) => { setTransportistaId(id); setTransportista(datos); }}
        />

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
          Se generará un remito tipo «derivación a proveedor» con {seleccionados.length === 1 ? 'el instrumento' : `los ${seleccionados.length} instrumentos`} como items «sale y vuelve», se marcarán como <strong>En calibración</strong>, y el remito se imprimirá por triplicado sobre el papel preimpreso.
        </p>
      </div>
    </Modal>
  );
}
