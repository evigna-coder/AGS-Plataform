import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner';
import {
  loanersPortalService,
  prestamoActivo,
  ultimoPrestamoDevuelto,
} from '../services/loanersPortalService';
import { matchesSearch } from '../utils/searchTerms';
import type { Loaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS, ESTADO_LOANER_COLORS } from '@ags/shared';

function formatDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
}

function moduloResumen(l: Loaner): string {
  return [l.categoriaModuloNombre || l.categoriaEquipo, l.moduloCodigo]
    .filter(Boolean).join(' · ') || l.descripcion;
}

/**
 * Lista mobile-first de loaners para el ingeniero:
 * - 'en_cliente' (préstamo activo) → tap abre el detalle con acciones
 *   (fotos de salida / registrar retorno).
 * - 'en_recalificacion' → solo lectura (badge violeta); la OT la coordina
 *   administración vía el sweep del back-office.
 */
export default function LoanersPage() {
  const navigate = useNavigate();
  const [loaners, setLoaners] = useState<Loaner[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    return loanersPortalService.subscribeVisibles(setLoaners);
  }, []);

  const filtered = useMemo(() => {
    if (!loaners) return [];
    if (!search.trim()) return loaners;
    return loaners.filter(l => {
      const prestamo = prestamoActivo(l) ?? ultimoPrestamoDevuelto(l);
      return matchesSearch(
        search,
        l.codigo, l.descripcion, l.serie,
        l.categoriaModuloNombre, l.categoriaEquipo,
        l.moduloCodigo, l.moduloDescripcion, l.moduloMarca,
        prestamo?.clienteNombre, prestamo?.establecimientoNombre,
      );
    });
  }, [loaners, search]);

  if (loaners === null) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Loaners</p>
        <h1 className="text-lg font-semibold text-slate-800">Módulos en préstamo</h1>
        <p className="text-xs text-slate-500 mt-1">
          Tocá un loaner en cliente para agregar fotos de salida o registrar la devolución.
        </p>
      </header>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por código, módulo, serie, cliente…"
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-12">
          {loaners.length === 0
            ? 'No hay loaners en cliente ni en recalificación'
            : 'Sin resultados para la búsqueda'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(l => {
            const enCliente = l.estado === 'en_cliente';
            const prestamo = enCliente ? prestamoActivo(l) : ultimoPrestamoDevuelto(l);
            const body = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-teal-700">{l.codigo}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_LOANER_COLORS[l.estado]}`}>
                    {ESTADO_LOANER_LABELS[l.estado]}
                  </span>
                </div>
                <p className="text-sm text-slate-800 mt-1 truncate">{moduloResumen(l)}</p>
                <p className="text-xs text-slate-500 truncate">
                  {l.serie ? `SN ${l.serie}` : 'Sin serie'}
                  {prestamo ? ` · ${prestamo.clienteNombre}` : ''}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {enCliente
                    ? `Salida ${formatDate(prestamo?.fechaSalida)}`
                    : `Devuelto ${formatDate(prestamo?.fechaRetornoReal)} · pendiente de RQ`}
                </p>
              </>
            );
            return (
              <li key={l.id}>
                {enCliente ? (
                  <button
                    onClick={() => navigate(`/loaners/${l.id}`)}
                    className="w-full text-left bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-teal-400 active:bg-slate-50"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="w-full bg-white border border-purple-100 rounded-xl px-3 py-3 opacity-80">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
