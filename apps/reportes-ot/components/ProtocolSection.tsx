import React, { useState, useEffect } from 'react';
import { useIsCompact } from '../hooks/useIsMobile';
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
import type { InstrumentoPatronOption, CertificadoIngeniero, PatronSeleccionado, ColumnaSeleccionada } from '../types/instrumentos';

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
  handleCatalogToggleClientSpec: (tableId: string, enabled: boolean, instanceValue?: string) => void;
  handleRemoveCatalogTable: (tableId: string) => void;
  handleDuplicateTable: (tableId: string) => void;
  handleDuplicateSection: (tableId: string, sectionItemId: string) => void;
  handleRemoveSection: (tableId: string, sectionItemId: string) => void;
  handleAddRow: (tableId: string) => void;
  handleRemoveRow: (tableId: string, rowId: string) => void;
  handleDuplicateRow: (tableId: string, originalRowId: string) => void;
  handleHeaderDataChange: (tableId: string, fieldId: string, value: string, instanceValue?: string) => void;
  handleColumnVisibilityChange: (tableId: string, colKey: string, visible: boolean) => void;
  handleColumnHeaderDataChange: (tableId: string, colKey: string, value: string) => void;
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
  // Patrones (nueva colección)
  patronesSeleccionados: PatronSeleccionado[];
  setPatronesSeleccionados: (v: PatronSeleccionado[]) => void;
  // Columnas (nueva colección)
  columnasSeleccionadas: ColumnaSeleccionada[];
  setColumnasSeleccionadas: (v: ColumnaSeleccionada[]) => void;
  // Certificados ingeniero
  aclaracionEspecialistaName: string;
  resolvedIngenieroId: string | null;
  certificadosIngenieroSeleccionados: CertificadoIngeniero[];
  setCertificadosIngenieroSeleccionados: (v: CertificadoIngeniero[]) => void;
  // Cover page data (auto-populated from OT)
  coverData?: {
    otNumber?: string;
    sistemaNombre?: string;
    moduloMarca?: string;
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
  handleAddRow, handleRemoveRow, handleDuplicateRow, handleHeaderDataChange, handleColumnVisibilityChange, handleColumnHeaderDataChange,
  handleChecklistAnswer, handleToggleChecklistSection,
  signatureClient, signatureEngineer, aclaracionCliente, aclaracionEspecialista,
  fechaInicio, fechaFin,
  instrumentosSeleccionados, setInstrumentosSeleccionados,
  patronesSeleccionados, setPatronesSeleccionados,
  columnasSeleccionadas, setColumnasSeleccionadas,
  aclaracionEspecialistaName, resolvedIngenieroId, certificadosIngenieroSeleccionados, setCertificadosIngenieroSeleccionados,
  coverData,
  markUserInteracted,
  variables,
  allPublishedTables,
}) => {
  // En viewports <1024px (mobile + tablet portrait) el protocolo pasa a modo tarjetas.
  // Preview mode y PDF export siempre usan scroll clásico (tabla real para fidelidad del PDF).
  const isCompact = useIsCompact();
  const wizardMode = isCompact && !isPreviewMode;

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

  // Admin bypass: when resolvedIngenieroId is null, allow manual selection
  const [allIngenieros, setAllIngenieros] = useState<{ id: string; nombre: string }[]>([]);
  const [manualIngenieroId, setManualIngenieroId] = useState<string | null>(null);
  useEffect(() => {
    if (resolvedIngenieroId === null && protocolSelections.length > 0) {
      firebase.getActiveIngenieros().then(setAllIngenieros);
    }
  }, [resolvedIngenieroId, protocolSelections.length, firebase]);

  const effectiveIngenieroId = resolvedIngenieroId ?? manualIngenieroId;

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
        <div className={`mt-4 max-w-full md:max-w-[calc(210mm+2rem)] mx-auto px-2 space-y-4${wizardMode ? ' protocol-cards-mode' : ''}`}>
          {[...protocolSelections].sort((a, b) => (a.tableSnapshot.orden || 999) - (b.tableSnapshot.orden || 999)).map(sel =>
            sel.tableSnapshot.tableType === 'cover' ? (
              <CatalogCoverView
                key={sel.tableId}
                selection={sel}
                isPrint={false}
                otNumber={coverData?.otNumber}
                fechaInicio={fechaInicio}
                sistemaNombre={coverData?.sistemaNombre || sistema}
                moduloMarca={coverData?.moduloMarca}
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
                onChangeData={handleCatalogCellChange}
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
                onDuplicateRow={handleDuplicateRow}
                onChangeHeaderData={handleHeaderDataChange}
                onChangeColumnVisibility={handleColumnVisibilityChange}
                onChangeColumnHeader={handleColumnHeaderDataChange}
                variables={{
                  ...variables,
                  'equipo.modelo': coverData?.sistemaNombre || sistema || '',
                  'equipo.marca': coverData?.moduloMarca || '',
                  'equipo.serie': coverData?.numeroSerie || '',
                  'equipo.id': coverData?.agsVisibleId || '',
                }}
                liveTemplateRows={getLiveRows(sel.tableId)}
                siblingSelections={protocolSelections}
              />
            )
          )}
        </div>
      )}

      {/* Instrumentos/patrones/columnas: solo visible cuando hay tablas seleccionadas */}
      {protocolSelections.length > 0 && (
        <div className="mt-4 max-w-full md:max-w-[calc(210mm+2rem)] mx-auto px-2">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Instrumentos / Patrones / Columnas utilizados</span>
          </div>
          <InstrumentoSelectorPanel
            firebase={firebase}
            instrumentosSelected={instrumentosSeleccionados}
            patronesSelected={patronesSeleccionados}
            columnasSelected={columnasSeleccionadas}
            onApply={(sel) => {
              setInstrumentosSeleccionados(sel.instrumentos);
              setPatronesSeleccionados(sel.patrones);
              setColumnasSeleccionadas(sel.columnas);
              markUserInteracted();
            }}
            readOnly={readOnly}
          />
          {/* Instrumentos seleccionados */}
          {instrumentosSeleccionados?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Instrumentos</p>
              <div className="flex flex-wrap gap-1.5">
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
            </div>
          )}
          {/* Patrones seleccionados */}
          {patronesSeleccionados?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1">Patrones</p>
              <div className="flex flex-wrap gap-1.5">
                {patronesSeleccionados.map((p, idx) => (
                  <span key={`${p.patronId}__${p.lote}__${idx}`} className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                    <span className="font-mono">{p.codigoArticulo}</span>
                    <span>· {p.descripcion}</span>
                    <span className="text-purple-400 font-mono">· Lote {p.lote}</span>
                    {!readOnly && (
                      <button onClick={() => {
                        setPatronesSeleccionados(patronesSeleccionados.filter((_, i) => i !== idx));
                        markUserInteracted();
                      }} className="text-purple-400 hover:text-purple-600 ml-0.5">×</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Columnas seleccionadas */}
          {columnasSeleccionadas?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Columnas</p>
              <div className="flex flex-wrap gap-1.5">
                {columnasSeleccionadas.map((c, idx) => (
                  <span key={`${c.columnaId}__${c.serie}__${idx}`} className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                    {c.codigoArticulo}
                    <span className="text-amber-400 font-mono">· S/N {c.serie}</span>
                    {!readOnly && (
                      <button onClick={() => {
                        setColumnasSeleccionadas(columnasSeleccionadas.filter((_, i) => i !== idx));
                        markUserInteracted();
                      }} className="text-amber-400 hover:text-amber-600 ml-0.5">×</button>
                    )}
                  </span>
                ))}
              </div>
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
            {resolvedIngenieroId === null && allIngenieros.length > 0 && (
              <select
                value={manualIngenieroId ?? ''}
                onChange={e => setManualIngenieroId(e.target.value || null)}
                className="ml-2 border border-slate-300 rounded px-2 py-0.5 text-xs bg-white text-slate-700"
              >
                <option value="">Seleccionar ingeniero...</option>
                {allIngenieros.map(ing => (
                  <option key={ing.id} value={ing.id}>{ing.nombre}</option>
                ))}
              </select>
            )}
          </div>
          <CertificadoIngenieroSelectorPanel
            firebase={firebase}
            ingenieroId={effectiveIngenieroId}
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

      {/* Anexo edición: tabla (desktop) o tarjetas (mobile/tablet portrait) */}
      {protocolTemplate && (
        <div
          className={
            wizardMode
              ? 'mt-4 w-full mx-auto px-3'
              : 'mt-6 bg-[#f1f5f9] py-6 w-full flex justify-center overflow-x-auto overflow-y-visible max-w-full md:max-w-[calc(210mm+2rem)] mx-auto px-2'
          }
        >
          <div
            id="pdf-container-anexo"
            className={wizardMode ? 'w-full' : 'shrink-0 min-h-0'}
            style={wizardMode ? undefined : { width: '210mm' }}
          >
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
              wizardMode={wizardMode}
            />
          </div>
        </div>
      )}

    </div>
  );
};
