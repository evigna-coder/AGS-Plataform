import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { PresupuestoItemsTable } from './PresupuestoItemsTable';
import { PresupuestoAdjuntosSection } from './PresupuestoAdjuntosSection';
import { PresupuestoCondicionesEditor } from './PresupuestoCondicionesEditor';
import { SistemasPresupuestoPanel } from './SistemasPresupuestoPanel';
import { PresupuestoHeaderBar } from './PresupuestoHeaderBar';
import { PresupuestoMetadataStrip } from './PresupuestoMetadataStrip';
import { PresupuestoRevisionHistory } from './PresupuestoRevisionHistory';
import { CreateRevisionModal } from './CreateRevisionModal';
import { SolicitarFacturaModal } from './SolicitarFacturaModal';
import { EnviarPresupuestoModal } from './EnviarPresupuestoModal';
import { ReservarStockModal } from '../stock/ReservarStockModal';
import { usePresupuestoEdit } from '../../hooks/usePresupuestoEdit';
import { usePresupuestoSistemas } from '../../hooks/usePresupuestoSistemas';
import { usePresupuestoActions } from '../../hooks/usePresupuestoActions';
import type { Presupuesto } from '@ags/shared';

interface Props {
  presupuestoId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onMinimize?: () => void;
}

const FACTURACION_STATES = ['aceptado'];

export const EditPresupuestoModal: React.FC<Props> = ({ presupuestoId, open, onClose, onUpdated, onMinimize }) => {
  const [showSolicitarFactura, setShowSolicitarFactura] = useState(false);
  const [showEnviarEmail, setShowEnviarEmail] = useState(false);
  const [showReservar, setShowReservar] = useState(false);
  const {
    form, setField, loading, saving,
    cliente, establecimiento, contactos, categoriasPresupuesto, condicionesPago, conceptosServicio, usuarios,
    clienteSistemas, loadModulosBySistema,
    calculateTotals, calculateItemTaxes,
    save, updateItem, addItem, removeItem, addAdjunto, removeAdjunto,
    handleEstadoChange: rawEstadoChange,
  } = usePresupuestoEdit(open ? presupuestoId : null);

  const { linkedSistemaIds, itemsByGrupo, getGrupo } = usePresupuestoSistemas(form.items, clienteSistemas);

  const actions = usePresupuestoActions({
    presupuestoId, form, setField, rawEstadoChange, save, calculateTotals,
    cliente, establecimiento, contactos, condicionesPago, categoriasPresupuesto,
    onClose, onUpdated,
  });

  const handleRemoveSistema = (sistemaId: string) => {
    form.items.filter(i => i.sistemaId === sistemaId).forEach(i => removeItem(i.id));
  };

  const totals = calculateTotals();

  const itemsConStock = (form.items ?? [])
    .filter(i => i.stockArticuloId)
    .map(i => ({ articuloId: i.stockArticuloId!, descripcion: i.descripcion }));

  const condicionesValues = {
    notasTecnicas: form.notasTecnicas,
    notasAdministrativas: form.notasAdministrativas,
    garantia: form.garantia,
    variacionTipoCambio: form.variacionTipoCambio,
    condicionesComerciales: form.condicionesComerciales,
    aceptacionPresupuesto: form.aceptacionPresupuesto,
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
        <PresupuestoHeaderBar
          presupuestoId={presupuestoId}
          numero={form.numero}
          estado={form.estado}
          clienteRazonSocial={cliente?.razonSocial || ''}
          saving={saving}
          generatingPDF={actions.generatingPDF}
          deleting={actions.deleting}
          onMinimize={onMinimize}
          onClose={onClose}
          onPreviewPDF={actions.handlePreviewPDF}
          onDownloadPDF={actions.handleDownloadPDF}
          onEnviar={() => setShowEnviarEmail(true)}
          onDelete={actions.handleDelete}
        />

        <PresupuestoMetadataStrip
          form={form}
          setField={setField}
          contactos={contactos}
          condicionesPago={condicionesPago}
          usuarios={usuarios}
          onEstadoChange={actions.handleEstadoChange}
        />

        <PresupuestoRevisionHistory
          presupuestoId={presupuestoId}
          numero={form.numero}
          estado={form.estado}
          motivoAnulacion={form.motivoAnulacion}
          presupuestoOrigenId={form.presupuestoOrigenId}
          showHistory={actions.showHistory}
          revisionHistory={actions.revisionHistory}
          onLoadHistory={actions.loadRevisionHistory}
          onCloseHistory={() => actions.setShowHistory(false)}
          onClose={onClose}
        />

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
          <CollapsibleSection
            title="Condiciones del presupuesto (PDF)"
            open={actions.showCondiciones}
            onToggle={() => actions.setShowCondiciones(!actions.showCondiciones)}
          >
            <div className="p-3">
              <PresupuestoCondicionesEditor
                tipo={form.tipo}
                seccionesVisibles={form.seccionesVisibles}
                values={condicionesValues}
                onSeccionToggle={actions.handleSeccionToggle}
                onValueChange={actions.handleCondicionValueChange}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title={`Adjuntos${form.adjuntos.length > 0 ? ` (${form.adjuntos.length})` : ''}`}
            open={actions.showAdjuntos}
            onToggle={() => actions.setShowAdjuntos(!actions.showAdjuntos)}
          >
            <div className="px-3 pb-3">
              <PresupuestoAdjuntosSection
                presupuestoId={presupuestoId}
                adjuntos={form.adjuntos}
                onAdd={addAdjunto}
                onRemove={removeAdjunto}
                onSuggestAutorizado={actions.handleSuggestAutorizado}
              />
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="-mx-5 -mb-4 mt-4 flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <div className="text-xs text-slate-500">
            {form.items.length > 0 && (
              <span>Items: <strong>{form.items.length}</strong> — Total: <strong className="text-teal-700">{actions.fmtMoney(totals.total)}</strong>
                {totals.totalImpuestos > 0 && <span className="text-slate-400"> (imp: {actions.fmtMoney(totals.totalImpuestos)})</span>}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {FACTURACION_STATES.includes(form.estado) && (
              <Button variant="ghost" size="sm" onClick={() => setShowSolicitarFactura(true)}>
                Solicitar facturacion
              </Button>
            )}
            {form.estado !== 'anulado' && (
              <Button variant="ghost" size="sm" onClick={() => actions.setShowRevision(true)}>
                Crear revisión
              </Button>
            )}
            {itemsConStock.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowReservar(true)}>
                Reservar stock
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
            {form.estado !== 'anulado' && (
              <Button variant="primary" size="sm" onClick={actions.handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
      <CreateRevisionModal
        open={actions.showRevision}
        presupuesto={actions.showRevision ? { id: presupuestoId, numero: form.numero, estado: form.estado, origenTipo: form.origenTipo as any, origenId: form.origenId } as Presupuesto : null}
        onClose={() => actions.setShowRevision(false)}
        onCreated={actions.handleRevisionCreated}
      />
      {showSolicitarFactura && (
        <SolicitarFacturaModal
          open={showSolicitarFactura}
          presupuesto={{ id: presupuestoId, numero: form.numero, clienteId: form.clienteId, moneda: form.moneda, items: form.items } as Presupuesto}
          clienteNombre={cliente?.razonSocial || ''}
          condicionPagoNombre={condicionesPago.find(c => c.id === form.condicionPagoId)?.nombre || 'No especificada'}
          onClose={() => setShowSolicitarFactura(false)}
          onCreated={() => { setShowSolicitarFactura(false); onUpdated?.(); }}
        />
      )}
      {showEnviarEmail && (
        <EnviarPresupuestoModal
          open={showEnviarEmail}
          onClose={() => setShowEnviarEmail(false)}
          onSent={async () => {
            setShowEnviarEmail(false);
            // Mark as enviado if still borrador
            if (form.estado === 'borrador') {
              actions.handleEstadoChange('enviado');
              await actions.handleSave();
            }
            onUpdated?.();
          }}
          pdfParams={actions.buildPDFParams()}
          defaultTo={contactos.find(c => c.id === form.contactoId)?.email || ''}
          defaultContactoNombre={contactos.find(c => c.id === form.contactoId)?.nombre || ''}
          presupuestoNumero={form.numero}
        />
      )}
      {showReservar && itemsConStock.length > 0 && (
        <ReservarStockModal
          presupuestoId={presupuestoId}
          presupuestoNumero={form.numero}
          clienteId={form.clienteId ?? ''}
          clienteNombre={cliente?.razonSocial ?? ''}
          items={itemsConStock}
          onClose={() => setShowReservar(false)}
          onSuccess={() => setShowReservar(false)}
        />
      )}
    </>
  );
};

/** Small reusable collapsible section wrapper */
const CollapsibleSection: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, open, onToggle, children }) => (
  <div className="border border-slate-200 rounded-lg overflow-hidden">
    <button onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
      <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">{title}</span>
      <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {open && children}
  </div>
);
