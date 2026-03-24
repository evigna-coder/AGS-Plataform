import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { proveedoresService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { Proveedor } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';

const tipoBadge = (tipo: string) =>
  tipo === 'internacional'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700';

const Field: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '—'}</p>
  </div>
);

interface FormState {
  nombre: string; tipo: 'nacional' | 'internacional';
  contacto: string; email: string; telefono: string; direccion: string;
  pais: string; cuit: string; condicionesPago: string; moneda: string;
  banco: string; cuentaBancaria: string; swift: string; iban: string;
  bancoIntermediario: string; swiftIntermediario: string; abaIntermediario: string;
  notas: string;
}

const toForm = (p: Proveedor): FormState => ({
  nombre: p.nombre, tipo: p.tipo || 'nacional',
  contacto: p.contacto || '', email: p.email || '', telefono: p.telefono || '',
  direccion: p.direccion || '', pais: p.pais || '', cuit: p.cuit || '',
  condicionesPago: p.condicionesPago || '', moneda: p.moneda || '',
  banco: p.banco || '', cuentaBancaria: p.cuentaBancaria || '',
  swift: p.swift || '', iban: p.iban || '',
  bancoIntermediario: p.bancoIntermediario || '',
  swiftIntermediario: p.swiftIntermediario || '',
  abaIntermediario: p.abaIntermediario || '', notas: p.notas || '',
});

export const ProveedorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(toForm({} as Proveedor));

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await proveedoresService.getById(id);
      if (data) { setProveedor(data); setForm(toForm(data)); }
      else { alert('Proveedor no encontrado'); navigate('/stock/proveedores'); }
    } catch (err) { console.error('Error cargando proveedor:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    if (!id || !form.nombre.trim()) return;
    setSaving(true);
    try {
      const dataToSave = {
        nombre: form.nombre.trim(), tipo: form.tipo,
        contacto: form.contacto.trim() || null, email: form.email.trim() || null,
        telefono: form.telefono.trim() || null, direccion: form.direccion.trim() || null,
        pais: form.pais.trim() || null, cuit: form.cuit.trim() || null,
        condicionesPago: form.condicionesPago.trim() || null,
        moneda: (form.moneda as any) || null,
        banco: form.banco.trim() || null, cuentaBancaria: form.cuentaBancaria.trim() || null,
        swift: form.swift.trim() || null, iban: form.iban.trim() || null,
        bancoIntermediario: form.bancoIntermediario.trim() || null,
        swiftIntermediario: form.swiftIntermediario.trim() || null,
        abaIntermediario: form.abaIntermediario.trim() || null,
        notas: form.notas.trim() || null,
      };
      await proveedoresService.update(id, dataToSave);
      setProveedor(prev => prev ? { ...prev, ...dataToSave } as Proveedor : prev);
      setEditing(false);
    } catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const set = (key: keyof FormState, value: string) => setForm(f => ({ ...f, [key]: value }));

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-xs text-slate-400">Cargando proveedor...</p></div>;
  }
  if (!proveedor) {
    return <div className="text-center py-12"><p className="text-xs text-slate-400">Proveedor no encontrado</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{proveedor.nombre}</h2>
              <p className="text-xs text-slate-400">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tipoBadge(proveedor.tipo)}`}>
                  {proveedor.tipo === 'internacional' ? 'Internacional' : 'Nacional'}
                </span>
                {proveedor.activo ? <span className="ml-2 text-green-600">Activo</span> : <span className="ml-2 text-slate-400">Inactivo</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => goBack()}>Volver</Button>
                <Button size="sm" onClick={() => setEditing(true)}>Editar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm(toForm(proveedor)); }}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          {/* Sidebar */}
          <div className="w-72 shrink-0 space-y-4">
            <Card compact>
              {editing ? (
                <div className="space-y-3">
                  <Input inputSize="sm" label="Nombre *" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Tipo</label>
                    <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white">
                      <option value="nacional">Nacional</option>
                      <option value="internacional">Internacional</option>
                    </select>
                  </div>
                  <Input inputSize="sm" label="Contacto" value={form.contacto} onChange={e => set('contacto', e.target.value)} />
                  <Input inputSize="sm" label="Email" value={form.email} onChange={e => set('email', e.target.value)} />
                  <Input inputSize="sm" label="Telefono" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
                  <Input inputSize="sm" label="Pais" value={form.pais} onChange={e => set('pais', e.target.value)} />
                  <Input inputSize="sm" label="CUIT" value={form.cuit} onChange={e => set('cuit', e.target.value)} />
                  <Input inputSize="sm" label="Notas" value={form.notas} onChange={e => set('notas', e.target.value)} />
                </div>
              ) : (
                <div className="space-y-3">
                  <Field label="Contacto" value={proveedor.contacto} />
                  <Field label="Email" value={proveedor.email} />
                  <Field label="Telefono" value={proveedor.telefono} />
                  <Field label="Pais" value={proveedor.pais} />
                  <Field label="CUIT" value={proveedor.cuit} />
                  {proveedor.notas && <Field label="Notas" value={proveedor.notas} />}
                </div>
              )}
            </Card>
          </div>

          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-4">
            <Card title="Informacion general" compact>
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Input inputSize="sm" label="Direccion" value={form.direccion} onChange={e => set('direccion', e.target.value)} />
                  </div>
                  <Input inputSize="sm" label="Condiciones de pago" value={form.condicionesPago} onChange={e => set('condicionesPago', e.target.value)} />
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Moneda</label>
                    <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white">
                      <option value="">Sin especificar</option>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><Field label="Direccion" value={proveedor.direccion} /></div>
                  <Field label="Condiciones de pago" value={proveedor.condicionesPago} />
                  <Field label="Moneda" value={proveedor.moneda} />
                </div>
              )}
            </Card>

            {(proveedor.tipo === 'internacional' || (editing && form.tipo === 'internacional')) && (
              <Card title="Datos bancarios" compact>
                {editing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Input inputSize="sm" label="Banco" value={form.banco} onChange={e => set('banco', e.target.value)} />
                    <Input inputSize="sm" label="Cuenta bancaria" value={form.cuentaBancaria} onChange={e => set('cuentaBancaria', e.target.value)} />
                    <Input inputSize="sm" label="SWIFT" value={form.swift} onChange={e => set('swift', e.target.value)} />
                    <Input inputSize="sm" label="IBAN" value={form.iban} onChange={e => set('iban', e.target.value)} />
                    <Input inputSize="sm" label="Banco intermediario" value={form.bancoIntermediario} onChange={e => set('bancoIntermediario', e.target.value)} />
                    <Input inputSize="sm" label="SWIFT intermediario" value={form.swiftIntermediario} onChange={e => set('swiftIntermediario', e.target.value)} />
                    <Input inputSize="sm" label="ABA intermediario" value={form.abaIntermediario} onChange={e => set('abaIntermediario', e.target.value)} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Banco" value={proveedor.banco} />
                    <Field label="Cuenta bancaria" value={proveedor.cuentaBancaria} />
                    <Field label="SWIFT" value={proveedor.swift} />
                    <Field label="IBAN" value={proveedor.iban} />
                    <Field label="Banco intermediario" value={proveedor.bancoIntermediario} />
                    <Field label="SWIFT intermediario" value={proveedor.swiftIntermediario} />
                    <Field label="ABA intermediario" value={proveedor.abaIntermediario} />
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
