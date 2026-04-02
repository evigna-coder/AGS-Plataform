import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useGoogleOAuth } from '../../hooks/useGoogleOAuth';
import { sendGmail } from '../../services/gmailService';
import { useAuth } from '../../contexts/AuthContext';
import type { GeneratePDFParams } from './pdf';

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";
const inputClass = "w-full border border-[#E5E5E5] rounded-md px-3 py-1.5 text-xs";

interface Props {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  pdfParams: GeneratePDFParams;
  defaultTo: string;
  defaultContactoNombre: string;
  presupuestoNumero: string;
}

function buildDefaultBody(contactoNombre: string, numero: string): string {
  return `<p>Estimado/a ${contactoNombre},</p>
<p>Adjunto presupuesto <strong>${numero}</strong> para su revisión.</p>
<p>Quedamos a disposición ante cualquier consulta.</p>
<p>Saludos cordiales,<br/>AGS Analítica</p>`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const EnviarPresupuestoModal: React.FC<Props> = ({
  open, onClose, onSent, pdfParams, defaultTo, defaultContactoNombre, presupuestoNumero,
}) => {
  const { usuario } = useAuth();
  const { requestToken, loading: oauthLoading } = useGoogleOAuth();

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'generating_pdf' | 'authorizing' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTo(defaultTo);
    setCc('');
    setSubject(`Presupuesto ${presupuestoNumero} — AGS Analítica`);
    setBody(buildDefaultBody(defaultContactoNombre || 'cliente', presupuestoNumero));
    setStatus('idle');
    setError('');
  }, [open, defaultTo, defaultContactoNombre, presupuestoNumero]);

  const handleSend = async () => {
    if (!to.trim()) { alert('Ingrese al menos un destinatario'); return; }

    try {
      setSending(true);
      setError('');

      // 1. Request OAuth token
      setStatus('authorizing');
      const accessToken = await requestToken();

      // 2. Generate PDF
      setStatus('generating_pdf');
      const { generatePresupuestoPDF } = await import('./pdf');
      const pdfBlob = await generatePresupuestoPDF(pdfParams);
      const pdfBase64 = await blobToBase64(pdfBlob);

      // 3. Send email
      setStatus('sending');
      const toList = to.split(',').map(e => e.trim()).filter(Boolean);
      const ccList = cc ? cc.split(',').map(e => e.trim()).filter(Boolean) : [];

      await sendGmail({
        accessToken,
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
        htmlBody: body,
        attachments: [{
          filename: `${presupuestoNumero}.pdf`,
          mimeType: 'application/pdf',
          base64Data: pdfBase64,
        }],
      });

      setStatus('sent');
      setTimeout(() => {
        onSent();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error enviando presupuesto:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setStatus('error');
    } finally {
      setSending(false);
    }
  };

  const statusMessages: Record<string, string> = {
    authorizing: 'Autorizando con Google...',
    generating_pdf: 'Generando PDF...',
    sending: 'Enviando email...',
    sent: 'Email enviado correctamente',
  };

  return (
    <Modal open={open} onClose={onClose} title="Enviar presupuesto por email" subtitle={presupuestoNumero} maxWidth="xl">
      <div className="space-y-3">
        <div>
          <label className={lbl}>De</label>
          <input value={usuario?.email || usuario?.displayName || ''} disabled className={`${inputClass} bg-slate-50 text-slate-400`} />
        </div>

        <div>
          <label className={lbl}>Para *</label>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            className={inputClass}
            placeholder="email@cliente.com (separar con coma para multiples)"
          />
        </div>

        <div>
          <label className={lbl}>CC</label>
          <input
            value={cc}
            onChange={e => setCc(e.target.value)}
            className={inputClass}
            placeholder="copia@empresa.com (opcional)"
          />
        </div>

        <div>
          <label className={lbl}>Asunto</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={lbl}>Mensaje</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            className={`${inputClass} font-sans`}
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
          </svg>
          <span>Se adjuntara automaticamente: <strong className="text-slate-500">{presupuestoNumero}.pdf</strong></span>
        </div>

        {status !== 'idle' && status !== 'error' && (
          <div className={`text-xs px-3 py-2 rounded-lg ${status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
            {statusMessages[status]}
          </div>
        )}

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end px-5 py-3 border-t border-[#E5E5E5] bg-[#F0F0F0] rounded-b-xl -mx-5 -mb-4 mt-3 gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={sending}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSend} disabled={sending || oauthLoading || !to.trim()}>
          {sending ? statusMessages[status] || 'Enviando...' : 'Enviar email'}
        </Button>
      </div>
    </Modal>
  );
};
