import { useState } from 'react';
import type { OrdenCompra, Proveedor } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useEnviarOrdenCompra, type EnviarOCStatus } from '../../hooks/useEnviarOrdenCompra';

const STATUS_MSG: Record<EnviarOCStatus, string> = {
  idle: 'Enviar', authorizing: 'Autorizando Gmail...', generating_pdf: 'Generando PDF...',
  sending: 'Enviando...', updating_firestore: 'Actualizando estado...', sent: 'Enviado', error: 'Enviar',
};

interface Props {
  open: boolean;
  oc: OrdenCompra;
  proveedor?: Proveedor | null;
  onClose: () => void;
  onSent: () => void;
}

interface RecipientOption { email: string; label: string; }

const splitEmails = (s: string) => s.split(',').map(e => e.trim()).filter(Boolean);

/**
 * Opciones de destinatario: contacto principal (email legacy) + cada
 * ContactoProveedor con email. Se deduplica por email (case-insensitive).
 */
function buildRecipientOptions(proveedor?: Proveedor | null): RecipientOption[] {
  const opts: RecipientOption[] = [];
  const seen = new Set<string>();
  const push = (email: string | null | undefined, label: string) => {
    const e = (email || '').trim();
    if (!e) return;
    const key = e.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    opts.push({ email: e, label });
  };
  if (proveedor) {
    push(proveedor.email, `${proveedor.contacto || 'Contacto principal'} — ${proveedor.email}`);
    for (const c of proveedor.contactos ?? []) {
      const nombre = c.nombre || 'Contacto';
      const rol = c.rol ? ` (${c.rol})` : '';
      push(c.email, `${nombre}${rol} — ${c.email}`);
    }
  }
  return opts;
}

export const EnviarOrdenCompraModal: React.FC<Props> = ({ open, oc, proveedor, onClose, onSent }) => {
  const options = buildRecipientOptions(proveedor);
  const principalEmail = (proveedor?.email || '').trim();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(principalEmail ? [principalEmail] : []));
  const [to, setTo] = useState(principalEmail);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(`Orden de compra ${oc.numero} - AGS Analitica`);
  const [body, setBody] = useState(
    `Estimados,\n\nAdjuntamos la orden de compra ${oc.numero}. Quedamos a la espera de su confirmacion.\n\nSaludos cordiales,\nAGS Analitica S.A.`,
  );
  const { send, status, error, sending } = useEnviarOrdenCompra(oc, onSent);

  // Los checkboxes rellenan "Para": mantienen las direcciones ad-hoc (las que el
  // usuario tipeó a mano y no son opciones) y reemplazan el set de opciones tildadas.
  const toggleRecipient = (email: string) => {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email); else next.add(email);
    setSelected(next);
    const optionEmails = new Set(options.map(o => o.email.toLowerCase()));
    const adHoc = splitEmails(to).filter(e => !optionEmails.has(e.toLowerCase()));
    setTo([...next, ...adHoc].join(', '));
  };

  const handleSend = () => {
    if (!to.trim()) { alert('Ingresá el email del proveedor'); return; }
    const htmlBody = body.split('\n').map(l => l || '<br/>').join('<br/>');
    send({ to: splitEmails(to), cc: splitEmails(cc), subject, htmlBody });
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="md" title={`Enviar OC ${oc.numero}`}
      subtitle="Por mail al proveedor (desde tu cuenta de Google)"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancelar</Button>
        <Button size="sm" onClick={handleSend} disabled={sending}>{sending ? STATUS_MSG[status] : 'Enviar'}</Button>
      </>}>
      <div className="space-y-3">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
        {status === 'sent' && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">Enviado correctamente ✓</div>}
        {options.length > 0 && (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Contactos del proveedor</label>
            <div className="space-y-1 border border-slate-200 rounded-lg px-3 py-2">
              {options.map(o => (
                <label key={o.email} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" className="accent-teal-600"
                    checked={selected.has(o.email)} onChange={() => toggleRecipient(o.email)} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <Input inputSize="sm" label="Para *" value={to} onChange={e => setTo(e.target.value)} placeholder="proveedor@dominio.com" />
        <Input inputSize="sm" label="CC (opcional)" value={cc} onChange={e => setCc(e.target.value)} placeholder="copia@dominio.com" />
        <Input inputSize="sm" label="Asunto" value={subject} onChange={e => setSubject(e.target.value)} />
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Mensaje</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <p className="text-[10px] text-slate-400">Se adjunta automaticamente el PDF de la OC. El mail sale desde tu cuenta de Google (Gmail).</p>
      </div>
    </Modal>
  );
};
