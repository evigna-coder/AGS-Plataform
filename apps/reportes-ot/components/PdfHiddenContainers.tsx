import React from 'react';
import { CatalogTableView } from './CatalogTableView';
import { CatalogChecklistView } from './CatalogChecklistView';
import { CatalogTextView } from './CatalogTextView';
import { CatalogSignaturesView } from './CatalogSignaturesView';
import { AdjuntosPDFSection } from './AdjuntosPDFSection';
import { LOGO_SRC } from '../constants/logos';
import type { ProtocolSelection } from '../types/tableCatalog';
import type { InstrumentoPatronOption, AdjuntoMeta } from '../types/instrumentos';

interface PdfHiddenContainersProps {
  protocolSelections: ProtocolSelection[];
  instrumentosSeleccionados: InstrumentoPatronOption[];
  adjuntos: AdjuntoMeta[];
  signatureClient: string | null;
  signatureEngineer: string | null;
  aclaracionCliente: string;
  aclaracionEspecialista: string;
  fechaInicio: string;
  fechaFin: string;
}

export const PdfHiddenContainers: React.FC<PdfHiddenContainersProps> = ({
  protocolSelections, instrumentosSeleccionados, adjuntos,
  signatureClient, signatureEngineer, aclaracionCliente, aclaracionEspecialista,
  fechaInicio, fechaFin,
}) => {
  return (
    <>
      {/* Hidden PDF: Tablas + Instrumentos */}
      {(protocolSelections.length > 0 || instrumentosSeleccionados.length > 0) && (
        <div
          id="pdf-container-tablas-pdf"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '210mm',
            padding: '10mm',
            boxSizing: 'border-box',
            transform: 'translateX(-200vw)',
            background: 'white',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          aria-hidden
        >
          {[...protocolSelections].sort((a, b) => (a.tableSnapshot.orden || 999) - (b.tableSnapshot.orden || 999)).map(sel => (
            <div key={sel.tableId} style={{ breakInside: 'avoid' }}>
              {sel.tableSnapshot.tableType === 'signatures' ? (
                <CatalogSignaturesView
                  selection={sel} readOnly
                  signatureClient={signatureClient} signatureEngineer={signatureEngineer}
                  aclaracionCliente={aclaracionCliente} aclaracionEspecialista={aclaracionEspecialista}
                  fechaInicio={fechaInicio} fechaFin={fechaFin}
                />
              ) : sel.tableSnapshot.tableType === 'text' ? (
                <CatalogTextView selection={sel} readOnly />
              ) : sel.tableSnapshot.tableType === 'checklist' ? (
                <CatalogChecklistView selection={sel} readOnly onChangeData={() => {}} />
              ) : (
                <CatalogTableView selection={sel} readOnly onChangeData={() => {}} />
              )}
            </div>
          ))}
          {instrumentosSeleccionados.length > 0 && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white" style={{ breakInside: 'avoid' }}>
              <div className="flex items-center px-3 py-2 bg-slate-50 border-b border-slate-200 rounded-t-xl">
                <p className="font-semibold text-sm text-slate-900">Instrumentos y Patrones Utilizados</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Identificación</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Tipo</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Marca</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Modelo</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Nº Serie</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Certificado</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instrumentosSeleccionados.map((inst, idx) => (
                      <tr key={inst.id} className={`${idx % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors`}>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{inst.nombre}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${inst.tipo === 'patron' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {inst.tipo === 'patron' ? 'Patrón' : 'Instrumento'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{inst.marca || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{inst.modelo || '—'}</td>
                        <td className="px-2 py-1.5 text-xs font-mono border-r border-slate-100">{inst.serie || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{inst.certificadoEmisor || '—'}</td>
                        <td className="px-2 py-1.5 text-xs">
                          {inst.certificadoVencimiento
                            ? new Date(inst.certificadoVencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden PDF: Fotos */}
      {adjuntos.some(a => a.mimeType.startsWith('image/')) && (
        <div
          id="pdf-container-fotos-pdf"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '210mm',
            transform: 'translateX(-200vw)',
            background: 'white',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          aria-hidden
        >
          <AdjuntosPDFSection adjuntos={adjuntos} logoSrc={LOGO_SRC} />
        </div>
      )}
    </>
  );
};
