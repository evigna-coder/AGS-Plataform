import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { OTInfoSidebar } from '../../components/ordenes-trabajo/OTInfoSidebar';
import { OTProtocolSection } from '../../components/ordenes-trabajo/OTProtocolSection';
import { OTItemsSection } from '../../components/ordenes-trabajo/OTItemsSection';
import { useOTDetail } from '../../hooks/useOTDetail';

export const OTDetail = () => {
  const { otNumber } = useParams<{ otNumber: string }>();
  const navigate = useNavigate();
  const ot = useOTDetail(otNumber);

  if (ot.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400 text-sm">Cargando orden de trabajo...</p>
      </div>
    );
  }

  const isParent = otNumber && !otNumber.includes('.');

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/ordenes-trabajo')} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">OT-{otNumber}</h1>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              ot.status === 'FINALIZADO'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
            }`}>
              {ot.status === 'FINALIZADO' ? 'Finalizado' : 'Borrador'}
            </span>
            {!ot.readOnly && (
              <select
                value={ot.status}
                onChange={e => ot.handleStatusChange(e.target.value)}
                className="border rounded-lg px-2 py-0.5 text-xs text-slate-600 border-slate-300"
              >
                <option value="BORRADOR">BORRADOR</option>
                <option value="FINALIZADO">FINALIZADO</option>
              </select>
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
          />

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            <OTProtocolSection
              readOnly={ot.readOnly}
              problemaFallaInicial={ot.problemaFallaInicial}
              reporteTecnico={ot.reporteTecnico}
              materialesParaServicio={ot.materialesParaServicio}
              accionesTomar={ot.accionesTomar}
              onFieldChange={ot.handleFieldChange}
            />
            <OTItemsSection
              readOnly={ot.readOnly}
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
          </div>
        </div>
      </div>
    </div>
  );
};
