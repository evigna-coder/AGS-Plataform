import React, { useState, useEffect } from 'react';
import { FirebaseService } from '../services/firebaseService';
import { TableSelectorPanel } from './TableSelectorPanel';
import { CatalogTableView } from './CatalogTableView';
import { CatalogChecklistView } from './CatalogChecklistView';
import { CatalogTextView } from './CatalogTextView';
import { CatalogSignaturesView } from './CatalogSignaturesView';
import { CatalogCoverView } from './CatalogCoverView';
import { InstrumentoSelectorPanel } from './InstrumentoSelectorPanel';
import { CertificadoIngenieroSelectorPanel } from './CertificadoIngenieroSelectorPanel';
import ProtocolView from './ProtocolView';
import { isProtocolTestMode } from '../utils/protocolSelector';
import type { ProtocolSelection, TableCatalogEntry, ChecklistItemAnswer } from '../types/tableCatalog';
import type { InstrumentoPatronOption, CertificadoIngeniero } from '../types/instrumentos';

interface ProtocolSectionProps {
  isPreviewMode: boolean;
  readOnly: boolean;
  firebase: FirebaseService;
  sistema: string;
  tipoServicio: string;
  catalogServiceTypes: Set<string>;
  // Protocol template
  protocolTemplate: any;
  protocolData: any;
  setProtocolData: (v: any) => void;
  // Catalog selections
  protocolSelections: ProtocolSelection[];
  setProtocolSelections: (v: ProtocolSelection[] | ((prev: ProtocolSelection[]) => ProtocolSelection[])) => void;
  suggestedTables: TableCatalogEntry[];
  setSuggestedTables: (v: TableCatalogEntry[]) => void;
  // Catalog handlers
  handleCatalogCellChange: (tableId: string, rowId: string, colKey: string, value: string) => void;
  handleCatalogObservaciones: (tableId: string, value: string) => void;
  handleCatalogResultado: (tableId: string, resultado: ProtocolSelection['resultado']) => void;
  handleCatalogToggleClientSpec: (tableId: string, enabled: boolean) => void;
  handleRemoveCatalogTable: (tableId: string) => void;
  handleDuplicateTable: (tableId: string) => void;
  handleDuplicateSection: (tableId: string, sectionItemId: string) => void;
  handleRemoveSection: (tableId: string, sectionItemId: string) => void;
  handleAddRow: (tableId: string) => void;
  handleRemoveRow: (tableId: string, rowId: string) => void;
  handleHeaderDataChange: (tableId: string, fieldId: string, value: string) => void;
  handleChecklistAnswer: (tableId: string, itemId: string, answer: ChecklistItemAnswer) => void;
  handleToggleChecklistSection: (tableId: string, itemId: string, isNA: boolean) => void;
  // Signatures for catalog
  signatureClient: string | null;
  signatureEngineer: string | null;
  aclaracionCliente: string;
  aclaracionEspecialista: string;
  fechaInicio: string;
  fechaFin: string;
  // Instrumentos
  instrumentosSeleccionados: InstrumentoPatronOption[];
  setInstrumentosSeleccionados: (v: InstrumentoPatronOption[]) => void;
  // Certificados ingeniero
  aclaracionEspecialistaName: string;
  certificadosIngenieroSeleccionados: CertificadoIngeniero[];
  setCertificadosIngenieroSeleccionados: (v: CertificadoIngeniero[]) => void;
  // Cover page data (auto-populated from OT)
  coverData?: {
    otNumber?: string;
    sistemaNombre?: string;
    agsVisibleId?: string;
    numeroSerie?: string;
    ingenieroNombre?: string;
    logoSrc?: string;
  };
  // Marker
  markUserInteracted: () => void;
  /** Variables del reporte para auto-rellenar filas con variable binding */
  variables?: Record<string, string>;
  /** Catálogo vivo completo — para resolver variables en snapshots obsoletos */
  allPublishedTables?: TableCatalogEntry[];
}

export const ProtocolSection: React.FC<ProtocolSectionProps> = ({
  isPreviewMode, readOnly, firebase, sistema, tipoServicio, catalogServiceTypes,
  protocolTemplate, protocolData, setProtocolData,
  protocolSelections, setProtocolSelections, suggestedTables, setSuggestedTables,
  handleCatalogCellChange, handleCatalogObservaciones, handleCatalogResultado,
  handleCatalogToggleClientSpec, handleRemoveCatalogTable, handleDuplicateTable, handleDuplicateSection, handleRemoveSection,
  handleAddRow, handleRemoveRow, handleHeaderDataChange,
  handleChecklistAnswer, handleToggleChecklistSection,
  signatureClient, signatureEngineer, aclaracionCliente, aclaracionEspecialista,
  fechaInicio, fechaFin,
  instrumentosSeleccionados, setInstrumentosSeleccionados,
  aclaracionEspecialistaName, certificadosIngenieroSeleccionados, setCertificadosIngenieroSeleccionados,
  coverData,
  markUserInteracted,
  variables,
  allPublishedTables,
}) => {
  // Fetch fresh table data by ID (bypasses published filter) for liveTemplateRows fallback
  const [freshTables, setFreshTables] = useState<TableCatalogEntry[]>([]);
  useEffect(() => {
    const ids = [...new Set(protocolSelections.map(s => s.tableId))];
    if (ids.length === 0) return;
    Promise.all(ids.map(id => firebase.getTableById(id))).then(results => {
      setFreshTables(results.filter(Boolean) as TableCatalogEntry[]);
    });
  }, [protocolSelections, firebase]);

  const getLiveRows = (tableId: string) => {
    const fresh = freshTables.find(t => t.id === tableId);
    if (fresh) return fresh.templateRows;
    return allPublishedTables?.find(t => t.id === tableId)?.templateRows;
  };

  // Resolve ingeniero ID from name for certificate selector
  const [resolvedIngenieroId, setResolvedIngenieroId] = useState<string | null>(null);
  useEffect(() => {
    if (!aclaracionEspecialistaName) { setResolvedIngenieroId(null); return; }
    firebase.getIngenieroByNombre(aclaracionEspecialistaName).then(ing => {
      setResolvedIngenieroId(ing?.id ?? null);
    });
  }, [aclaracionEspecialistaName, firebase]);

  return (
    <div
      className={
        isPreviewMode
          ? 'fixed -left-[9999px] top-0 w-[210mm] no-print pointer-events-none'
          : 'max-w-5xl mx-auto mt-4 no-print w-full'
      }
      aria-hidden={isPreviewMode}
    >
      {protocolTemplate && import.meta.env.DEV && isProtocolTestMode() && (
        <div className="mx-auto max-w-5xl px-2 py-2 bg-amber-100 border border-amber-400 text-amber-900 text-xs font-semibold rounded no-print" role="status">
          Modo test: plantilla de prueba cargada
        </div>
      )}
      {/* Selector de tablas dinámicas del catálogo */}
      {!readOnly && catalogServiceTypes.has(tipoServicio) && (
        <div className="mt-4 max-w-full md:max-w-[calc(210mm+2rem)] mx-auto px-2">
          <TableSelectorPanel
            firebase={firebase}
            sysType={sistema || undefined}
            modeloEquipo={sistema || undefined}
            existingSelections={protocolSelections}
            suggestedTables={suggestedTables}
            onApply={(selections) => {
              setProtocolSelections(selections);
              setSuggestedTables([]);
              markUserInteracted();
            }}
          />
        </div>
      )}

      {/* Tablas y checklists seleccionados (modo edición) */}
      {protocolSelections.length > 0 && (
        <div className="mt-4 max-w-full md:max-w-[calc(210mm+2rem)] mx-auto px-2 space-y-4">
          {[...protocolSelections].sort((a, b) => (a.tableSnapshot.orden || 999) - (b.tableSnapshot.orden || 999)).map(sel =>
            sel.tableSnapshot.tableType === 'cover' ? (
              <CatalogCoverView
                key={sel.tableId}
                selection={sel}
                isPrint={false}
                otNumber={coverData?.otNumber}
                fechaInicio={fechaInicio}
                sistemaNombre={coverData?.sistemaNombre || sistema}
                agsVisibleId={coverData?.agsVisibleId}
                numeroSerie={coverData?.numeroSerie}
                ingenieroNombre={coverData?.ingenieroNombre || aclaracionEspecialista}
                logoSrc={coverData?.logoSrc}
              />
            ) : sel.tableSnapshot.tableType === 'signatures' ? (
              <CatalogSignaturesView
                key={sel.tableId}
                selection={sel}
                readOnly={readOnly}
                signatureClient={signatureClient}
                signatureEngineer={signatureEngineer}
                aclaracionCliente={aclaracionCliente}
                aclaracionEspecialista={aclaracionEspecialista}
                fechaInicio={fechaInicio}
                fechaFin={fechaFin}
              />
            ) : sel.tableSnapshot.tableType === 'text' ? (
              <CatalogTextView
                key={sel.tableId}
                selection={sel}
                readOnly={readOnly}
                isPrint={false}
                onRemove={handleRemoveCatalogTable}
              />
            ) : sel.tableSnapshot.tableType === 'checklist' ? (
              <CatalogChecklistView
                key={sel.tableId}
                selection={sel}
                readOnly={readOnly}
                isPrint={false}
                onChangeData={handleChecklistAnswer}
                onChangeObservaciones={handleCatalogObservaciones}
                onChangeResultado={handleCatalogResultado}
                onToggleSection={handleToggleChecklistSection}
                onRemove={handleRemoveCatalogTable}
                onDuplicateSection={(sectionId) => handleDuplicateSection(sel.tableId, sectionId)}
                onRemoveSection={(sectionId) => handleRemoveSection(sel.tableId, sectionId)}
                signatureClient={signatureClient}
                signatureEngineer={signatureEngineer}
                aclaracionCliente={aclaracionCliente}
                aclaracionEspecialista={aclaracionEspecialista}
                fechaInicio={fechaInicio}
                fechaFin={fechaFin}
              />
            ) : (
              <CatalogTableView
                key={sel.tableId}
                selection={sel}
                readOnly={readOnly}
                isPrint={false}
                onChangeData={handleCatalogCellChange}
                onChangeObservaciones={handleCatalogObservaciones}
                onChangeResultado={handleCatalogResultado}
                onToggleClientSpec={handleCatalogToggleClientSpec}
                onRemove={handleRemoveCatalogTable}
                onDuplicate={handleDuplicateTable}
                onAddRow={handleAddRow}
                onRemoveRow={handleRemoveRow}
                onChangeHeaderData={handleHeaderDataChange}
                variables={variables}
                liveTemplateRows={getLiveRows(sel.tableId)}
              />
            )
          )}
        </div>
      )}

      {/* Instrumentos/patrones: solo visible cuando hay tablas seleccionadas */}
      {protocolSelections.length > 0 && (
        <div className="mt-4 max-w-full md:max-w-[calc(210mm+2rem)] mx-auto px-2">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Instrumentos / Patrones utilizados</span>
          </div>
          <InstrumentoSelectorPanel
            firebase={firebase}
            selected={instrumentosSeleccionados}
            onApply={(sel) => {
              setInstrumentosSeleccionados(sel);
              markUserInteracted();
            }}
            readOnly={readOnly}
          />
          {instrumentosSeleccionados.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {instrumentosSeleccionados.map(inst => (
                <span key={inst.id} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                  {inst.nombre}
                  {!readOnly && (
                    <button onClick={() => {
                      setInstrumentosSeleccionados(instrumentosSeleccionados.filter(i => i.id !== inst.id));
                      markUserInteracted();
                    }} className="text-indigo-400 hover:text-indigo-600 ml-0.5">×</button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certificados de ingeniero: visible cuando hay tablas seleccionadas */}
      {protocolSelections.length > 0 && (
        <div className="mt-4 max-w-full md:max-w-[calc(210mm+2rem)] mx-auto px-2">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Certificados del ingeniero</span>
          </div>
          <CertificadoIngenieroSelectorPanel
            firebase={firebase}
            ingenieroId={resolvedIngenieroId}
            ingenieroNombre={aclaracionEspecialistaName}
            selected={certificadosIngenieroSeleccionados}
            onApply={(sel) => {
              setCertificadosIngenieroSeleccionados(sel);
              markUserInteracted();
            }}
            readOnly={readOnly}
          />
          {(certificadosIngenieroSeleccionados ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {certificadosIngenieroSeleccionados.map(cert => (
                <span key={cert.id} className="inline-flex items-center gap-1 text-[10px] bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5">
                  {cert.descripcion}
                  {!readOnly && (
                    <button onClick={() => {
                      setCertificadosIngenieroSeleccionados(certificadosIngenieroSeleccionados.filter(c => c.id !== cert.id));
                      markUserInteracted();
                    }} className="text-teal-400 hover:text-teal-600 ml-0.5">×</button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anexo edición: scroll de página (solo si hay template) */}
      {protocolTemplate && (
        <div className="mt-6 bg-[#f1f5f9] py-6 w-full flex justify-center overflow-x-auto overflow-y-visible max-w-full md:max-w-[calc(210mm+2rem)] mx-auto px-2">
          <div id="pdf-container-anexo" className="shrink-0 min-h-0" style={{ width: '210mm' }}>
            <ProtocolView
              template={protocolTemplate}
              readOnly={readOnly}
              data={protocolData ?? undefined}
              onChangeData={(newData) => {
                if (readOnly) return;
                setProtocolData(newData);
              }}
              showGuides={true}
              mode="edit"
            />
          </div>
        </div>
      )}

    </div>
  );
};
