import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { importacionesService } from '../../services/firebaseService';
import type { Importacion } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { CrearPostaModal } from '../../components/postas/CrearPostaModal';
import { ImportacionInfoSidebar } from '../../components/stock/ImportacionInfoSidebar';
import { ImportacionEmbarqueSection } from '../../components/stock/ImportacionEmbarqueSection';
import { ImportacionAduanaSection } from '../../components/stock/ImportacionAduanaSection';
import { ImportacionVEPSection } from '../../components/stock/ImportacionVEPSection';
import { ImportacionGastosSection } from '../../components/stock/ImportacionGastosSection';
import { ImportacionDocumentosSection } from '../../components/stock/ImportacionDocumentosSection';

export const ImportacionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [imp, setImp] = useState<Importacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCrearPosta, setShowCrearPosta] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await importacionesService.getById(id);
      if (!data) {
        alert('Importacion no encontrada');
        navigate('/stock/importaciones');
        return;
      }
      setImp(data);
    } catch (err) {
      console.error('Error cargando importacion:', err);
      alert('Error al cargar importacion');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <p className="text-xs text-slate-400">Cargando...</p>
      </div>
    );
  }

  if (!imp) return null;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{imp.numero}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Importacion de {imp.proveedorNombre}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCrearPosta(true)}>Crear posta</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/stock/importaciones')}>Volver</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-5 p-5 h-full">
          <div className="w-72 shrink-0">
            <ImportacionInfoSidebar imp={imp} onUpdate={loadData} />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <ImportacionEmbarqueSection imp={imp} onUpdate={loadData} />
            <ImportacionAduanaSection imp={imp} onUpdate={loadData} />
            <ImportacionVEPSection imp={imp} onUpdate={loadData} />
            <ImportacionGastosSection imp={imp} onUpdate={loadData} />
            <ImportacionDocumentosSection imp={imp} onUpdate={loadData} />
          </div>
        </div>
      </div>
      {showCrearPosta && id && (
        <CrearPostaModal
          tipoEntidad="importacion"
          entidadId={id}
          entidadNumero={imp.numero}
          entidadDescripcion={`Importacion de ${imp.proveedorNombre}`}
          categoriaDefault="administracion"
          onClose={() => setShowCrearPosta(false)}
        />
      )}
    </div>
  );
};
