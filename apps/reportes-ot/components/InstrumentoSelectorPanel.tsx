import { useState, useEffect, useMemo } from 'react';
import { FirebaseService } from '../services/firebaseService';
import type {
  InstrumentoPatronOption,
  Patron,
  Columna,
  PatronSeleccionado,
  ColumnaSeleccionada,
} from '../types/instrumentos';

/** Calcula estado del certificado (espejo simplificado de @ags/shared) */
function estadoCert(vencimiento: string | null | undefined): 'vigente' | 'por_vencer' | 'vencido' | 'sin_cert' {
  if (!vencimiento) return 'sin_cert';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(vencimiento); v.setHours(0, 0, 0, 0);
  if (v < hoy) return 'vencido';
  const diff = Math.ceil((v.getTime() - hoy.getTime()) / 86400000);
  return diff <= 30 ? 'por_vencer' : 'vigente';
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-700' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-700' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-700' },
  sin_cert: { label: 'Sin cert.', cls: 'bg-slate-100 text-slate-500' },
};

type Tab = 'instrumentos' | 'patrones' | 'columnas';

interface Props {
  firebase: FirebaseService;
  // Selección actual
  instrumentosSelected: InstrumentoPatronOption[];
  patronesSelected: PatronSeleccionado[];
  columnasSelected: ColumnaSeleccionada[];
  // Callback cuando el usuario confirma selección
  onApply: (sel: {
    instrumentos: InstrumentoPatronOption[];
    patrones: PatronSeleccionado[];
    columnas: ColumnaSeleccionada[];
  }) => void;
  readOnly?: boolean;
}

// ─── Row de instrumento ──────────────────────────────────────────────────────
function InstrumentoRow({ inst, checked, onToggle }: {
  inst: InstrumentoPatronOption;
  checked: boolean;
  onToggle: () => void;
}) {
  const estado = estadoCert(inst.certificadoVencimiento);
  const badge = ESTADO_BADGE[estado];
  return (
    <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
      checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
    }`}>
      <input type="checkbox" checked={checked} onChange={onToggle}
        className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${checked ? 'text-indigo-900' : 'text-slate-800'}`}>{inst.nombre}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {inst.marca && <span className="text-[10px] text-slate-500">{inst.marca}</span>}
          {inst.modelo && <span className="text-[10px] text-slate-400 font-mono">Mod: {inst.modelo}</span>}
          {inst.serie && <span className="text-[10px] text-slate-400 font-mono">S/N: {inst.serie}</span>}
          <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>
    </label>
  );
}

// ─── Tab Instrumentos: agrupados por categoría ──────────────────────────────
function InstrumentosTab({
  instrumentos,
  checkedIds,
  onToggle,
}: {
  instrumentos: InstrumentoPatronOption[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  // Agrupar por primera categoría
  const grupos = useMemo(() => {
    const map = new Map<string, InstrumentoPatronOption[]>();
    for (const inst of instrumentos) {
      const cat = inst.categorias?.[0] || 'Sin categoría';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(inst);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [instrumentos]);

  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(grupos.map(([k]) => k)));
  const toggleGrupo = (cat: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (instrumentos.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-6">No hay instrumentos activos registrados.</p>;
  }

  return (
    <div className="space-y-2">
      {grupos.map(([cat, items]) => {
        const isOpen = expandidos.has(cat);
        const selCount = items.filter(i => checkedIds.has(i.id)).length;
        return (
          <div key={cat} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => toggleGrupo(cat)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{isOpen ? '▼' : '▶'}</span>
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{cat}</span>
                <span className="text-[10px] text-slate-400">({items.length})</span>
              </div>
              {selCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  {selCount} sel.
                </span>
              )}
            </button>
            {isOpen && (
              <div className="p-2 space-y-1.5">
                {items.map(inst => (
                  <InstrumentoRow key={inst.id} inst={inst}
                    checked={checkedIds.has(inst.id)}
                    onToggle={() => onToggle(inst.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab Patrones: agrupados por patrón, expandible por lote ────────────────
function PatronesTab({
  patrones,
  selectedKeys,
  onToggle,
}: {
  patrones: Patron[];
  /** keys: `${patronId}__${loteIdx}` */
  selectedKeys: Set<string>;
  onToggle: (patronId: string, loteIdx: number) => void;
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const togglePatron = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (patrones.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-6">No hay patrones activos registrados.</p>;
  }

  return (
    <div className="space-y-2">
      {patrones.map(p => {
        const isOpen = expandidos.has(p.id);
        const selCount = p.lotes.filter((_, idx) => selectedKeys.has(`${p.id}__${idx}`)).length;
        return (
          <div key={p.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => togglePatron(p.id)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-[10px] text-slate-400 shrink-0">{isOpen ? '▼' : '▶'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 font-mono truncate">{p.codigoArticulo}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 truncate">{p.descripcion}</span>
                    {p.marca && <span className="text-[10px] text-slate-400 shrink-0">· {p.marca}</span>}
                    <span className="text-[10px] text-slate-400 shrink-0">· {p.lotes.length} lote(s)</span>
                  </div>
                </div>
              </div>
              {selCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  {selCount} sel.
                </span>
              )}
            </button>
            {isOpen && (
              <div className="p-2 space-y-1.5 border-t border-slate-100 bg-slate-50/30">
                {p.lotes.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic px-2">Sin lotes cargados</p>
                ) : (
                  p.lotes.map((lote, idx) => {
                    const key = `${p.id}__${idx}`;
                    const isChecked = selectedKeys.has(key);
                    const estado = estadoCert(lote.fechaVencimiento);
                    const badge = ESTADO_BADGE[estado];
                    return (
                      <label key={idx} className={`flex items-start gap-3 p-2 rounded border cursor-pointer transition-colors ${
                        isChecked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}>
                        <input type="checkbox" checked={isChecked}
                          onChange={() => onToggle(p.id, idx)}
                          className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono text-slate-700">Lote: {lote.lote}</span>
                            {lote.fechaVencimiento && (
                              <span className="text-[10px] text-slate-500">Vence: {lote.fechaVencimiento}</span>
                            )}
                            <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          {lote.certificadoEmisor && (
                            <p className="text-[10px] text-slate-400 mt-0.5">Emisor: {lote.certificadoEmisor}</p>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab Columnas: agrupadas por código de artículo, expandible por serie ──
function ColumnasTab({
  columnas,
  selectedKeys,
  onToggle,
}: {
  columnas: Columna[];
  /** keys: `${columnaId}__${serieIdx}` */
  selectedKeys: Set<string>;
  onToggle: (columnaId: string, serieIdx: number) => void;
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const toggleCol = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (columnas.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-6">No hay columnas activas registradas.</p>;
  }

  return (
    <div className="space-y-2">
      {columnas.map(c => {
        const isOpen = expandidos.has(c.id);
        const selCount = c.series.filter((_, idx) => selectedKeys.has(`${c.id}__${idx}`)).length;
        return (
          <div key={c.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => toggleCol(c.id)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-[10px] text-slate-400 shrink-0">{isOpen ? '▼' : '▶'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 font-mono truncate">{c.codigoArticulo}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 truncate">{c.descripcion}</span>
                    {c.marca && <span className="text-[10px] text-slate-400 shrink-0">· {c.marca}</span>}
                    <span className="text-[10px] text-slate-400 shrink-0">· {c.series.length} serie(s)</span>
                  </div>
                </div>
              </div>
              {selCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  {selCount} sel.
                </span>
              )}
            </button>
            {isOpen && (
              <div className="p-2 space-y-1.5 border-t border-slate-100 bg-slate-50/30">
                {c.series.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic px-2">Sin series cargadas</p>
                ) : (
                  c.series.map((s, idx) => {
                    const key = `${c.id}__${idx}`;
                    const isChecked = selectedKeys.has(key);
                    const estado = estadoCert(s.fechaVencimiento);
                    const badge = ESTADO_BADGE[estado];
                    return (
                      <label key={idx} className={`flex items-start gap-3 p-2 rounded border cursor-pointer transition-colors ${
                        isChecked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}>
                        <input type="checkbox" checked={isChecked}
                          onChange={() => onToggle(c.id, idx)}
                          className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono text-slate-700">S/N: {s.serie}</span>
                            {s.fechaVencimiento && (
                              <>
                                <span className="text-[10px] text-slate-500">Vence: {s.fechaVencimiento}</span>
                                <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${badge.cls}`}>{badge.label}</span>
                              </>
                            )}
                          </div>
                          {s.notas && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{s.notas}</p>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export const InstrumentoSelectorPanel: React.FC<Props> = ({
  firebase,
  instrumentosSelected = [],
  patronesSelected = [],
  columnasSelected = [],
  onApply,
  readOnly,
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('instrumentos');
  const [loading, setLoading] = useState(false);

  // Datos cargados
  const [availableInstrumentos, setAvailableInstrumentos] = useState<InstrumentoPatronOption[]>([]);
  const [availablePatrones, setAvailablePatrones] = useState<Patron[]>([]);
  const [availableColumnas, setAvailableColumnas] = useState<Columna[]>([]);

  // Estado de selección en el panel
  const [checkedInstrumentos, setCheckedInstrumentos] = useState<Set<string>>(
    () => new Set(instrumentosSelected.map(i => i.id))
  );
  const [checkedPatronesKeys, setCheckedPatronesKeys] = useState<Set<string>>(new Set());
  const [checkedColumnasKeys, setCheckedColumnasKeys] = useState<Set<string>>(new Set());

  // Sincronizar cuando cambia el selected desde afuera
  useEffect(() => {
    setCheckedInstrumentos(new Set(instrumentosSelected.map(i => i.id)));
  }, [instrumentosSelected]);

  // Cuando hay available + selected, calcular las keys de patrones/columnas seleccionados
  useEffect(() => {
    if (availablePatrones.length === 0) return;
    const keys = new Set<string>();
    for (const sel of patronesSelected) {
      const patron = availablePatrones.find(p => p.id === sel.patronId);
      if (!patron) continue;
      const idx = patron.lotes.findIndex(l => l.lote === sel.lote);
      if (idx >= 0) keys.add(`${patron.id}__${idx}`);
    }
    setCheckedPatronesKeys(keys);
  }, [availablePatrones, patronesSelected]);

  useEffect(() => {
    if (availableColumnas.length === 0) return;
    const keys = new Set<string>();
    for (const sel of columnasSelected) {
      const col = availableColumnas.find(c => c.id === sel.columnaId);
      if (!col) continue;
      const idx = col.series.findIndex(s => s.serie === sel.serie);
      if (idx >= 0) keys.add(`${col.id}__${idx}`);
    }
    setCheckedColumnasKeys(keys);
  }, [availableColumnas, columnasSelected]);

  const handleOpen = async () => {
    if (readOnly) return;
    setOpen(true);
    if (availableInstrumentos.length > 0 || availablePatrones.length > 0 || availableColumnas.length > 0) return;
    setLoading(true);
    try {
      const [insts, patrs, cols] = await Promise.all([
        firebase.getActiveInstrumentos(),
        firebase.getActivePatrones(),
        firebase.getActiveColumnas(),
      ]);
      setAvailableInstrumentos(insts.filter(i => i.tipo === 'instrumento')); // patron legacy quedan fuera
      setAvailablePatrones(patrs);
      setAvailableColumnas(cols);
    } catch (err) {
      console.error('Error cargando inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleInstrumento = (id: string) => {
    setCheckedInstrumentos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePatronLote = (patronId: string, loteIdx: number) => {
    const key = `${patronId}__${loteIdx}`;
    setCheckedPatronesKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleColumnaSerie = (columnaId: string, serieIdx: number) => {
    const key = `${columnaId}__${serieIdx}`;
    setCheckedColumnasKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleApply = () => {
    // Construir los 3 arrays desde los checks
    const instrumentos = availableInstrumentos.filter(i => checkedInstrumentos.has(i.id));

    const patrones: PatronSeleccionado[] = [];
    for (const key of checkedPatronesKeys) {
      const [patronId, idxStr] = key.split('__');
      const idx = parseInt(idxStr, 10);
      const p = availablePatrones.find(x => x.id === patronId);
      if (!p || !p.lotes[idx]) continue;
      const lote = p.lotes[idx];
      patrones.push({
        patronId: p.id,
        codigoArticulo: p.codigoArticulo,
        descripcion: p.descripcion,
        marca: p.marca,
        categorias: p.categorias,
        lote: lote.lote,
        fechaVencimiento: lote.fechaVencimiento,
        certificadoEmisor: lote.certificadoEmisor ?? null,
        certificadoUrl: lote.certificadoUrl ?? null,
      });
    }

    const columnas: ColumnaSeleccionada[] = [];
    for (const key of checkedColumnasKeys) {
      const [columnaId, idxStr] = key.split('__');
      const idx = parseInt(idxStr, 10);
      const c = availableColumnas.find(x => x.id === columnaId);
      if (!c || !c.series[idx]) continue;
      const serie = c.series[idx];
      columnas.push({
        columnaId: c.id,
        codigoArticulo: c.codigoArticulo,
        descripcion: c.descripcion,
        marca: c.marca,
        categorias: c.categorias,
        serie: serie.serie,
        fechaVencimiento: serie.fechaVencimiento ?? null,
        certificadoEmisor: serie.certificadoEmisor ?? null,
        certificadoUrl: serie.certificadoUrl ?? null,
      });
    }

    onApply({ instrumentos, patrones, columnas });
    setOpen(false);
  };

  const totalSelected = checkedInstrumentos.size + checkedPatronesKeys.size + checkedColumnasKeys.size;

  if (!open) {
    const parts: string[] = [];
    if (instrumentosSelected.length > 0) parts.push(`${instrumentosSelected.length} inst.`);
    if (patronesSelected.length > 0) parts.push(`${patronesSelected.length} patrón(es)`);
    if (columnasSelected.length > 0) parts.push(`${columnasSelected.length} columna(s)`);

    return (
      <button
        onClick={handleOpen}
        disabled={readOnly}
        className="flex items-center gap-2 text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {parts.length > 0 ? `Editar (${parts.join(', ')})` : 'Seleccionar instrumentos / patrones / columnas'}
      </button>
    );
  }

  return (
    <div className="border border-indigo-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-200">
        <div>
          <p className="text-sm font-semibold text-indigo-900">Instrumentos, patrones y columnas utilizados</p>
          <p className="text-xs text-indigo-600 mt-0.5">Seleccioná el material usado en este servicio</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-indigo-400 hover:text-indigo-600 p-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 bg-white">
        {([
          { k: 'instrumentos' as Tab, label: 'Instrumentos', count: checkedInstrumentos.size },
          { k: 'patrones' as Tab, label: 'Patrones', count: checkedPatronesKeys.size },
          { k: 'columnas' as Tab, label: 'Columnas', count: checkedColumnasKeys.size },
        ]).map(tab => (
          <button
            key={tab.k}
            onClick={() => setActiveTab(tab.k)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === tab.k
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="px-4 py-3 max-h-96 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-6">Cargando…</p>
        ) : activeTab === 'instrumentos' ? (
          <InstrumentosTab instrumentos={availableInstrumentos}
            checkedIds={checkedInstrumentos} onToggle={toggleInstrumento} />
        ) : activeTab === 'patrones' ? (
          <PatronesTab patrones={availablePatrones}
            selectedKeys={checkedPatronesKeys} onToggle={togglePatronLote} />
        ) : (
          <ColumnasTab columnas={availableColumnas}
            selectedKeys={checkedColumnasKeys} onToggle={toggleColumnaSerie} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          {totalSelected > 0
            ? `${totalSelected} ${totalSelected === 1 ? 'item seleccionado' : 'items seleccionados'}`
            : 'Ninguno seleccionado'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen(false)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Confirmar selección
          </button>
        </div>
      </div>
    </div>
  );
};
