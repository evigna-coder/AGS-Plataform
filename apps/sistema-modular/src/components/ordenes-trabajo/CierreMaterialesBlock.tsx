/**
 * Bloque "Materiales / Repuestos" del cierre administrativo.
 * Extraído de OTCierreAdminSection (250-LOC budget) + UAT 2026-07-15: si el
 * reporte técnico llegó sin items, el admin tiene que poder cargarlos ACÁ
 * (antes solo decía "Sin materiales registrados" sin salida — en el modal de
 * OT no existe otra sección de materiales).
 */
import { useEffect, useMemo, useState } from 'react';
import type { Articulo, CierreAdministrativo, Part } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { articulosService } from '../../services/firebaseService';
import { useReservasCierre } from '../../hooks/useReservasCierre';
import { reservasService } from '../../services/stockService';
import { useConfirm } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';

const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5 block';
const chk = 'w-3.5 h-3.5 accent-teal-600';

interface Props {
  articulos: Part[];
  cierreAdmin: CierreAdministrativo;
  disabled: boolean;
  onChange: (field: keyof CierreAdministrativo, value: any) => void;
  /** Si están presentes, el bloque permite cargar/editar items durante el cierre. */
  onAddPart?: (prefill?: { codigo: string; descripcion: string }) => void;
  onUpdatePart?: (id: string, field: keyof Part, value: any) => void;
  onRemovePart?: (id: string) => void;
  /** Números de presupuesto vinculados — para mostrar y poder liberar sus reservas. */
  budgets?: string[];
  /** Para el motivo del movimiento de liberación. */
  otNumber?: string;
}

export const CierreMaterialesBlock: React.FC<Props> = ({
  articulos, cierreAdmin, disabled, onChange,
  onAddPart, onUpdatePart, onRemovePart, budgets, otNumber,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [stockArticulos, setStockArticulos] = useState<Articulo[]>([]);
  const [liberando, setLiberando] = useState<string | null>(null);
  const confirm = useConfirm();
  const { usuario } = useAuth();
  const editable = !disabled && !!onAddPart;
  const tienePresupuestos = !!budgets && budgets.length > 0;
  // Reservas de los pptos vinculados. Ya NO se consumen solas (2026-09-01): se
  // muestran para que el administrativo decida — usarlas o soltarlas.
  const { reservas, refrescar } = useReservasCierre(budgets);

  const liberar = async (r: (typeof reservas)[number]) => {
    const que = `${r.cantidad} × ${r.articuloCodigo || r.articuloDescripcion}`;
    const ok = await confirm({
      title: 'Liberar reserva',
      message: `${que} vuelve a estar disponible en stock y deja de estar apartado para ${r.presupuestoNumero}.\n\nUsalo cuando el material no se haya usado en este trabajo.`,
      confirmLabel: 'Liberar',
    });
    if (!ok) return;
    setLiberando(r.unidadIds.join(','));
    try {
      const { liberadas, fallos } = await reservasService.liberarVarias({
        unidadIds: r.unidadIds,
        motivo: `Liberada al cerrar la OT ${otNumber ?? ''} — no se usó`.trim(),
        solicitadoPorNombre: usuario?.displayName ?? usuario?.email ?? 'Admin',
      });
      if (fallos.length > 0) {
        alert(`Se liberaron ${liberadas} u.\n\nNo se pudieron liberar:\n${fallos.join('\n')}`);
      }
      refrescar();
    } catch (err) {
      console.error('[CierreMaterialesBlock] liberar reserva:', err);
      alert('No se pudo liberar la reserva.');
    } finally {
      setLiberando(null);
    }
  };

  useEffect(() => {
    if (showPicker && stockArticulos.length === 0) {
      articulosService.getAll({ activoOnly: true }).then(setStockArticulos);
    }
  }, [showPicker, stockArticulos.length]);

  // Memoizado: evita recrear el array de opciones en cada render (identidad estable para el SearchableSelect).
  const articuloOptions = useMemo(
    () => stockArticulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` })),
    [stockArticulos],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={lbl}>Materiales / Repuestos ({articulos.length})</span>
        {editable && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="text-[11px] font-medium text-cyan-600 hover:underline"
          >
            + Desde stock
          </button>
        )}
      </div>
      {showPicker && editable && (
        <div className="mb-2 mt-1">
          <SearchableSelect
            value=""
            onChange={artId => {
              const art = stockArticulos.find(a => a.id === artId);
              if (art) { onAddPart!({ codigo: art.codigo, descripcion: art.descripcion }); setShowPicker(false); }
            }}
            options={articuloOptions}
            placeholder="Buscar artículo por código o descripción..."
          />
        </div>
      )}
      {articulos.length > 0 ? (
        <div className="border rounded-lg overflow-hidden mt-1">
          <table className="w-full">
            <thead className="bg-white/60">
              <tr>
                <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-center">Codigo</th>
                <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-center">Descripcion</th>
                <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-center w-16">Cant.</th>
                {editable && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articulos.map(p => (
                <tr key={p.id} className="bg-white/40">
                  <td className="px-2 py-1 text-xs text-slate-600 font-mono">{p.codigo || '-'}</td>
                  <td className="px-2 py-1 text-xs text-slate-600">{p.descripcion || '-'}</td>
                  <td className="px-2 py-1 text-xs text-slate-600 text-center">
                    {editable && onUpdatePart ? (
                      <input
                        type="number" min={1} value={p.cantidad}
                        onChange={e => onUpdatePart(p.id, 'cantidad', Number(e.target.value) || 1)}
                        className="w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-center bg-white"
                      />
                    ) : p.cantidad}
                  </td>
                  {editable && (
                    <td className="px-1 py-1 text-center">
                      {onRemovePart && (
                        <button onClick={() => onRemovePart(p.id)} title="Quitar"
                          className="text-slate-300 hover:text-red-500 text-xs">✕</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic mt-1">
          Sin materiales registrados
          {editable && ' — podés cargarlos con «+ Desde stock» (el selector de origen aparece al agregar)'}.
        </p>
      )}
      {tienePresupuestos && reservas.length > 0 && (
        <div className="mt-1.5 border border-slate-200 bg-slate-50 rounded px-2 py-1.5">
          <p className="text-[10px] font-semibold text-slate-600">
            Reservado para los presupuestos vinculados — <span className="font-normal">no se descuenta solo</span>
          </p>
          <ul className="mt-1 space-y-0.5">
            {reservas.map((r, i) => (
              <li key={i} className="text-[10px] text-slate-600 font-mono flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">
                  {r.cantidad} × {r.articuloCodigo || r.articuloDescripcion}
                  {r.nroSerie ? ` · S/N ${r.nroSerie}` : r.nroLote ? ` · Lote ${r.nroLote}` : ''}
                  {' — '}{r.ubicacionNombre || 'sin ubicación'} · {r.presupuestoNumero}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => void liberar(r)}
                    disabled={liberando !== null}
                    title="Devolver estas unidades al stock disponible"
                    className="shrink-0 text-[10px] font-sans font-medium text-teal-600 hover:text-teal-800 hover:underline disabled:text-slate-300"
                  >
                    {liberando === r.unidadIds.join(',') ? 'liberando…' : 'liberar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-500 mt-1">
            Si alguna se usó, agregala arriba como material y elegila en «Origen de materiales».
            Si no se usó, «liberar» la devuelve al stock disponible. Las que no toques siguen reservadas.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5 mt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={cierreAdmin.partesConfirmadas} disabled={disabled || articulos.length === 0}
            onChange={e => onChange('partesConfirmadas', e.target.checked)} className={chk} />
          <span className="text-xs text-slate-700">Partes confirmadas</span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={cierreAdmin.stockDeducido} disabled={disabled}
            onChange={e => onChange('stockDeducido', e.target.checked)} className={`${chk} mt-0.5`} />
          <span className="text-xs text-slate-700">
            Stock ya descontado por fuera del sistema
            <span className="block text-[10px] text-slate-400">
              Tildar solo si el consumo se registró en otro sistema — al finalizar NO se descuenta nada (ni reservas ni selección manual).
            </span>
          </span>
        </label>
      </div>
    </div>
  );
};
