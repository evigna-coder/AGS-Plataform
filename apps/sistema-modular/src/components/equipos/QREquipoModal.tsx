import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface QREquipoModalProps {
  agsVisibleId: string;
  equipoNombre: string;
  onClose: () => void;
}

const QR_BASE_URL = 'https://portal.agsanalitica.com/equipo';

export default function QREquipoModal({ agsVisibleId, equipoNombre, onClose }: QREquipoModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrUrl = `${QR_BASE_URL}/${agsVisibleId}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    }).then(() => {
      setQrDataUrl(canvasRef.current!.toDataURL('image/png'));
    }).catch(console.error);
  }, [qrUrl]);

  function handleDownload() {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${agsVisibleId}.png`;
    a.click();
  }

  return (
    <Modal open onClose={onClose} title="Código QR del equipo" maxWidth="sm">
      <div className="flex flex-col items-center gap-4 py-2">
        {/* Sticker preview */}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm w-full max-w-xs">
          <span className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">AGS Analítica</span>
          <canvas ref={canvasRef} className="rounded-md" />
          <div className="text-center space-y-0.5">
            <p className="text-[11px] font-medium text-slate-700">Servicio técnico del equipo</p>
            <p className="text-[10px] text-slate-400">Escanee para solicitar soporte o ver historial</p>
            <p className="text-[11px] font-semibold text-indigo-600 mt-1">ID: {agsVisibleId}</p>
          </div>
        </div>

        {/* Equipment name reference */}
        <p className="text-xs text-slate-500 text-center">{equipoNombre}</p>

        {/* URL */}
        <p className="text-[10px] text-slate-400 font-mono break-all text-center">{qrUrl}</p>

        <div className="flex gap-2 w-full">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cerrar</Button>
          <Button variant="primary" className="flex-1" onClick={handleDownload} disabled={!qrDataUrl}>
            Descargar PNG
          </Button>
        </div>
      </div>
    </Modal>
  );
}
