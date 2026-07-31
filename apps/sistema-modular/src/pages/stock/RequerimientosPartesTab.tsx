import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { presupuestosService, clientesService } from '../../services/firebaseService';
import { requerimientosService } from '../../services/importacionesService';
import { Card } from '../../components/ui/Card';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { matchesSearch } from '../../utils/searchTerms';
import type { Presupuesto, PresupuestoItem } from '@ags/shared';
import { ESTADO_PRESUPUESTO_LABELS, ESTADO_PRESUPUESTO_COLORS } from '@ags/shared';

/** Estados de requerimiento que ya no cuentan como "generado" para esta vista. */
const REQ_CERRADOS = new Set(['comprado', 'cancelado', 'completado']);

interface ParteRow {
  presupuesto: Presupuesto;
  item: PresupuestoItem;
  clienteNombre: string;
}

const th = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';
const td = 'px-3 py-2 text-xs';

/**
 * Pestaña "Partes de presupuestos" (cambio de lógica 2026-07-25): items vinculados a
 * stock de presupuestos en borrador/enviado. NO son requerimientos todavía — el
 * vendedor puede generarlo a mano si la venta es certera aunque no haya OC. Los
 * requerimientos firmes recién nacen al aceptar el presupuesto (o acá, a demanda).
 */
export function RequerimientosPartesTab() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<ParteRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Buscador por cliente / artículo / número de presupuesto (pedido 2026-07-31).
  const [localSearch, setLocalSearch] = useState('');
  const busqueda = useDebounce(localSearch, 300);
  // Claves `${presupuestoId}:${articuloId}` y `item:${presupuestoItemId}` con req abierto.
  const [reqKeys, setReqKeys] = useState<Set<string>>(new Set());
  const [generando, setGenerando] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [presupuestos, clientes, reqs] = await Promise.all([
        presupuestosService.getAll(),
        clientesService.getAll(true),
        requerimientosService.getAll(),
      ]);
      const nombreCliente = new Map(clientes.map(c => [c.id, c.razonSocial]));
      const abiertos = reqs.filter(r => !REQ_CERRADOS.has(r.estado));
      const keys = new Set<string>();
      for (const r of abiertos) {
        if (r.presupuestoId && r.articuloId) keys.add(`${r.presupuestoId}:${r.articuloId}`);
        if ((r as { presupuestoItemId?: string | null }).presupuestoItemId) keys.add(`item:${(r as { presupuestoItemId?: string | null }).presupuestoItemId}`);
      }
      setReqKeys(keys);
      const out: ParteRow[] = [];
      for (const p of presupuestos) {
        if (p.estado !== 'borrador' && p.estado !== 'enviado') continue;
        for (const item of (p.items ?? [])) {
          if (!item.stockArticuloId) continue;
          out.push({ presupuesto: p, item, clienteNombre: nombreCliente.get(p.clienteId) ?? p.clienteId });
        }
      }
      // Más recientes primero (mismo criterio que la lista de requerimientos).
      out.sort((a, b) => (b.presupuesto.createdAt || '').localeCompare(a.presupuesto.createdAt || ''));
      setRows(out);
    } catch (err) {
      console.error('[RequerimientosPartesTab] error cargando partes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tieneReq = useCallback((r: ParteRow) =>
    reqKeys.has(`${r.presupuesto.id}:${r.item.stockArticuloId}`) || (r.item.id && reqKeys.has(`item:${r.item.id}`)),
  [reqKeys]);

  const handleGenerar = async (r: ParteRow) => {
    const key = `${r.presupuesto.id}:${r.item.id}`;
    if (generando) return;
    setGenerando(key);
    try {
      let creados = await presupuestosService.generarRequerimientosParaItems(
        r.presupuesto.id, r.presupuesto.numero, [r.item],
      );
      // El ATP cubre → avisar pero PERMITIR generarlo igual (pedido 2026-07-31:
      // venta certera con ppto enviado sin aceptar — quieren comprar de todos modos).
      // Diálogo de la app, no window.confirm (feedback: "está como alerta de Windows").
      if (creados === 0) {
        const forzar = await confirm(
          'El stock proyectado (ATP) cubre la cantidad del ítem.\n\n¿Generar el requerimiento de todos modos?',
        );
        if (forzar) {
          creados = await presupuestosService.generarRequerimientosParaItems(
            r.presupuesto.id, r.presupuesto.numero, [r.item], { forzar: true },
          );
        }
      }
      if (creados > 0) {
        setReqKeys(prev => {
          const n = new Set(prev);
          n.add(`${r.presupuesto.id}:${r.item.stockArticuloId}`);
          if (r.item.id) n.add(`item:${r.item.id}`);
          return n;
        });
      }
    } catch (err) {
      console.error(err);
      alert('Error al generar el requerimiento');
    } finally {
      setGenerando(null);
    }
  };

  const rowsFiltradas = useMemo(() => {
    if (!busqueda.trim()) return rows;
    return rows.filter(r => matchesSearch(
      busqueda, r.clienteNombre, r.item.codigoProducto, r.item.descripcion, r.presupuesto.numero,
    ));
  }, [rows, busqueda]);

  const pendientes = useMemo(() => rows.filter(r => !tieneReq(r)).length, [rows, tieneReq]);

  if (loading) {
    return <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando partes de presupuestos...</p></div>;
  }
  if (rows.length === 0) {
    return <Card><div className="text-center py-12"><p className="text-slate-400 text-xs">No hay partes de presupuestos en borrador o enviados.</p></div></Card>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">
        Partes vinculadas a stock de presupuestos <span className="font-medium">borrador / enviados</span> — todavía sin
        requerimiento firme ({pendientes} sin generar). Si la venta es certera, generá el requerimiento sin esperar la OC.
      </p>
      <input
        type="text"
        value={localSearch}
        onChange={e => setLocalSearch(e.target.value)}
        placeholder="Buscar por cliente, artículo o presupuesto…"
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 w-72"
      />
      <div className="bg-white overflow-x-auto rounded-xl border border-slate-200">
        <table className="tabla-compacta w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={th}>Presupuesto</th>
              <th className={th}>Estado</th>
              <th className={th}>Cliente</th>
              <th className={th}>Artículo</th>
              <th className={`${th} text-center`}>Cant.</th>
              <th className={th}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rowsFiltradas.map(r => {
              const generado = tieneReq(r);
              const key = `${r.presupuesto.id}:${r.item.id}`;
              return (
                <tr key={key} className="hover:bg-slate-50">
                  <td className={`${td} whitespace-nowrap`}>
                    <Link to={`/presupuestos/${r.presupuesto.id}`} className="font-mono font-semibold text-teal-600 hover:underline">
                      {r.presupuesto.numero}
                    </Link>
                  </td>
                  <td className={td}>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_PRESUPUESTO_COLORS[r.presupuesto.estado]}`}>
                      {ESTADO_PRESUPUESTO_LABELS[r.presupuesto.estado]}
                    </span>
                  </td>
                  <td className={`${td} text-slate-600 max-w-[180px] truncate`}>{r.clienteNombre}</td>
                  <td className={td}>
                    <span className="font-mono font-semibold text-teal-800">{r.item.codigoProducto || '—'}</span>
                    <span className="block text-[10px] text-slate-400 max-w-[260px] truncate">{r.item.descripcion}</span>
                  </td>
                  <td className={`${td} text-center tabular-nums`}>{r.item.cantidad}</td>
                  <td className={td}>
                    {generado ? (
                      <span className="text-[10px] font-medium bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full">Req. generado</span>
                    ) : (
                      <button onClick={() => handleGenerar(r)} disabled={generando !== null}
                        className="text-[10px] font-medium text-teal-600 hover:underline disabled:opacity-40">
                        {generando === key ? 'Generando...' : 'Generar requerimiento'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
