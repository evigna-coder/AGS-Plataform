import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { FichaPropiedad, Cliente, CondicionIva } from '@ags/shared';
import { fichasService } from '../../services/fichasService';
import { clientesService } from '../../services/clientesService';
import { remitosService, type DatosTransportista } from '../../services/stockService';
import { RemitoOverlayPDF } from './pdf/RemitoOverlayPDF';
import { openRemitoPdfInNewTab } from '../../utils/remitoPdfActions';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Ficha desde la que se disparó el modal — queda preseleccionada. */
  ficha: FichaPropiedad;
  onCreated?: (remitoId: string) => void;
}

const EMPTY_DEST: DatosTransportista = {
  razonSocial: '', domicilio: '', localidad: '', provincia: '', iva: '', cuit: '',
};

const IVA_LABELS: Partial<Record<CondicionIva, string>> = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
};

function fichaDescripcion(f: FichaPropiedad, motivo: string): string {
  const partes = [
    f.sistemaNombre,
    f.moduloNombre,
    f.serie ? `S/N ${f.serie}` : null,
  ].filter(Boolean);
  const equipo = partes.join(' · ') || (f.descripcionLibre ?? 'Equipo');
  return `${equipo} · ${motivo}`;
}

export function GenerarRemitoDevolucionModal({ open, onClose, ficha, onCreated }: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [otherFichas, setOtherFichas] = useState<FichaPropiedad[]>([]);
  const [selectedFichaIds, setSelectedFichaIds] = useState<Set<string>>(new Set([ficha.id]));
  const [numero, setNumero] = useState('0001-');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinatario, setDestinatario] = useState<DatosTransportista>(EMPTY_DEST);
  const [transportista, setTransportista] = useState<DatosTransportista>(EMPTY_DEST);
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar cliente y otras fichas elegibles del mismo cliente
  useEffect(() => {
    if (!open) return;
    void clientesService.getById(ficha.clienteId).then(c => {
      if (!c) return;
      setCliente(c);
      setDestinatario({
        razonSocial: c.razonSocial,
        domicilio: c.direccionFiscal ?? c.direccion ?? '',
        localidad: c.localidadFiscal ?? c.localidad ?? '',
        provincia: c.provinciaFiscal ?? c.provincia ?? '',
        iva: c.condicionIva ? (IVA_LABELS[c.condicionIva] ?? c.condicionIva) : '',
        cuit: c.cuit ?? '',
      });
    });
    void fichasService.getAll({ clienteId: ficha.clienteId, activasOnly: true }).then(items => {
      // Excluir la actual (ya está seleccionada) y las que ya están en envío/derivadas
      setOtherFichas(items.filter(f =>
        f.id !== ficha.id &&
        f.estado !== 'en_envio' &&
        f.estado !== 'derivado_proveedor',
      ));
    });
  }, [open, ficha.id, ficha.clienteId]);

  const selectedFichas = useMemo(() => {
    const all = [ficha, ...otherFichas];
    return all.filter(f => selectedFichaIds.has(f.id));
  }, [ficha, otherFichas, selectedFichaIds]);

  const toggleFicha = (id: string) => {
    setSelectedFichaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      // La ficha actual no se puede deseleccionar
      if (!next.has(ficha.id)) next.add(ficha.id);
      return next;
    });
  };

  const setDestField = <K extends keyof DatosTransportista>(k: K, v: string) =>
    setDestinatario(prev => ({ ...prev, [k]: v }));
  const setTranspField = <K extends keyof DatosTransportista>(k: K, v: string) =>
    setTransportista(prev => ({ ...prev, [k]: v }));

  const canSubmit = numero.trim().length >= 7 && destinatario.razonSocial.trim() && selectedFichas.length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const fichasInput = selectedFichas.map(f => ({
        fichaId: f.id,
        fichaNumero: f.numero,
        descripcion: fichaDescripcion(f, 'Devolución por reparación'),
      }));
      const otNumbersUnique = Array.from(new Set(selectedFichas.flatMap(f => f.otIds ?? [])));

      const { id } = await remitosService.createForFichas({
        numero: numero.trim(),
        tipo: 'devolucion',
        destinatario,
        transportista: transportista.razonSocial ? transportista : null,
        fecha,
        fichas: fichasInput,
        observaciones: observaciones || null,
        clienteId: ficha.clienteId,
        clienteNombre: ficha.clienteNombre,
        otNumbers: otNumbersUnique,
      });

      // Abrir PDF para imprimir
      const fechaFmt = fecha.split('-').reverse().join('/');
      await openRemitoPdfInNewTab(
        <RemitoOverlayPDF
          fecha={fechaFmt}
          destinatario={destinatario}
          transportista={transportista.razonSocial ? transportista : null}
          items={fichasInput.map((f, i) => ({
            numero: i + 1,
            cantidad: 1,
            producto: f.fichaNumero,
            descripcion: f.descripcion,
          }))}
        />,
      );
      onCreated?.(id);
      onClose();
    } catch (err) {
      console.error('Error generando remito:', err);
      setError(err instanceof Error ? err.message : 'No se pudo generar el remito');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generar remito de devolución"
      subtitle={cliente?.razonSocial ?? ficha.clienteNombre}
      maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
            {submitting ? 'Generando…' : 'Generar y abrir PDF'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="N° Remito (preimpreso)" value={numero} onChange={e => setNumero(e.target.value)} placeholder="0001-00017091" />
          <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>

        <div>
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Fichas a incluir</p>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto">
            {[ficha, ...otherFichas].map(f => (
              <label key={f.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedFichaIds.has(f.id)}
                  onChange={() => toggleFicha(f.id)}
                  disabled={f.id === ficha.id}
                />
                <div className="flex-1 min-w-0 text-sm">
                  <span className="font-mono text-teal-700">{f.numero}</span>
                  <span className="text-slate-500"> · {fichaDescripcion(f, '')}</span>
                </div>
              </label>
            ))}
            {otherFichas.length === 0 && (
              <p className="text-xs text-slate-400 px-3 py-2">No hay otras fichas elegibles del mismo cliente.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Destinatario (cliente)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Razón social" value={destinatario.razonSocial} onChange={e => setDestField('razonSocial', e.target.value)} />
            <Input label="CUIT" value={destinatario.cuit} onChange={e => setDestField('cuit', e.target.value)} />
            <Input label="Domicilio" value={destinatario.domicilio} onChange={e => setDestField('domicilio', e.target.value)} />
            <Input label="IVA" value={destinatario.iva} onChange={e => setDestField('iva', e.target.value)} />
            <Input label="Localidad" value={destinatario.localidad} onChange={e => setDestField('localidad', e.target.value)} />
            <Input label="Provincia" value={destinatario.provincia} onChange={e => setDestField('provincia', e.target.value)} />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Transportista (opcional)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Razón social" value={transportista.razonSocial} onChange={e => setTranspField('razonSocial', e.target.value)} />
            <Input label="CUIT" value={transportista.cuit} onChange={e => setTranspField('cuit', e.target.value)} />
            <Input label="Domicilio" value={transportista.domicilio} onChange={e => setTranspField('domicilio', e.target.value)} />
            <Input label="IVA" value={transportista.iva} onChange={e => setTranspField('iva', e.target.value)} />
            <Input label="Localidad" value={transportista.localidad} onChange={e => setTranspField('localidad', e.target.value)} />
            <Input label="Provincia" value={transportista.provincia} onChange={e => setTranspField('provincia', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>
    </Modal>
  );
}
