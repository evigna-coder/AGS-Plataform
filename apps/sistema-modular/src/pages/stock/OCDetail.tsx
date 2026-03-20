import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ordenesCompraService } from '../../services/firebaseService';
import type { OrdenCompra } from '@ags/shared';
import { ESTADO_OC_LABELS, ESTADO_OC_COLORS } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { OCInfoSidebar } from '../../components/stock/OCInfoSidebar';
import { OCItemsTable } from '../../components/stock/OCItemsTable';
import { OCStatusTransition } from '../../components/stock/OCStatusTransition';
import { useNavigateBack } from '../../hooks/useNavigateBack';

export const OCDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const [oc, setOc] = useState<OrdenCompra | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);

  useEffect(() => { if (id) loadOC(); }, [id]);

  const loadOC = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await ordenesCompraService.getById(id);
      if (!data) { alert('Orden de compra no encontrada'); navigate('/stock/ordenes-compra'); return; }
      setOc(data);
    } catch (err) {
      console.error('Error cargando OC:', err);
      alert('Error al cargar la orden de compra');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !oc) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando orden de compra...</p></div>;
  }

  const canEdit = oc.estado === 'borrador';
  const canReceive = oc.estado === 'confirmada' || oc.estado === 'en_transito';

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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{oc.numero}</h2>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_OC_COLORS[oc.estado]}`}>
                  {ESTADO_OC_LABELS[oc.estado]}
                </span>
              </div>
              <p className="text-xs text-slate-400">{oc.proveedorNombre}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canReceive && (
              <Button variant="outline" size="sm" onClick={() => setShowTransition(true)}>Registrar recepcion</Button>
            )}
            {canEdit && (
              <Link to={`/stock/ordenes-compra/${oc.id}/editar`}>
                <Button variant="outline" size="sm">Editar</Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={() => goBack()}>Volver</Button>
          </div>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <OCInfoSidebar oc={oc} onUpdate={loadOC} />
          <div className="flex-1 min-w-0 space-y-4">
            <OCItemsTable items={oc.items} moneda={oc.moneda} readOnly />
          </div>
        </div>
      </div>

      <OCStatusTransition
        oc={oc}
        open={showTransition}
        onClose={() => setShowTransition(false)}
        onUpdated={() => { setShowTransition(false); loadOC(); }}
      />

    </div>
  );
};
