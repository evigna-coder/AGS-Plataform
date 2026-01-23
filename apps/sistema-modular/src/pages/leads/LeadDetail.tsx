import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
    if (id) {
      loadLead();
    }
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
    
    if (!confirm('¿Estás seguro de eliminar este lead?')) {
      return;
    }

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

  if (!lead) {
    return null;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            Detalle del Lead
          </h2>
          <p className="text-slate-500 mt-1">{lead.razonSocial}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="danger" onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </div>

      <Card title="Información del Lead">
        <div className="space-y-4">
          <Input
            label="Razón Social"
            value={formData.razonSocial}
            onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
          />

          <Input
            label="Persona de Contacto"
            value={formData.contacto}
            onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            label="Teléfono"
            type="tel"
            value={formData.telefono}
            onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
          />

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
              Estado
            </label>
            <select
              value={formData.estado}
              onChange={(e) => setFormData({ ...formData, estado: e.target.value as Lead['estado'] })}
              className="w-full border rounded-lg px-4 py-2.5 text-sm bg-white border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            >
              {estados.map((estado) => (
                <option key={estado} value={estado}>
                  {estadoLabels[estado]}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
              <div>
                <span className="font-bold">Creado:</span>{' '}
                {new Date(lead.createdAt).toLocaleString('es-AR')}
              </div>
              <div>
                <span className="font-bold">Actualizado:</span>{' '}
                {new Date(lead.updatedAt).toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/leads')}>
              Volver a Lista
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
