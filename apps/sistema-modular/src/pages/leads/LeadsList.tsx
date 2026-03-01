import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { leadsService } from '../../services/firebaseService';

interface Lead {
  id: string;
  razonSocial: string;
  contacto: string;
  email: string;
  telefono: string;
  estado: 'nuevo' | 'contactado' | 'presupuestado' | 'convertido' | 'perdido';
  createdAt: string;
  updatedAt: string;
}

const estadoColors = {
  nuevo: 'bg-blue-100 text-blue-800',
  contactado: 'bg-yellow-100 text-yellow-800',
  presupuestado: 'bg-purple-100 text-purple-800',
  convertido: 'bg-green-100 text-green-800',
  perdido: 'bg-red-100 text-red-800',
};

const estadoLabels = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  presupuestado: 'Presupuestado',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

const emptyForm = { razonSocial: '', contacto: '', email: '', telefono: '' };

export const LeadsList: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => { loadLeads(); }, []);

  const loadLeads = async () => {
    try {
      setLoading(true); setError(null);
      const data = await leadsService.getAll();
      setLeads(data as Lead[]);
    } catch (err: any) {
      console.error('Error al cargar leads:', err);
      setError('Error al cargar los leads. Verifica la configuración de Firebase.');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!form.razonSocial.trim()) errs.razonSocial = 'Obligatorio';
    if (!form.contacto.trim()) errs.contacto = 'Obligatorio';
    if (!form.email.trim()) errs.email = 'Obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido';
    if (!form.telefono.trim()) errs.telefono = 'Obligatorio';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      setSaving(true);
      await leadsService.create({ ...form, estado: 'nuevo' });
      setShowCreate(false); setForm(emptyForm); setFormErrors({});
      loadLeads();
    } catch { alert('Error al crear el lead'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-slate-500">Cargando leads...</p></div>;
  if (error) return <Card><div className="text-center py-8"><p className="text-red-600 mb-4">{error}</p><Button onClick={loadLeads}>Reintentar</Button></div></Card>;

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader title="Leads / Consultas" count={leads.length}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Lead</Button>} />

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {leads.length === 0 ? (
          <Card><div className="text-center py-8">
            <p className="text-slate-400 mb-4">No hay leads registrados</p>
            <Button size="sm" onClick={() => setShowCreate(true)}>Crear primer lead</Button>
          </div></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Razón Social</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Contacto</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Email</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Teléfono</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Creado</th>
                    <th className="px-3 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs font-semibold text-slate-900">{lead.razonSocial}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{lead.contacto}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{lead.email}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{lead.telefono}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estadoColors[lead.estado]}`}>
                          {estadoLabels[lead.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{new Date(lead.createdAt).toLocaleDateString('es-AR')}</td>
                      <td className="px-3 py-2 text-right">
                        <Link to={`/leads/${lead.id}`}><Button variant="ghost" size="sm">Ver</Button></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setFormErrors({}); }}
        title="Nuevo Lead" subtitle="Registrar nueva consulta"
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? 'Creando...' : 'Crear Lead'}</Button>
        </>}>
        <div className="space-y-3">
          <Input inputSize="sm" label="Razón Social" value={form.razonSocial}
            onChange={e => setForm({ ...form, razonSocial: e.target.value })} error={formErrors.razonSocial} placeholder="Nombre de la empresa" />
          <Input inputSize="sm" label="Persona de Contacto" value={form.contacto}
            onChange={e => setForm({ ...form, contacto: e.target.value })} error={formErrors.contacto} placeholder="Nombre completo" />
          <Input inputSize="sm" label="Email" type="email" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} error={formErrors.email} placeholder="correo@ejemplo.com" />
          <Input inputSize="sm" label="Teléfono" type="tel" value={form.telefono}
            onChange={e => setForm({ ...form, telefono: e.target.value })} error={formErrors.telefono} placeholder="011 1234 5678" />
        </div>
      </Modal>
    </div>
  );
};
