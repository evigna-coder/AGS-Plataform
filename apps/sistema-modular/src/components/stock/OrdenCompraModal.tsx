import { useState, useEffect } from 'react';
import { ESTADO_OC_LABELS, ESTADO_OC_COLORS } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useConfirm } from '../ui/ConfirmDialog';
import { ordenesCompraService } from '../../services/firebaseService';
import { OCItemsEditTable } from './OCItemsEditTable';
import { OCAddItemWizard } from './OCAddItemWizard';
import { OCItemsTable } from './OCItemsTable';
import { OCStatusTransition } from './OCStatusTransition';
import { OCImportacionesSection } from './OCImportacionesSection';
import { EnviarOrdenCompraModal } from './EnviarOrdenCompraModal';
import { ImportacionModal } from './ImportacionModal';
import { previewOrdenCompraPDF } from './pdf/generateOrdenCompraPDF';
import { useOrdenCompraForm, type OCPrefill } from '../../hooks/useOrdenCompraForm';

interface Props {
  open: boolean;
  ocId: string | null;
  onClose: () => void;
  onSaved?: () => void;
  prefill?: OCPrefill;
}

const selectClass = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';
const lbl = 'block text-[11px] font-medium text-slate-400 mb-0.5';

// Condiciones de pago sugeridas según tipo de OC (nacional = español, importación = inglés).
const CONDICIONES_PAGO: Record<string, string[]> = {
  nacional: ['Contado', '30 días fecha factura', '50% anticipo, 50% contra entrega', '100% anticipado'],
  importacion: ['30 days from customs clearance', '30% in advance, 70% after customs clearance', '100% advance'],
};

const MONEDA_SYM: Record<string, string> = { ARS: '$', USD: 'U$S', EUR: '€' };
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('es-AR') : '—');

const Info = ({ label, value, bold, className }: { label: string; value: React.ReactNode; bold?: boolean; className?: string }) => (
  <div className={className}>
    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
    <div className={`text-xs truncate ${bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{value || '—'}</div>
  </div>
);

export const OrdenCompraModal: React.FC<Props> = ({ open, ocId, onClose, onSaved, prefill }) => {
  const h = useOrdenCompraForm(ocId, open, prefill);
  const confirm = useConfirm();
  const [showTransition, setShowTransition] = useState(false);
  const [showEnviar, setShowEnviar] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showImportacion, setShowImportacion] = useState(false);
  const [editing, setEditing] = useState(false);
  // Resetear el modo edición al abrir/cambiar de OC.
  useEffect(() => { setEditing(false); }, [ocId, open]);

  const oc = h.oc;
  const editable = !oc || editing;             // form editable: OC nueva o en modo edición
  const puedeEditar = !oc || oc.estado !== 'cancelada';  // se puede editar en cualquier estado salvo cancelada
  const canReceive = !!oc && (oc.estado === 'enviada_proveedor' || oc.estado === 'embarcada');
  const proveedorOC = oc ? h.proveedores.find(p => p.id === oc.proveedorId) ?? null : null;
  const proveedorEmail = proveedorOC?.email ?? null;
  const sym = oc ? (MONEDA_SYM[oc.moneda] || '$') : '$';

  // PDF + envío disponibles solo cuando la OC ya existe (guardada).
  const pdfMailBtns = oc ? (
    <>
      <Button variant="outline" size="sm" onClick={() => previewOrdenCompraPDF(oc, proveedorOC)}>PDF</Button>
      <Button variant="outline" size="sm" onClick={() => setShowEnviar(true)}>Enviar al proveedor</Button>
    </>
  ) : null;

  const handleSave = async () => {
    const id = await h.save();
    if (id) {
      onSaved?.();
      if (oc) { setEditing(false); h.reload(); } // editar OC existente → volver a lectura
      else onClose();                            // OC nueva → cerrar
    }
  };

  const handleDelete = async () => {
    if (!oc) return;
    if (!await confirm(`Eliminar la orden de compra ${oc.numero}? Esta acción no se puede deshacer.`)) return;
    try {
      await ordenesCompraService.delete(oc.id);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('[OrdenCompraModal] error eliminando OC:', err);
      alert('Error al eliminar la orden de compra');
    }
  };

  const handleCrearImportacion = () => {
    if (!oc) return;
    setShowImportacion(true);
  };

  const title = oc ? `Orden de compra ${oc.numero}` : 'Nueva orden de compra';

  const footer = editable ? (
    <>
      <Button variant="outline" size="sm" onClick={editing ? () => { setEditing(false); h.reload(); } : onClose}>
        {editing ? 'Descartar' : 'Cancelar'}
      </Button>
      <Button size="sm" onClick={handleSave} disabled={h.saving}>{h.saving ? 'Guardando...' : 'Guardar'}</Button>
    </>
  ) : (
    <>
      {oc && (
        <Button variant="ghost" size="sm" onClick={handleDelete} className="mr-auto text-red-600 hover:bg-red-50">Eliminar</Button>
      )}
      {pdfMailBtns}
      {puedeEditar && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
      )}
      {oc?.tipo === 'importacion' && (
        <Button variant="outline" size="sm" onClick={handleCrearImportacion}>+ Crear importacion</Button>
      )}
      {canReceive && (
        <Button variant="outline" size="sm" onClick={() => setShowTransition(true)}>Registrar recepcion</Button>
      )}
      <Button size="sm" onClick={onClose}>Cerrar</Button>
    </>
  );

  return (
    <>
      <Modal open={open} onClose={onClose} maxWidth="2xl" title={title}
        subtitle={oc ? oc.proveedorNombre : 'El numero se asigna al guardar'} footer={footer}>
        {h.loading ? (
          <div className="text-center py-10 text-xs text-slate-400">Cargando...</div>
        ) : editable ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tipo (segun proveedor)</label>
                <div className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-600">
                  {h.proveedorId ? (h.tipo === 'importacion' ? 'Importacion' : 'Nacional') : 'Seleccione proveedor'}
                </div>
              </div>
              <div>
                <label className={lbl}>Proveedor *</label>
                <select value={h.proveedorId} onChange={e => h.handleProveedorChange(e.target.value)} className={selectClass}>
                  <option value="">Seleccionar proveedor...</option>
                  {h.proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Moneda</label>
                <select value={h.moneda} onChange={e => h.setMoneda(e.target.value as 'ARS' | 'USD' | 'EUR')} className={selectClass}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <Input inputSize="sm" label="Proforma N." value={h.proformaNumero} onChange={e => h.setProformaNumero(e.target.value)} />
              <Input inputSize="sm" label="Fecha proforma" type="date" value={h.fechaProforma} onChange={e => h.setFechaProforma(e.target.value)} />
              <Input inputSize="sm" label="Fecha entrega estimada" type="date" value={h.fechaEntregaEstimada} onChange={e => h.setFechaEntregaEstimada(e.target.value)} />
              {h.tipo === 'importacion' && (
                <div>
                  <label className={lbl}>Incoterm</label>
                  <select value={h.incoterm} onChange={e => h.setIncoterm(e.target.value)} className={selectClass}>
                    <option value="">—</option>
                    {['FOB', 'CIF', 'EXW', 'FCA', 'DAP', 'CFR', 'DDP'].map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className={lbl}>Condiciones de pago</label>
                <input value={h.condicionesPago} onChange={e => h.setCondicionesPago(e.target.value)}
                  list="oc-cond-pago" className={selectClass} placeholder="Seleccionar o escribir..."
                  onClick={e => { try { (e.currentTarget as unknown as { showPicker?: () => void }).showPicker?.(); } catch { /* noop */ } }} />
                <datalist id="oc-cond-pago">
                  {(CONDICIONES_PAGO[h.tipo] || []).map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notas</label>
                <textarea value={h.notas} onChange={e => h.setNotas(e.target.value)} rows={2} className={selectClass} />
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <OCItemsEditTable items={h.items} moneda={h.moneda} showIva={h.tipo === 'nacional'} onAdd={() => setShowWizard(true)} onUpdate={h.updateItem} onRemove={h.removeItem} />
            </div>
          </div>
        ) : oc ? (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-x-3 gap-y-2 bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <Info label="Proveedor" value={oc.proveedorNombre} className="col-span-2" />
              <Info label="Tipo" value={oc.tipo === 'importacion' ? 'Importacion' : 'Nacional'} />
              <Info label="Moneda" value={oc.moneda} />
              <Info label="Estado" value={
                <span className="inline-flex items-center gap-1.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_OC_COLORS[oc.estado]}`}>{ESTADO_OC_LABELS[oc.estado]}</span>
                  <button onClick={() => setShowTransition(true)} className="text-[10px] text-teal-600 hover:underline">cambiar</button>
                </span>
              } />
              <Info label="Entrega est." value={fmtDate(oc.fechaEntregaEstimada)} />
              <Info label="Enviada" value={fmtDate(oc.fechaEnvio)} />
              <Info label="Recepcion" value={fmtDate(oc.fechaRecepcion)} />
              <Info label="Cond. pago" value={oc.condicionesPago} className="col-span-2" />
              <Info label="Neto" value={`${sym} ${(oc.subtotal ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} />
              <Info label="IVA" value={`${sym} ${(oc.impuestos ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} />
              <Info label="Total" value={`${sym} ${(oc.total ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} bold />
            </div>
            <OCItemsTable items={oc.items} moneda={oc.moneda} readOnly />
            {oc.tipo === 'importacion' && <OCImportacionesSection importaciones={h.importaciones} />}
            {oc.notas && <p className="text-[11px] text-slate-500"><span className="text-slate-400">Notas:</span> {oc.notas}</p>}
          </div>
        ) : null}
      </Modal>

      {oc && (
        <OCStatusTransition
          oc={oc}
          open={showTransition}
          onClose={() => setShowTransition(false)}
          onUpdated={() => { setShowTransition(false); h.reload(); onSaved?.(); }}
        />
      )}

      {oc && (
        <EnviarOrdenCompraModal
          open={showEnviar}
          oc={oc}
          proveedorEmail={proveedorEmail}
          onClose={() => setShowEnviar(false)}
          onSent={() => { setShowEnviar(false); h.reload(); onSaved?.(); }}
        />
      )}

      {showWizard && (
        <OCAddItemWizard onAdd={h.pushItem} onClose={() => setShowWizard(false)} />
      )}

      {oc && (
        <ImportacionModal
          open={showImportacion}
          impId={null}
          prefill={{
            ordenCompraId: oc.id, ordenCompraNumero: oc.numero,
            proveedorId: oc.proveedorId, proveedorNombre: oc.proveedorNombre,
            moneda: oc.moneda, incoterm: oc.incoterm ?? null, items: oc.items ?? [],
          }}
          onClose={() => setShowImportacion(false)}
          onSaved={() => { setShowImportacion(false); h.reload(); onSaved?.(); }}
        />
      )}
    </>
  );
};
