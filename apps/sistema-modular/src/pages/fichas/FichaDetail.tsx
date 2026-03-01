import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fichasService, loanersService, remitosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FichaInfoSidebar } from '../../components/fichas/FichaInfoSidebar';
import { FichaHistorialSection } from '../../components/fichas/FichaHistorialSection';
import { FichaDerivacionSection } from '../../components/fichas/FichaDerivacionSection';
import { FichaRepuestosSection } from '../../components/fichas/FichaRepuestosSection';
import { FichaStatusTransition } from '../../components/fichas/FichaStatusTransition';
import { FichaLoanerLink } from '../../components/fichas/FichaLoanerLink';
import { FichaFotosSection } from '../../components/fichas/FichaFotosSection';
import type { FichaPropiedad, EstadoFicha, Loaner } from '@ags/shared';

export function FichaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ficha, setFicha] = useState<FichaPropiedad | null>(null);
  const [loading, setLoading] = useState(true);
  const [loanerModalOpen, setLoanerModalOpen] = useState(false);
  const [disponibles, setDisponibles] = useState<Loaner[]>([]);
  const [selectedLoanerId, setSelectedLoanerId] = useState('');
  const [asigning, setAsigning] = useState(false);

  const loadFicha = useCallback(async () => {
    if (!id) return;
    const f = await fichasService.getById(id);
    if (!f) return navigate('/fichas');
    setFicha(f);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { loadFicha(); }, [loadFicha]);

  const handleTransition = async (nuevoEstado: EstadoFicha, nota: string) => {
    if (!ficha) return;
    await fichasService.addHistorial(ficha.id, {
      fecha: new Date().toISOString(),
      estadoAnterior: ficha.estado,
      estadoNuevo: nuevoEstado,
      nota,
      creadoPor: 'admin',
    });
    await loadFicha();
  };

  const handleEntregarCliente = async () => {
    if (!ficha || !confirm('Generar remito de devolucion y marcar como entregado?')) return;
    const remitoId = await remitosService.create({
      tipo: 'devolucion',
      estado: 'borrador',
      ingenieroId: '',
      ingenieroNombre: 'AGS Taller',
      clienteId: ficha.clienteId,
      clienteNombre: ficha.clienteNombre,
      fichaId: ficha.id,
      fichaNumero: ficha.numero,
      items: [],
      observaciones: `Devolucion ficha ${ficha.numero}`,
    });
    await fichasService.update(ficha.id, {
      remitoDevolucionId: remitoId,
      fechaEntrega: new Date().toISOString(),
    });
    await fichasService.addHistorial(ficha.id, {
      fecha: new Date().toISOString(),
      estadoAnterior: ficha.estado,
      estadoNuevo: 'entregado',
      nota: 'Entregado al cliente. Remito generado.',
      creadoPor: 'admin',
    });
    await loadFicha();
  };

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
      // Register loan on loaner
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
      // Link loaner on ficha
      await fichasService.update(ficha.id, {
        loanerId: selectedLoanerId,
        loanerCodigo: loaner.codigo,
      });
      setLoanerModalOpen(false);
      setSelectedLoanerId('');
      await loadFicha();
    } finally {
      setAsigning(false);
    }
  };

  if (loading || !ficha) {
    return <p className="text-center text-slate-400 py-12">Cargando...</p>;
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/fichas')} className="text-slate-400 hover:text-slate-600">&larr;</button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{ficha.numero}</h1>
            <p className="text-xs text-slate-500">{ficha.clienteNombre} — {ficha.moduloNombre || ficha.descripcionLibre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FichaStatusTransition currentEstado={ficha.estado} onTransition={handleTransition} />
          {ficha.estado === 'listo_para_entrega' && (
            <Button variant="primary" size="sm" onClick={handleEntregarCliente}>Entregar al cliente</Button>
          )}
          {!ficha.loanerId && ficha.estado !== 'entregado' && (
            <Button variant="secondary" size="sm" onClick={openLoanerPicker}>Asignar loaner</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`/fichas/${ficha.id}/editar`)}>Editar</Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="flex gap-6 px-6 py-6">
          {/* Sidebar */}
          <div className="w-72 shrink-0">
            <FichaInfoSidebar ficha={ficha} />
          </div>
          {/* Main */}
          <div className="flex-1 space-y-4">
            <FichaLoanerLink ficha={ficha} />
            <FichaHistorialSection historial={ficha.historial} />
            <FichaDerivacionSection ficha={ficha} onUpdate={loadFicha} />
            <FichaRepuestosSection ficha={ficha} onUpdate={loadFicha} />
            <FichaFotosSection ficha={ficha} readOnly={ficha.estado === 'entregado'} onUpdate={loadFicha} />
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
              <label key={l.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${selectedLoanerId === l.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
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
    </div>
  );
}
