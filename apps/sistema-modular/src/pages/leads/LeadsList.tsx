import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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

export const LeadsList: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await leadsService.getAll();
      setLeads(data as Lead[]);
    } catch (err: any) {
      console.error('Error al cargar leads:', err);
      setError('Error al cargar los leads. Verifica la configuración de Firebase.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Cargando leads...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadLeads}>Reintentar</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            Leads / Consultas
          </h2>
          <p className="text-slate-500 mt-1">
            {leads.length} {leads.length === 1 ? 'lead' : 'leads'} registrados
          </p>
        </div>
        <Link to="/leads/nuevo">
          <Button>+ Nuevo Lead</Button>
        </Link>
      </div>

      {leads.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">No hay leads registrados</p>
            <Link to="/leads/nuevo">
              <Button>Crear Primer Lead</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {leads.map((lead) => (
            <Card key={lead.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-black text-slate-900">
                      {lead.razonSocial}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${estadoColors[lead.estado]}`}
                    >
                      {estadoLabels[lead.estado]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-slate-600">
                    <div>
                      <span className="font-bold">Contacto:</span> {lead.contacto}
                    </div>
                    <div>
                      <span className="font-bold">Email:</span> {lead.email}
                    </div>
                    <div>
                      <span className="font-bold">Teléfono:</span> {lead.telefono}
                    </div>
                    <div>
                      <span className="font-bold">Creado:</span>{' '}
                      {new Date(lead.createdAt).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <Link to={`/leads/${lead.id}`}>
                    <Button variant="ghost" size="sm">
                      Ver Detalle
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
