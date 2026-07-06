import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-4xl mb-3">🧭</p>
        <h2 className="text-base font-semibold text-slate-900 tracking-tight mb-1">Pagina no encontrada</h2>
        <p className="text-xs text-slate-400 mb-4">La ruta no existe o fue movida.</p>
        <Button size="sm" variant="outline" onClick={() => navigate('/')}>Volver al inicio</Button>
      </div>
    </div>
  );
};
