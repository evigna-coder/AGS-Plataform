import { useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { FichaPropiedad } from '@ags/shared';
import { remitosService } from '../../services/stockService';
import { RemitoOverlayPDF } from './pdf/RemitoOverlayPDF';
import { openRemitoPdfInNewTab } from '../../utils/remitoPdfActions';
import { RemitoItemPicker } from './RemitoItemPicker';
import { RemitoPartyFields } from './RemitoPartyFields';
import { RemitoTipoToggle } from './RemitoTipoToggle';
import { useGenerarRemito, itemDescripcion } from '../../hooks/useGenerarRemito';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Ficha desde la que se disparó el modal — sus items quedan elegibles preseleccionados. */
  ficha: FichaPropiedad;
  onCreated?: (remitoId: string) => void;
}

export function GenerarRemitoDevolucionModal({ open, onClose, ficha, onCreated }: Props) {
  const f = useGenerarRemito({ open, ficha });

  const proveedorOptions = useMemo(
    () => f.proveedores.map(p => ({ value: p.id, label: p.nombre })),
    [f.proveedores],
  );
  const subtitle = f.isDerivacion
    ? (f.proveedores.find(p => p.id === f.proveedorId)?.nombre ?? 'Derivación a proveedor')
    : (f.cliente?.razonSocial ?? ficha.clienteNombre);

  const handleSubmit = async () => {
    f.setSubmitting(true);
    f.setError(null);
    try {
      const motivo = f.isDerivacion ? 'Derivación a proveedor' : 'Devolución por reparación';
      const itemsInput = f.selected.map(({ ficha: fi, item }) => {
        const parent = item.parentItemId ? fi.items.find(i => i.id === item.parentItemId) : null;
        const mode = f.modeByKey.get(`${fi.id}:${item.id}`) ?? 'completo';
        const partes = f.partesByKey.get(`${fi.id}:${item.id}`) ?? [];
        const tienePartes = f.isDerivacion && mode === 'partes' && partes.length > 0;
        return {
          fichaId: fi.id,
          fichaNumero: fi.numero,
          itemId: item.id,
          itemSubId: item.subId,
          descripcion: itemDescripcion(item, motivo, parent?.subId),
          partes: tienePartes ? partes.map(p => ({
            articuloId: p.articuloId,
            articuloCodigo: p.articuloCodigo,
            descripcion: p.descripcion.trim(),
            serie: p.serie?.trim() || null,
          })) : undefined,
        };
      });
      const otNumbersUnique = Array.from(new Set(f.selected.flatMap(e => e.ficha.otIds ?? [])));
      const proveedor = f.proveedores.find(p => p.id === f.proveedorId) ?? null;

      const { id } = await remitosService.createForItems({
        numero: f.numero.trim(),
        tipo: f.tipo,
        destinatario: f.destinatario,
        transportista: f.transportista.razonSocial ? f.transportista : null,
        fecha: f.fecha,
        items: itemsInput,
        observaciones: f.observaciones || null,
        clienteId: f.isDerivacion ? null : ficha.clienteId,
        clienteNombre: f.isDerivacion ? null : ficha.clienteNombre,
        proveedorId: f.isDerivacion ? f.proveedorId : null,
        proveedorNombre: f.isDerivacion ? (proveedor?.nombre ?? null) : null,
        otNumbers: otNumbersUnique,
      });

      const pdfLines: { numero: number; cantidad: number; producto: string; descripcion: string }[] = [];
      for (const it of itemsInput) {
        if (it.partes && it.partes.length > 0) {
          for (const p of it.partes) {
            pdfLines.push({
              numero: pdfLines.length + 1,
              cantidad: 1,
              producto: it.itemSubId,
              descripcion: `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''} (de ${it.itemSubId})`,
            });
          }
        } else {
          pdfLines.push({
            numero: pdfLines.length + 1,
            cantidad: 1,
            producto: it.itemSubId,
            descripcion: it.descripcion,
          });
        }
      }

      const fechaFmt = f.fecha.split('-').reverse().join('/');
      await openRemitoPdfInNewTab(
        <RemitoOverlayPDF
          fecha={fechaFmt}
          destinatario={f.destinatario}
          transportista={f.transportista.razonSocial ? f.transportista : null}
          items={pdfLines}
        />,
      );
      onCreated?.(id);
      onClose();
    } catch (err) {
      console.error('Error generando remito:', err);
      f.setError(err instanceof Error ? err.message : 'No se pudo generar el remito');
    } finally {
      f.setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generar remito de salida"
      subtitle={subtitle}
      maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={f.submitting}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} disabled={!f.canSubmit || f.submitting}>
            {f.submitting ? 'Generando…' : 'Generar y abrir PDF'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {f.error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{f.error}</div>
        )}

        <RemitoTipoToggle value={f.tipo} onChange={f.handleChangeTipo} />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="N° Remito (preimpreso)"
            value={f.numero}
            onChange={e => f.setNumero(e.target.value)}
            placeholder="0001-00000001"
            error={f.numero && !f.numeroValido ? 'Formato 0001-00000001' : undefined}
          />
          <Input label="Fecha" type="date" value={f.fecha} onChange={e => f.setFecha(e.target.value)} />
        </div>

        {f.isDerivacion && (
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Proveedor *</p>
            <SearchableSelect
              value={f.proveedorId}
              onChange={f.handlePickProveedor}
              options={proveedorOptions}
              placeholder="Seleccionar proveedor…"
            />
          </div>
        )}

        <div>
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">
            Items a incluir ({f.selected.length} seleccionado{f.selected.length === 1 ? '' : 's'})
          </p>
          <RemitoItemPicker
            elegibles={f.elegibles}
            onlyCompleto={!f.isDerivacion}
            selectedKeys={f.selectedKeys}
            onToggleItem={f.handleToggleItem}
            modeByKey={f.modeByKey}
            onChangeMode={f.handleChangeMode}
            partesByKey={f.partesByKey}
            onChangePartes={f.handleChangePartes}
            currentFichaId={ficha.id}
          />
        </div>

        <RemitoPartyFields
          title={`Destinatario ${f.isDerivacion ? '(proveedor)' : '(cliente)'}`}
          value={f.destinatario}
          onChange={f.setDestinatario}
        />

        <RemitoPartyFields
          title="Transportista (opcional)"
          value={f.transportista}
          onChange={f.setTransportista}
        />

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
          <textarea
            value={f.observaciones}
            onChange={e => f.setObservaciones(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>
    </Modal>
  );
}
