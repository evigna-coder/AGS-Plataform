import React, { useRef, useEffect, useState } from 'react';
import { CompanyHeader } from './CompanyHeader';
import { CatalogTableView } from './CatalogTableView';
import { CatalogChecklistView } from './CatalogChecklistView';
import { CatalogTextView } from './CatalogTextView';
import { CatalogSignaturesView } from './CatalogSignaturesView';
import { ProtocolPaginatedPreview } from './ProtocolPaginatedPreview';
import { AdjuntosPDFSection } from './AdjuntosPDFSection';
import { PdfAdjuntoPreview } from './PdfAdjuntoPreview';
import { ISO_LOGO_SRC, LOGO_SRC } from '../constants/logos';
import { formatDateTimeAR } from '../services/time';
import { Part } from '../types';
import type { FirebaseService } from '../services/firebaseService';
import type { ProtocolSelection, TableCatalogEntry } from '../types/tableCatalog';
import type { InstrumentoPatronOption, AdjuntoMeta, PatronSeleccionado, ColumnaSeleccionada } from '../types/instrumentos';

const A4_WIDTH_PX = 794; // 210mm ≈ 794px at 96dpi

/** Wraps A4-width content and scales it to fit the screen on mobile */
function ScaledA4Wrapper({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState<number | undefined>(undefined);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const w = outer.clientWidth;
      const s = w < A4_WIDTH_PX ? w / A4_WIDTH_PX : 1;
      setScale(s);
      setInnerH(s < 1 ? inner.scrollHeight * s : undefined);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className={className} style={{ overflow: 'hidden', height: innerH }}>
      <div ref={innerRef} style={{
        transformOrigin: 'top left',
        transform: scale < 1 ? `scale(${scale})` : undefined,
        width: scale < 1 ? `${100 / scale}%` : undefined,
      }}>
        {children}
      </div>
    </div>
  );
}

interface PreviewSectionProps {
  // Form data
  otNumber: string;
  razonSocial: string;
  contacto: string;
  sector: string;
  fullDireccion: string;
  sistema: string;
  codigoInternoCliente: string;
  moduloModelo: string;
  moduloDescripcion: string;
  moduloMarca: string;
  moduloSerie: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  horasTrabajadas: string;
  tiempoViaje: string;
  tipoServicio: string;
  reporteTecnico: string;
  articulos: Part[];
  accionesTomar: string;
  accionesInternaOnly: boolean;
  budgets: string[];
  esFacturable: boolean;
  tieneContrato: boolean;
  esGarantia: boolean;
  // Signatures
  signatureClient: string | null;
  signatureEngineer: string | null;
  aclaracionCliente: string;
  aclaracionEspecialista: string;
  // Protocol
  protocolSelections: ProtocolSelection[];
  instrumentosSeleccionados: InstrumentoPatronOption[];
  patronesSeleccionados: PatronSeleccionado[];
  columnasSeleccionadas: ColumnaSeleccionada[];
  allPublishedTables: TableCatalogEntry[];
  allProjects: { id: string; headerTitle?: string | null; footerQF?: string | null }[];
  // Adjuntos
  adjuntos: AdjuntoMeta[];
  firebase: FirebaseService;
  // Controls
  setIsPreviewMode: (v: boolean) => void;
}

export const PreviewSection: React.FC<PreviewSectionProps> = (props) => {
  const {
    otNumber, razonSocial, contacto, sector, fullDireccion,
    sistema, codigoInternoCliente, moduloModelo, moduloDescripcion, moduloMarca, moduloSerie,
    fechaInicio, fechaFin, horaInicio, horaFin, horasTrabajadas, tiempoViaje,
    tipoServicio, reporteTecnico, articulos, accionesTomar, accionesInternaOnly, budgets,
    esFacturable, tieneContrato, esGarantia,
    signatureClient, signatureEngineer, aclaracionCliente, aclaracionEspecialista,
    protocolSelections, instrumentosSeleccionados, patronesSeleccionados, columnasSeleccionadas, allPublishedTables, allProjects,
    adjuntos, firebase,
    setIsPreviewMode,
  } = props;

  return (
    <>
      {/* Header de previsualización (NO afecta A4) */}
      <div className="-mb-2">
        <div className="no-print relative bg-blue-600 text-white p-3 rounded-xl w-full sm:w-[210mm] mx-auto mb-4 flex justify-between items-center shadow-lg">
          <div>
            <h4 className="font-black uppercase text-sm">Previsualización de Reporte</h4>
            <p className="text-[9px] opacity-75">Documento oficial final para el cliente.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsPreviewMode(false)}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase transition-colors"
            >
              Volver a Editar
            </button>
          </div>
        </div>
      </div>

      {/* Wrapper visual */}
      <ScaledA4Wrapper className="relative bg-slate-100 pb-[12mm]">
        <div
          id="pdf-container"
          className="bg-white shadow-2xl mx-auto"
          style={{
            width: '210mm',
            margin: '0 auto',
            pageBreakInside: 'avoid',
            boxSizing: 'border-box'
          }}>

          <div className="pt-[1mm] px-[10mm] pb-[0mm] min-h-[277mm] flex flex-col relative bg-white" style={{ boxSizing: 'border-box', height: '285mm' }}>
            <div className="-mb-[2mm]">
              <CompanyHeader
                companyName="AGS ANALITICA S.A."
                address="Arenales 605 – Piso 15, B1638BRG Buenos Aires - Argentina"
                phone="011 4524 7247"
                whatsapp="54.911 5693.4883"
                email="info@agsanalitica.com"
                web="www.agsanalitica.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2 text-[11px] bg-white p-[1px] relative z-10 ">
              <div className="border border-slate-200 p-2 rounded-lg bg-white">
                <div className="-mx-2 px-2 border-b border-slate-200 mb-0.5">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase mb-1">Datos del Cliente</h4>
                </div>
                <p className="font-black text-slate-900 text-[14px] leading-tight uppercase">{razonSocial || "S/D"}</p>
                <p className="text-slate-700 font-bold mt-0.5">Contacto: {contacto || "S/D"}</p>
                <p className="text-slate-600 mt-1 leading-tight text-[10px]">{fullDireccion || "S/D"}</p>
                <div className="mt-1 pt-1">
                  <div className="-mx-2 px-2 border-t border-b border-slate-200 mb-0.5 flex items-center">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase mb-0">Información del equipo</h4>
                  </div>
                  <div className="space-y-0.5 text-[10px]">
                    <p className="text-slate-800 font-black uppercase text-[12px] truncate">Sistema: {sistema || "S/D"}</p>
                    <p className="text-slate-600"><span className="font-bold">Id - Código interno:</span> {codigoInternoCliente || "S/D"}</p>
                    <p className="text-slate-600"><span className="font-bold">Modelo:</span> {moduloModelo || "S/D"}{moduloDescripcion ? `, ${moduloDescripcion}` : ''}{moduloMarca ? `, Marca: ${moduloMarca}` : ''}</p>
                    <p className="text-slate-600 font-mono"><span className="font-bold">S/N:</span> {moduloSerie || "S/D"}</p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 border border-slate-200 p-2 rounded-lg bg-white">
                <div>
                  <div className="-mx-2 px-2 border-b border-slate-200 mb-0.5">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase mb-1">Datos de la Orden de trabajo</h4>
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-blue-700 text-[12px]">Orden de trabajo N°: {otNumber}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] mt-0.5">
                    <p className="text-slate-600"><span className="font-bold uppercase text-[8px]">Inicio:</span> {formatDateTimeAR(fechaInicio, horaInicio) || fechaInicio || '—'}</p>
                    <p className="text-slate-600"><span className="font-bold uppercase text-[8px]">Fin:</span> {formatDateTimeAR(fechaFin, horaFin) || fechaFin || '—'}</p>
                    <p className="text-slate-600"><span className="font-bold uppercase text-[8px]">Hs. Lab:</span> {horasTrabajadas || "0.0"}</p>
                    <p className="text-slate-600"><span className="font-bold uppercase text-[8px]">Hs. Trasl:</span> {tiempoViaje || "0.0"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 mb-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Informe Técnico</label>
              <div className="text-[12px] whitespace-pre-wrap border-l-4 border-blue-600 pl-3 py-2 bg-slate-50/50 rounded-r-lg leading-relaxed min-h-[35mm]">
                {tipoServicio && <p className="mb-2 font-bold">{tipoServicio}</p>}
                <p className="italic">{reporteTecnico || "Sin descripción registrada."}</p>
              </div>
            </div>

            <div className="mt-2 mb-2 pb-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Materiales / Repuestos Utilizados</label>
              <table className="w-full border border-slate-100 rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-1 text-left w-[35mm]">Código</th>
                    <th className="px-3 py-1 text-left w-[100mm]">Descripción</th>
                    <th className="px-3 py-1 text-center w-[15mm]">Cant.</th>
                    <th className="px-3 py-1 text-left w-[25mm]">Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[10px]">
                  {articulos.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-1 font-mono truncate">{p.codigo}</td>
                      <td className="px-3 py-1 break-words line-clamp-1">{p.descripcion}</td>
                      <td className="px-3 py-1 text-center font-black">{p.cantidad}</td>
                      <td className="px-3 py-1 truncate">{p.origen}</td>
                    </tr>
                  ))}
                  {articulos.length === 0 && <tr><td colSpan={4} className="p-3 text-center italic text-slate-300">No se registraron materiales</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Sección final: Firmas, Observaciones y Footer */}
            <div className="mt-auto pt-2" style={{ marginTop: 'auto', paddingTop: '1mm' }}>
              <div className="mb-2">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Conformidad del Servicio</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-2">
                <div className="flex flex-col items-center">
                  <div className="h-14 w-full border-b border-slate-900 flex items-end justify-center pb-1">
                    {signatureClient && <img src={signatureClient} className="max-h-full max-w-full object-contain" alt="Firma Cliente" />}
                  </div>
                  <p className="font-black text-[11px] mt-1 uppercase text-center leading-none">{aclaracionCliente || "Cliente"}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Firma del cliente</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="h-14 w-full border-b border-slate-900 flex items-end justify-center pb-1">
                    {signatureEngineer && <img src={signatureEngineer} className="max-h-full max-w-full object-contain" alt="Firma Técnico" />}
                  </div>
                  <p className="font-black text-[11px] mt-1 uppercase text-center leading-none">{aclaracionEspecialista || "Especialista AGS"}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Firma del Ing. de soporte técnico</p>
                </div>
              </div>

              <div className="w-full border-b border-slate-200 my-2"></div>

              <div className="grid grid-cols-12 gap-3 mb-2">
                <div className="col-span-8 border border-slate-200 p-2.5 rounded-lg bg-white">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase mb-1 border-b border-slate-200 pb-0.5">OBSERVACIONES / ACCIONES A TOMAR</h4>
                  <p className="text-[11px] italic text-slate-700 leading-tight">
                    {accionesInternaOnly
                      ? "Sin observaciones pendientes."
                      : (accionesTomar || "Sin observaciones pendientes.")}
                  </p>
                </div>
                <div className="col-span-4 border border-slate-200 p-2.5 rounded-lg bg-white flex flex-col">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase mb-1 border-b border-slate-200 pb-0.5">Facturación</h4>
                  <div className="text-[9px] space-y-0.5">
                    {budgets.filter(b => b.trim() !== '').map((b, i) => (
                      <p key={i} className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold uppercase text-[8px]">Presupuesto:</span>
                        <span className="font-black uppercase">{b}</span>
                      </p>
                    ))}
                    <p className="flex justify-between items-center"><span className="text-slate-400 font-bold uppercase text-[8px]">Facturable:</span> <span className="font-black uppercase">{esFacturable ? 'SÍ' : 'NO'}</span></p>
                    <p className="flex justify-between items-center"><span className="text-slate-400 font-bold uppercase text-[8px]">Contrato:</span> <span className="font-black uppercase">{tieneContrato ? 'SÍ' : 'NO'}</span></p>
                    <p className="flex justify-between items-center"><span className="text-slate-400 font-bold uppercase text-[8px]">Garantía:</span> <span className="font-black uppercase">{esGarantia ? 'SÍ' : 'NO'}</span></p>
                  </div>
                </div>
              </div>

              {/* Footer fijo al final */}
              <div className="border-t border-slate-200 text-[9px] text-slate-500" style={{ marginTop: '8mm', paddingTop: '1mm' }}>
                <div className="relative flex items-end justify-between">
                  <div className="flex items-end">
                    <img src={ISO_LOGO_SRC} alt="Certificación ISO 9001" className="h-[18mm] w-auto" style={{ maxHeight: '18mm' }} />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 flex items-end">
                    <span className="whitespace-nowrap">Formulario QF7.0502 Rev.07</span>
                  </div>
                  <div className="flex items-end whitespace-nowrap">
                    Página 1 de 1 | OT-{otNumber}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScaledA4Wrapper>

      {/* Preview: Tablas + Instrumentos (paginado A4 con headers/footers) */}
      {(protocolSelections?.length > 0 || instrumentosSeleccionados?.length > 0 || patronesSeleccionados?.length > 0 || columnasSeleccionadas?.length > 0) && (
        <ScaledA4Wrapper className="relative bg-[#f1f5f9] mt-6 pb-6"><div id="pdf-preview-tablas" className="flex flex-col gap-6">
          <ProtocolPaginatedPreview
            protocolSelections={protocolSelections}
            instrumentosSeleccionados={instrumentosSeleccionados}
            patronesSeleccionados={patronesSeleccionados}
            columnasSeleccionadas={columnasSeleccionadas}
            meta={{
              otNumber,
              razonSocial,
              clienteContacto: contacto,
              clienteDireccion: fullDireccion,
              clienteSector: sector,
              sistema,
              moduloModelo,
              moduloDescripcion,
              moduloMarca,
              moduloSerie,
              codigoInternoCliente,
              fechaInicio,
              tipoServicio,
              logoSrc: LOGO_SRC,
              isoLogoSrc: ISO_LOGO_SRC,
              ingenieroNombre: aclaracionEspecialista,
            }}
            signatureClient={signatureClient}
            signatureEngineer={signatureEngineer}
            aclaracionCliente={aclaracionCliente}
            aclaracionEspecialista={aclaracionEspecialista}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            catalogTables={allPublishedTables}
            catalogProjects={allProjects}
          />
        </div></ScaledA4Wrapper>
      )}

      {/* Preview: PDFs adjuntos */}
      {adjuntos.some(a => a.mimeType === 'application/pdf') && (
        <ScaledA4Wrapper className="relative bg-[#f1f5f9] mt-6 pb-[12mm]">
          <PdfAdjuntoPreview adjuntos={adjuntos} firebase={firebase} />
        </ScaledA4Wrapper>
      )}

      {/* Preview: Fotos */}
      {adjuntos.some(a => a.mimeType.startsWith('image/')) && (
        <ScaledA4Wrapper className="relative bg-[#f1f5f9] mt-6 pb-[12mm]">
          <div className="bg-white shadow-md rounded-sm overflow-visible shrink-0" style={{ width: '210mm', margin: '0 auto', boxSizing: 'border-box' }}>
            <AdjuntosPDFSection adjuntos={adjuntos} logoSrc={LOGO_SRC} />
          </div>
        </ScaledA4Wrapper>
      )}
    </>
  );
};
