import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { FichaPropiedad, ItemFicha, Cliente, CondicionIva } from '@ags/shared';
import { fichasService } from '../../services/fichasService';
import { clientesService } from '../../services/clientesService';
import { remitosService, type DatosTransportista } from '../../services/stockService';
import { RemitoOverlayPDF } from './pdf/RemitoOverlayPDF';
import { openRemitoPdfInNewTab } from '../../utils/remitoPdfActions';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Ficha desde la que se disparó el modal — sus items quedan elegibles preseleccionados. */
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

interface ElegibleItem {
  ficha: FichaPropiedad;
  item: ItemFicha;
  /** Identificador único combinando ficha+item (para el set de selección). */
  key: string;
}

function itemDescripcion(it: ItemFicha, motivo: string, parentSubId?: string | null): string {
  const partes = [
    it.articuloDescripcion || it.descripcionLibre,
    it.articuloCodigo,
    it.serie ? `S/N ${it.serie}` : null,
    parentSubId ? `(de ${parentSubId})` : null,
  ].filter(Boolean) as string[];
  const equipo = partes.join(' · ') || it.subId;
  return `${equipo} · ${motivo}`;
}

export function GenerarRemitoDevolucionModal({ open, onClose, ficha, onCreated }: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [otherFichas, setOtherFichas] = useState<FichaPropiedad[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [numero, setNumero] = useState('0001-');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinatario, setDestinatario] = useState<DatosTransportista>(EMPTY_DEST);
  const [transportista, setTransportista] = useState<DatosTransportista>(EMPTY_DEST);
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Items elegibles = items de la ficha actual + items de otras fichas activas del cliente
  // que estén en estado listo_para_entrega (devolución) o cualquier no-cerrado.
  const elegibles = useMemo<ElegibleItem[]>(() => {
    const all = [ficha, ...otherFichas];
    const out: ElegibleItem[] = [];
    for (const f of all) {
      for (const it of (f.items ?? [])) {
        if (it.estado === 'entregado') continue;
        if (it.estado === 'en_envio') continue;
        if (it.estado === 'derivado_proveedor') continue;
        out.push({ ficha: f, item: it, key: `${f.id}:${it.id}` });
      }
    }
    return out;
  }, [ficha, otherFichas]);

  // Carga cliente + preselección + otras fichas elegibles del mismo cliente
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
      setOtherFichas(items.filter(f => f.id !== ficha.id));
    });
    // Preselección: items de la ficha actual que están listos para entrega
    const preselect = new Set<string>();
    for (const it of ficha.items ?? []) {
      if (it.estado === 'listo_para_entrega') preselect.add(`${ficha.id}:${it.id}`);
    }
    setSelectedKeys(preselect);
  }, [open, ficha.id, ficha.clienteId, ficha.items]);

  const toggleItem = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const setDestField = <K extends keyof DatosTransportista>(k: K, v: string) =>
    setDestinatario(prev => ({ ...prev, [k]: v }));
  const setTranspField = <K extends keyof DatosTransportista>(k: K, v: string) =>
    setTransportista(prev => ({ ...prev, [k]: v }));

  const selected = elegibles.filter(e => selectedKeys.has(e.key));
  const canSubmit = numero.trim().length >= 7 && destinatario.razonSocial.trim() && selected.length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const itemsInput = selected.map(({ ficha: f, item }) => {
        const parent = item.parentItemId ? f.items.find(i => i.id === item.parentItemId) : null;
        return {
          fichaId: f.id,
          fichaNumero: f.numero,
          itemId: item.id,
          itemSubId: item.subId,
          descripcion: itemDescripcion(item, 'Devolución por reparación', parent?.subId),
        };
      });
      const otNumbersUnique = Array.from(new Set(selected.flatMap(e => e.ficha.otIds ?? [])));

      const { id } = await remitosService.createForItems({
        numero: numero.trim(),
        tipo: 'devolucion',
        destinatario,
        transportista: transportista.razonSocial ? transportista : null,
        fecha,
        items: itemsInput,
        observaciones: observaciones || null,
        clienteId: ficha.clienteId,
        clienteNombre: ficha.clienteNombre,
        otNumbers: otNumbersUnique,
      });

      const fechaFmt = fecha.split('-').reverse().join('/');
      await openRemitoPdfInNewTab(
        <RemitoOverlayPDF
          fecha={fechaFmt}
          destinatario={destinatario}
          transportista={transportista.razonSocial ? transportista : null}
          items={itemsInput.map((it, i) => ({
            numero: i + 1,
            cantidad: 1,
            producto: it.itemSubId,
            descripcion: it.descripcion,
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
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">
            Items a incluir ({selected.length} seleccionado{selected.length === 1 ? '' : 's'})
          </p>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {elegibles.length === 0 ? (
              <p className="text-xs text-slate-400 px-3 py-2">No hay items elegibles del cliente.</p>
            ) : (
              elegibles.map(({ ficha: f, item, key }) => (
                <label key={key} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(key)}
                    onChange={() => toggleItem(key)}
                  />
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-mono text-teal-700">{item.subId}</span>
                    <span className="text-slate-500"> · {item.articuloDescripcion || item.descripcionLibre || 'Item'}</span>
                    {item.serie && <span className="text-slate-400 font-mono"> · S/N {item.serie}</span>}
                    {f.id !== ficha.id && (
                      <span className="text-[10px] text-slate-400 ml-2">(otra ficha: {f.numero})</span>
                    )}
                  </div>
                </label>
              ))
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
