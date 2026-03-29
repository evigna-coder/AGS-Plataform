import { useState } from 'react';
import type { MedioPago, GastoViatico } from '@ags/shared';
import { MEDIO_PAGO_LABELS, VIATICO_ESTADO_LABELS, VIATICO_ESTADO_COLORS } from '@ags/shared';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { useViaticos } from '../hooks/useViaticos';
import HistorialViaticosModal from '../components/viaticos/HistorialViaticosModal';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function ViaticosPage() {
  const { periodo, loading, saving, error, agregarGasto, editarGasto, eliminarGasto, enviarPeriodo, loadHistorial, historial, retry } = useViaticos();
  const [showForm, setShowForm] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [confirmEnviar, setConfirmEnviar] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingGasto, setEditingGasto] = useState<GastoViatico | null>(null);

  // Form state
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [establecimiento, setEstablecimiento] = useState('');
  const [monto, setMonto] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [notas, setNotas] = useState('');

  const resetForm = () => {
    setFecha(new Date().toISOString().split('T')[0]);
    setConcepto('');
    setEstablecimiento('');
    setMonto('');
    setMedioPago('efectivo');
    setNotas('');
    setEditingGasto(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (g: GastoViatico) => {
    setEditingGasto(g);
    setFecha(g.fecha);
    setConcepto(g.concepto);
    setEstablecimiento(g.establecimiento || '');
    setMonto(String(g.monto));
    setMedioPago(g.medioPago);
    setNotas(g.notas || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!concepto.trim() || !monto) return;
    const data = { fecha, concepto: concepto.trim(), ...(establecimiento.trim() ? { establecimiento: establecimiento.trim() } : {}), monto: parseFloat(monto), medioPago, ...(notas.trim() ? { notas: notas.trim() } : {}) };
    if (editingGasto) {
      await editarGasto(editingGasto.id, data);
    } else {
      await agregarGasto(data);
    }
    resetForm();
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await eliminarGasto(deleteId);
    setDeleteId(null);
  };

  const handleEnviar = async () => {
    await enviarPeriodo();
    setConfirmEnviar(false);
  };

  const handleShowHistorial = () => {
    loadHistorial();
    setShowHistorial(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>;
  }

  if (error || !periodo) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader title="Viáticos" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <p className="text-sm text-red-600 text-center">{error || 'No se pudo cargar el período.'}</p>
          <Button size="sm" onClick={retry}>Reintentar</Button>
        </div>
      </div>
    );
  }

  const isAbierto = periodo.estado === 'abierto';
  const gastos = periodo?.gastos ?? [];
  const gastosOrdenados = [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Viáticos"
        subtitle={periodo ? `${MESES[(periodo.mes - 1)]} ${periodo.anio}` : undefined}
        count={gastos.length}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleShowHistorial}>Historial</Button>
            {isAbierto && gastos.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setConfirmEnviar(true)}>Enviar a admin</Button>
            )}
            {isAbierto && (
              <Button size="sm" onClick={openAdd}>+ Gasto</Button>
            )}
          </div>
        }
      />

      {/* Status banner when not abierto */}
      {periodo && periodo.estado !== 'abierto' && (
        <div className={`mx-4 mt-3 px-4 py-2.5 rounded-xl text-xs font-medium ${VIATICO_ESTADO_COLORS[periodo.estado]}`}>
          Período {VIATICO_ESTADO_LABELS[periodo.estado].toLowerCase()}
          {periodo.estado === 'enviado' && ' — esperando confirmación de administración'}
          {periodo.estado === 'confirmado' && periodo.confirmadoPorNombre && ` por ${periodo.confirmadoPorNombre}`}
        </div>
      )}

      {/* Totals strip */}
      {periodo && gastos.length > 0 && (
        <div className="mx-4 mt-3 flex items-center gap-4 bg-slate-50 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[11px] text-slate-500">{formatMoney(periodo.totalEfectivo)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-[11px] text-slate-500">{formatMoney(periodo.totalTarjeta)}</span>
          </div>
          <div className="ml-auto text-sm font-semibold text-slate-800 tabular-nums">{formatMoney(periodo.total)}</div>
        </div>
      )}

      {/* Expenses list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {gastos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-400">No hay gastos cargados</p>
            {isAbierto && <p className="text-xs text-slate-300 mt-1">Presioná "+ Gasto" para agregar</p>}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {gastosOrdenados.map(g => (
              <div
                key={g.id}
                className={`flex items-center gap-2 px-3 py-2 transition-colors ${isAbierto ? 'cursor-pointer hover:bg-slate-50/50 active:bg-slate-100/50' : ''}`}
                onClick={isAbierto ? () => openEdit(g) : undefined}
              >
                <div className="w-[3px] h-5 rounded-full shrink-0" style={{ background: g.medioPago === 'efectivo' ? '#22c55e' : '#8b5cf6' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-700 truncate leading-tight">{g.concepto}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    {g.establecimiento && ` · ${g.establecimiento}`}
                    {g.notas && ` · ${g.notas}`}
                  </p>
                </div>
                <p className="text-[13px] font-semibold text-slate-700 tabular-nums shrink-0">{formatMoney(g.monto)}</p>
                {isAbierto && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteId(g.id); }}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit gasto modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingGasto ? 'Editar gasto' : 'Nuevo gasto'} footer={
        <div className="flex gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1">Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !concepto.trim() || !monto} className="flex-1">
            {saving ? 'Guardando...' : editingGasto ? 'Guardar' : 'Agregar'}
          </Button>
        </div>
      }>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-1 block">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-1 block">Concepto</label>
            <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)}
              placeholder="Ej: Almuerzo, Hotel, Nafta, Peaje..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-1 block">Establecimiento</label>
            <input type="text" value={establecimiento} onChange={e => setEstablecimiento(e.target.value)}
              placeholder="Ej: Shell, McDonald's, Hotel Amerian..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">Monto ($)</label>
              <input type="number" value={monto} onChange={e => setMonto(e.target.value)}
                placeholder="0" min="0" step="0.01"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">Medio de pago</label>
              <select value={medioPago} onChange={e => setMedioPago(e.target.value as MedioPago)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-1 block">Notas (opcional)</label>
            <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Detalle adicional..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
      </Modal>

      {/* Confirm enviar modal */}
      <Modal open={confirmEnviar} onClose={() => setConfirmEnviar(false)} title="Enviar viáticos" footer={
        <div className="flex gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={() => setConfirmEnviar(false)} className="flex-1">Cancelar</Button>
          <Button size="sm" onClick={handleEnviar} disabled={saving} className="flex-1">
            {saving ? 'Enviando...' : 'Confirmar envío'}
          </Button>
        </div>
      }>
        <p className="text-sm text-slate-600">
          Se enviarán <span className="font-semibold">{gastos.length} gastos</span> por un total de <span className="font-semibold">{formatMoney(periodo?.total ?? 0)}</span> a administración para su confirmación.
        </p>
        <p className="text-xs text-slate-400 mt-2">Una vez enviado, no podrás agregar ni eliminar gastos de este período.</p>
      </Modal>

      {/* Confirm delete modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar gasto" footer={
        <div className="flex gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving} className="flex-1">
            {saving ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      }>
        <p className="text-sm text-slate-600">¿Eliminar este gasto? Esta acción no se puede deshacer.</p>
      </Modal>

      {/* Historial modal */}
      <HistorialViaticosModal open={showHistorial} onClose={() => setShowHistorial(false)} historial={historial} />
    </div>
  );
}
