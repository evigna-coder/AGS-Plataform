import { useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { FichaPropiedad, Loaner } from '@ags/shared';
import { remitosService } from '../../services/stockService';
import { imprimirRemitoOverlay } from '../../utils/remitoImprimir';
import { RemitoItemPicker } from './RemitoItemPicker';
import { RemitoPartyFields } from './RemitoPartyFields';
import { RemitoTipoToggle } from './RemitoTipoToggle';
import { useGenerarRemito, itemDescripcion } from '../../hooks/useGenerarRemito';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Ficha desde la que se disparó el modal — sus items quedan elegibles
   *  preseleccionados. `null` = modo LOTE A PROVEEDOR desde el listado:
   *  derivación con items de fichas de CUALQUIER cliente en una tanda. */
  ficha: FichaPropiedad | null;
  /** Loaner de entrada (2026-08-06): derivación del módulo AGS, preseleccionado. */
  loaner?: Loaner | null;
  onCreated?: (remitoId: string) => void;
}

export function GenerarRemitoDevolucionModal({ open, onClose, ficha, loaner = null, onCreated }: Props) {
  const f = useGenerarRemito({ open, ficha, loaner });
  const modoLote = !ficha;

  const proveedorOptions = useMemo(
    () => f.proveedores.map(p => ({ value: p.id, label: p.nombre })),
    [f.proveedores],
  );
  const subtitle = f.isDerivacion
    ? (f.proveedores.find(p => p.id === f.proveedorId)?.nombre ?? 'Derivación a proveedor')
    : (f.cliente?.razonSocial ?? ficha?.clienteNombre ?? '');

  const handleSubmit = async () => {
    f.setSubmitting(true);
    f.setError(null);
    try {
      // Split ficha-items vs loaners (2026-08-06): los loaners viajan como
      // líneas documentales propias, sin update de ficha.
      const fichaSel = f.selected.filter(e => !e.key.startsWith('loaner:'));
      const loanerSel = f.selected.filter(e => e.key.startsWith('loaner:'));
      const itemsInput = fichaSel.map(({ ficha: fi, item }) => {
        const parent = item.parentItemId ? fi.items.find(i => i.id === item.parentItemId) : null;
        const mode = f.modeByKey.get(`${fi.id}:${item.id}`) ?? 'completo';
        const partes = f.partesByKey.get(`${fi.id}:${item.id}`) ?? [];
        const tienePartes = f.isDerivacion && mode === 'partes' && partes.length > 0;
        // Módulo de origen con nombre y serie (2026-08-06). SIN el subId de la
        // ficha (2026-08-07): el número interno de AGS no va al papel.
        const origenLabel = [
          item.articuloDescripcion || item.descripcionLibre || null,
          item.serie ? `S/N ${item.serie}` : null,
        ].filter(Boolean).join(' · ');
        // El cliente dueño del equipo reemplaza al motivo en la descripción:
        // en una derivación en lote el proveedor necesita saber de quién es
        // cada equipo (2026-08-07). En devolución el destinatario ES el
        // cliente, así que no se repite.
        const sufijo = f.isDerivacion ? fi.clienteNombre : null;
        const parentDesc = parent
          ? [parent.articuloDescripcion || parent.descripcionLibre, parent.serie ? `S/N ${parent.serie}` : null]
              .filter(Boolean).join(' · ')
          : null;
        return {
          fichaId: fi.id,
          fichaNumero: fi.numero,
          itemId: item.id,
          itemSubId: item.subId,
          // Código de artículo / N° de parte para la columna "Producto".
          articuloCodigo: item.articuloCodigo ?? null,
          origenLabel,
          descripcion: itemDescripcion(item, sufijo, parentDesc),
          partes: tienePartes ? partes.map(p => ({
            articuloId: p.articuloId,
            articuloCodigo: p.articuloCodigo,
            descripcion: p.descripcion.trim(),
            serie: p.serie?.trim() || null,
          })) : undefined,
        };
      });
      const loanersInput = loanerSel.map(({ item, key }) => {
        const mode = f.modeByKey.get(key) ?? 'completo';
        const partes = f.partesByKey.get(key) ?? [];
        const tienePartes = mode === 'partes' && partes.length > 0;
        // Mismo criterio que fichas (2026-08-07): sin el código interno (LNR) en
        // el papel; el equipo se identifica por modelo y serie, y el sufijo
        // aclara que es propiedad de AGS (no de un cliente).
        const origenLabel = [
          item.articuloDescripcion || null,
          item.serie ? `S/N ${item.serie}` : null,
        ].filter(Boolean).join(' · ');
        return {
          loanerId: item.id,
          loanerCodigo: item.subId,
          articuloCodigo: item.articuloCodigo ?? null,
          descripcion: [
            item.articuloDescripcion,
            item.serie ? `S/N ${item.serie}` : null,
            'Equipo AGS',
          ].filter(Boolean).join(' · '),
          origenLabel,
          partes: tienePartes ? partes.map(p => ({
            articuloId: p.articuloId,
            articuloCodigo: p.articuloCodigo,
            descripcion: p.descripcion.trim(),
            serie: p.serie?.trim() || null,
          })) : undefined,
        };
      });
      // OTs elegidas en el selector (2026-08-06) — antes se heredaban a ciegas.
      const otNumbersUnique = Array.from(f.otsSeleccionadas);
      const proveedor = f.proveedores.find(p => p.id === f.proveedorId) ?? null;

      const { id } = await remitosService.createForItems({
        numero: f.numero.trim(),
        tipo: f.tipo,
        destinatario: f.destinatario,
        transportista: f.transportista.razonSocial ? f.transportista : null,
        fecha: f.fecha,
        items: itemsInput,
        loaners: loanersInput.length > 0 ? loanersInput : undefined,
        observaciones: f.observaciones || null,
        clienteId: f.isDerivacion ? null : ficha?.clienteId ?? null,
        clienteNombre: f.isDerivacion ? null : ficha?.clienteNombre ?? null,
        proveedorId: f.isDerivacion ? f.proveedorId : null,
        proveedorNombre: f.isDerivacion ? (proveedor?.nombre ?? null) : null,
        otNumbers: otNumbersUnique,
      });

      const pdfLines: { numero: number; cantidad: number; producto: string; descripcion: string }[] = [];
      for (const it of itemsInput) {
        // Columna "Producto" = código de artículo / N° de parte (2026-08-06);
        // el subId de la ficha es el fallback cuando el item no tiene código.
        if (it.partes && it.partes.length > 0) {
          for (const p of it.partes) {
            pdfLines.push({
              numero: pdfLines.length + 1,
              cantidad: 1,
              producto: p.articuloCodigo || '',
              descripcion: `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''} (de ${it.origenLabel ?? it.itemSubId})`,
            });
          }
        } else {
          pdfLines.push({
            numero: pdfLines.length + 1,
            cantidad: 1,
            producto: it.articuloCodigo || it.itemSubId,
            descripcion: it.descripcion,
          });
        }
      }

      // Líneas de loaners al PDF (después de las de fichas).
      for (const l of loanersInput) {
        if (l.partes && l.partes.length > 0) {
          for (const p of l.partes) {
            pdfLines.push({
              numero: pdfLines.length + 1,
              cantidad: 1,
              producto: l.loanerCodigo,
              descripcion: `${p.descripcion}${p.serie ? ` · S/N ${p.serie}` : ''} (de ${l.origenLabel})`,
            });
          }
        } else {
          pdfLines.push({ numero: pdfLines.length + 1, cantidad: 1, producto: l.loanerCodigo, descripcion: l.descripcion });
        }
      }

      const fechaFmt = f.fecha.split('-').reverse().join('/');
      // Pipeline calibrado (2026-08-06): triplicado silencioso con los mismos
      // offsets que el resto de los remitos — salía sin calibrar y abría PDF.
      await imprimirRemitoOverlay({
        fecha: fechaFmt,
        destinatario: f.destinatario,
        transportista: f.transportista.razonSocial ? f.transportista : null,
        items: pdfLines,
        observaciones: f.observaciones || null,
      }).catch(err => console.warn('[GenerarRemito] impresión falló:', err));
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
      title={loaner ? `Derivación a proveedor — ${loaner.codigo}` : modoLote ? 'Derivación a proveedor — lote' : 'Generar remito de salida'}
      subtitle={subtitle}
      maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={f.submitting}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} disabled={!f.canSubmit || f.submitting}>
            {f.submitting ? 'Generando…' : 'Generar e imprimir (triplicado)'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {f.error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{f.error}</div>
        )}

        {/* En modo lote el tipo está fijo en derivación a proveedor. */}
        {!modoLote && <RemitoTipoToggle value={f.tipo} onChange={f.handleChangeTipo} />}

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
            currentFichaId={ficha?.id ?? ''}
            showCliente={modoLote}
          />
        </div>

        {/* OTs vinculadas (2026-08-06): abiertas del cliente + las de la ficha.
            Siempre visible (con leyenda si no hay) — oculto parecía "no existe". */}
        {!!ficha && (
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">
              OTs vinculadas ({f.otsSeleccionadas.size})
            </p>
            {f.otsCliente.length === 0 ? (
              <p className="text-[11px] text-slate-400">El cliente no tiene OTs abiertas para vincular.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {f.otsCliente.map(o => {
                  const on = f.otsSeleccionadas.has(o.otNumber);
                  return (
                    <button key={o.otNumber} type="button" onClick={() => f.handleToggleOt(o.otNumber)}
                      title={[o.tipoServicio, o.sistema].filter(Boolean).join(' · ') || undefined}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-mono border transition-colors ${
                        on ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-500'
                      }`}>
                      {o.otNumber}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <RemitoPartyFields
          title={`Destinatario ${f.isDerivacion ? '(proveedor)' : '(cliente)'}`}
          value={f.destinatario}
          onChange={f.setDestinatario}
        />

        {/* Transportistas = proveedores con esa categoría (2026-08-07): elegir
            uno autocompleta los campos de abajo. Si falta, se carga en
            Proveedores con la categoría "Transportista". */}
        {f.transportistas.length > 0 && (
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Transportista</p>
            <SearchableSelect
              value={f.transportistas.find(t => t.nombre === f.transportista.razonSocial)?.id ?? ''}
              onChange={f.handlePickTransportista}
              options={f.transportistas.map(t => ({ value: t.id, label: t.nombre }))}
              placeholder="Buscar transportista..."
            />
          </div>
        )}
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
