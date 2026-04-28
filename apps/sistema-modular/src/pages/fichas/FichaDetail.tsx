import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fichasService, loanersService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FichaInfoSidebar } from '../../components/fichas/FichaInfoSidebar';
import { FichaHistorialSection } from '../../components/fichas/FichaHistorialSection';
import { FichaRepuestosSection } from '../../components/fichas/FichaRepuestosSection';
import { FichaLoanerLink } from '../../components/fichas/FichaLoanerLink';
import { FichaItemCard } from '../../components/fichas/FichaItemCard';
import { EditFichaModal } from '../../components/fichas/EditFichaModal';
import { GenerarRemitoDevolucionModal } from '../../components/remitos/GenerarRemitoDevolucionModal';
import type { FichaPropiedad, Loaner } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';

export function FichaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const [ficha, setFicha] = useState<FichaPropiedad | null>(null);
  const [loading, setLoading] = useState(true);
  const [loanerModalOpen, setLoanerModalOpen] = useState(false);
  const [disponibles, setDisponibles] = useState<Loaner[]>([]);
  const [selectedLoanerId, setSelectedLoanerId] = useState('');
  const [asigning, setAsigning] = useState(false);
  const [remitoModalOpen, setRemitoModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = fichasService.subscribeById(id, (f) => {
      if (!f) { navigate('/fichas'); return; }
      setFicha(f);
      setLoading(false);
    }, (err) => {
      console.error('Error loading ficha:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [id, navigate]);

  const openLoanerPicker = async () => {
    const d = await loanersService.getDisponibles();
    setDisponibles(d);
    setLoanerModalOpen(true);
  };

  const handleAsignarLoaner = async () => {
    if (!ficha || !selectedLoanerId) return;
    setAsigning(true);
    try {
      const loaner = disponibles.find(l => l.id === selectedLoanerId);
      if (!loaner) return;
      await loanersService.registrarPrestamo(selectedLoanerId, {
        clienteId: ficha.clienteId,
        clienteNombre: ficha.clienteNombre,
        establecimientoId: ficha.establecimientoId || null,
        establecimientoNombre: ficha.establecimientoNombre || null,
        motivo: `Reemplazo por ficha ${ficha.numero}`,
        fichaId: ficha.id,
        fichaNumero: ficha.numero,
        fechaSalida: new Date().toISOString(),
        estado: 'activo',
      });
      await fichasService.update(ficha.id, {
        loanerId: selectedLoanerId,
        loanerCodigo: loaner.codigo,
      });
      setLoanerModalOpen(false);
      setSelectedLoanerId('');
    } finally {
      setAsigning(false);
    }
  };

  if (loading || !ficha) {
    return <p className="text-center text-slate-400 py-12">Cargando...</p>;
  }

  // ¿Hay items listos para entregar (para mostrar el botón de remito)?
  const hasItemsParaRemito = ficha.items.some(i =>
    i.estado === 'listo_para_entrega' || i.estado === 'derivado_proveedor'
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{ficha.numero}</h1>
            <p className="text-xs text-slate-500">
              {ficha.clienteNombre} · {ficha.items.length} item{ficha.items.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasItemsParaRemito && (
            <Button variant="primary" size="sm" onClick={() => setRemitoModalOpen(true)}>
              Generar remito
            </Button>
          )}
          {!ficha.loanerId && ficha.estado !== 'entregado' && (
            <Button variant="secondary" size="sm" onClick={openLoanerPicker}>Asignar loaner</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setEditModalOpen(true)}>Editar</Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="flex gap-5 px-5 py-4">
          {/* Sidebar */}
          <div className="w-72 shrink-0">
            <FichaInfoSidebar ficha={ficha} />
          </div>
          {/* Main */}
          <div className="flex-1 space-y-4">
            <FichaLoanerLink ficha={ficha} />
            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Items recibidos
                </h2>
              </div>
              {ficha.items.length === 0 ? (
                <p className="text-sm text-slate-400 px-3 py-6 text-center bg-white rounded-lg border border-slate-200">
                  Sin items registrados — agregalos desde "Editar"
                </p>
              ) : (
                ficha.items.map(item => (
                  <FichaItemCard
                    key={item.id}
                    ficha={ficha}
                    item={item}
                    canDelete={ficha.items.length > 1 && item.estado !== 'entregado'}
                    defaultExpanded={ficha.items.length === 1}
                    onUpdate={() => { /* subscription refresh */ }}
                  />
                ))
              )}
            </div>
            {/* A nivel ficha: historial global, repuestos, etc. */}
            <FichaHistorialSection historial={ficha.historial} />
            <FichaRepuestosSection ficha={ficha} onUpdate={() => { /* subscription refresh */ }} />
          </div>
        </div>
      </div>

      {/* Loaner picker modal */}
      <Modal open={loanerModalOpen} onClose={() => setLoanerModalOpen(false)} title="Asignar loaner" footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setLoanerModalOpen(false)}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleAsignarLoaner} disabled={!selectedLoanerId || asigning}>
            {asigning ? 'Asignando...' : 'Asignar'}
          </Button>
        </div>
      }>
        {disponibles.length === 0 ? (
          <p className="text-sm text-slate-400">No hay loaners disponibles</p>
        ) : (
          <div className="space-y-2">
            {disponibles.map(l => (
              <label key={l.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${selectedLoanerId === l.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="loaner" value={l.id} checked={selectedLoanerId === l.id} onChange={() => setSelectedLoanerId(l.id)} />
                <div>
                  <p className="text-sm font-medium text-slate-700">{l.codigo} — {l.descripcion}</p>
                  <p className="text-xs text-slate-500">{l.categoriaEquipo || 'General'} {l.serie ? `| S/N: ${l.serie}` : ''}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal>

      {/* Generar remito */}
      <GenerarRemitoDevolucionModal
        open={remitoModalOpen}
        onClose={() => setRemitoModalOpen(false)}
        ficha={ficha}
      />

      {/* Editar ficha */}
      <EditFichaModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        ficha={ficha}
      />
    </div>
  );
}
