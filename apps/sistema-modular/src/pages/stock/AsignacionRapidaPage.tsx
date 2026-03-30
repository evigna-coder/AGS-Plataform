import { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { InventarioIngenieroModal } from '../../components/stock/InventarioIngenieroModal';
import { useAsignacionRapida, type DragPayload } from '../../hooks/useAsignacionRapida';
import type { UnidadStock, Minikit, InstrumentoPatron, Dispositivo, Vehiculo } from '@ags/shared';

export const AsignacionRapidaPage = () => {
  const {
    loading, saving, cart, tab, setTab, searchQuery, setSearchQuery,
    ingenieros, clientes, observaciones, setObservaciones,
    filteredUnits, filteredMinikits, filteredInstrumentos, filteredDispositivos, filteredVehiculos,
    cartByIngeniero, assignToIngeniero, setIngenieroCliente,
    removeFromCart, updateCartItem, handleConfirm, loadData,
  } = useAsignacionRapida();

  const dragRef = useRef<DragPayload | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [inventarioIngId, setInventarioIngId] = useState<string | null>(null);

  const clienteOpts = [{ value: '', label: 'Sin cliente' }, ...Object.values(
    clientes.filter(c => c.cuit).reduce<Record<string, { value: string; label: string }>>((acc, c) => {
      if (!acc[c.cuit!]) acc[c.cuit!] = { value: c.cuit!, label: c.razonSocial };
      return acc;
    }, {})
  )];

  const startDrag = (payload: DragPayload) => (e: React.DragEvent) => {
    dragRef.current = payload;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', payload.label);
  };

  const handleDrop = (ingId: string, ingNombre: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    if (dragRef.current) {
      assignToIngeniero(ingId, ingNombre, dragRef.current);
      dragRef.current = null;
    }
  };

  const handleDragOver = (ingId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverId(ingId);
  };

  if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><p className="text-xs text-slate-400">Cargando...</p></div>;

  const tabs = [
    { key: 'articulos' as const, label: 'Artículos', count: filteredUnits.length },
    { key: 'minikits' as const, label: 'Minikits', count: filteredMinikits.length },
    { key: 'instrumentos' as const, label: 'Instrumentos', count: filteredInstrumentos.length },
    { key: 'dispositivos' as const, label: 'Dispositivos', count: filteredDispositivos.length },
    { key: 'vehiculos' as const, label: 'Vehículos', count: filteredVehiculos.length },
  ];

  const ingenieroCount = Object.keys(cartByIngeniero).length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Asignación rápida" subtitle="Arrastre items hacia los ingenieros para asignarlos" />
      <div className="flex-1 overflow-hidden px-5 pb-4">
        <div className="flex gap-4 h-full">
          {/* ═══ Left: draggable items ═══ */}
          <div className="flex-[3] flex flex-col min-w-0">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${tab === t.key ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {t.label} ({t.count})
                  </button>
                ))}
                <div className="flex-1 min-w-[140px]">
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="Buscar..." />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {tab === 'articulos' && (filteredUnits.length === 0 ? <Empty /> :
                  filteredUnits.map(u => <DragRow key={u.id} onDragStart={startDrag(unitPayload(u))}
                    code={u.articuloCodigo} label={u.articuloDescripcion} extra={u.nroSerie ? `S/N: ${u.nroSerie}` : u.ubicacion.referenciaNombre} />))}
                {tab === 'minikits' && (filteredMinikits.length === 0 ? <Empty /> :
                  filteredMinikits.map(mk => <DragRow key={mk.id} onDragStart={startDrag(minikitPayload(mk))}
                    code={mk.codigo} label={mk.nombre} badge="En base" badgeColor="bg-green-50 text-green-700" />))}
                {tab === 'instrumentos' && (filteredInstrumentos.length === 0 ? <Empty /> :
                  filteredInstrumentos.map(i => <DragRow key={i.id} onDragStart={startDrag(instrumentoPayload(i))}
                    code={`${i.marca} ${i.modelo}`} label={i.nombre}
                    badge={i.tipo === 'instrumento' ? 'Instrumento' : 'Patrón'}
                    badgeColor={i.tipo === 'instrumento' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'} />))}
                {tab === 'dispositivos' && (filteredDispositivos.length === 0 ? <Empty /> :
                  filteredDispositivos.map(d => <DragRow key={d.id} onDragStart={startDrag(dispositivoPayload(d))}
                    code={`${d.marca} ${d.modelo}`} label={d.serie ? `S/N: ${d.serie}` : ''} badge={d.tipo} badgeColor="bg-blue-50 text-blue-700" />))}
                {tab === 'vehiculos' && (filteredVehiculos.length === 0 ? <Empty /> :
                  filteredVehiculos.map(v => <DragRow key={v.id} onDragStart={startDrag(vehiculoPayload(v))}
                    code={v.patente} label={`${v.marca} ${v.modelo}`} extra={v.asignadoA ? `Actual: ${v.asignadoA}` : undefined} />))}
              </div>
            </Card>
          </div>

          {/* ═══ Right: engineer drop-zones ═══ */}
          <div className="flex-[2] flex flex-col min-w-0">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Ingenieros — arrastre items aquí
              </p>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {ingenieros.map(ing => {
                  const group = cartByIngeniero[ing.id];
                  const count = group?.items.length ?? 0;
                  const isOver = dragOverId === ing.id;
                  return (
                    <IngenieroDropZone key={ing.id}
                      nombre={ing.nombre} count={count} isOver={isOver}
                      clienteId={group?.clienteId ?? ''}
                      clienteOpts={clienteOpts}
                      onClienteChange={val => setIngenieroCliente(ing.id, val)}
                      onDrop={handleDrop(ing.id, ing.nombre)}
                      onDragOver={handleDragOver(ing.id)}
                      onDragLeave={() => setDragOverId(null)}
                      items={group?.items ?? []}
                      onRemove={removeFromCart}
                      onTogglePerm={(id, val) => updateCartItem(id, { permanente: val })}
                      onNameClick={() => setInventarioIngId(ing.id)}
                    />
                  );
                })}
              </div>

              {/* Footer */}
              <div className="shrink-0 space-y-2 pt-2 mt-2 border-t border-slate-100">
                <Input inputSize="sm" label="Observaciones" value={observaciones}
                  onChange={e => setObservaciones(e.target.value)} placeholder="Notas opcionales..." />
                <Button className="w-full" size="sm" onClick={handleConfirm}
                  disabled={saving || cart.length === 0}>
                  {saving ? 'Procesando...' : `Confirmar ${cart.length} items → ${ingenieroCount} IST`}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Inventario modal */}
      <InventarioIngenieroModal ingenieroId={inventarioIngId} onClose={() => { setInventarioIngId(null); loadData(); }} />
    </div>
  );
};

// ── Engineer drop-zone (collapsed when empty, expanded when has items) ──

const IngenieroDropZone = ({ nombre, count, isOver, clienteId, clienteOpts, onClienteChange,
  onDrop, onDragOver, onDragLeave, items, onRemove, onTogglePerm, onNameClick }: {
  nombre: string; count: number; isOver: boolean;
  clienteId: string; clienteOpts: { value: string; label: string }[];
  onClienteChange: (val: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  items: { id: string; codigo: string; label: string; tipo: string; permanente: boolean }[];
  onRemove: (id: string) => void;
  onTogglePerm: (id: string, val: boolean) => void;
  onNameClick: () => void;
}) => (
  <div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
    className={`rounded-md border transition-all ${
      isOver
        ? 'border-dashed border-amber-400 bg-amber-50 shadow-lg ring-2 ring-amber-200 scale-[1.01]'
        : count > 0
          ? 'border-amber-200 bg-amber-50'
          : 'border-amber-200 bg-amber-50 hover:border-amber-300'
    }`}>
    {/* Header */}
    <div className={`flex items-center justify-between px-4 ${count > 0 ? 'py-3' : 'py-7'}`}>
      <button onClick={onNameClick}
        className={`text-sm font-semibold truncate text-left ${count > 0 ? 'text-amber-900 hover:text-amber-700' : 'text-slate-600 hover:text-amber-700'}`}>
        {nombre}
      </button>
      {count > 0 ? (
        <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-amber-500 text-white text-[10px] font-bold shrink-0">
          {count}
        </span>
      ) : (
        <span className="text-[10px] text-slate-300 italic shrink-0">soltar aquí</span>
      )}
    </div>

    {/* Expanded content when has items */}
    {count > 0 && (
      <div className="px-3 pb-3 space-y-2">
        {/* Per-IST client selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium shrink-0">Cliente:</span>
          <div className="flex-1">
            <SearchableSelect value={clienteId} onChange={onClienteChange}
              options={clienteOpts} placeholder="Sin cliente" />
          </div>
        </div>

        {/* Item list */}
        <div className="space-y-0.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-white rounded px-2 py-1 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-teal-700 font-semibold text-[10px]">{item.codigo}</span>
                <span className="text-slate-700 truncate">{item.label}</span>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">{item.tipo}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <label className="flex items-center gap-0.5 cursor-pointer" title="Permanente">
                  <input type="checkbox" checked={item.permanente}
                    onChange={e => onTogglePerm(item.id, e.target.checked)}
                    className="w-2.5 h-2.5 accent-teal-600" />
                  <span className="text-[9px] text-slate-400">Perm</span>
                </label>
                <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 text-[10px] ml-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ── Payload builders ───────────────────────────────────────────────────

const unitPayload = (u: UnidadStock): DragPayload => ({
  tipo: 'articulo', label: u.articuloDescripcion, codigo: u.articuloCodigo,
  unidadId: u.id, articuloId: u.articuloId, articuloDescripcion: u.articuloDescripcion, permanente: false,
});
const minikitPayload = (mk: Minikit): DragPayload => ({
  tipo: 'minikit', label: mk.nombre, codigo: mk.codigo, minikitId: mk.id, permanente: false,
});
const instrumentoPayload = (i: InstrumentoPatron): DragPayload => ({
  tipo: 'instrumento', label: i.nombre, codigo: `${i.marca} ${i.modelo}`,
  instrumentoId: i.id, instrumentoTipo: i.tipo, permanente: false,
});
const dispositivoPayload = (d: Dispositivo): DragPayload => ({
  tipo: 'dispositivo', label: `${d.marca} ${d.modelo}`, codigo: d.serie || '-',
  dispositivoId: d.id, permanente: true,
});
const vehiculoPayload = (v: Vehiculo): DragPayload => ({
  tipo: 'vehiculo', label: `${v.marca} ${v.modelo}`, codigo: v.patente,
  vehiculoId: v.id, permanente: true,
});

// ── Sub-components ────────────────────────────────────────────────────

const Empty = () => <p className="text-xs text-slate-400 text-center py-4">Sin items disponibles</p>;

const DragRow = ({ code, label, extra, badge, badgeColor, onDragStart }: {
  code: string; label: string; extra?: string; badge?: string; badgeColor?: string;
  onDragStart: (e: React.DragEvent) => void;
}) => (
  <div draggable onDragStart={onDragStart}
    className="flex items-center px-2 py-1.5 hover:bg-teal-50 rounded cursor-grab active:cursor-grabbing group transition-colors">
    <span className="text-slate-300 group-hover:text-teal-400 text-xs mr-1.5">⠿</span>
    <span className="font-mono text-[11px] text-teal-700 font-semibold">{code}</span>
    <span className="text-xs text-slate-700 truncate ml-1.5">{label}</span>
    {extra && <span className="text-[10px] text-slate-400 ml-1.5">{extra}</span>}
    {badge && <span className={`text-[10px] px-1 py-0.5 rounded ml-1.5 ${badgeColor || 'bg-slate-100 text-slate-600'}`}>{badge}</span>}
  </div>
);
