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
            moduloModelo={app.moduloModelo} moduloSerie={app.moduloSerie}
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
          <button
            onClick={() => app.setIsPreviewMode(false)}
            className="fixed bottom-24 right-6 bg-slate-800 text-white font-black px-6 py-3 rounded-full uppercase tracking-widest text-[10px] shadow-xl hover:bg-slate-700 no-print z-50"
          >
            Volver a Editar
          </button>
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
