import { useEffect, useMemo, useRef, useState } from 'react';
import { useNumeroAnimado } from '@ags/shared';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { usePreferenciaUsuario } from '../../hooks/usePreferenciaUsuario';
import { useDebouncedUrlText } from '../../hooks/useDebouncedUrlText';
import { useInventarioAnual } from '../../hooks/useInventarioAnual';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { InventarioAnualTabla } from '../../components/stock/InventarioAnualTabla';
import { exportInventarioAnual } from '../../utils/exports/exportInventarioAnual';
import { rutaPosicion, type FilaInventario, type FiltrosInventario } from '../../utils/inventarioAnual';
import { toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { notify } from '../../utils/notify';
import { articulosService } from '../../services/stockService';

const FILTER_SCHEMA = {
  posiciones: { type: 'string' as const, default: '' },   // ids separados por coma; vacío = todas
  posExcluidas: { type: 'string' as const, default: '' }, // depósitos/posiciones que no entran (con sus hijas)
  quitados:   { type: 'string' as const, default: '' },   // artículos quitados a mano
  fuera:      { type: 'string' as const, default: 'true' }, // incluir minikits y asignadas
  sufijo:     { type: 'string' as const, default: 'true' }, // excluir códigos B/C
  condicion:  { type: 'string' as const, default: 'true' }, // excluir por condición
  texto:      { type: 'string' as const, default: '' },
  vista:      { type: 'string' as const, default: 'vendibles' },
  sortField:  { type: 'string' as const, default: 'codigo' },
  sortDir:    { type: 'string' as const, default: 'asc' },
};

/** Valor de una columna para ordenar; los textos derivados se arman acá. */
function valorOrden(f: FilaInventario, field: string): string | number | null {
  switch (field) {
    case 'ubicacionesTexto': return f.ubicaciones.join(' · ');
    case 'condicionesTexto': return f.condiciones.join(', ');
    default: {
      const v = (f as unknown as Record<string, unknown>)[field];
      return typeof v === 'number' || typeof v === 'string' ? v : v == null ? null : String(v);
    }
  }
}

/** Orden por columna con los vacíos (sin precio, sin valor) siempre al final. */
function ordenar(filas: FilaInventario[], field: string, dir: SortDir): FilaInventario[] {
  return [...filas].sort((a, b) => {
    const va = valorOrden(a, field), vb = valorOrden(b, field);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
    return dir === 'asc' ? cmp : -cmp;
  });
}
const usd = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Inventario anual valorizado (2026-09-29): el stock vendible filtrado por
 * posiciones, sin los códigos B/C ni las condiciones no vendibles, con precio
 * EXW promedio en USD y export a Excel para completar los precios que faltan y
 * cruzar con listas de precios.
 */
export function InventarioAnualPage() {
  const [filters, setFilter, setFilters] = useUrlFilters(FILTER_SCHEMA);
  const [textoInput, setTextoInput] = useDebouncedUrlText(filters.texto, v => setFilter('texto', v));
  // Las exclusiones siguen al USUARIO (2026-10-01): depósitos excluidos y
  // artículos quitados se guardan en sus preferencias y se adoptan al abrir la
  // pantalla con la URL vacía. Antes vivían solo en la URL de la pestaña: al
  // perderse la pestaña se perdía una tarde de trabajo de purga.
  const [prefInv, setPrefInv] = usePreferenciaUsuario('inventarioAnual', { posExcluidas: '', quitados: '' });
  const urlTuvoDatos = useRef(!!(filters.posExcluidas || filters.quitados));
  useEffect(() => {
    if (!urlTuvoDatos.current && (prefInv.posExcluidas || prefInv.quitados)) {
      setFilters({ posExcluidas: prefInv.posExcluidas, quitados: prefInv.quitados });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const tiene = !!(filters.posExcluidas || filters.quitados);
    if (tiene) urlTuvoDatos.current = true;
    // URL vacía de entrada (todavía no se adoptó lo guardado): no pisar la preferencia.
    if (!tiene && !urlTuvoDatos.current) return;
    if (filters.posExcluidas !== prefInv.posExcluidas || filters.quitados !== prefInv.quitados) {
      setPrefInv({ posExcluidas: filters.posExcluidas, quitados: filters.quitados });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.posExcluidas, filters.quitados]);
  const posicionIds = useMemo(() => filters.posiciones.split(',').filter(Boolean), [filters.posiciones]);
  const posExcluidas = useMemo(() => filters.posExcluidas.split(',').filter(Boolean), [filters.posExcluidas]);
  const quitados = useMemo(() => filters.quitados.split(',').filter(Boolean), [filters.quitados]);
  const filtros = useMemo<FiltrosInventario>(() => ({
    posicionIds, posicionesExcluidas: posExcluidas, articulosExcluidos: quitados,
    incluirFueraDePosicion: filters.fuera !== 'false',
    excluirSufijo: filters.sufijo !== 'false',
    excluirCondicion: filters.condicion !== 'false',
  }), [posicionIds, posExcluidas, quitados, filters.fuera, filters.sufijo, filters.condicion]);
  const inv = useInventarioAnual(filtros);
  // El total valorizado cuenta hasta el valor nuevo al quitar o recalcular (2026-09-30).
  const totalAnimado = useNumeroAnimado(inv.resultado?.totalValor ?? 0);
  const [exportando, setExportando] = useState(false);
  // Selección múltiple para "Quitar" (transitoria; lo quitado sí va a la URL).
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSeleccion(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const quitarSeleccionados = () => {
    if (seleccion.size === 0) return;
    setFilter('quitados', [...new Set([...quitados, ...seleccion])].join(','));
    notify.success(`${seleccion.size} artículo${seleccion.size === 1 ? '' : 's'} quitado${seleccion.size === 1 ? '' : 's'} del inventario`);
    setSeleccion(new Set());
  };
  const restaurar = async (f: FilaInventario) => {
    if (f.excluida === 'manual') { setFilter('quitados', quitados.filter(x => x !== f.articuloId).join(',')); return; }
    // Excluido por código B/C o por condición: la confirmación se guarda en el artículo.
    try {
      await articulosService.update(f.articuloId, { vendibleConfirmado: true });
      notify.success(`${f.codigo} confirmado como vendible`);
      inv.recargar();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'No se pudo guardar la confirmación');
    }
  };
  const desconfirmar = async (id: string) => {
    try {
      await articulosService.update(id, { vendibleConfirmado: false });
      inv.recargar();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'No se pudo deshacer');
    }
  };

  const posById = useMemo(() => new Map(inv.posiciones.map(p => [p.id, p])), [inv.posiciones]);
  const opcionesPos = useMemo(() => inv.posiciones
    .filter(p => !posicionIds.includes(p.id) && !posExcluidas.includes(p.id))
    .map(p => ({ value: p.id, label: rutaPosicion(p.id, posById) || p.nombre, subLabel: p.codigo }))
    .sort((a, b) => a.label.localeCompare(b.label)), [inv.posiciones, posicionIds, posExcluidas, posById]);
  const agregarPos = (id: string) => { if (id) setFilter('posiciones', [...posicionIds, id].join(',')); };
  const quitarPos = (id: string) => setFilter('posiciones', posicionIds.filter(x => x !== id).join(','));
  const excluirPos = (id: string) => { if (id) setFilter('posExcluidas', [...posExcluidas, id].join(',')); };
  const desexcluirPos = (id: string) => setFilter('posExcluidas', posExcluidas.filter(x => x !== id).join(','));

  const t = filters.texto.trim().toLowerCase();
  const porTexto = (f: { codigo: string; descripcion: string }) => !t || f.codigo.toLowerCase().includes(t) || f.descripcion.toLowerCase().includes(t);
  const sortDir = (filters.sortDir === 'desc' ? 'desc' : 'asc') as SortDir;
  const onSort = (field: string) => {
    const s = toggleSort(field, filters.sortField, sortDir);
    setFilter('sortField', s.field);
    setFilter('sortDir', s.dir);
  };
  const vendibles = ordenar((inv.resultado?.vendibles ?? []).filter(porTexto), filters.sortField, sortDir);
  const excluidas = ordenar((inv.resultado?.excluidas ?? []).filter(porTexto), filters.sortField, sortDir);
  const enExcluidos = filters.vista === 'excluidos';

  const descripcionFiltros = () => [
    posicionIds.length === 0 ? 'Todas las posiciones' : `Posiciones: ${posicionIds.map(id => rutaPosicion(id, posById)).join(', ')}`,
    ...(posExcluidas.length > 0 ? [`Sin: ${posExcluidas.map(id => rutaPosicion(id, posById)).join(', ')}`] : []),
    ...(quitados.length > 0 ? [`${quitados.length} artículos quitados a mano`] : []),
    filtros.incluirFueraDePosicion ? 'Incluye minikits y asignadas' : 'Solo en posición',
    filtros.excluirSufijo ? 'Sin códigos B/C' : 'Con códigos B/C',
    filtros.excluirCondicion ? 'Sin reacondicionado / scrap / bien de uso' : 'Todas las condiciones',
  ];
  const exportar = () => {
    if (!inv.resultado) return;
    setExportando(true);
    try {
      exportInventarioAnual({ vendibles: inv.resultado.vendibles, excluidas: inv.resultado.excluidas, filtros: descripcionFiltros() });
      notify.success('Excel generado');
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setExportando(false);
    }
  };

  const toggle = (k: 'fuera' | 'sufijo' | 'condicion', label: string) => (
    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
      <input type="checkbox" checked={filters[k] !== 'false'} onChange={e => setFilter(k, e.target.checked ? 'true' : 'false')} className="rounded border-slate-300" />
      {label}
    </label>
  );
  const tab = (v: string, label: string) => (
    <button onClick={() => setFilter('vista', v)}
      className={`px-3 py-1 text-xs rounded-lg border ${filters.vista === v ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'}`}>
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-5 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Inventario anual</h1>
            {inv.resultado && (
              <p className="text-xs text-slate-400 mt-0.5">
                {inv.resultado.vendibles.length} artículos vendibles · {inv.resultado.totalCantidad} unidades ·{' '}
                <span className="text-slate-700 font-medium tabular-nums">U$S {usd(totalAnimado)}</span>
                {inv.resultado.sinPrecio > 0 && <span className="text-amber-600"> · {inv.resultado.sinPrecio} sin precio</span>}
                {' · '}{inv.resultado.excluidas.length} excluidos a confirmar
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tab('vendibles', 'Vendibles')}
            {tab('excluidos', `No vendibles (${inv.resultado?.excluidas.length ?? 0})`)}
            <Button variant="outline" size="sm" onClick={inv.recargar} disabled={inv.loading}>Recalcular</Button>
            <Button size="sm" onClick={exportar} disabled={!inv.resultado || exportando}>Exportar Excel</Button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="text" value={textoInput} onChange={e => setTextoInput(e.target.value)} placeholder="Buscar por código o descripción…"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <div className="w-72">
            <SearchableSelect value="" onChange={agregarPos} size="sm" options={opcionesPos}
              placeholder={posicionIds.length === 0 ? 'Posiciones: todas (agregar para filtrar)' : '+ Agregar posición'} emptyMessage="Sin más posiciones" />
          </div>
          {posicionIds.map(id => (
            <span key={id} className="inline-flex items-center gap-1 text-[11px] bg-teal-50 text-teal-800 border border-teal-200 rounded-full px-2 py-0.5">
              {rutaPosicion(id, posById) || id}
              <button onClick={() => quitarPos(id)} className="text-teal-600 hover:text-red-600" title="Quitar">×</button>
            </span>
          ))}
          <div className="w-64">
            <SearchableSelect value="" onChange={excluirPos} size="sm" options={opcionesPos}
              placeholder="− Excluir depósito o posición" emptyMessage="Sin más posiciones" />
          </div>
          {posExcluidas.map(id => (
            <span key={id} className="inline-flex items-center gap-1 text-[11px] bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 line-through decoration-red-300">
              {rutaPosicion(id, posById) || id}
              <button onClick={() => desexcluirPos(id)} className="text-red-500 hover:text-teal-700 no-underline" title="Volver a incluir">×</button>
            </span>
          ))}
          {toggle('fuera', 'Incluir minikits y asignadas')}
          {toggle('sufijo', 'Excluir códigos B/C')}
          {toggle('condicion', 'Excluir por condición')}
        </div>
        {!enExcluidos && seleccion.size > 0 && (
          <div className="mt-3 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 text-xs text-teal-800 motion-safe:animate-barra-in">
            <span className="font-medium">{seleccion.size} seleccionado{seleccion.size === 1 ? '' : 's'}</span>
            <Button size="sm" variant="danger" onClick={quitarSeleccionados}>Quitar del inventario</Button>
            <button onClick={() => setSeleccion(new Set())} className="text-teal-700 hover:underline">Limpiar selección</button>
            <span className="text-teal-600/70">Lo quitado pasa a "No vendibles" y se puede restaurar.</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 px-5 pb-4 pt-4">
        {inv.error ? (
          <EmptyState message="No se pudo leer el stock" hint={inv.error} action={<Button size="sm" onClick={inv.recargar}>Reintentar</Button>} />
        ) : inv.loading ? (
          <LoadingState message="Leyendo unidades, artículos y posiciones…" rows={8} />
        ) : enExcluidos ? (
          excluidas.length === 0
            ? <EmptyState message="Nada excluido con estos filtros" hint="Activá 'Excluir códigos B/C' o 'Excluir por condición' para ver qué queda afuera." />
            : <InventarioAnualTabla filas={excluidas} excluidos onRestaurar={restaurar} sortField={filters.sortField} sortDir={sortDir} onSort={onSort} />
        ) : vendibles.length === 0 ? (
          <EmptyState message="Ningún artículo con estos filtros" hint="Probá con otras posiciones o sin la búsqueda." />
        ) : (
          <InventarioAnualTabla filas={vendibles} seleccion={seleccion} onToggle={toggleSel}
            onToggleTodos={marcar => setSeleccion(marcar ? new Set(vendibles.map(f => f.articuloId)) : new Set())}
            onDesconfirmar={desconfirmar} sortField={filters.sortField} sortDir={sortDir} onSort={onSort} />
        )}
      </div>
    </div>
  );
}
