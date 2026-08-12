import type { DragPayload, LotePatronDisponible, SerieColumnaDisponible } from '../../hooks/useAsignacionRapida';
import type { UnidadStock, Minikit, InstrumentoPatron, Dispositivo, Vehiculo } from '@ags/shared';

type TabKey = 'articulos' | 'minikits' | 'instrumentos' | 'patrones' | 'columnas' | 'dispositivos' | 'vehiculos';

interface Props {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredUnits: UnidadStock[];
  filteredMinikits: Minikit[];
  filteredInstrumentos: InstrumentoPatron[];
  filteredPatrones: LotePatronDisponible[];
  filteredColumnas: SerieColumnaDisponible[];
  filteredDispositivos: Dispositivo[];
  filteredVehiculos: Vehiculo[];
  startDrag: (payload: DragPayload) => (e: React.DragEvent) => void;
}

/** Columna izquierda del modal de asignar: tabs + buscador + filas draggables. */
export const AsignarItemsPanel = ({
  tab, setTab, searchQuery, setSearchQuery, startDrag,
  filteredUnits, filteredMinikits, filteredInstrumentos, filteredPatrones,
  filteredColumnas, filteredDispositivos, filteredVehiculos,
}: Props) => {
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'articulos', label: 'Artículos', count: filteredUnits.length },
    { key: 'minikits', label: 'Minikits', count: filteredMinikits.length },
    { key: 'instrumentos', label: 'Instrumentos', count: filteredInstrumentos.length },
    { key: 'patrones', label: 'Patrones', count: filteredPatrones.length },
    { key: 'columnas', label: 'Columnas', count: filteredColumnas.length },
    { key: 'dispositivos', label: 'Dispositivos', count: filteredDispositivos.length },
    { key: 'vehiculos', label: 'Vehículos', count: filteredVehiculos.length },
  ];

  return (
    <div className="flex-[3] flex flex-col min-w-0 bg-white border border-slate-200 rounded-xl p-3 overflow-hidden">
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
        {/* Un item por LOTE: es lo que el IST se lleva. El vencimiento va a la
            vista porque llevarse un patrón vencido invalida la calibración. */}
        {tab === 'patrones' && (filteredPatrones.length === 0 ? <Empty /> :
          filteredPatrones.map(p => <DragRow key={`${p.patronId}:${p.lote}`} onDragStart={startDrag(patronPayload(p))}
            code={p.codigo} label={`${p.descripcion} — Lote ${p.lote}`}
            extra={`${p.marca} · ${p.cantidad} disp.${p.vencimiento ? ` · vence ${p.vencimiento.slice(0, 10).split('-').reverse().join('/')}` : ''}`}
            badge={p.vencido ? 'Vencido' : undefined}
            badgeColor="bg-red-50 text-red-700" />))}
        {/* Una serie física por fila — mismo criterio que los lotes de patrón. */}
        {tab === 'columnas' && (filteredColumnas.length === 0 ? <Empty /> :
          filteredColumnas.map(c => <DragRow key={`${c.columnaId}:${c.serie}`} onDragStart={startDrag(columnaPayload(c))}
            code={c.codigo} label={c.descripcion}
            extra={`${c.marca} · S/N ${c.serie}${c.vencimiento ? ` · vence ${c.vencimiento.slice(0, 10).split('-').reverse().join('/')}` : ''}`} />))}
        {tab === 'dispositivos' && (filteredDispositivos.length === 0 ? <Empty /> :
          filteredDispositivos.map(d => <DragRow key={d.id} onDragStart={startDrag(dispositivoPayload(d))}
            code={`${d.marca} ${d.modelo}`} label={d.serie ? `S/N: ${d.serie}` : ''} badge={d.tipo} badgeColor="bg-blue-50 text-blue-700" />))}
        {tab === 'vehiculos' && (filteredVehiculos.length === 0 ? <Empty /> :
          filteredVehiculos.map(v => <DragRow key={v.id} onDragStart={startDrag(vehiculoPayload(v))}
            code={v.patente} label={`${v.marca} ${v.modelo}`} extra={v.asignadoA ? `Actual: ${v.asignadoA}` : undefined} />))}
      </div>
    </div>
  );
};

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
/** Lo asignable es la SERIE física de la columna. */
const columnaPayload = (c: SerieColumnaDisponible): DragPayload => ({
  tipo: 'columna', label: c.descripcion, codigo: c.codigo,
  columnaId: c.columnaId, columnaSerie: c.serie,
  permanente: false,
});
/** Lo asignable es el LOTE del patrón, con cantidad elegible. */
const patronPayload = (p: LotePatronDisponible): DragPayload => ({
  tipo: 'patron', label: p.descripcion, codigo: p.codigo,
  patronId: p.patronId, patronLote: p.lote, patronVencimiento: p.vencimiento,
  cantidadDisponible: p.cantidad,
  permanente: false,
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
