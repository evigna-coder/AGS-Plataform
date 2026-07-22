import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { importacionesService } from '../../services/firebaseService';
import type { Importacion } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { ImportacionInfoSidebar } from '../../components/stock/ImportacionInfoSidebar';
import { ImportacionEmbarqueSection } from '../../components/stock/ImportacionEmbarqueSection';
import { ImportacionAduanaSection } from '../../components/stock/ImportacionAduanaSection';
import { ImportacionVEPSection } from '../../components/stock/ImportacionVEPSection';
import { ImportacionGastosSection } from '../../components/stock/ImportacionGastosSection';
import { ImportacionDocumentosSection } from '../../components/stock/ImportacionDocumentosSection';
import { ImportacionItemsSection } from '../../components/stock/ImportacionItemsSection';
import { ImportacionIngresarStockModal } from '../../components/stock/ImportacionIngresarStockModal';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useIngresarStock } from '../../hooks/useIngresarStock';
import { resumenRecepcion, describirFaltantes } from '../../utils/importacionRecepcion';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useDeclareParent } from '../../hooks/useDeclareParent';

export const ImportacionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack();

  useDeclareParent('/stock/importaciones');
  const [imp, setImp] = useState<Importacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIngresarStock, setShowIngresarStock] = useState(false);
  const confirm = useConfirm();
  const { cerrarIncompleta, loading: cerrando, error: cerrarError } = useIngresarStock();

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

  const puedeIngresarStock = (imp.estado === 'recibido' || imp.estado === 'despachado') && !imp.stockIngresado;
  // Avance de recepción (I3): con faltante se puede re-ingresar en N tandas o cerrar incompleta.
  const resumen = resumenRecepcion(imp);
  const recepcionParcial = puedeIngresarStock && resumen.huboRecepcion && !resumen.completo;

  const handleCerrarIncompleta = async () => {
    const ok = await confirm({
      title: 'Cerrar recepción incompleta',
      message: `El embarque quedará terminado SIN el faltante (recibido ${resumen.recibido} de ${resumen.pedido}):\n\n${describirFaltantes(resumen.faltantes)}\n\nNo se van a poder ingresar más unidades por esta importación. El faltante queda asentado en la importación.`,
      confirmLabel: 'Cerrar incompleta',
      danger: true,
    });
    if (!ok) return;
    const done = await cerrarIncompleta(imp, describirFaltantes(resumen.faltantes));
    if (done) loadData();
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Importación · OC {imp.ordenCompraNumero}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {imp.proveedorNombre}
              {recepcionParcial && (
                <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  Recibido {resumen.recibido} de {resumen.pedido} · faltan {resumen.faltantes.length} ítem{resumen.faltantes.length > 1 ? 's' : ''}
                </span>
              )}
              {imp.recepcionCerradaIncompleta && (
                <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                  Cerrada incompleta
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {recepcionParcial && (
              <Button variant="outline" size="sm" onClick={() => void handleCerrarIncompleta()} disabled={cerrando}>
                {cerrando ? 'Cerrando...' : 'Cerrar incompleta'}
              </Button>
            )}
            {puedeIngresarStock && (
              <Button size="sm" onClick={() => setShowIngresarStock(true)}>
                {recepcionParcial ? 'Ingresar faltante' : 'Ingresar al stock'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => goBack()}>Volver</Button>
          </div>
        </div>
        {cerrarError && (
          <p className="px-5 pb-2 text-xs text-red-600">{cerrarError}</p>
        )}
        {imp.recepcionCerradaIncompleta && imp.notaRecepcionIncompleta && (
          <div className="px-5 pb-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-[11px] text-amber-800 whitespace-pre-wrap">{imp.notaRecepcionIncompleta}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-5 p-5 h-full">
          <div className="w-72 shrink-0">
            <ImportacionInfoSidebar imp={imp} onUpdate={loadData} />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <ImportacionItemsSection imp={imp} />
            <ImportacionEmbarqueSection imp={imp} onUpdate={loadData} />
            <ImportacionAduanaSection imp={imp} onUpdate={loadData} />
            <ImportacionVEPSection imp={imp} onUpdate={loadData} />
            <ImportacionGastosSection imp={imp} onUpdate={loadData} />
            <ImportacionDocumentosSection imp={imp} onUpdate={loadData} />
          </div>
        </div>
      </div>

      {showIngresarStock && imp && (
        <ImportacionIngresarStockModal
          imp={imp}
          onClose={() => setShowIngresarStock(false)}
          onSuccess={() => {
            setShowIngresarStock(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
