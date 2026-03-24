import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { PresupuestoItemsTable } from './PresupuestoItemsTable';
import { PresupuestoAdjuntosSection } from './PresupuestoAdjuntosSection';
import { PresupuestoCondicionesEditor } from './PresupuestoCondicionesEditor';
import { SistemasPresupuestoPanel } from './SistemasPresupuestoPanel';
import { usePresupuestoEdit } from '../../hooks/usePresupuestoEdit';
import { usePresupuestoSistemas } from '../../hooks/usePresupuestoSistemas';
import { presupuestosService, leadsService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import type { Presupuesto, TipoPresupuesto, MonedaPresupuesto, Posta, LeadEstado, PresupuestoSeccionesVisibles } from '@ags/shared';
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
    cliente, establecimiento, contactos, categoriasPresupuesto, condicionesPago, conceptosServicio, usuarios,
    clienteSistemas, loadModulosBySistema,
    calculateTotals, calculateItemTaxes,
    save, updateItem, addItem, removeItem, addAdjunto, removeAdjunto,
    handleEstadoChange: rawEstadoChange,
  } = usePresupuestoEdit(open ? presupuestoId : null);

  const { linkedSistemaIds, itemsByGrupo, getGrupo } = usePresupuestoSistemas(form.items, clienteSistemas);

  const handleRemoveSistema = (sistemaId: string) => {
    form.items.filter(i => i.sistemaId === sistemaId).forEach(i => removeItem(i.id));
  };

  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showAdjuntos, setShowAdjuntos] = useState(false);
  const [showCondiciones, setShowCondiciones] = useState(false);

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
    const contacto = contactos.find(c => c.id === form.contactoId);
    const email = contacto?.email;
    if (email) {
      const subject = encodeURIComponent(`Presupuesto ${form.numero} - AGS`);
      const body = encodeURIComponent(`Estimado/a ${contacto.nombre},\n\nAdjunto presupuesto ${form.numero} para su revisión.\n\nSaludos cordiales,\nAGS`);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
    }
  };

  /** Build PDF params from current form state */
  const buildPDFParams = useCallback(() => {
    const condPago = condicionesPago.find(c => c.id === form.condicionPagoId) || null;
    const contacto = contactos.find(c => c.id === form.contactoId) || null;
    const totalsCalc = calculateTotals();

    // Build a Presupuesto-like object from form state
    const presupuestoData: Presupuesto = {
      id: presupuestoId,
      numero: form.numero,
      tipo: form.tipo,
      moneda: form.moneda,
      clienteId: form.clienteId,
      establecimientoId: form.establecimientoId,
      sistemaId: form.sistemaId,
      contactoId: form.contactoId,
      origenTipo: form.origenTipo as any,
      origenId: form.origenId,
      origenRef: form.origenRef,
      estado: form.estado,
      items: form.items,
      subtotal: totalsCalc.subtotal,
      total: totalsCalc.total,
      tipoCambio: form.tipoCambio,
      condicionPagoId: form.condicionPagoId,
      ordenesCompraIds: [],
      adjuntos: form.adjuntos,
      notasTecnicas: form.notasTecnicas || null,
      notasAdministrativas: form.notasAdministrativas || null,
      garantia: form.garantia || null,
      variacionTipoCambio: form.variacionTipoCambio || null,
      condicionesComerciales: form.condicionesComerciales || null,
      aceptacionPresupuesto: form.aceptacionPresupuesto || null,
      seccionesVisibles: form.seccionesVisibles,
      validezDias: form.validezDias,
      validUntil: form.validUntil,
      fechaEnvio: form.fechaEnvio,
      proximoContacto: form.proximoContacto || null,
      responsableId: form.responsableId || null,
      responsableNombre: form.responsableNombre || null,
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      presupuesto: presupuestoData,
      cliente,
      establecimiento,
      contacto: contacto as any,
      condicionPago: condPago,
      categorias: categoriasPresupuesto,
    };
  }, [form, presupuestoId, cliente, establecimiento, contactos, condicionesPago, categoriasPresupuesto, calculateTotals]);

  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      const { downloadPresupuestoPDF } = await import('./pdf');
      await downloadPresupuestoPDF(buildPDFParams());
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Error al generar el PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handlePreviewPDF = async () => {
    setGeneratingPDF(true);
    try {
      const { previewPresupuestoPDF } = await import('./pdf');
      await previewPresupuestoPDF(buildPDFParams());
    } catch (err) {
      console.error('Error generando preview:', err);
      alert('Error al generar la vista previa');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar permanentemente ${form.numero}? Esta acción no se puede deshacer.`)) return;
    try {
      setDeleting(true);
      await presupuestosService.hardDelete(presupuestoId);
      onClose();
      onUpdated?.();
    } catch (err) {
      console.error('Error eliminando presupuesto:', err);
      alert('Error al eliminar el presupuesto');
    } finally {
      setDeleting(false);
    }
  };

  /** Condiciones editor helpers */
  const condicionesValues = {
    notasTecnicas: form.notasTecnicas,
    notasAdministrativas: form.notasAdministrativas,
    garantia: form.garantia,
    variacionTipoCambio: form.variacionTipoCambio,
    condicionesComerciales: form.condicionesComerciales,
    aceptacionPresupuesto: form.aceptacionPresupuesto,
  };

  const handleSeccionToggle = (key: keyof PresupuestoSeccionesVisibles, visible: boolean) => {
    setField('seccionesVisibles', { ...form.seccionesVisibles, [key]: visible });
  };

  const handleCondicionValueChange = (key: keyof PresupuestoSeccionesVisibles, value: string) => {
    setField(key as any, value);
  };

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
              {generatingPDF && <span className="text-[10px] text-teal-500">Generando PDF...</span>}
              {onMinimize && (
                <Button variant="ghost" size="sm" onClick={onMinimize} title="Minimizar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                  </svg>
                </Button>
              )}
              {/* Preview PDF */}
              <Button variant="ghost" size="sm" onClick={handlePreviewPDF} disabled={generatingPDF} title="Vista previa PDF">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </Button>
              {/* Download PDF */}
              <Button variant="ghost" size="sm" onClick={handleDownloadPDF} disabled={generatingPDF} title="Descargar PDF">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </Button>
              {form.estado === 'borrador' && (
                <Button variant="outline" size="sm" onClick={handleEnviar}>Enviar</Button>
              )}
              {form.estado === 'autorizado' && (
                <Button variant="outline" size="sm" onClick={() => { onClose(); navigate(`/ordenes-trabajo/nuevo?presupuestoId=${presupuestoId}`); }}>Crear OT</Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} title="Eliminar presupuesto"
                className="text-red-400 hover:text-red-600 hover:bg-red-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </Button>
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
                className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>
            <div>
              <label className={lbl}>Tipo cambio</label>
              <input type="number" min="0" step="0.01" value={form.tipoCambio || ''}
                onChange={e => setField('tipoCambio', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="—" />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className={lbl}>Contacto</label>
              {contactos.length > 0 ? (
                <SearchableSelect value={form.contactoId || ''} onChange={(v) => setField('contactoId', v || null)}
                  options={[{ value: '', label: 'Sin contacto' }, ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${'cargo' in c && c.cargo ? ` — ${c.cargo}` : ''}` }))]}
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
                className="w-full border rounded-lg px-2 py-1 text-xs bg-white border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500" />
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

        {/* Sistemas vinculados */}
        {clienteSistemas.length > 0 && (
          <SistemasPresupuestoPanel
            clienteSistemas={clienteSistemas}
            linkedSistemaIds={linkedSistemaIds}
            onRemoveSistema={handleRemoveSistema}
          />
        )}

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
          tipoPresupuesto={form.tipo}
          sistemas={clienteSistemas}
          loadModulos={loadModulosBySistema}
          itemsByGrupo={itemsByGrupo}
          getGrupo={getGrupo}
        />

        {/* Collapsible sections */}
        <div className="mt-4 space-y-2">
          {/* Condiciones del presupuesto */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setShowCondiciones(!showCondiciones)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                Condiciones del presupuesto (PDF)
              </span>
              <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showCondiciones ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCondiciones && (
              <div className="p-3">
                <PresupuestoCondicionesEditor
                  tipo={form.tipo}
                  seccionesVisibles={form.seccionesVisibles}
                  values={condicionesValues}
                  onSeccionToggle={handleSeccionToggle}
                  onValueChange={handleCondicionValueChange}
                />
              </div>
            )}
          </div>

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
              <span>Items: <strong>{form.items.length}</strong> — Total: <strong className="text-teal-700">{fmtMoney(totals.total)}</strong>
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
