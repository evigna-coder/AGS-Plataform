import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
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

const estados: Lead['estado'][] = ['nuevo', 'contactado', 'presupuestado', 'convertido', 'perdido'];
const estadoLabels: Record<Lead['estado'], string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  presupuestado: 'Presupuestado',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

export const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    razonSocial: '',
    contacto: '',
    email: '',
    telefono: '',
    estado: 'nuevo' as Lead['estado'],
  });

  useEffect(() => {
    if (id) loadLead();
  }, [id]);

  const loadLead = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await leadsService.getById(id);
      if (data) {
        setLead(data as Lead);
        setFormData({
          razonSocial: data.razonSocial || '',
          contacto: data.contacto || '',
          email: data.email || '',
          telefono: data.telefono || '',
          estado: data.estado || 'nuevo',
        });
      } else {
        alert('Lead no encontrado');
        navigate('/leads');
      }
    } catch (error: any) {
      console.error('Error al cargar lead:', error);
      alert('Error al cargar el lead. Verifica la configuración de Firebase.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await leadsService.update(id, formData);
      await loadLead();
      alert('Lead actualizado correctamente');
    } catch (error: any) {
      console.error('Error al actualizar lead:', error);
      alert('Error al actualizar el lead.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('¿Estás seguro de eliminar este lead?')) return;
    try {
      await leadsService.delete(id);
      navigate('/leads');
    } catch (error: any) {
      console.error('Error al eliminar lead:', error);
      alert('Error al eliminar el lead.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Cargando lead...</p>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      {/* Compact header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/leads')}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                {lead.razonSocial}
              </h2>
              <p className="text-xs text-slate-400">
                Lead &middot; {estadoLabels[lead.estado]}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button size="sm" variant="danger" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          {/* Left column — contact & estado */}
          <div className="w-72 shrink-0 space-y-4">
            <Card compact>
              <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">
                Contacto
              </p>
              <div className="space-y-3">
                <Input
                  label="Razón Social"
                  inputSize="sm"
                  value={formData.razonSocial}
                  onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                />
                <Input
                  label="Persona de Contacto"
                  inputSize="sm"
                  value={formData.contacto}
                  onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  inputSize="sm"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                <Input
                  label="Teléfono"
                  type="tel"
                  inputSize="sm"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
            </Card>

            <Card compact>
              <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">
                Estado
              </p>
              <SearchableSelect
                value={formData.estado}
                onChange={(value) => setFormData({ ...formData, estado: value as Lead['estado'] })}
                options={estados.map((e) => ({ value: e, label: estadoLabels[e] }))}
                placeholder="Seleccionar estado..."
              />
            </Card>
          </div>

          {/* Right column — timeline */}
          <div className="flex-1 min-w-0 space-y-4">
            <Card compact>
              <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">
                Actividad
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 mb-0.5">Creado</p>
                  <p className="text-xs text-slate-700">
                    {new Date(lead.createdAt).toLocaleString('es-AR')}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400 mb-0.5">Actualizado</p>
                  <p className="text-xs text-slate-700">
                    {new Date(lead.updatedAt).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
