import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { OTInfoSidebar } from '../../components/ordenes-trabajo/OTInfoSidebar';
import { OTProtocolSection } from '../../components/ordenes-trabajo/OTProtocolSection';
import { OTItemsSection } from '../../components/ordenes-trabajo/OTItemsSection';
import { OTCierreAdminSection } from '../../components/ordenes-trabajo/OTCierreAdminSection';
import { CrearLeadModal } from '../../components/leads/CrearLeadModal';
import { useOTDetail } from '../../hooks/useOTDetail';
import { OT_ESTADO_LABELS, OT_ESTADO_ORDER } from '@ags/shared';
import type { OTEstadoAdmin } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';

const ESTADO_COLORS: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-600',
  ASIGNADA: 'bg-blue-100 text-blue-700',
  COORDINADA: 'bg-violet-100 text-violet-700',
  EN_CURSO: 'bg-amber-100 text-amber-700',
  CIERRE_TECNICO: 'bg-orange-100 text-orange-700',
  CIERRE_ADMINISTRATIVO: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
};

export const OTDetail = () => {
  const { otNumber } = useParams<{ otNumber: string }>();
  const goBack = useNavigateBack();
  const ot = useOTDetail(otNumber);
  const [showCrearLead, setShowCrearLead] = useState(false);

  if (ot.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400 text-sm">Cargando orden de trabajo...</p>
      </div>
    );
  }

  const isParent = otNumber && !otNumber.includes('.');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">OT-{otNumber}</h1>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLORS[ot.estadoAdmin] ?? 'bg-slate-100 text-slate-600'}`}>
              {OT_ESTADO_LABELS[ot.estadoAdmin] ?? ot.estadoAdmin}
            </span>
            {!ot.readOnly && (
              <select
                value={ot.estadoAdmin}
                onChange={e => ot.handleEstadoAdminChange(e.target.value as OTEstadoAdmin)}
                className="border rounded-lg px-2 py-0.5 text-xs text-slate-600 border-slate-300"
              >
                {OT_ESTADO_ORDER.map(e => (
                  <option key={e} value={e}>{OT_ESTADO_LABELS[e]}</option>
                ))}
              </select>
            )}
            {ot.enCierreAdmin && (
              <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full border border-cyan-200">
                Horas e insumos editables
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {ot.saving && <span className="text-[11px] text-slate-400">Guardando...</span>}
            <Button variant="outline" size="sm" onClick={() => ot.openInReportesOT()}>
              Abrir reporte
            </Button>
            {!ot.readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={ot.handleDelete}
                disabled={ot.saving}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Eliminar
              </Button>
            )}
            {isParent && (
              <Button size="sm" onClick={() => ot.setShowNewItemModal(true)}>
                + Item
              </Button>
            )}
            <Button size="sm" onClick={ot.handleSave} disabled={ot.saving}>
              {ot.saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          {/* Sidebar */}
          <OTInfoSidebar
            readOnly={ot.readOnly}
            readOnlyTecnico={ot.readOnlyTecnico}
            enCierreAdmin={ot.enCierreAdmin}
            clienteId={ot.clienteId}
            clientes={ot.clientes}
            cliente={ot.cliente}
            contacto={ot.contacto}
            contactos={ot.contactos}
            emailPrincipal={ot.emailPrincipal}
            direccion={ot.direccion}
            localidad={ot.localidad}
            provincia={ot.provincia}
            onClienteChange={ot.handleClienteChange}
            onContactoChange={ot.handleContactoChange}
            onFieldChange={ot.handleFieldChange}
            sistemaId={ot.sistemaId}
            sistemasFiltrados={ot.sistemasFiltrados}
            sistema={ot.sistema}
            codigoInternoCliente={ot.codigoInternoCliente}
            moduloId={ot.moduloId}
            modulosFiltrados={ot.modulosFiltrados}
            modulo={ot.modulo}
            moduloModelo={ot.moduloModelo}
            moduloDescripcion={ot.moduloDescripcion}
            moduloSerie={ot.moduloSerie}
            onSistemaChange={ot.handleSistemaChange}
            onModuloChange={ot.handleModuloChange}
            tipoServicio={ot.tipoServicio}
            tiposServicio={ot.tiposServicio}
            fechaInicio={ot.fechaInicio}
            fechaFin={ot.fechaFin}
            horasTrabajadas={ot.horasTrabajadas}
            tiempoViaje={ot.tiempoViaje}
            esFacturable={ot.esFacturable}
            tieneContrato={ot.tieneContrato}
            esGarantia={ot.esGarantia}
            onCheckboxChange={ot.handleCheckboxChange}
            budgets={ot.budgets}
            onAddBudget={ot.addBudget}
            onUpdateBudget={ot.updateBudget}
            onRemoveBudget={ot.removeBudget}
            ordenCompra={ot.ordenCompra}
            fechaServicioAprox={ot.fechaServicioAprox}
            ingenieroAsignadoId={ot.ingenieroAsignadoId}
            ingenieroAsignadoNombre={ot.ingenieroAsignadoNombre}
            ingenieros={ot.ingenieros}
            onIngenieroChange={ot.handleIngenieroChange}
            estadoAdmin={ot.estadoAdmin}
            estadoAdminFecha={ot.estadoAdminFecha}
            estadoHistorial={ot.estadoHistorial}
            leadId={ot.leadId}
            presupuestoOrigenId={ot.presupuestoOrigenId}
            presupuestoOrigenNumero={ot.presupuestoOrigenNumero}
            onCreateLeadFromOT={() => setShowCrearLead(true)}
            creatingLead={false}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            <OTProtocolSection
              readOnly={ot.readOnlyTecnico}
              problemaFallaInicial={ot.problemaFallaInicial}
              reporteTecnico={ot.reporteTecnico}
              materialesParaServicio={ot.materialesParaServicio}
              accionesTomar={ot.accionesTomar}
              onFieldChange={ot.handleFieldChange}
            />
            <OTItemsSection
              readOnly={ot.readOnly && !ot.enCierreAdmin}
              otNumber={otNumber}
              articulos={ot.articulos}
              onAddPart={ot.addPart}
              onUpdatePart={ot.updatePart}
              onRemovePart={ot.removePart}
              items={ot.items}
              showNewItemModal={ot.showNewItemModal}
              setShowNewItemModal={ot.setShowNewItemModal}
              newItemData={ot.newItemData}
              setNewItemData={ot.setNewItemData}
              tiposServicio={ot.tiposServicio}
              cliente={ot.cliente}
              onCreateNewItem={ot.handleCreateNewItem}
            />
            {(ot.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || ot.estadoAdmin === 'FINALIZADO') && (
              <OTCierreAdminSection
                cierreAdmin={ot.cierreAdmin}
                onChange={ot.handleCierreChange}
                onConfirmarCierre={ot.handleConfirmarCierre}
                onReabrirOT={ot.handleReabrirOT}
                horasTrabajadas={ot.horasTrabajadas}
                tiempoViaje={ot.tiempoViaje}
                articulos={ot.articulos}
                readOnly={ot.estadoAdmin === 'FINALIZADO'}
                estadoAdmin={ot.estadoAdmin}
                razonSocial={ot.cliente?.razonSocial}
                tipoServicio={ot.tipoServicio}
                ingenieroNombre={ot.ingenieroAsignadoNombre}
                otNumber={otNumber}
                budgets={ot.budgets}
                clienteId={ot.clienteId}
                clienteNombre={ot.cliente?.razonSocial}
              />
            )}
          </div>
        </div>
      </div>
      {showCrearLead && (
        <CrearLeadModal
          onClose={() => setShowCrearLead(false)}
          onCreated={async (leadId) => {
            setShowCrearLead(false);
            if (leadId) {
              ot.handleFieldChange('leadId', leadId);
            }
          }}
          prefill={{
            clienteId: ot.clienteId || undefined,
            razonSocial: ot.cliente?.razonSocial,
            contacto: ot.contacto || undefined,
            email: ot.emailPrincipal || undefined,
            sistemaId: ot.sistemaId || undefined,
            moduloId: ot.moduloId || undefined,
            motivoContacto: ot.problemaFallaInicial || undefined,
          }}
        />
      )}
    </div>
  );
};
