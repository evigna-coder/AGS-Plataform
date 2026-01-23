import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { leadsService } from '../../services/firebaseService';

export const LeadNew: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    razonSocial: '',
    contacto: '',
    email: '',
    telefono: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.razonSocial.trim()) {
      newErrors.razonSocial = 'La razón social es obligatoria';
    }
    
    if (!formData.contacto.trim()) {
      newErrors.contacto = 'El contacto es obligatorio';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    
    if (!formData.telefono.trim()) {
      newErrors.telefono = 'El teléfono es obligatorio';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      await leadsService.create({
        razonSocial: formData.razonSocial,
        contacto: formData.contacto,
        email: formData.email,
        telefono: formData.telefono,
        estado: 'nuevo',
      });
      
      navigate('/leads');
    } catch (error: any) {
      console.error('Error al crear lead:', error);
      alert('Error al crear el lead. Verifica la configuración de Firebase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
          Nuevo Lead
        </h2>
        <p className="text-slate-500 mt-1">Registra una nueva consulta o lead</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Razón Social"
            value={formData.razonSocial}
            onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
            error={errors.razonSocial}
            placeholder="Nombre de la empresa"
            required
          />

          <Input
            label="Persona de Contacto"
            value={formData.contacto}
            onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
            error={errors.contacto}
            placeholder="Nombre completo"
            required
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
            placeholder="correo@ejemplo.com"
            required
          />

          <Input
            label="Teléfono"
            type="tel"
            value={formData.telefono}
            onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
            error={errors.telefono}
            placeholder="011 1234 5678"
            required
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Lead'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/leads')}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
