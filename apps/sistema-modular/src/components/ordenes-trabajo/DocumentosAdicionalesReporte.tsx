import { useState, useEffect, useRef, useCallback } from 'react';
import type { DocumentoAdicionalReporte } from '@ags/shared';
import { reportePdfService } from '../../services/reportePdfService';
import { ordenesTrabajoService } from '../../services/otService';

interface Props {
  otNumber: string;
  /** Se llama tras anexar con éxito, para que el preview recargue el PDF. */
  onAppended?: () => void;
}

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const DocumentosAdicionalesReporte: React.FC<Props> = ({ otNumber, onAppended }) => {
  const [docs, setDocs] = useState<DocumentoAdicionalReporte[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshDocs = useCallback(async () => {
    try {
      const ot = await ordenesTrabajoService.getByOtNumber(otNumber);
      setDocs(ot?.documentosAdicionales ?? []);
    } catch {
      // no bloqueante: la lista queda como estaba
    }
  }, [otNumber]);

  useEffect(() => { refreshDocs(); }, [refreshDocs]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permitir re-seleccionar el mismo archivo
    if (!file) return;

    setError(null);
    setWorking(true);
    try {
      const { paginasAgregadas } = await reportePdfService.appendDocumentToReportPdf(otNumber, file);
      await refreshDocs();
      onAppended?.();
      alert(`Documento anexado al reporte (${paginasAgregadas} página${paginasAgregadas === 1 ? '' : 's'}).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo anexar el documento.';
      setError(msg);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mt-2">
      {docs.length > 0 && (
        <ul className="mb-2 space-y-1">
          {docs.map((d, i) => (
            <li key={`${d.storagePath}-${i}`} className="flex items-center gap-2 text-[11px] text-slate-600">
              <svg className="w-3.5 h-3.5 text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline truncate max-w-[200px]">
                {d.fileName}
              </a>
              <span className="text-slate-400">· {fmtSize(d.sizeBytes)}</span>
              <span className="text-slate-400 ml-auto">{new Date(d.agregadoAt).toLocaleDateString('es-AR')}</span>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={handleFile}
        className="hidden"
        disabled={working}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={working}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 hover:text-teal-700 disabled:text-slate-400 disabled:cursor-wait"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {working ? 'Anexando al reporte…' : 'Agregar documento al reporte'}
      </button>
      <p className="text-[10px] text-slate-400 mt-0.5">
        PDF, JPG o PNG — se incorpora al PDF definitivo del reporte.
      </p>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
};
