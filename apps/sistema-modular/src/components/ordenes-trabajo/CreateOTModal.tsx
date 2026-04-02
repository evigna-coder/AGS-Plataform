import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CrearLeadModal } from '../leads/CrearLeadModal';
import { useCreateOTForm } from '../../hooks/useCreateOTForm';
import { MONEDA_PRESUPUESTO_LABELS, TIPO_LIMITE_CONTRATO_LABELS } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';
const selectClass = 'w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400';

export const CreateOTModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const h = useCreateOTForm(open, onClose, onCreated);

  const selectedContrato = h.contratosCliente.find(c => c.id === h.form.contratoId);

  return (
    <>
    <Modal open={open} onClose={h.handleClose} maxWidth="lg" title="Nueva orden de trabajo"
      subtitle="El numero de OT se asigna automaticamente al confirmar"
      footer={<>
        <Button variant="outline" size="sm" onClick={h.handleClose}>Cancelar</Button>
        <Button size="sm" onClick={h.handleSave} disabled={h.saving}>
          {h.saving ? 'Creando...' : 'Crear OT'}
        </Button>
      </>}>

      <div className="space-y-3">
        {h.loadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {h.loadError}
            <button onClick={() => window.location.reload()} className="ml-2 underline">Recargar</button>
          </div>
        )}

        {/* Tipo de Servicio */}
        <div>
          <label className={lbl}>Tipo de servicio *</label>
          <SearchableSelect value={h.form.tipoServicioId}
            onChange={v => h.set('tipoServicioId', v)}
            options={h.tiposServicio.map(t => ({ value: t.id, label: t.nombre }))}
            placeholder="Seleccionar tipo..." />
        </div>

        {/* Cliente */}
        <div>
          <label className={lbl}>Cliente *</label>
          <SearchableSelect value={h.form.clienteId}
            onChange={v => h.set('clienteId', v)}
            options={h.clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
            placeholder="Seleccionar cliente..." />
        </div>

        {/* Contrato (visible when client has active contracts) */}
        {h.contratosCliente.length > 0 && (
          <div>
            <label className={lbl}>Contrato de servicio</label>
            <SearchableSelect value={h.form.contratoId}
              onChange={v => h.set('contratoId', v)}
              options={[
                { value: '', label: 'Sin contrato (per incident)' },
                ...h.contratosCliente.map(c => ({
                  value: c.id,
                  label: `${c.numero} — ${TIPO_LIMITE_CONTRATO_LABELS[c.tipoLimite]}${c.maxVisitas ? ` (${c.visitasUsadas}/${c.maxVisitas})` : ''}`,
                })),
              ]}
              placeholder="Seleccionar contrato..." />
            {selectedContrato && (
              <div className="mt-1 flex items-center gap-2 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                  {selectedContrato.tipoLimite === 'visitas' && selectedContrato.maxVisitas
                    ? `${selectedContrato.maxVisitas - selectedContrato.visitasUsadas} visitas restantes`
                    : 'Ilimitado'}
                </span>
                <span className="text-slate-400">
                  Vigencia: {selectedContrato.fechaInicio} — {selectedContrato.fechaFin}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Establecimiento */}
        <div>
          <label className={lbl}>Establecimiento</label>
          <SearchableSelect value={h.form.establecimientoId}
            onChange={v => h.set('establecimientoId', v)}
            options={[
              { value: '', label: 'Todos los establecimientos' },
              ...h.establecimientosFiltrados.map(e => ({
                value: e.id,
                label: `${e.nombre}${e.localidad ? ` — ${e.localidad}` : ''}`,
              })),
            ]}
            placeholder={h.form.clienteId ? 'Seleccionar establecimiento...' : 'Seleccione cliente primero'}
            disabled={!h.form.clienteId} />
        </div>

        {/* Sistema + Módulo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Sistema / Equipo</label>
            <SearchableSelect value={h.form.sistemaId}
              onChange={v => h.set('sistemaId', v)}
              options={[
                { value: '', label: 'Sin sistema' },
                ...h.sistemasFiltrados.map(s => ({
                  value: s.id,
                  label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}`,
                })),
              ]}
              placeholder={h.form.clienteId ? 'Seleccionar...' : 'Seleccione cliente primero'} />
          </div>
          <div>
            <label className={lbl}>Modulo</label>
            <SearchableSelect value={h.form.moduloId}
              onChange={v => h.set('moduloId', v)}
              options={[
                { value: '', label: h.modulos.length === 0 ? 'Sin modulos' : 'Sistema completo' },
                ...h.modulos.map(m => ({
                  value: m.id,
                  label: `${m.nombre}${m.descripcion ? ` — ${m.descripcion}` : ''}${m.serie ? ` (${m.serie})` : ''}`,
                })),
              ]}
              placeholder={h.form.sistemaId ? 'Seleccionar...' : 'Seleccione sistema primero'}
              disabled={!h.form.sistemaId || h.modulos.length === 0} />
          </div>
        </div>

        {/* Contacto + Ingeniero */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Contacto</label>
            <SearchableSelect value={h.form.contactoId}
              onChange={v => h.set('contactoId', v)}
              options={[
                { value: '', label: 'Sin contacto' },
                ...h.contactos.map(c => ({
                  value: c.id,
                  label: `${c.nombre}${c.cargo ? ` — ${c.cargo}` : ''}`,
                })),
              ]}
              placeholder="Seleccionar contacto..."
              disabled={h.contactos.length === 0} />
          </div>
          <div>
            <label className={lbl}>Ingeniero asignado</label>
            <SearchableSelect value={h.form.ingenieroId}
              onChange={v => h.set('ingenieroId', v)}
              options={[
                { value: '', label: 'Sin asignar' },
                ...h.ingenieros.map(u => ({ value: u.id, label: u.nombre })),
              ]}
              placeholder="Seleccionar ingeniero..." />
          </div>
        </div>

        {/* Presupuesto + OC + Fecha servicio */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>
              Presupuesto {h.presupuestoRequerido ? <span className="text-red-500">*</span> : <span className="text-slate-300">(opcional)</span>}
            </label>
            <SearchableSelect value={h.form.presupuestoId}
              onChange={h.handlePresupuestoChange}
              options={[
                { value: '', label: 'Sin presupuesto' },
                ...h.presupuestosCliente.map(p => ({
                  value: p.id,
                  label: `${p.numero} — ${MONEDA_PRESUPUESTO_LABELS[p.moneda]} $${p.total?.toLocaleString('es-AR') ?? '0'}`,
                })),
              ]}
              placeholder={h.form.clienteId ? 'Seleccionar...' : 'Seleccione cliente primero'}
              disabled={!h.form.clienteId} />
          </div>
          <div>
            <label className={lbl}>Orden de compra</label>
            <Input value={h.form.ordenCompra} onChange={e => h.set('ordenCompra', e.target.value)}
              inputSize="sm" placeholder="OC cliente" />
          </div>
          <div>
            <label className={lbl}>Fecha aprox. servicio</label>
            <input type="date" value={h.form.fechaServicioAprox}
              onChange={e => h.set('fechaServicioAprox', e.target.value)}
              className={selectClass} />
          </div>
        </div>

        {/* Lead link */}
        <div className="flex items-center gap-2">
          <label className={lbl}>Lead vinculado</label>
          {h.form.leadId ? (
            <span className="text-[11px] text-teal-600 font-medium">{h.form.leadId}</span>
          ) : (
            <button type="button" onClick={() => h.setShowCrearLead(true)}
              className="px-2 py-1 text-[11px] font-medium text-teal-600 border border-teal-300 rounded-md hover:bg-teal-50">
              + Crear Lead
            </button>
          )}
        </div>

        {/* Falla inicial */}
        <div>
          <label className={lbl}>Problema / Falla inicial</label>
          <textarea value={h.form.problemaFallaInicial}
            onChange={e => h.set('problemaFallaInicial', e.target.value)}
            rows={2} placeholder="Descripcion del problema o motivo de la OT..."
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
        </div>

        {/* Materiales + Comentario facturación */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Materiales para servicio</label>
            <textarea value={h.form.materialesParaServicio}
              onChange={e => h.set('materialesParaServicio', e.target.value)}
              rows={2} placeholder="Materiales necesarios..."
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
          </div>
          <div>
            <label className={lbl}>Comentario para facturacion</label>
            <textarea value={h.form.comentarioFacturacion}
              onChange={e => h.set('comentarioFacturacion', e.target.value)}
              rows={2} placeholder="Notas para el area de facturacion..."
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
          </div>
        </div>
      </div>
    </Modal>

    {h.showCrearLead && (
      <CrearLeadModal
        onClose={() => h.setShowCrearLead(false)}
        onCreated={async (leadId) => {
          h.setShowCrearLead(false);
          if (leadId) h.set('leadId', leadId);
        }}
      />
    )}
    </>
  );
};
