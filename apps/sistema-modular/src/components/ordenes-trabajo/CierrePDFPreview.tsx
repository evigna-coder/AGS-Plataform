import { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';

interface Props {
  otNumber: string;
}

export const CierrePDFPreview: React.FC<Props> = ({ otNumber }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!otNumber) return;
    setLoading(true);
    setError(false);

    // Try multiple possible paths for the PDF
    const paths = [
      `reportes/${otNumber}/reporte.pdf`,
      `reportes/${otNumber}.pdf`,
      `reports/${otNumber}/reporte.pdf`,
    ];

    const tryPaths = async () => {
      for (const path of paths) {
        try {
          const url = await getDownloadURL(ref(storage, path));
          setPdfUrl(url);
          setLoading(false);
          return;
        } catch {
          // Try next path
        }
      }
      setLoading(false);
      setError(true);
    };

    tryPaths();
  }, [otNumber]);

  if (loading) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 text-center">
        <p className="text-xs text-slate-400">Buscando PDF del reporte...</p>
      </div>
    );
  }

  if (error || !pdfUrl) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 text-center">
        <p className="text-xs text-slate-400">PDF del reporte no disponible</p>
        <p className="text-[10px] text-slate-300 mt-1">El reporte debe generarse primero desde reportes-ot</p>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
        <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">Reporte tecnico PDF</p>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-teal-600 hover:underline font-medium">
          Abrir en nueva ventana
        </a>
      </div>
      <iframe src={pdfUrl} className="w-full h-[400px]" title={`Reporte OT-${otNumber}`} />
    </div>
  );
};
