import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loanersService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { LoanerInfoSidebar } from '../../components/loaners/LoanerInfoSidebar';
import { LoanerPrestamosSection } from '../../components/loaners/LoanerPrestamosSection';
import { LoanerExtraccionesSection } from '../../components/loaners/LoanerExtraccionesSection';
import { LoanerVentaSection } from '../../components/loaners/LoanerVentaSection';
import { LoanerPrestamoModal } from '../../components/loaners/LoanerPrestamoModal';
import { LoanerDevolucionModal } from '../../components/loaners/LoanerDevolucionModal';
import { LoanerExtraccionModal } from '../../components/loaners/LoanerExtraccionModal';
import { LoanerVentaModal } from '../../components/loaners/LoanerVentaModal';
import type { Loaner } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';

export function LoanerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const [loaner, setLoaner] = useState<Loaner | null>(null);
  const [loading, setLoading] = useState(true);

  const [prestamoOpen, setPrestamoOpen] = useState(false);
  const [devolucionOpen, setDevolucionOpen] = useState(false);
  const [extraccionOpen, setExtraccionOpen] = useState(false);
  const [ventaOpen, setVentaOpen] = useState(false);

  const loadLoaner = useCallback(async () => {
    if (!id) return;
    const l = await loanersService.getById(id);
    if (!l) return navigate('/loaners');
    setLoaner(l);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { loadLoaner(); }, [loadLoaner]);

  const prestamoActivo = loaner?.prestamos.find(p => p.estado === 'activo');

  const handlePrestamo = async (data: {
    clienteId: string; clienteNombre: string;
    establecimientoId: string | null; establecimientoNombre: string | null;
    motivo: string; fechaRetornoPrevista: string | null;
    remitoSalidaId: string | null; remitoSalidaNumero: string | null;
  }) => {
    if (!loaner) return;
    await loanersService.registrarPrestamo(loaner.id, {
      ...data,
      fechaSalida: new Date().toISOString(),
      estado: 'activo',
    });
    await loadLoaner();
  };

  const handleDevolucion = async (data: { fechaRetornoReal: string; condicionRetorno: string }) => {
    if (!loaner || !prestamoActivo) return;
    await loanersService.registrarDevolucion(loaner.id, prestamoActivo.id, data);
    await loadLoaner();
  };

  const handleExtraccion = async (data: {
    descripcion: string; codigoArticulo: string | null;
    destino: string; otNumber: string | null; extraidoPor: string;
  }) => {
    if (!loaner) return;
    await loanersService.registrarExtraccion(loaner.id, {
      fecha: new Date().toISOString(),
      ...data,
    });
    await loadLoaner();
  };

  const handleVenta = async (data: {
    clienteId: string; clienteNombre: string;
    precio: number | null; moneda: 'ARS' | 'USD' | null; notas: string | null;
  }) => {
    if (!loaner) return;
    await loanersService.registrarVenta(loaner.id, {
      fecha: new Date().toISOString(),
      ...data,
    });
    await loadLoaner();
  };

  const handleBaja = async () => {
    if (!loaner || !confirm('Dar de baja este loaner?')) return;
    await loanersService.update(loaner.id, { estado: 'baja', activo: false });
    await loadLoaner();
  };

  if (loading || !loaner) {
    return <p className="text-center text-slate-400 py-12">Cargando...</p>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{loaner.codigo}</h1>
            <p className="text-xs text-slate-500">{loaner.descripcion}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loaner.estado === 'en_base' && (
            <>
              <Button variant="primary" size="sm" onClick={() => setPrestamoOpen(true)}>Prestar</Button>
              <Button variant="secondary" size="sm" onClick={() => setVentaOpen(true)}>Vender</Button>
            </>
          )}
          {loaner.estado === 'en_cliente' && prestamoActivo && (
            <Button variant="primary" size="sm" onClick={() => setDevolucionOpen(true)}>Registrar devolucion</Button>
          )}
          {loaner.activo && loaner.estado !== 'vendido' && (
            <Button variant="ghost" size="sm" onClick={() => setExtraccionOpen(true)}>Extraer pieza</Button>
          )}
          {loaner.activo && loaner.estado === 'en_base' && (
            <Button variant="danger" size="sm" onClick={handleBaja}>Dar de baja</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`/loaners/${loaner.id}/editar`)}>Editar</Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="flex gap-5 px-5 py-4">
          <div className="w-72 shrink-0">
            <LoanerInfoSidebar loaner={loaner} />
          </div>
          <div className="flex-1 space-y-4">
            <LoanerPrestamosSection prestamos={loaner.prestamos} />
            <LoanerExtraccionesSection extracciones={loaner.extracciones} />
            <LoanerVentaSection loaner={loaner} onVender={() => setVentaOpen(true)} />
          </div>
        </div>
      </div>

      {/* Modals */}
      <LoanerPrestamoModal open={prestamoOpen} onClose={() => setPrestamoOpen(false)} loaner={loaner} onConfirm={handlePrestamo} />
      {prestamoActivo && (
        <LoanerDevolucionModal open={devolucionOpen} onClose={() => setDevolucionOpen(false)} clienteNombre={prestamoActivo.clienteNombre} onConfirm={handleDevolucion} />
      )}
      <LoanerExtraccionModal open={extraccionOpen} onClose={() => setExtraccionOpen(false)} onConfirm={handleExtraccion} />
      <LoanerVentaModal open={ventaOpen} onClose={() => setVentaOpen(false)} onConfirm={handleVenta} />
    </div>
  );
}
