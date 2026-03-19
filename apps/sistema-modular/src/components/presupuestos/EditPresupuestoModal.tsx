import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { PresupuestoItemsTable } from './PresupuestoItemsTable';
import { PresupuestoAdjuntosSection } from './PresupuestoAdjuntosSection';
import { usePresupuestoEdit } from '../../hooks/usePresupuestoEdit';
import { presupuestosService, leadsService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import type { Presupuesto, TipoPresupuesto, MonedaPresupuesto, Posta, LeadEstado } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS, TIPO_PRESUPUESTO_LABELS, MONEDA_SIMBOLO, ORIGEN_PRESUPUESTO_LABELS } from '@ags/shared';

/** Presupuesto estados that should generate a posta on the lead timeline */
const LEAD_POSTA_MESSAGES: Partial<Record<Presupuesto['estado'], string>> = {
  enviado: 'Presupuesto enviado',
  aceptado: 'Presupuesto aceptado',
  autorizado: 'Presupuesto autorizado',
  rechazado: 'Presupuesto rechazado',
};

interface Props {
  presupuestoId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onMinimize?: () => void;
}

const estadoOptions = Object.entries(ESTADO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }));
const tipoOptions = Object.entries(TIPO_PRESUPUESTO_LABELS).map(([value, label]) => ({ value, label }));
const monedaOptions = [
  { value: 'USD', label: 'USD (U$S)' },
  { value: 'ARS', label: 'ARS ($)' },
  { value: 'EUR', label: 'EUR (€)' },
];

const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5 block';

export const EditPresupuestoModal: React.FC<Props> = ({ presupuestoId, open, onClose, onUpdated, onMinimize }) => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const {
    form, setField, loading, saving,
    cliente, contactos, categoriasPresupuesto, condicionesPago, conceptosServicio, usuarios,
    calculateTotals, calculateItemTaxes,
    save, updateItem, addItem, removeItem, addAdjunto, removeAdjunto,
    handleEstadoChange: rawEstadoChange,
  } = usePresupuestoEdit(open ? presupuestoId : null);

  const [duplicating, setDuplicating] = useState(false);
  const [showAdjuntos, setShowAdjuntos] = useState(false);
  /** Add a posta to the linked lead when presupuesto estado changes to a relevant state */
  const addLeadPosta = useCallback((newEstado: Presupuesto['estado']) => {
    if (form.origenTipo !== 'lead' || !form.origenId || !usuario) return;
    const message = LEAD_POSTA_MESSAGES[newEstado];
    if (!message) return;
    const posta: Posta = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      deUsuarioId: usuario.id,
      deUsuarioNombre: usuario.displayName,
      aUsuarioId: usuario.id,
      aUsuarioNombre: usuario.displayName,
      comentario: `${message}: ${form.numero}`,
      estadoAnterior: form.estado as LeadEstado,
      estadoNuevo: form.estado as LeadEstado,
    };
    leadsService.agregarComentario(form.origenId, posta).catch(err =>
      console.error('Error agregando posta al lead:', err)
    );
  }, [form.origenTipo, form.origenId, form.numero, form.estado, usuario]);

  /** Wraps rawEstadoChange + adds lead posta */
  const handleEstadoChange = useCallback((newEstado: Presupuesto['estado']) => {
    rawEstadoChange(newEstado);
    addLeadPosta(newEstado);
  }, [rawEstadoChange, addLeadPosta]);

  const totals = calculateTotals();
  const sym = MONEDA_SIMBOLO[form.moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const handleSave = async () => {
    await save();
    onUpdated?.();
  };

  const handleDuplicate = async () => {
    if (!confirm('¿Duplicar este presupuesto? Se creará una copia en estado Borrador.')) return;
    setDuplicating(true);
    try {
      const newId = await presupuestosService.duplicate(presupuestoId);
      onClose();
      navigate(`/presupuestos/${newId}`);
    } catch { alert('Error al duplicar'); }
    finally { setDuplicating(false); }
  };

  const handleSuggestAutorizado = () => {
    if (form.estado !== 'autorizado' && confirm('Se adjuntó una orden de compra. ¿Cambiar estado a "Autorizado"?')) {
      handleEstadoChange('autorizado');
    }
  };

  const handleEnviar = async () => {
    handleEstadoChange('enviado');
    await save();
    onUpdated?.();
    // Try mailto if we have a contact email
    const contacto = contactos.find(c => c.id === form.contactoId);
    const email = contacto?.email;
    if (email) {
      const subject = encodeURIComponent(`Presupuesto ${form.numero} - AGS`);
      const body = encodeURIComponent(`Estimado/a ${contacto.nombre},\n\nAdjunto presupuesto ${form.numero} para su revisión.\n\nSaludos cordiales,\nAGS`);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
    }
  };

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    const condPago = condicionesPago.find(c => c.id === form.condicionPagoId);
    const hasDiscount = form.items.some(i => i.descuento && i.descuento > 0);
    const cs = hasDiscount ? 6 : 5; // colspan for totals row
    const itemsRows = form.items.map((item, i) => {
      const taxes = calculateItemTaxes(item);
      const cat = categoriasPresupuesto.find(c => c.id === item.categoriaPresupuestoId);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">${item.descripcion}${item.codigoProducto ? `<br><span style="color:#94a3b8;font-size:10px;">${item.codigoProducto}</span>` : ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;">${item.cantidad}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">${item.unidad}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;">${fmtMoney(item.precioUnitario)}</td>
        ${hasDiscount ? `<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;">${item.descuento ? `${item.descuento}%` : '—'}</td>` : ''}
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;font-weight:600;">${fmtMoney(item.subtotal)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#64748b;">${cat?.nombre || '—'}${taxes.totalImpuestos > 0 ? `<br>Imp: ${fmtMoney(taxes.totalImpuestos)}` : ''}</td>
      </tr>`;
    }).join('');

    const totalsRows = [
      `<tr><td colspan="${cs}" style="text-align:right;padding:6px 8px;font-size:11px;color:#94a3b8;">Subtotal</td><td style="text-align:right;padding:6px 8px;font-size:12px;font-weight:600;">${fmtMoney(totals.subtotal)}</td><td></td></tr>`,
      totals.iva > 0 ? `<tr><td colspan="${cs}" style="text-align:right;padding:4px 8px;font-size:11px;color:#94a3b8;">IVA</td><td style="text-align:right;padding:4px 8px;font-size:11px;">${fmtMoney(totals.iva)}</td><td></td></tr>` : '',
      totals.ganancias > 0 ? `<tr><td colspan="${cs}" style="text-align:right;padding:4px 8px;font-size:11px;color:#94a3b8;">Ganancias</td><td style="text-align:right;padding:4px 8px;font-size:11px;">${fmtMoney(totals.ganancias)}</td><td></td></tr>` : '',
      totals.iibb > 0 ? `<tr><td colspan="${cs}" style="text-align:right;padding:4px 8px;font-size:11px;color:#94a3b8;">IIBB</td><td style="text-align:right;padding:4px 8px;font-size:11px;">${fmtMoney(totals.iibb)}</td><td></td></tr>` : '',
      `<tr style="background:#eef2ff;"><td colspan="${cs}" style="text-align:right;padding:8px;font-size:12px;font-weight:700;color:#312e81;">Total</td><td style="text-align:right;padding:8px;font-size:14px;font-weight:700;color:#4338ca;">${fmtMoney(totals.total)}</td><td></td></tr>`,
    ].join('');

    const contacto = contactos.find(c => c.id === form.contactoId);

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Presupuesto ${form.numero}</title>
    <style>body{font-family:Inter,system-ui,sans-serif;margin:40px;color:#1e293b;} table{border-collapse:collapse;width:100%;} @media print{body{margin:20px;}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid #e2e8f0;padding-bottom:16px;">
      <div><h1 style="font-size:20px;margin:0;font-weight:700;">AGS</h1><p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">Servicios Analíticos</p></div>
      <div style="text-align:right;"><h2 style="font-size:16px;margin:0;font-weight:600;">Presupuesto ${form.numero}</h2>
        <p style="font-size:11px;color:#64748b;margin:4px 0 0;">Fecha: ${new Date().toLocaleDateString('es-AR')}</p>
        <p style="font-size:11px;color:#64748b;margin:2px 0 0;">Moneda: ${form.moneda}</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;font-size:12px;">
      <div style="background:#f8fafc;padding:12px;border-radius:8px;">
        <p style="font-size:10px;color:#94a3b8;font-weight:600;margin:0 0 4px;text-transform:uppercase;">Cliente</p>
        <p style="margin:0;font-weight:600;">${cliente?.razonSocial || '—'}</p>
        ${contacto ? `<p style="margin:4px 0 0;color:#64748b;">${contacto.nombre}${contacto.cargo ? ` — ${contacto.cargo}` : ''}</p>` : ''}
        ${contacto?.email ? `<p style="margin:2px 0 0;color:#64748b;">${contacto.email}</p>` : ''}
      </div>
      <div style="background:#f8fafc;padding:12px;border-radius:8px;">
        <p style="font-size:10px;color:#94a3b8;font-weight:600;margin:0 0 4px;text-transform:uppercase;">Condiciones</p>
        <p style="margin:0;">Validez: ${form.validezDias} días</p>
        ${condPago ? `<p style="margin:2px 0 0;">Pago: ${condPago.nombre}${condPago.dias > 0 ? ` (${condPago.dias} días)` : ''}</p>` : ''}
        ${form.tipoCambio ? `<p style="margin:2px 0 0;">T/C: ${form.tipoCambio}</p>` : ''}
      </div>
    </div>
    <table>
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:600;width:30px;">#</th>
        <th style="padding:8px;text-align:left;font-size:10px;color:#64748b;font-weight:600;">Descripción</th>
        <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:600;width:50px;">Cant.</th>
        <th style="padding:8px;text-align:left;font-size:10px;color:#64748b;font-weight:600;width:60px;">Unidad</th>
        <th style="padding:8px;text-align:right;font-size:10px;color:#64748b;font-weight:600;width:80px;">P. Unit.</th>
        ${hasDiscount ? '<th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:600;width:50px;">Dto %</th>' : ''}
        <th style="padding:8px;text-align:right;font-size:10px;color:#64748b;font-weight:600;width:90px;">Subtotal</th>
        <th style="padding:8px;text-align:left;font-size:10px;color:#64748b;font-weight:600;width:90px;">Cat.</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
      <tfoot>${totalsRows}</tfoot>
    </table>
    ${form.notasTecnicas || form.condicionesComerciales ? `
    <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:11px;">
      ${form.notasTecnicas ? `<div style="background:#f8fafc;padding:12px;border-radius:8px;"><p style="font-size:10px;color:#94a3b8;font-weight:600;margin:0 0 4px;text-transform:uppercase;">Notas técnicas</p><p style="margin:0;white-space:pre-wrap;">${form.notasTecnicas}</p></div>` : ''}
      ${form.condicionesComerciales ? `<div style="background:#f8fafc;padding:12px;border-radius:8px;"><p style="font-size:10px;color:#94a3b8;font-weight:600;margin:0 0 4px;text-transform:uppercase;">Condiciones comerciales</p><p style="margin:0;white-space:pre-wrap;">${form.condicionesComerciales}</p></div>` : ''}
    </div>` : ''}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }, [form, totals, cliente, contactos, condicionesPago, categoriasPresupuesto, calculateItemTaxes]);

  if (!open) return null;

  if (loading) {
    return (
      <Modal open={open} onClose={onClose} title="Cargando..." maxWidth="2xl">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-400 text-sm">Cargando presupuesto...</p>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="" maxWidth="2xl">
        {/* Custom header inside modal body for more control */}
        <div className="-mx-5 -mt-4 px-5 pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-slate-900 tracking-tight">{form.numero || 'Presupuesto'}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-600 truncate max-w-[200px]">{cliente?.razonSocial || ''}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[form.estado]}`}>
                {ESTADO_PRESUPUESTO_LABELS[form.estado]}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {saving && <span className="text-[10px] text-slate-400">Guardando...</span>}
              {onMinimize && (
                <Button variant="ghost" size="sm" onClick={onMinimize} title="Minimizar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                  </svg>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handlePrint} title="Imprimir">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 9.456l-2.689-1.429" />
                </svg>
              </Button>
              {form.estado === 'borrador' && (
                <Button variant="outline" size="sm" onClick={handleEnviar}>Enviar</Button>
              )}
              {form.estado === 'autorizado' && (
                <Button variant="outline" size="sm" onClick={() => { onClose(); navigate(`/ordenes-trabajo/nuevo?presupuestoId=${presupuestoId}`); }}>Crear OT</Button>
              )}
            </div>
          </div>
        </div>

        {/* Metadata strip — compact 2 rows */}
        <div className="bg-slate-50 -mx-5 px-5 py-3 mb-4 border-b border-slate-100 space-y-2">
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className={lbl}>Estado</label>
              <SearchableSelect value={form.estado} onChange={(v) => handleEstadoChange(v as Presupuesto['estado'])} options={estadoOptions} size="sm" />
            </div>
            <div>
              <label className={lbl}>Tipo</label>
              <SearchableSelect value={form.tipo} onChange={(v) => setField('tipo', v as TipoPresupuesto)} options={tipoOptions} size="sm" />
            </div>
            <div>
              <label className={lbl}>Moneda</label>
              <SearchableSelect value={form.moneda} onChange={(v) => setField('moneda', v as MonedaPresupuesto)} options={monedaOptions} size="sm" />
            </div>
            <div>
              <label className={lbl}>Validez (días)</label>
              <input type="number" min="1" value={form.validezDias}
                onChange={e => setField('validezDias', Number(e.target.value) || 15)}
                className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className={lbl}>Tipo cambio</label>
              <input type="number" min="0" step="0.01" value={form.tipoCambio || ''}
                onChange={e => setField('tipoCambio', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="—" />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className={lbl}>Contacto</label>
              {contactos.length > 0 ? (
                <SearchableSelect value={form.contactoId || ''} onChange={(v) => setField('contactoId', v || null)}
                  options={[{ value: '', label: 'Sin contacto' }, ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` — ${c.cargo}` : ''}` }))]}
                  size="sm" />
              ) : (
                <span className="text-xs text-slate-400 block py-1">—</span>
              )}
            </div>
            <div>
              <label className={lbl}>Condición pago</label>
              <SearchableSelect value={form.condicionPagoId || ''} onChange={(v) => setField('condicionPagoId', v || undefined)}
                options={[{ value: '', label: 'Sin condición' }, ...condicionesPago.filter(c => c.activo).map(c => ({ value: c.id, label: `${c.nombre}${c.dias > 0 ? ` (${c.dias}d)` : ''}` }))]}
                size="sm" />
            </div>
            <div>
              <label className={lbl}>Responsable</label>
              <SearchableSelect value={form.responsableId} onChange={(v) => {
                const usr = usuarios.find(u => u.id === v);
                setField('responsableId', v);
                setField('responsableNombre', usr?.displayName || '');
              }}
                options={[{ value: '', label: 'Sin asignar' }, ...usuarios.filter(u => u.status === 'activo').map(u => ({ value: u.id, label: u.displayName }))]}
                size="sm" />
            </div>
            <div>
              <label className={lbl}>Prox. contacto</label>
              <input type="date" value={form.proximoContacto} onChange={e => setField('proximoContacto', e.target.value)}
                className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            {form.origenTipo && (
              <div>
                <label className={lbl}>Origen</label>
                <span className="text-xs text-slate-600 block py-1">
                  {ORIGEN_PRESUPUESTO_LABELS[form.origenTipo as keyof typeof ORIGEN_PRESUPUESTO_LABELS] || form.origenTipo}
                  {form.origenRef ? ` — ${form.origenRef}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        <PresupuestoItemsTable
          items={form.items}
          categoriasPresupuesto={categoriasPresupuesto}
          conceptosServicio={conceptosServicio}
          moneda={form.moneda}
          totals={totals}
          notasTecnicas={form.notasTecnicas}
          condicionesComerciales={form.condicionesComerciales}
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onNotasTecnicasChange={(v) => setField('notasTecnicas', v)}
          onCondicionesChange={(v) => setField('condicionesComerciales', v)}
          calculateItemTaxes={calculateItemTaxes}
        />

        {/* Collapsible sections */}
        <div className="mt-4 space-y-2">
          {/* Adjuntos */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setShowAdjuntos(!showAdjuntos)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                Adjuntos {form.adjuntos.length > 0 && `(${form.adjuntos.length})`}
              </span>
              <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showAdjuntos ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAdjuntos && (
              <div className="px-3 pb-3">
                <PresupuestoAdjuntosSection
                  presupuestoId={presupuestoId}
                  adjuntos={form.adjuntos}
                  onAdd={addAdjunto}
                  onRemove={removeAdjunto}
                  onSuggestAutorizado={handleSuggestAutorizado}
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="-mx-5 -mb-4 mt-4 flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <div className="text-xs text-slate-500">
            {form.items.length > 0 && (
              <span>Items: <strong>{form.items.length}</strong> — Total: <strong className="text-indigo-700">{fmtMoney(totals.total)}</strong>
                {totals.totalImpuestos > 0 && <span className="text-slate-400"> (imp: {fmtMoney(totals.totalImpuestos)})</span>}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDuplicate} disabled={duplicating}>
              {duplicating ? 'Duplicando...' : 'Duplicar'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
