import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Sistema } from '@ags/shared';
import { sistemasService, leadsService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

// ─── Sub-component: header branding ──────────────────────────────────────────
function PublicHeader() {
  return (
    <header className="bg-indigo-600 px-5 py-4 flex items-center gap-3">
      <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
        </svg>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-indigo-200 uppercase tracking-widest">AGS Analítica</p>
        <p className="text-sm font-semibold text-white">Servicio técnico de equipos</p>
      </div>
    </header>
  );
}

// ─── Sub-component: support form ─────────────────────────────────────────────
interface SoporteFormProps {
  sistema: Sistema;
  agsId: string;
  onSuccess: () => void;
}

function SoporteForm({ sistema, agsId, onSuccess }: SoporteFormProps) {
  const [form, setForm] = useState({ razonSocial: '', contacto: '', email: '', telefono: '', motivoContacto: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await leadsService.create({
        clienteId: null,
        contactoId: null,
        razonSocial: form.razonSocial,
        contacto: form.contacto,
        email: form.email,
        telefono: form.telefono,
        motivoLlamado: 'soporte',
        motivoContacto: form.motivoContacto,
        sistemaId: sistema.id,
        estado: 'nuevo',
        postas: [],
        asignadoA: null,
        derivadoPor: null,
        source: 'qr',
        sistemaAgsVisibleId: agsId,
      });
      onSuccess();
    } catch (err) {
      setError('No se pudo enviar la solicitud. Intentá de nuevo.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Empresa / Razón social" value={form.razonSocial} onChange={set('razonSocial')} required placeholder="Ej: Laboratorios XYZ S.A." />
      <Input label="Nombre de contacto" value={form.contacto} onChange={set('contacto')} required placeholder="Ej: María García" />
      <Input label="Email" type="email" value={form.email} onChange={set('email')} required placeholder="contacto@empresa.com" />
      <Input label="Teléfono" type="tel" value={form.telefono} onChange={set('telefono')} required placeholder="+54 9 11 ..." />
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">¿Cuál es el problema?</label>
        <textarea
          value={form.motivoContacto}
          onChange={set('motivoContacto')}
          required
          rows={3}
          placeholder="Describí brevemente el problema o lo que necesitás..."
          className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? 'Enviando...' : 'Solicitar soporte'}
      </Button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EquipoPublicPage() {
  const { agsId } = useParams<{ agsId: string }>();
  const { isAuthenticated, usuario } = useAuth();
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!agsId) return;
    sistemasService.getByAgsVisibleId(agsId)
      .then(setSistema)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [agsId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!sistema) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="text-center space-y-2">
            <p className="text-slate-800 font-semibold">Equipo no encontrado</p>
            <p className="text-sm text-slate-400">El ID <span className="font-mono">{agsId}</span> no corresponde a ningún equipo registrado.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PublicHeader />

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">
        {/* Equipment card */}
        <Card compact>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">Equipo registrado</p>
              <p className="text-base font-semibold text-slate-900">{sistema.nombre}</p>
              {sistema.software && <p className="text-xs text-slate-500 mt-0.5">{sistema.software}</p>}
            </div>
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg font-mono">
              {agsId}
            </span>
          </div>
        </Card>

        {/* Engineer banner (if logged in) */}
        {isAuthenticated && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-800">
              Vista como <span className="font-semibold">{usuario?.displayName}</span> — Ingeniero AGS
            </p>
          </div>
        )}

        {/* Form or success */}
        <Card>
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-slate-800">Solicitud enviada</p>
              <p className="text-sm text-slate-500">Un ingeniero de AGS Analítica se comunicará a la brevedad.</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800 mb-4">Solicitar soporte técnico</p>
              <SoporteForm sistema={sistema} agsId={agsId!} onSuccess={() => setSubmitted(true)} />
            </>
          )}
        </Card>

        <p className="text-center text-[11px] text-slate-400 pb-4">
          AGS Analítica · soporte@agsanalitica.com
        </p>
      </div>
    </div>
  );
}
