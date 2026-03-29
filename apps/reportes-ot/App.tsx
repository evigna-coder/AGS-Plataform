import React from 'react';
import { useAppLogic, CATALOG_SERVICE_TYPES } from './hooks/useAppLogic';
import { CompanyHeader } from './components/CompanyHeader';
import { MobileSignatureView } from './components/MobileSignatureView';
import { OTFormSection } from './components/OTFormSection';
import { SidebarPanel } from './components/SidebarPanel';
import { ServiceReportSection } from './components/ServiceReportSection';
import { SignaturesSection } from './components/SignaturesSection';
import { ObservationsBillingSection } from './components/ObservationsBillingSection';
import { AdjuntosSection } from './components/AdjuntosSection';
import { ProtocolSection } from './components/ProtocolSection';
import { PdfHiddenContainers } from './components/PdfHiddenContainers';
import { PreviewSection } from './components/PreviewSection';
import { DuplicateOTModal } from './components/DuplicateOTModal';
import { MobileMenu } from './components/MobileMenu';
import { AppModals } from './components/AppModals';
import { WizardLayout, WizardStep } from './components/WizardLayout';
import { useIsMobile } from './hooks/useIsMobile';
import { incrementSuffix } from './services/utils';
import { getProtocolTemplateForServiceType } from './utils/protocolSelector';
import { createEmptyProtocolDataForTemplate } from './data/sampleProtocol';
import { signOut } from './services/authService';
import { Part } from './types';

const App: React.FC = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const isModoFirma = queryParams.get('modo') === 'firma';
  const reportIdFromUrl = queryParams.get('reportId');
  const shouldShare = queryParams.get('share') === 'true';

  const app = useAppLogic(reportIdFromUrl, isModoFirma, shouldShare);

  // Mobile signature mode
  if (isModoFirma) {
    return (
      <MobileSignatureView
        ot={reportIdFromUrl || app.otNumber}
        razonSocial={app.razonSocial}
        firebase={app.firebase}
        shareReportPDF={app.shareReportPDF}
        isSharing={app.isSharing}
        showAlert={app.modal.showAlert}
      />
    );
  }

  const fullDireccion = app.fullDireccion;

  const handleTipoServicioChange = (newServiceType: string) => {
    app.setTipoServicio(newServiceType);
    app.setProtocolSelections([]);
    const template = getProtocolTemplateForServiceType(newServiceType);
    if (template) {
      app.setProtocolTemplateId(template.id);
      app.setProtocolData(createEmptyProtocolDataForTemplate(template));
    } else {
      app.setProtocolTemplateId(null);
      app.setProtocolData(null);
    }
  };

  const isMobile = useIsMobile();

  // ─── MOBILE WIZARD ──────────────────────────────────────────────────────────
  if (isMobile && !app.isPreviewMode) {
    const stepIcon = (d: string) => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    );

    const hasProtocolContent = !!(app.protocolTemplate || app.protocolSelections.length > 0 || CATALOG_SERVICE_TYPES.has(app.tipoServicio));

    const wizardSteps: WizardStep[] = [
      {
        key: 'datos',
        label: 'Datos del servicio',
        icon: stepIcon('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
        content: (
          <div className="space-y-4">
            <CompanyHeader
              companyName="AGS ANALITICA S.A."
              address="Arenales 605 – Piso 15, B1638BRG Buenos Aires - Argentina"
              phone="011 4524 7247" whatsapp="54.911 5693.4883"
              email="info@agsanalitica.com" web="www.agsanalitica.com"
            />
            <OTFormSection
              otInput={app.otInput} setOtInput={app.setOtInput}
              readOnlyByStatus={app.readOnlyByStatus} readOnly={app.readOnly}
              confirmLoadOt={app.confirmLoadOt} baseInputClass={app.baseInputClass}
              razonSocial={app.razonSocial} setRazonSocial={app.setRazonSocial}
              contacto={app.contacto} setContacto={app.setContacto}
              emailPrincipal={app.emailPrincipal} setEmailPrincipal={app.setEmailPrincipal}
              direccion={app.direccion} setDireccion={app.setDireccion}
              localidad={app.localidad} setLocalidad={app.setLocalidad}
              provincia={app.provincia} setProvincia={app.setProvincia}
              sistema={app.sistema} setSistema={app.setSistema}
              codigoInternoCliente={app.codigoInternoCliente} setCodigoInternoCliente={app.setCodigoInternoCliente}
              moduloModelo={app.moduloModelo} setModuloModelo={app.setModuloModelo}
              moduloMarca={app.moduloMarca} setModuloMarca={app.setModuloMarca}
              moduloDescripcion={app.moduloDescripcion} setModuloDescripcion={app.setModuloDescripcion}
              moduloSerie={app.moduloSerie} setModuloSerie={app.setModuloSerie}
              fechaInicio={app.fechaInicio} setFechaInicio={app.setFechaInicio}
              fechaFin={app.fechaFin} setFechaFin={app.setFechaFin}
              fechaInicioDisplay={app.fechaInicioDisplay} setFechaInicioDisplay={app.setFechaInicioDisplay}
              fechaFinDisplay={app.fechaFinDisplay} setFechaFinDisplay={app.setFechaFinDisplay}
              horaInicio={app.horaInicio} setHoraInicio={app.setHoraInicio}
              horaFin={app.horaFin} setHoraFin={app.setHoraFin}
              horasTrabajadas={app.horasTrabajadas} setHorasTrabajadas={app.setHorasTrabajadas}
              tiempoViaje={app.tiempoViaje} setTiempoViaje={app.setTiempoViaje}
              manualHoras={app.manualHoras} setManualHoras={app.setManualHoras}
              entitySelectors={app.entitySelectors}
              markUserInteracted={app.markUserInteracted}
            />
            <SidebarPanel
              readOnly={app.readOnly}
              otNumber={app.otNumber}
              totalHs={app.totalHs}
              onGenerateQR={app.handleGenerateRemoteSign}
            />
          </div>
        ),
      },
      {
        key: 'reporte',
        label: 'Reporte técnico',
        icon: stepIcon('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'),
        content: (
          <ServiceReportSection
            readOnly={app.readOnly}
            tipoServicio={app.tipoServicio}
            onTipoServicioChange={handleTipoServicioChange}
            reporteTecnico={app.reporteTecnico} setReporteTecnico={app.setReporteTecnico}
            loadingAI={app.loadingAI} onOptimizeReport={app.handleOptimizeReport}
            articulos={app.articulos}
            onAddPart={app.addPart}
            onUpdatePart={app.updatePart}
            onRemovePart={app.removePart}
          />
        ),
      },
      ...(hasProtocolContent ? [{
        key: 'protocolos',
        label: 'Protocolos',
        icon: stepIcon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'),
        content: (
          <ProtocolSection
            isPreviewMode={app.isPreviewMode} readOnly={app.readOnly}
            firebase={app.firebase} sistema={app.sistema}
            tipoServicio={app.tipoServicio} catalogServiceTypes={CATALOG_SERVICE_TYPES}
            protocolTemplate={app.protocolTemplate}
            protocolData={app.protocolData} setProtocolData={app.setProtocolData}
            protocolSelections={app.protocolSelections} setProtocolSelections={app.setProtocolSelections}
            suggestedTables={app.suggestedTables} setSuggestedTables={app.setSuggestedTables}
            handleCatalogCellChange={app.handleCatalogCellChange}
            handleCatalogObservaciones={app.handleCatalogObservaciones}
            handleCatalogResultado={app.handleCatalogResultado}
            handleCatalogToggleClientSpec={app.handleCatalogToggleClientSpec}
            handleRemoveCatalogTable={app.handleRemoveCatalogTable}
            handleAddRow={app.handleAddRow} handleRemoveRow={app.handleRemoveRow}
            handleHeaderDataChange={app.handleHeaderDataChange}
            handleChecklistAnswer={app.handleChecklistAnswer}
            handleToggleChecklistSection={app.handleToggleChecklistSection}
            signatureClient={app.signatureClient} signatureEngineer={app.signatureEngineer}
            aclaracionCliente={app.aclaracionCliente} aclaracionEspecialista={app.aclaracionEspecialista}
            fechaInicio={app.fechaInicio} fechaFin={app.fechaFin}
            instrumentosSeleccionados={app.instrumentosSeleccionados}
            setInstrumentosSeleccionados={app.setInstrumentosSeleccionados}
            markUserInteracted={app.markUserInteracted}
          />
        ),
      }] : []),
      {
        key: 'observaciones',
        label: 'Observaciones y adjuntos',
        icon: stepIcon('M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z'),
        content: (
          <div className="space-y-6">
            <ObservationsBillingSection
              readOnly={app.readOnly}
              accionesTomar={app.accionesTomar} setAccionesTomar={app.setAccionesTomar}
              budgets={app.budgets}
              onAddBudget={app.addBudget} onUpdateBudget={app.updateBudget} onRemoveBudget={app.removeBudget}
              esFacturable={app.esFacturable} setEsFacturable={app.setEsFacturable}
              tieneContrato={app.tieneContrato} setTieneContrato={app.setTieneContrato}
              esGarantia={app.esGarantia} setEsGarantia={app.setEsGarantia}
            />
            <AdjuntosSection
              firebase={app.firebase} otNumber={app.otNumber}
              adjuntos={app.adjuntos} setAdjuntos={app.setAdjuntos}
              readOnly={app.readOnly}
            />
          </div>
        ),
      },
      {
        key: 'firmas',
        label: 'Firmas',
        icon: stepIcon('M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'),
        content: (
          <SignaturesSection
            readOnly={app.readOnly}
            signatureClient={app.signatureClient} setSignatureClient={app.setSignatureClient}
            signatureEngineer={app.signatureEngineer} setSignatureEngineer={app.setSignatureEngineer}
            aclaracionCliente={app.aclaracionCliente} setAclaracionCliente={app.setAclaracionCliente}
            aclaracionEspecialista={app.aclaracionEspecialista} setAclaracionEspecialista={app.setAclaracionEspecialista}
            clientPadRef={app.clientPadRef} engineerPadRef={app.engineerPadRef}
            isGenerating={app.isGenerating}
            onConfirmClientAndFinalize={app.confirmClientAndFinalize}
          />
        ),
      },
      {
        key: 'envio',
        label: 'Vista previa y envío',
        icon: stepIcon('M12 19l9 2-9-18-9 18 9-2zm0 0v-8'),
        content: (
          <div className="space-y-4">
            {/* Compact summary card */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">OT</span><span className="font-semibold text-slate-800">{app.otNumber || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cliente</span><span className="font-semibold text-slate-800 text-right max-w-[60%] truncate">{app.razonSocial || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sistema</span><span className="font-semibold text-slate-800 text-right max-w-[60%] truncate">{app.sistema || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tipo</span><span className="font-semibold text-slate-800">{app.tipoServicio || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Protocolos</span><span className="font-semibold text-slate-800">{app.protocolSelections.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Firmas</span>
                <span className="font-semibold">
                  {app.signatureEngineer ? <span className="text-emerald-600">Ingeniero OK</span> : <span className="text-amber-500">Falta ingeniero</span>}
                  {' / '}
                  {app.signatureClient ? <span className="text-emerald-600">Cliente OK</span> : <span className="text-amber-500">Falta cliente</span>}
                </span>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              {app.status === 'FINALIZADO' && app.generatedPdfBlob ? (
                <>
                  <button onClick={() => app.shareReportPDF()} disabled={app.isSharing}
                    className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm active:bg-purple-700 disabled:opacity-50">
                    {app.isSharing ? 'Compartiendo...' : 'Compartir / Enviar PDF'}
                  </button>
                  <button onClick={() => app.downloadPDF()}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700">
                    Descargar PDF
                  </button>
                </>
              ) : app.status === 'FINALIZADO' ? (
                <button onClick={app.handleFinalSubmit} disabled={app.isGenerating}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm active:bg-emerald-700 disabled:opacity-50">
                  {app.isGenerating ? 'Generando PDF...' : 'Generar PDF'}
                </button>
              ) : (
                <button onClick={app.handleReview}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700">
                  Revisar y continuar
                </button>
              )}
              <button onClick={app.newReport}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm active:bg-slate-200">
                Nuevo reporte
              </button>
              <button onClick={() => app.setShowDuplicateModal(true)}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm active:bg-slate-200">
                Duplicar OT
              </button>
              <button onClick={signOut}
                className="w-full py-2.5 rounded-xl text-slate-400 text-sm font-medium">
                Cerrar sesión
              </button>
            </div>
          </div>
        ),
      },
    ];

    return (
      <WizardLayout
        steps={wizardSteps}
        extra={
          <>
            <PdfHiddenContainers
              protocolSelections={app.protocolSelections}
              instrumentosSeleccionados={app.instrumentosSeleccionados}
              adjuntos={app.adjuntos}
              signatureClient={app.signatureClient} signatureEngineer={app.signatureEngineer}
              aclaracionCliente={app.aclaracionCliente} aclaracionEspecialista={app.aclaracionEspecialista}
              fechaInicio={app.fechaInicio} fechaFin={app.fechaFin}
            />
            <DuplicateOTModal
              isOpen={app.showDuplicateModal}
              onClose={() => app.setShowDuplicateModal(false)}
              otNumber={app.otNumber}
              incrementSuffix={incrementSuffix}
              firebase={app.firebase}
              onDuplicate={app.duplicateOt}
            />
            <AppModals
              showShareModal={app.showShareModal} setShowShareModal={app.setShowShareModal}
              shareUrl={app.shareUrl} otNumber={app.otNumber}
              showQRModal={app.showQRModal} setShowQRModal={app.setShowQRModal}
              qrRef={app.qrRef}
              showNewOtModal={app.showNewOtModal} setShowNewOtModal={app.setShowNewOtModal}
              pendingOt={app.pendingOt} setPendingOt={app.setPendingOt}
              setOtInput={app.setOtInput}
              confirmCreateNewOt={app.confirmCreateNewOt}
              modal={app.modal}
            />
          </>
        }
      />
    );
  }

  return (
    <div id="report-container" className={`max-w-5xl mx-auto bg-white transition-all duration-300 pb-32 ${app.isPreviewMode ? 'p-0 min-h-screen shadow-none' : 'px-4 md:px-8 pt-2 md:pt-4 pb-4 md:pb-8 my-0 md:my-8 min-h-screen shadow-xl border border-slate-100'} print:p-0 print:m-0 print:shadow-none print:min-h-0 print:bg-white`}>

      {!app.isPreviewMode && (
        <>
          <CompanyHeader
            companyName="AGS ANALITICA S.A."
            address="Arenales 605 – Piso 15, B1638BRG Buenos Aires - Argentina"
            phone="011 4524 7247"
            whatsapp="54.911 5693.4883"
            email="info@agsanalitica.com"
            web="www.agsanalitica.com"
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 no-print mt-4 relative z-10">
            <OTFormSection
              otInput={app.otInput} setOtInput={app.setOtInput}
              readOnlyByStatus={app.readOnlyByStatus} readOnly={app.readOnly}
              confirmLoadOt={app.confirmLoadOt} baseInputClass={app.baseInputClass}
              razonSocial={app.razonSocial} setRazonSocial={app.setRazonSocial}
              contacto={app.contacto} setContacto={app.setContacto}
              emailPrincipal={app.emailPrincipal} setEmailPrincipal={app.setEmailPrincipal}
              direccion={app.direccion} setDireccion={app.setDireccion}
              localidad={app.localidad} setLocalidad={app.setLocalidad}
              provincia={app.provincia} setProvincia={app.setProvincia}
              sistema={app.sistema} setSistema={app.setSistema}
              codigoInternoCliente={app.codigoInternoCliente} setCodigoInternoCliente={app.setCodigoInternoCliente}
              moduloModelo={app.moduloModelo} setModuloModelo={app.setModuloModelo}
              moduloMarca={app.moduloMarca} setModuloMarca={app.setModuloMarca}
              moduloDescripcion={app.moduloDescripcion} setModuloDescripcion={app.setModuloDescripcion}
              moduloSerie={app.moduloSerie} setModuloSerie={app.setModuloSerie}
              fechaInicio={app.fechaInicio} setFechaInicio={app.setFechaInicio}
              fechaFin={app.fechaFin} setFechaFin={app.setFechaFin}
              fechaInicioDisplay={app.fechaInicioDisplay} setFechaInicioDisplay={app.setFechaInicioDisplay}
              fechaFinDisplay={app.fechaFinDisplay} setFechaFinDisplay={app.setFechaFinDisplay}
              horaInicio={app.horaInicio} setHoraInicio={app.setHoraInicio}
              horaFin={app.horaFin} setHoraFin={app.setHoraFin}
              horasTrabajadas={app.horasTrabajadas} setHorasTrabajadas={app.setHorasTrabajadas}
              tiempoViaje={app.tiempoViaje} setTiempoViaje={app.setTiempoViaje}
              manualHoras={app.manualHoras} setManualHoras={app.setManualHoras}
              entitySelectors={app.entitySelectors}
              markUserInteracted={app.markUserInteracted}
            />
            <SidebarPanel
              readOnly={app.readOnly}
              otNumber={app.otNumber}
              totalHs={app.totalHs}
              onGenerateQR={app.handleGenerateRemoteSign}
            />
          </div>

          <ServiceReportSection
            readOnly={app.readOnly}
            tipoServicio={app.tipoServicio}
            onTipoServicioChange={handleTipoServicioChange}
            reporteTecnico={app.reporteTecnico} setReporteTecnico={app.setReporteTecnico}
            loadingAI={app.loadingAI} onOptimizeReport={app.handleOptimizeReport}
            articulos={app.articulos}
            onAddPart={app.addPart}
            onUpdatePart={app.updatePart}
            onRemovePart={app.removePart}
          />

          <SignaturesSection
            readOnly={app.readOnly}
            signatureClient={app.signatureClient} setSignatureClient={app.setSignatureClient}
            signatureEngineer={app.signatureEngineer} setSignatureEngineer={app.setSignatureEngineer}
            aclaracionCliente={app.aclaracionCliente} setAclaracionCliente={app.setAclaracionCliente}
            aclaracionEspecialista={app.aclaracionEspecialista} setAclaracionEspecialista={app.setAclaracionEspecialista}
            clientPadRef={app.clientPadRef} engineerPadRef={app.engineerPadRef}
            isGenerating={app.isGenerating}
            onConfirmClientAndFinalize={app.confirmClientAndFinalize}
          />

          <ObservationsBillingSection
            readOnly={app.readOnly}
            accionesTomar={app.accionesTomar} setAccionesTomar={app.setAccionesTomar}
            budgets={app.budgets}
            onAddBudget={app.addBudget} onUpdateBudget={app.updateBudget} onRemoveBudget={app.removeBudget}
            esFacturable={app.esFacturable} setEsFacturable={app.setEsFacturable}
            tieneContrato={app.tieneContrato} setTieneContrato={app.setTieneContrato}
            esGarantia={app.esGarantia} setEsGarantia={app.setEsGarantia}
          />
        </>
      )}

      {/* Fotos y Adjuntos */}
      <section className="no-print max-w-5xl mx-auto px-2 mb-6 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-slate-700">Fotos y adjuntos</span>
        </div>
        <AdjuntosSection
          firebase={app.firebase} otNumber={app.otNumber}
          adjuntos={app.adjuntos} setAdjuntos={app.setAdjuntos}
          readOnly={app.readOnly}
        />
      </section>

      {/* Protocol Section */}
      <ProtocolSection
        isPreviewMode={app.isPreviewMode} readOnly={app.readOnly}
        firebase={app.firebase} sistema={app.sistema}
        tipoServicio={app.tipoServicio} catalogServiceTypes={CATALOG_SERVICE_TYPES}
        protocolTemplate={app.protocolTemplate}
        protocolData={app.protocolData} setProtocolData={app.setProtocolData}
        protocolSelections={app.protocolSelections} setProtocolSelections={app.setProtocolSelections}
        suggestedTables={app.suggestedTables} setSuggestedTables={app.setSuggestedTables}
        handleCatalogCellChange={app.handleCatalogCellChange}
        handleCatalogObservaciones={app.handleCatalogObservaciones}
        handleCatalogResultado={app.handleCatalogResultado}
        handleCatalogToggleClientSpec={app.handleCatalogToggleClientSpec}
        handleRemoveCatalogTable={app.handleRemoveCatalogTable}
        handleAddRow={app.handleAddRow} handleRemoveRow={app.handleRemoveRow}
        handleHeaderDataChange={app.handleHeaderDataChange}
        handleChecklistAnswer={app.handleChecklistAnswer}
        handleToggleChecklistSection={app.handleToggleChecklistSection}
        signatureClient={app.signatureClient} signatureEngineer={app.signatureEngineer}
        aclaracionCliente={app.aclaracionCliente} aclaracionEspecialista={app.aclaracionEspecialista}
        fechaInicio={app.fechaInicio} fechaFin={app.fechaFin}
        instrumentosSeleccionados={app.instrumentosSeleccionados}
        setInstrumentosSeleccionados={app.setInstrumentosSeleccionados}
        markUserInteracted={app.markUserInteracted}
      />

      {/* Hidden PDF containers */}
      <PdfHiddenContainers
        protocolSelections={app.protocolSelections}
        instrumentosSeleccionados={app.instrumentosSeleccionados}
        adjuntos={app.adjuntos}
        signatureClient={app.signatureClient} signatureEngineer={app.signatureEngineer}
        aclaracionCliente={app.aclaracionCliente} aclaracionEspecialista={app.aclaracionEspecialista}
        fechaInicio={app.fechaInicio} fechaFin={app.fechaFin}
      />

      {/* Preview Mode */}
      {app.isPreviewMode && (
        <>
          <PreviewSection
            otNumber={app.otNumber} razonSocial={app.razonSocial}
            contacto={app.contacto} fullDireccion={fullDireccion}
            sistema={app.sistema} codigoInternoCliente={app.codigoInternoCliente}
            moduloModelo={app.moduloModelo} moduloDescripcion={app.moduloDescripcion} moduloMarca={app.moduloMarca} moduloSerie={app.moduloSerie}
            fechaInicio={app.fechaInicio} fechaFin={app.fechaFin}
            horaInicio={app.horaInicio} horaFin={app.horaFin}
            horasTrabajadas={app.horasTrabajadas} tiempoViaje={app.tiempoViaje}
            tipoServicio={app.tipoServicio} reporteTecnico={app.reporteTecnico}
            articulos={app.articulos} accionesTomar={app.accionesTomar}
            budgets={app.budgets}
            esFacturable={app.esFacturable} tieneContrato={app.tieneContrato} esGarantia={app.esGarantia}
            signatureClient={app.signatureClient} signatureEngineer={app.signatureEngineer}
            aclaracionCliente={app.aclaracionCliente} aclaracionEspecialista={app.aclaracionEspecialista}
            protocolSelections={app.protocolSelections}
            instrumentosSeleccionados={app.instrumentosSeleccionados}
            allPublishedTables={app.allPublishedTables} allProjects={app.allProjects}
            adjuntos={app.adjuntos} firebase={app.firebase}
            setIsPreviewMode={app.setIsPreviewMode}
          />
{/* Botón "Volver a Editar" ahora está integrado en MobileMenu */}
        </>
      )}

      {/* Floating Buttons */}
      <MobileMenu
        isPreviewMode={app.isPreviewMode} status={app.status}
        isGenerating={app.isGenerating} isSharing={app.isSharing}
        hasPdfBlob={!!app.generatedPdfBlob}
        hasSignatures={!!(app.signatureEngineer || app.engineerPadRef.current?.getSignature()) && !!(app.signatureClient || app.clientPadRef.current?.getSignature())}
        onNewReport={app.newReport}
        onDuplicateOT={() => app.setShowDuplicateModal(true)}
        onReview={app.handleReview}
        onFinalSubmit={app.handleFinalSubmit}
        onSharePDF={app.shareReportPDF}
        onDownloadPDF={app.downloadPDF}
        onSignOut={signOut}
        onBackToEdit={app.isPreviewMode ? () => app.setIsPreviewMode(false) : undefined}
      />

      {/* Modals */}
      <DuplicateOTModal
        isOpen={app.showDuplicateModal}
        onClose={() => app.setShowDuplicateModal(false)}
        otNumber={app.otNumber}
        incrementSuffix={incrementSuffix}
        firebase={app.firebase}
        onDuplicate={app.duplicateOt}
      />

      <AppModals
        showShareModal={app.showShareModal} setShowShareModal={app.setShowShareModal}
        shareUrl={app.shareUrl} otNumber={app.otNumber}
        showQRModal={app.showQRModal} setShowQRModal={app.setShowQRModal}
        qrRef={app.qrRef}
        showNewOtModal={app.showNewOtModal} setShowNewOtModal={app.setShowNewOtModal}
        pendingOt={app.pendingOt} setPendingOt={app.setPendingOt}
        setOtInput={app.setOtInput}
        confirmCreateNewOt={app.confirmCreateNewOt}
        modal={app.modal}
      />
    </div>
  );
};

export default App;
