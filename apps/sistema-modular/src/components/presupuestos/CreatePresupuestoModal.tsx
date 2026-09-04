import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useCreatePresupuestoForm } from '../../hooks/useCreatePresupuestoForm';
import type { OrigenPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { CreatePresupuestoItems } from './CreatePresupuestoItems';
import { PresupuestoItemsTableContrato } from './contrato/PresupuestoItemsTableContrato';
import { totalesPorMonedaDeItems } from '@ags/shared';
import { modulosService } from '../../services/equiposService';
import { SubItemsRow } from './equipos/SubItemsRow';
import { PresupuestoCuotasSection } from './PresupuestoCuotasSection';
import { EsquemaFacturacionSection } from './EsquemaFacturacionSection';
import { CrearLeadModal } from '../leads/CrearLeadModal';
import { PresupuestoFormHeader } from './PresupuestoFormHeader';
import { PresupuestoFormCliente } from './PresupuestoFormCliente';
import { PendientesActivosBanner } from '../pendientes/PendientesActivosBanner';
import { VentasMetadataSection } from './VentasMetadataSection';
import { RichTextEditor } from '../ui/RichTextEditor';
import { NotasTecnicasPlantillas } from './NotasTecnicasPlantillas';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (newId?: string) => void;
  prefill?: {
    clienteId?: string;
    establecimientoId?: string;
    sistemaId?: string;
    moduloId?: string;
    contactoNombre?: string;
    origenTipo?: OrigenPresupuesto;
    origenId?: string;
    origenRef?: string;
  };
}

export const CreatePresupuestoModal: React.FC<Props> = ({ open, onClose, onCreated, prefill }) => {
  const h = useCreatePresupuestoForm(open, onClose, onCreated, prefill);
  // Condiciones comerciales ocultas por default (2026-08-05): vienen de plantillas.
  const [mostrarCondiciones, setMostrarCondiciones] = useState(false);
  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";
  const sym = MONEDA_SIMBOLO[h.form.moneda] || '$';
  const totalItems = h.items.reduce((s, i) => s + (i.subtotal || 0), 0);

  return (
    <>
    <Modal open={open} onClose={h.handleClose} title="Nuevo presupuesto" subtitle="Complete todos los datos del presupuesto" maxWidth="2xl"
      // Footer FIJO del Modal (2026-08-05): "Crear presupuesto" quedaba dentro
      // del scroll y la barra de tareas lo tapaba en monitores chicos.
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-mono text-slate-500">
            {h.items.length > 0 && h.form.moneda === 'MIXTA' ? (
              <span>Items: <strong>{h.items.length}</strong> — {
                Object.entries(h.items.reduce((acc, i) => { const m = i.moneda || 'USD'; acc[m] = (acc[m] || 0) + (i.subtotal || 0); return acc; }, {} as Record<string, number>))
                  .map(([m, t]) => <span key={m}><strong className="text-teal-700">{MONEDA_SIMBOLO[m] || '$'} {t.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>)
                  .reduce((prev, curr, i) => <>{prev}{i > 0 && ' · '}{curr}</> as any)
              }</span>
            ) : h.items.length > 0 ? (
              <span>Items: <strong>{h.items.length}</strong> — Total: <strong className="text-teal-700">{sym} {totalItems.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={h.handleClose}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={h.handleSave} disabled={h.saving || !h.form.clienteId || h.items.length === 0}>
              {h.saving ? 'Creando...' : 'Crear presupuesto'}
            </Button>
          </div>
        </div>
      }>
      {/* form-compacto (2026-08-05): letra/controles/ritmo achicados vía index.css */}
      <div className="form-compacto space-y-4">
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">Datos del presupuesto</p>

        <PresupuestoFormHeader form={h.form} setForm={h.setForm} condiciones={h.condiciones}
          leadOptions={h.leadOptions} otOptions={h.otOptions}
          onShowCrearLead={() => h.setShowCrearLead(true)} />

        <PresupuestoFormCliente form={h.form} setForm={h.setForm}
          clientes={h.clientes} establecimientos={h.establecimientos}
          sistemasFiltrados={h.sistemasFiltrados} contactos={h.contactos} />

        {/* Pendientes activas del cliente */}
        <PendientesActivosBanner
          clienteId={h.form.clienteId || null}
          equipoId={h.form.sistemaId && h.form.sistemaId !== '__ALL_SISTEMAS__' ? h.form.sistemaId : null}
          context="presupuesto"
          selectedIds={h.selectedPendienteIds}
          onSelectionChange={h.setSelectedPendienteIds}
        />

        {h.form.tipo === 'ventas' && (
          <VentasMetadataSection
            value={h.form.ventasMetadata}
            onChange={patch => h.setForm({ ...h.form, ventasMetadata: { ...h.form.ventasMetadata, ...patch } })}
          />
        )}

        {/* Divider + Items */}
        <hr className="border-[#E5E5E5]" />
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">Items del presupuesto</p>

        {h.form.tipo === 'contrato' ? (
          /* Contrato (2026-08-04): misma tabla jerárquica que la edición, con la
             cola de carga por alcance — antes la creación usaba la tabla plana
             y los sistemas solo se podían cargar editando después. */
          <PresupuestoItemsTableContrato
            items={h.items}
            moneda={h.form.moneda}
            monedasMixta={h.form.monedasMixta}
            sistemas={h.sistemasFiltrados}
            loadModulos={(sistemaId) => modulosService.getBySistema(sistemaId)}
            onAddItems={h.addItems}
            onUpdateItem={h.updateItem}
            onRemoveItem={h.removeItem}
            onRemoveSistema={(_sistemaId, grupo) => h.removeItemsByGrupo(grupo)}
            conceptosServicio={h.conceptos}
            categoriasPresupuesto={h.categorias}
            sistemasPlan={h.sistemasPlan}
            onChangeSistemasPlan={h.setSistemasPlan}
          />
        ) : (
          <CreatePresupuestoItems
            items={h.items} onAdd={h.addItem} onRemove={h.removeItem} onUpdate={h.updateItem}
            categoriasPresupuesto={h.categorias} conceptosServicio={h.conceptos} moneda={h.form.moneda}
            sistemas={h.sistemasFiltrados}
            defaultSistemaId={h.form.sistemaId && h.form.sistemaId !== '__ALL_SISTEMAS__' ? h.form.sistemaId : null}
            renderSubRow={h.form.tipo === 'ventas' ? (item, idx) => (
              <SubItemsRow item={item} itemNumero={idx} colSpan={h.form.moneda === 'MIXTA' ? 10 : 9}
                presupuestoId={null} onChangeSubItems={(subs) => h.updateItem(item.id, 'subItems', subs)} />
            ) : undefined} />
        )}

        {/* Cuotas / Esquema de facturación */}
        <hr className="border-[#E5E5E5]" />
        {h.form.tipo === 'contrato' ? (
          /* Contrato: legacy monto-based installment planner (PresupuestoCuota[]) */
          <PresupuestoCuotasSection
            cuotas={h.cuotas}
            onChange={h.setCuotas}
            totalsByCurrency={h.form.moneda === 'MIXTA'
              ? totalesPorMonedaDeItems(h.items, h.form.moneda)
              : { [h.form.moneda]: totalItems }
            }
            moneda={h.form.moneda}
          />
        ) : (
          /* Non-contrato (servicio, per_incident, partes, mixto, ventas):
             Phase 12 porcentual schema editor. Always readOnly=false at create time (always borrador). */
          <EsquemaFacturacionSection
            esquema={h.esquemaFacturacion}
            moneda={h.form.moneda}
            itemsForTotals={h.items}
            readOnly={false}
            onChange={h.setEsquemaFacturacion}
          />
        )}

        {/* Notas complementarias (contrato, 2026-08-05): recuadro en la carátula del PDF */}
        {h.form.tipo === 'contrato' && (
          <div>
            <label className={lbl}>Notas complementarias (carátula del PDF)</label>
            <textarea
              value={h.form.notasComplementarias}
              onChange={e => h.setForm({ ...h.form, notasComplementarias: e.target.value })}
              rows={3}
              placeholder="Texto libre que sale en un recuadro en la carátula, debajo del plan de pagos…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        )}

        {/* Notes — solo notas técnicas a la vista (2026-08-05): las condiciones
            comerciales se editan desde PLANTILLAS y se aplican solas; quedan
            ocultas tras un toggle por si hace falta un retoque puntual. */}
        <hr className="border-[#E5E5E5]" />
        <div>
          <label className={lbl}>Notas tecnicas</label>
          <NotasTecnicasPlantillas
            tipo={h.form.tipo}
            value={h.form.notasTecnicas || ''}
            onChange={html => h.setForm({ ...h.form, notasTecnicas: html })}
          />
          <RichTextEditor value={h.form.notasTecnicas || ''}
            onChange={html => h.setForm({ ...h.form, notasTecnicas: html })}
            placeholder="Observaciones tecnicas..." />
        </div>
        <div>
          <button type="button" onClick={() => setMostrarCondiciones(v => !v)}
            className="text-[10px] font-mono uppercase tracking-wide text-slate-400 hover:text-teal-700">
            {mostrarCondiciones ? '▾' : '▸'} Condiciones comerciales
            <span className="normal-case font-sans text-slate-300"> — se cargan desde plantillas{h.form.condicionesComerciales ? ' · con contenido' : ''}</span>
          </button>
          {mostrarCondiciones && (
            <div className="mt-1">
              <RichTextEditor value={h.form.condicionesComerciales || ''}
                onChange={html => h.setForm({ ...h.form, condicionesComerciales: html })}
                placeholder="Forma de pago, plazos..." />
            </div>
          )}
        </div>
      </div>

    </Modal>

    {h.showCrearLead && (() => {
      const cliente = h.clientes.find(c => c.id === h.form.clienteId);
      const contacto = h.contactos.find(c => c.id === h.form.contactoId);
      return (
        <CrearLeadModal
          onClose={() => h.setShowCrearLead(false)}
          onCreated={async (leadId) => {
            h.setShowCrearLead(false);
            await h.reloadLeads(leadId);
          }}
          prefill={{
            clienteId: h.form.clienteId || undefined,
            razonSocial: cliente?.razonSocial,
            contacto: contacto?.nombre,
            email: contacto?.email,
            telefono: contacto?.telefono,
            sistemaId: h.form.sistemaId && h.form.sistemaId !== '__ALL_SISTEMAS__' ? h.form.sistemaId : undefined,
            moduloId: h.items[0]?.moduloId || undefined,
          }}
        />
      );
    })()}
    </>
  );
};
