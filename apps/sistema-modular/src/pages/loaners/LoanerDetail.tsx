import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loanersService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { LoanerInfoSidebar } from '../../components/loaners/LoanerInfoSidebar';
import { LoanerPrestamosSection } from '../../components/loaners/LoanerPrestamosSection';
import { LoanerDerivacionesSection } from '../../components/loaners/LoanerDerivacionesSection';
import { LoanerExtraccionesSection } from '../../components/loaners/LoanerExtraccionesSection';
import { LoanerVentaSection } from '../../components/loaners/LoanerVentaSection';
import { LoanerOTsSection } from '../../components/loaners/LoanerOTsSection';
import { LoanerFotosSection } from '../../components/loaners/LoanerFotosSection';
import { LoanerPrestamoModal } from '../../components/loaners/LoanerPrestamoModal';
import { LoanerVincularModal } from '../../components/loaners/LoanerVincularModal';
import { LoanerDevolucionModal } from '../../components/loaners/LoanerDevolucionModal';
import { LoanerExtraccionModal } from '../../components/loaners/LoanerExtraccionModal';
import type { IngresoStockExtraccion } from '../../components/loaners/LoanerExtraccionIngresoStock';
import { LoanerVentaModal } from '../../components/loaners/LoanerVentaModal';
import { LoanerRetornoProveedorButton } from '../../components/loaners/LoanerRetornoProveedorButton';
import { GenerarRemitoDevolucionModal } from '../../components/remitos/GenerarRemitoDevolucionModal';
import { liberarLoanersRecalificados, procesarRecalificacionesPendientes } from '../../utils/loanerRecalificacion';
import { useLoanerPrestamos } from '../../hooks/useLoanerPrestamos';
import type { Loaner, VentaLoaner } from '@ags/shared';
import { loanerEstaIncompleto, loanerPartesFaltantes } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useDeclareParent } from '../../hooks/useDeclareParent';
import { useConfirm } from '../../components/ui/ConfirmDialog';

export function LoanerDetail() {
  const { id } = useParams();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const goBack = useNavigateBack();

  useDeclareParent('/loaners');
  const [loaner, setLoaner] = useState<Loaner | null>(null);
  const [loading, setLoading] = useState(true);

  const [prestamoOpen, setPrestamoOpen] = useState(false);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [devolucionOpen, setDevolucionOpen] = useState(false);
  const [extraccionOpen, setExtraccionOpen] = useState(false);
  const [ventaOpen, setVentaOpen] = useState(false);
  // Derivación a proveedor (2026-08-06): mismos criterios que ficha —
  // completo o por partes, remito calibrado en triplicado.
  const [derivacionOpen, setDerivacionOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = loanersService.subscribeById(id, (l) => {
      if (!l) { navigate('/loaners'); return; }
      setLoaner(l);
      setLoading(false);
    }, (err) => {
      console.error('Error loading loaner:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [id, navigate]);

  // Préstamo del MÓDULO entero; las partes prestadas se manejan por fila del
  // historial (2026-09-04) y no mueven el estado del loaner.
  const {
    prestamoActivo, retornoParte, setRetornoParte,
    registrarPrestamo, registrarDevolucion, registrarRetornoParte,
  } = useLoanerPrestamos(loaner);

  // Sweep de recalificación en dos fases (mismo orden que LoanersList): si
  // este loaner quedó 'en_recalificacion' sin OT (devolución desde el portal),
  // crear OT + ticket con guard anti-duplicado; y si su OT ya cerró
  // técnicamente (ej. cierre escrito por la app de campo), liberarlo.
  // Guard por id para correr una sola vez por loaner montado.
  const sweepDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!loaner || loaner.estado !== 'en_recalificacion') return;
    if (sweepDoneRef.current === loaner.id) return;
    sweepDoneRef.current = loaner.id;
    void (async () => {
      await procesarRecalificacionesPendientes([loaner]).catch(err =>
        console.warn('[LoanerDetail] sweep de OTs de recalificación pendientes falló:', err));
      await liberarLoanersRecalificados([loaner]).catch(err =>
        console.warn('[LoanerDetail] sweep de recalificación falló:', err));
    })();
  }, [loaner]);

  const handleExtraccion = async (
    data: {
      descripcion: string; codigoArticulo: string | null;
      destino: string; otNumber: string | null; extraidoPor: string;
      dejaInoperativo: boolean;
    },
    ingresoStock: IngresoStockExtraccion | null,
  ) => {
    if (!loaner) return;
    await loanersService.registrarExtraccion(loaner.id, {
      fecha: new Date().toISOString(),
      ...data,
    }, ingresoStock);
    // subscription auto-refreshes
  };

  /** La pieza volvió: el loaner deja de figurar incompleto. */
  const handleReponer = async (extraccionId: string) => {
    if (!loaner) return;
    await loanersService.reponerExtraccion(loaner.id, extraccionId);
  };

  const handleVenta = async (payload: {
    venta: Omit<VentaLoaner, 'fecha'> & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' };
    articuloRecienVinculado: {
      articuloId: string; articuloCodigo: string; articuloDescripcion: string;
    } | null;
  }) => {
    if (!loaner) return;
    // Phase 15 Wave 3: el modal nuevo propaga costoUnitario/monedaCosto y opcionalmente
    // un articuloRecienVinculado (cuando el loaner no tenía articuloId previo).
    // El service hace todo en una sola tx atómica: actualiza loaner + crea unidad + crea movimiento.
    await loanersService.registrarVenta(
      loaner.id,
      {
        fecha: new Date().toISOString(),
        ...payload.venta,
      },
      payload.articuloRecienVinculado,
    );
    // subscription auto-refreshes
  };

  const handleBaja = async () => {
    if (!loaner || !await confirm('Dar de baja este loaner?')) return;
    await loanersService.update(loaner.id, { estado: 'baja', activo: false });
    // subscription auto-refreshes
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
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{loaner.codigo}</h1>
              {/* Incompleto (2026-08-20): va al lado del codigo, no abajo — es lo
                  primero que hay que ver antes de decidir prestarlo. */}
              {loanerEstaIncompleto(loaner) && (
                <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                  INCOMPLETO
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{loaner.descripcion}</p>
            {loanerEstaIncompleto(loaner) && (
              <p className="text-[11px] text-amber-700 mt-0.5">
                Falta reponer: {loanerPartesFaltantes(loaner)}
              </p>
            )}
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
            <>
              <Button variant="primary" size="sm" onClick={() => setDevolucionOpen(true)}>Registrar devolucion</Button>
              {/* Vincular a posteriori con la OT de la visita y/o la ficha del
                  equipo traído a bench (2026-08-26): el vínculo solo se podía
                  declarar al CREAR el préstamo. */}
              <Button variant="secondary" size="sm" onClick={() => setVincularOpen(true)}>
                Vincular OT / ficha
              </Button>
            </>
          )}
          {/* Retorno de proveedor (2026-08-27): módulo completo o parte, resuelve
              SOLO la línea de este loaner en el remito de derivación en lote. */}
          {loaner.activo && loaner.enProveedor && (
            <LoanerRetornoProveedorButton loaner={loaner} />
          )}
          {loaner.activo && loaner.estado !== 'vendido' && (
            <Button variant="ghost" size="sm" onClick={() => setExtraccionOpen(true)}>Extraer pieza</Button>
          )}
          {loaner.activo && loaner.estado === 'en_base' && (
            <Button variant="ghost" size="sm" onClick={() => setDerivacionOpen(true)}>Derivar a proveedor</Button>
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
          {/* Fotos al costado, como en FichaDetail (pedido 2026-08-06). */}
          <div className="w-72 shrink-0 space-y-3">
            <LoanerInfoSidebar loaner={loaner} />
            <LoanerFotosSection loaner={loaner} />
          </div>
          <div className="flex-1 space-y-4">
            <LoanerPrestamosSection prestamos={loaner.prestamos} onRetornoParte={setRetornoParte} />
            <LoanerDerivacionesSection derivaciones={loaner.derivaciones ?? []} />
            <LoanerOTsSection otIds={loaner.otIds ?? []} />
            <LoanerExtraccionesSection extracciones={loaner.extracciones} onReponer={handleReponer} />
            <LoanerVentaSection loaner={loaner} onVender={() => setVentaOpen(true)} />
          </div>
        </div>
      </div>

      {/* Modals */}
      <LoanerPrestamoModal open={prestamoOpen} onClose={() => setPrestamoOpen(false)} loaner={loaner} onConfirm={registrarPrestamo} />
      {prestamoActivo && (
        <LoanerVincularModal open={vincularOpen} onClose={() => setVincularOpen(false)}
          loaner={loaner} prestamo={prestamoActivo} onLinked={() => { /* subscription refresh */ }} />
      )}
      {prestamoActivo && (
        <LoanerDevolucionModal open={devolucionOpen} onClose={() => setDevolucionOpen(false)} clienteNombre={prestamoActivo.clienteNombre} onConfirm={registrarDevolucion} />
      )}
      {retornoParte && (
        <LoanerDevolucionModal open onClose={() => setRetornoParte(null)}
          clienteNombre={retornoParte.clienteNombre} parteDescripcion={retornoParte.parte?.descripcion ?? 'Parte'}
          onConfirm={registrarRetornoParte} />
      )}
      <LoanerExtraccionModal open={extraccionOpen} onClose={() => setExtraccionOpen(false)} onConfirm={handleExtraccion} />
      {derivacionOpen && (
        <GenerarRemitoDevolucionModal
          open={derivacionOpen}
          onClose={() => setDerivacionOpen(false)}
          ficha={null}
          loaner={loaner}
          onCreated={remitoId => navigate(`/stock/remitos/${remitoId}`)}
        />
      )}
      <LoanerVentaModal open={ventaOpen} onClose={() => setVentaOpen(false)} loaner={loaner} onConfirm={handleVenta} />
    </div>
  );
}
