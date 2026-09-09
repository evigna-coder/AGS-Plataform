import { useState, useRef, useEffect } from 'react';
import type { WorkOrder } from '@ags/shared';
import { reportePdfService } from '../../services/reportePdfService';
import { abrirVentanaParaPdf, mostrarPdfEnVentana, mostrarPdfEnOverlay } from '../../utils/ventanaPdf';
import { notify } from '../../utils/notify';

interface Props {
  ot: WorkOrder;
}

/**
 * Acción "Reporte" del listado de OTs. Acceso directo al PDF ya generado por
 * reportes-ot (guardado en el mismo doc `reportes/{otNumber}`):
 *  - Si hay reporte + protocolo → menú "Solo reporte" / "Reporte + protocolo"
 *    (el segundo es UN solo PDF fusionado, no dos ventanas).
 *  - Si solo hay reporte → abre directo.
 *  - Si no hay PDF → aviso; antes caía a localhost:3000, una ventana que en
 *    las PCs de la oficina no carga nunca.
 *
 * Las URLs NO se toman del documento (2026-09-08): Storage rota el token al
 * sobrescribir el archivo (anexar documentos, regenerar), y la URL guardada
 * responde 403 — la "ventana que no carga". Se resuelve una URL fresca por el
 * path, igual que el visor del cierre administrativo. Y el PDF se muestra en
 * una pestaña de la app en el navegador; en Electron se baja a un archivo
 * temporal y se abre con el visor del sistema (`saveTempAndOpen`), porque una
 * pestaña con iframe ahí muestra "obtener aplicación para este vínculo".
 */
const enElectron = () => !!window.electronAPI?.saveTempAndOpen;

const abrirConVisorDelSistema = async (blob: Blob, nombre: string) => {
  await window.electronAPI!.saveTempAndOpen!(new Uint8Array(await blob.arrayBuffer()), nombre);
};
export const OTReporteButton: React.FC<Props> = ({ ot }) => {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const tieneProtocolo = !!ot.protocolPdfUrl;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const mostrar = (win: Window | null, url: string, titulo: string) => {
    if (win && !win.closed) mostrarPdfEnVentana(win, url, titulo);
    else mostrarPdfEnOverlay(url, titulo);
  };

  /** Solo el reporte (hoja 1 + fotos + anexos). */
  const abrirSolo = async () => {
    setOpen(false);
    setCargando(true);
    if (enElectron()) {
      try {
        const blob = await reportePdfService.blobDelReporte(ot.otNumber);
        if (!blob) { notify.warning(`La OT ${ot.otNumber} todavía no tiene el reporte generado desde la app de campo.`); return; }
        await abrirConVisorDelSistema(blob, `Reporte OT ${ot.otNumber}.pdf`);
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'No se pudo abrir el reporte');
      } finally { setCargando(false); }
      return;
    }
    // La pestaña se pide SÍNCRONA, antes de cualquier await, o el navegador la bloquea.
    const win = abrirVentanaParaPdf(`Reporte OT ${ot.otNumber}`);
    try {
      const resolved = await reportePdfService.resolveReportePdf(ot.otNumber);
      if (!resolved) {
        win?.close();
        notify.warning(`La OT ${ot.otNumber} todavía no tiene el reporte generado desde la app de campo.`);
        return;
      }
      mostrar(win, resolved.url, `Reporte OT ${ot.otNumber}`);
    } catch (err) {
      win?.close();
      notify.error(err instanceof Error ? err.message : 'No se pudo abrir el reporte');
    } finally {
      setCargando(false);
    }
  };

  /** Reporte + protocolo en un solo PDF. */
  const abrirCompleto = async () => {
    setOpen(false);
    setCargando(true);
    if (enElectron()) {
      try {
        const blob = await reportePdfService.mergeReporteYProtocolo(ot);
        if (!blob) { notify.warning(`La OT ${ot.otNumber} no tiene el reporte o el protocolo generados.`); return; }
        await abrirConVisorDelSistema(blob, `Reporte + protocolo OT ${ot.otNumber}.pdf`);
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'No se pudo armar el PDF completo');
      } finally { setCargando(false); }
      return;
    }
    const win = abrirVentanaParaPdf(`Reporte + protocolo OT ${ot.otNumber}`);
    try {
      const blob = await reportePdfService.mergeReporteYProtocolo(ot);
      if (!blob) {
        win?.close();
        notify.warning(`La OT ${ot.otNumber} no tiene el reporte o el protocolo generados.`);
        return;
      }
      mostrar(win, URL.createObjectURL(blob), `Reporte + protocolo OT ${ot.otNumber}`);
    } catch (err) {
      win?.close();
      notify.error(err instanceof Error ? err.message : 'No se pudo armar el PDF completo');
    } finally {
      setCargando(false);
    }
  };

  const handleClick = () => {
    if (tieneProtocolo) setOpen(o => !o);
    else void abrirSolo();
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={handleClick}
        disabled={cargando}
        className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50 disabled:opacity-50"
        title={ot.pdfUrl ? (tieneProtocolo ? 'Ver reporte, con o sin protocolo' : 'Ver reporte (PDF)') : 'Ver reporte si ya se generó desde la app de campo'}
      >
        {cargando ? 'Abriendo…' : 'Reporte'}
      </button>
      {open && tieneProtocolo && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-left">
          <button onClick={() => void abrirSolo()}
            className="block w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50">
            Solo reporte
          </button>
          <button onClick={() => void abrirCompleto()}
            className="block w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50">
            Reporte + protocolo <span className="text-slate-400">(un solo PDF)</span>
          </button>
        </div>
      )}
    </div>
  );
};
