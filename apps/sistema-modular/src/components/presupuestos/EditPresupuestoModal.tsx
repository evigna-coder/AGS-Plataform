import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { PresupuestoItemsTable } from './PresupuestoItemsTable';
import { PresupuestoCuotasSection } from './PresupuestoCuotasSection';
import { PresupuestoAdjuntosSection } from './PresupuestoAdjuntosSection';
import { PresupuestoCondicionesEditor } from './PresupuestoCondicionesEditor';
import { SistemasPresupuestoPanel } from './SistemasPresupuestoPanel';
import { PresupuestoHeaderBar } from './PresupuestoHeaderBar';
import { PresupuestoMetadataStrip } from './PresupuestoMetadataStrip';
import { PresupuestoRevisionHistory } from './PresupuestoRevisionHistory';
import { PresupuestoRequerimientosSection } from './PresupuestoRequerimientosSection';
import { PresupuestoOTsVinculadas } from './PresupuestoOTsVinculadas';
import { PresupuestoItemsTableContrato } from './contrato/PresupuestoItemsTableContrato';
import { VentasMetadataSection } from './VentasMetadataSection';
import { CreateRevisionModal } from './CreateRevisionModal';
import { SolicitarFacturaModal } from './SolicitarFacturaModal';
import { PresupuestoFacturacionSection } from './PresupuestoFacturacionSection';
import { EsquemaFacturacionSection } from './EsquemaFacturacionSection';
import { EnviarPresupuestoModal } from './EnviarPresupuestoModal';
import { CargarOCModal } from './CargarOCModal';
import { ReservarStockModal } from '../stock/ReservarStockModal';
import { usePresupuestoEdit } from '../../hooks/usePresupuestoEdit';
import { usePresupuestoSistemas } from '../../hooks/usePresupuestoSistemas';
import { usePresupuestoActions } from '../../hooks/usePresupuestoActions';
import { CreateOTModal } from '../ordenes-trabajo/CreateOTModal';
import { ordenesCompraClienteService } from '../../services/ordenesCompraClienteService';
import { presupuestosService } from '../../services/presupuestosService';
import { articulosService } from '../../services/stockService';
import { computeStockAmplio } from '../../services/stockAmplioService';
import { useAuth } from '../../contexts/AuthContext';
import type { Presupuesto, PresupuestoCuota, OrdenCompraCliente, Articulo } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';

interface Props {
  presupuestoId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onMinimize?: () => void;
}

const FACTURACION_STATES = ['aceptado'];

export const EditPresupuestoModal: React.FC<Props> = ({ presupuestoId, open, onClose, onUpdated, onMinimize }) => {
  const { firebaseUser, usuario } = useAuth();
  const [showSolicitarFactura, setShowSolicitarFactura] = useState(false);
  const [showEnviarEmail, setShowEnviarEmail] = useState(false);
  const [showReservar, setShowReservar] = useState(false);
  const [showCrearOT, setShowCrearOT] = useState(false);
  // Phase 12 B2: busy flag for direct togglePreEmbarque service call (bypasses form-state)
  const [preEmbarqueBusy, setPreEmbarqueBusy] = useState(false);
  // FLOW-02: estado del modal "Cargar OC" + datos resueltos async para su select/checkbox.
  const [showCargarOC, setShowCargarOC] = useState(false);
  const [ocsExistentesOfCliente, setOcsExistentesOfCliente] = useState<OrdenCompraCliente[]>([]);
  const [otrosPresupuestosParaOC, setOtrosPresupuestosParaOC] = useState<Presupuesto[]>([]);
  // Bumped whenever a save completes, to re-query requerimientos that may
  // have been auto-generated as a side effect. Auto-gen runs fire-and-forget
  // in the service layer so we refresh a few seconds later to catch up.
  const [requerimientosRefreshKey, setRequerimientosRefreshKey] = useState(0);
  // Phase 10: articulos catalog for partes/mixto/ventas ArticuloPickerPanel
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const {
    form, setField, loading, saving,
    cliente, establecimiento, contactos, categoriasPresupuesto, condicionesPago, conceptosServicio, usuarios,
    clienteSistemas, loadModulosBySistema,
    calculateTotals, calculateItemTaxes,
    save, load, updateItem, addItem, addItems, removeItem, removeItemsByGrupo, addAdjunto, removeAdjunto,
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

  // Phase 10: UX-only ATP validation before transitioning to 'aceptado' for non-contrato types.
  // Non-blocking confirm — user can proceed; FLOW-03 creates conditional requirements either way.
  const handleEstadoChangeWithValidation = async (nuevo: Presupuesto['estado']) => {
    if (nuevo !== 'aceptado' || !['partes', 'mixto', 'ventas'].includes(form.tipo)) {
      return actions.handleEstadoChange(nuevo);
    }
    const warnings: string[] = [];
    for (const item of form.items.filter(i => i.stockArticuloId)) {
      try {
        const s = await computeStockAmplio(item.stockArticuloId!);
        const atpNeto = s.disponible + s.enTransito - s.reservado - s.comprometido;
        if ((item.cantidad || 0) > atpNeto) {
          warnings.push(`${item.descripcion}: cantidad ${item.cantidad}, ATP disponible ${atpNeto}`);
        }
      } catch (err) {
        console.warn('[EditPresupuestoModal] ATP check failed for', item.stockArticuloId, err);
      }
    }
    if (warnings.length > 0) {
      const ok = window.confirm(
        `Advertencia — ATP insuficiente para:\n\n${warnings.join('\n')}\n\n` +
        `Al aceptar, FLOW-03 creará requerimientos condicionales automáticos.\n\n¿Continuar?`,
      );
      if (!ok) return;
    }
    return actions.handleEstadoChange(nuevo);
  };

  const totals = calculateTotals();
  const isMixta = form.moneda === 'MIXTA';

  const totalsByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    if (isMixta) {
      (form.items ?? []).forEach(i => { const m = i.moneda || 'USD'; map[m] = (map[m] || 0) + (i.subtotal || 0); });
    } else {
      map[form.moneda] = totals.total;
    }
    return map;
  }, [form.items, form.moneda, isMixta, totals.total]);

  const handleCuotasChange = (cuotas: PresupuestoCuota[]) => {
    setField('cuotas', cuotas);
    setField('cantidadCuotas', cuotas.length || null);
  };

  // Refresh requerimientos section after a save completes. Auto-generation
  // happens asynchronously in presupuestosService.update/create so we poll
  // once shortly after the save to pick up any new documents.
  useEffect(() => {
    if (!saving) {
      const t = setTimeout(() => setRequerimientosRefreshKey(k => k + 1), 1500);
      return () => clearTimeout(t);
    }
  }, [saving]);

  // Phase 10: load articulos catalog for non-contrato types that may link items to stock
  useEffect(() => {
    if (!open) return;
    const needsCatalog = form.tipo && ['partes', 'mixto', 'ventas'].includes(form.tipo);
    if (!needsCatalog) { setArticulos([]); return; }
    articulosService.getAll().then(setArticulos).catch(() => setArticulos([]));
  }, [open, form.tipo]);

  // FLOW-02: cuando se abre el modal "Cargar OC", resuelve OCs previas del
  // cliente + otros presupuestos `aceptado` sin OC del mismo cliente (N:M).
  // Lazy — no pegamos a Firestore hasta que el usuario abra el modal.
  useEffect(() => {
    let cancelled = false;
    if (!showCargarOC || !form.clienteId) {
      if (!showCargarOC) {
        setOcsExistentesOfCliente([]);
        setOtrosPresupuestosParaOC([]);
      }
      return;
    }
    (async () => {
      try {
        const [ocs, todosDelCliente] = await Promise.all([
          ordenesCompraClienteService.getByCliente(form.clienteId),
          presupuestosService.getByCliente(form.clienteId).catch(() => [] as Presupuesto[]),
        ]);
        if (cancelled) return;
        setOcsExistentesOfCliente(ocs);
        setOtrosPresupuestosParaOC(
          todosDelCliente.filter(p =>
            p.id !== presupuestoId &&
            p.estado === 'aceptado' &&
            (!p.ordenesCompraIds || p.ordenesCompraIds.length === 0)
          ),
        );
      } catch (err) {
        console.error('Error resolviendo datos para Cargar OC:', err);
        if (!cancelled) {
          setOcsExistentesOfCliente([]);
          setOtrosPresupuestosParaOC([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [showCargarOC, form.clienteId, presupuestoId]);

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
          onCrearOT={() => setShowCrearOT(true)}
        />

        <PresupuestoMetadataStrip
          form={form}
          setField={setField}
          contactos={contactos}
          condicionesPago={condicionesPago}
          usuarios={usuarios}
          onEstadoChange={handleEstadoChangeWithValidation}
        />

        <PresupuestoOTsVinculadas
          otsVinculadasNumbers={form.otsVinculadasNumbers}
          otVinculadaNumber={form.otVinculadaNumber}
        />

        {/* Phase 10: Ventas delivery metadata — only shown for tipo 'ventas' */}
        {form.tipo === 'ventas' && (
          <VentasMetadataSection
            value={form.ventasMetadata}
            onChange={(patch) => setField('ventasMetadata', { ...form.ventasMetadata, ...patch })}
          />
        )}

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

        {/* Items table — switches based on presupuesto type */}
        {form.tipo === 'contrato' ? (
          <PresupuestoItemsTableContrato
            items={form.items}
            moneda={form.moneda}
            sistemas={clienteSistemas}
            loadModulos={loadModulosBySistema}
            onAddItems={addItems}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
            onRemoveSistema={(_sistemaId, grupo) => removeItemsByGrupo(grupo)}
          />
        ) : (
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
            articulos={articulos}
          />
        )}

        {/* Phase 12: Esquema de facturación porcentual — for all types except contrato */}
        {form.tipo !== 'contrato' && (
          <EsquemaFacturacionSection
            esquema={form.esquemaFacturacion ?? []}
            moneda={form.moneda}
            itemsForTotals={form.items}
            readOnly={form.estado !== 'borrador'}
            onChange={(next) => setField('esquemaFacturacion', next)}
          />
        )}

        {/* Phase 12 B2: preEmbarque header toggle — only when esquema has a pre_embarque cuota.
            B2 fix: onChange calls service directly so audit posta fires on linked ticket (plan 12-03).
            This is the ONLY field that bypasses form-state in this modal. */}
        {form.tipo !== 'contrato' &&
          (form.esquemaFacturacion ?? []).some(c => c.hito === 'pre_embarque') && (
          <div className="mt-2 px-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form.preEmbarque}
                disabled={
                  form.estado === 'finalizado' ||
                  form.estado === 'anulado' ||
                  preEmbarqueBusy
                }
                onChange={async (e) => {
                  // B2: bypass form-state — call service direct so audit posta fires.
                  // This is the ONLY field that bypasses the form-state route in this modal.
                  const next = e.target.checked;
                  setPreEmbarqueBusy(true);
                  try {
                    const actor = firebaseUser
                      ? { uid: firebaseUser.uid, name: usuario?.displayName || undefined }
                      : undefined;
                    await presupuestosService.togglePreEmbarque(presupuestoId, next, actor);
                    // Refresh form state to reflect the persisted value
                    const refreshed = await presupuestosService.getById(presupuestoId);
                    if (refreshed) {
                      setField('preEmbarque', refreshed.preEmbarque ?? false);
                      setField('esquemaFacturacion', refreshed.esquemaFacturacion ?? []);
                    }
                  } catch (err) {
                    console.error('[togglePreEmbarque] failed:', err);
                  } finally {
                    setPreEmbarqueBusy(false);
                  }
                }}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                {preEmbarqueBusy ? 'Actualizando...' : 'Mercadería en pre-embarque'}
              </span>
            </label>
          </div>
        )}

        {/* Cuotas */}
        <div className="mt-4">
          <PresupuestoCuotasSection
            cuotas={form.cuotas || []}
            onChange={handleCuotasChange}
            totalsByCurrency={totalsByCurrency}
            moneda={form.moneda}
            cantidadCuotasPorMoneda={form.cantidadCuotasPorMoneda}
            onCantidadCuotasPorMonedaChange={(map) => setField('cantidadCuotasPorMoneda', map)}
          />
        </div>

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
                ocNumero={form.ordenCompraNumero}
                onOCNumeroChange={v => setField('ordenCompraNumero', v)}
              />
            </div>
          </CollapsibleSection>

          {((form.esquemaFacturacion?.length ?? 0) > 0 || (form.otsListasParaFacturar?.length ?? 0) > 0) && (
            <CollapsibleSection
              title={
                (form.esquemaFacturacion?.length ?? 0) > 0
                  ? `Facturación — ${form.esquemaFacturacion!.length} cuota${form.esquemaFacturacion!.length !== 1 ? 's' : ''}${(form.otsListasParaFacturar?.length ?? 0) > 0 ? ` + ${form.otsListasParaFacturar!.length} OT${form.otsListasParaFacturar!.length !== 1 ? 's' : ''}` : ''}`
                  : `OTs listas para facturar (${form.otsListasParaFacturar?.length ?? 0})`
              }
              open={actions.showFacturacion}
              onToggle={() => actions.setShowFacturacion(!actions.showFacturacion)}
            >
              <PresupuestoFacturacionSection
                presupuestoId={presupuestoId}
                esquemaFacturacion={form.esquemaFacturacion}
                otsListasParaFacturar={form.otsListasParaFacturar ?? []}
                moneda={form.moneda}
                itemsForTotals={form.items}
                onChanged={() => load()}
                actor={firebaseUser ? { uid: firebaseUser.uid, name: usuario?.displayName || undefined } : undefined}
              />
            </CollapsibleSection>
          )}

          <PresupuestoRequerimientosSection
            presupuestoId={presupuestoId}
            refreshKey={requerimientosRefreshKey}
          />
        </div>

        {/* Footer */}
        <div className="-mx-5 -mb-4 mt-4 flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <div className="text-xs text-slate-500">
            {form.items.length > 0 && isMixta ? (
              <span>Items: <strong>{form.items.length}</strong> — {
                Object.entries(totalsByCurrency).map(([m, t], i) => (
                  <span key={m}>{i > 0 && ' · '}<strong className="text-teal-700">{MONEDA_SIMBOLO[m] || '$'} {t.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>
                ))
              }</span>
            ) : form.items.length > 0 ? (
              <span>Items: <strong>{form.items.length}</strong> — Total: <strong className="text-teal-700">{actions.fmtMoney(totals.total)}</strong>
                {totals.totalImpuestos > 0 && <span className="text-slate-400"> (imp: {actions.fmtMoney(totals.totalImpuestos)})</span>}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2 flex-wrap">
            {form.estado === 'aceptado' && (
              <Button variant="outline" size="sm" onClick={() => setShowCargarOC(true)} title="Cargar OC del cliente (FLOW-02)">
                Cargar OC
              </Button>
            )}
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
          condicionPagoNombre={(() => { const cp = condicionesPago.find(c => c.id === form.condicionPagoId); return cp ? `${cp.nombre}${cp.dias > 0 ? ` (${cp.dias} días)` : ''}` : 'No especificada'; })()}
          onClose={() => setShowSolicitarFactura(false)}
          onCreated={() => { setShowSolicitarFactura(false); onUpdated?.(); }}
        />
      )}
      {showEnviarEmail && (
        <EnviarPresupuestoModal
          open={showEnviarEmail}
          onClose={() => setShowEnviarEmail(false)}
          onSent={async () => {
            // markEnviado already committed estado='enviado' atomically inside EnviarPresupuestoModal.
            // FINDING-I / R4: usePresupuestoEdit has a dirty-guard (line 197) that skips snapshots
            // when dirty.current === true (user has unsaved local edits). We must explicitly reload
            // to bypass the guard; the server is the source of truth after a successful send.
            setShowEnviarEmail(false);
            await load();  // resets dirty flag; subscription will repopulate form with enviado estado
            onUpdated?.();
          }}
          pdfParams={actions.buildPDFParams()}
          defaultTo={contactos.find(c => c.id === form.contactoId)?.email || ''}
          defaultContactoNombre={contactos.find(c => c.id === form.contactoId)?.nombre || ''}
          presupuestoNumero={form.numero}
          presupuestoId={presupuestoId}
          presupuestoEstado={form.estado}
          origenTipo={form.origenTipo}
          origenId={form.origenId}
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
      {showCrearOT && (
        <CreateOTModal
          open={showCrearOT}
          onClose={() => setShowCrearOT(false)}
          onCreated={() => { setShowCrearOT(false); onUpdated?.(); }}
          prefill={{
            clienteId: form.clienteId,
            sistemaId: form.sistemaId || undefined,
            contactoId: form.contactoId || undefined,
            presupuestoId,
            presupuestoNumero: form.numero,
            ordenCompra: form.ordenCompraNumero || undefined,
          }}
        />
      )}
      {showCargarOC && (
        <CargarOCModal
          open={showCargarOC}
          presupuesto={{
            id: presupuestoId,
            numero: form.numero,
            clienteId: form.clienteId,
            estado: form.estado,
            origenTipo: form.origenTipo as any,
            origenId: form.origenId,
            responsableNombre: form.responsableNombre,
          } as Presupuesto}
          onClose={() => setShowCargarOC(false)}
          onSuccess={() => {
            setShowCargarOC(false);
            // subscribe en usePresupuestoEdit refresca el form automático; si no,
            // onUpdated fuerza un re-fetch upstream (list / floating).
            onUpdated?.();
            load();
          }}
          ocsExistentes={ocsExistentesOfCliente}
          otrosPresupuestosPendientes={otrosPresupuestosParaOC}
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
