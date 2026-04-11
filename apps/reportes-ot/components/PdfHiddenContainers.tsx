import React from 'react';
import { CatalogTableView } from './CatalogTableView';
import { CatalogChecklistView } from './CatalogChecklistView';
import { CatalogTextView } from './CatalogTextView';
import { CatalogSignaturesView } from './CatalogSignaturesView';
import { AdjuntosPDFSection } from './AdjuntosPDFSection';
import { LOGO_SRC } from '../constants/logos';
import type { ProtocolSelection } from '../types/tableCatalog';
import type { InstrumentoPatronOption, AdjuntoMeta, PatronSeleccionado, ColumnaSeleccionada } from '../types/instrumentos';

interface PdfHiddenContainersProps {
  protocolSelections: ProtocolSelection[];
  instrumentosSeleccionados: InstrumentoPatronOption[];
  patronesSeleccionados?: PatronSeleccionado[];
  columnasSeleccionadas?: ColumnaSeleccionada[];
  adjuntos: AdjuntoMeta[];
  signatureClient: string | null;
  signatureEngineer: string | null;
  aclaracionCliente: string;
  aclaracionEspecialista: string;
  fechaInicio: string;
  fechaFin: string;
}

export const PdfHiddenContainers: React.FC<PdfHiddenContainersProps> = ({
  protocolSelections, instrumentosSeleccionados,
  patronesSeleccionados = [], columnasSeleccionadas = [],
  adjuntos,
  signatureClient, signatureEngineer, aclaracionCliente, aclaracionEspecialista,
  fechaInicio, fechaFin,
}) => {
  return (
    <>
      {/* Hidden PDF: Tablas + Instrumentos/Patrones/Columnas */}
      {(protocolSelections.length > 0 || instrumentosSeleccionados.length > 0 || patronesSeleccionados.length > 0 || columnasSeleccionadas.length > 0) && (
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
                <CatalogChecklistView selection={sel} readOnly isPrint onChangeData={() => {}}
                  signatureClient={signatureClient} signatureEngineer={signatureEngineer}
                  aclaracionCliente={aclaracionCliente} aclaracionEspecialista={aclaracionEspecialista}
                  fechaInicio={fechaInicio} fechaFin={fechaFin}
                />
              ) : (
                <CatalogTableView selection={sel} readOnly isPrint onChangeData={() => {}} />
              )}
            </div>
          ))}
          {instrumentosSeleccionados.filter(i => i.tipo !== 'patron').length > 0 && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white" style={{ breakInside: 'avoid' }}>
              <div className="flex items-center px-3 py-2 bg-slate-50 border-b border-slate-200 rounded-t-xl">
                <p className="font-semibold text-sm text-slate-900">Instrumentos Utilizados</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Identificación</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Marca</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Modelo</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Nº Serie</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Certificado</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instrumentosSeleccionados.filter(i => i.tipo !== 'patron').map((inst, idx) => (
                      <tr key={inst.id} className={idx % 2 === 0 ? '' : 'bg-slate-50/50'}>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{inst.nombre}</td>
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
          {(patronesSeleccionados.length > 0 || instrumentosSeleccionados.filter(i => i.tipo === 'patron').length > 0) && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white" style={{ breakInside: 'avoid' }}>
              <div className="flex items-center px-3 py-2 bg-slate-50 border-b border-slate-200 rounded-t-xl">
                <p className="font-semibold text-sm text-slate-900">Patrones Utilizados</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Artículo</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Marca</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Descripción</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Lote</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Certificado</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Patrones nuevos (colección /patrones) */}
                    {patronesSeleccionados.map((p, idx) => (
                      <tr key={`p-${p.patronId}-${p.lote}-${idx}`} className={idx % 2 === 0 ? '' : 'bg-slate-50/50'}>
                        <td className="px-2 py-1.5 text-xs font-mono border-r border-slate-100">{p.codigoArticulo || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{p.marca || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{p.descripcion || '—'}</td>
                        <td className="px-2 py-1.5 text-xs font-mono border-r border-slate-100">{p.lote || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{p.certificadoEmisor || '—'}</td>
                        <td className="px-2 py-1.5 text-xs">
                          {p.fechaVencimiento
                            ? new Date(p.fechaVencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {/* Patrones legacy (tipo='patron' en colección /instrumentos) */}
                    {instrumentosSeleccionados.filter(i => i.tipo === 'patron').map((inst, idx) => (
                      <tr key={`lp-${inst.id}`} className={(patronesSeleccionados.length + idx) % 2 === 0 ? '' : 'bg-slate-50/50'}>
                        <td className="px-2 py-1.5 text-xs font-mono border-r border-slate-100">{inst.modelo || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{inst.marca || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{inst.nombre}</td>
                        <td className="px-2 py-1.5 text-xs font-mono border-r border-slate-100">{inst.lote || '—'}</td>
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
          {columnasSeleccionadas.length > 0 && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white" style={{ breakInside: 'avoid' }}>
              <div className="flex items-center px-3 py-2 bg-slate-50 border-b border-slate-200 rounded-t-xl">
                <p className="font-semibold text-sm text-slate-900">Columnas Utilizadas</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Artículo</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Marca</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Descripción</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Nº Serie</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Certificado</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnasSeleccionadas.map((c, idx) => (
                      <tr key={`c-${c.columnaId}-${c.serie}-${idx}`} className={idx % 2 === 0 ? '' : 'bg-slate-50/50'}>
                        <td className="px-2 py-1.5 text-xs font-mono border-r border-slate-100">{c.codigoArticulo || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{c.marca || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{c.descripcion || '—'}</td>
                        <td className="px-2 py-1.5 text-xs font-mono border-r border-slate-100">{c.serie || '—'}</td>
                        <td className="px-2 py-1.5 text-xs border-r border-slate-100">{c.certificadoEmisor || '—'}</td>
                        <td className="px-2 py-1.5 text-xs">
                          {c.fechaVencimiento
                            ? new Date(c.fechaVencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
