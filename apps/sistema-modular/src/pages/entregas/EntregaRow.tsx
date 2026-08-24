import React, { useState } from 'react';
import type { EstadoImportacion } from '@ags/shared';
import { ESTADO_IMPORTACION_COLORS, ESTADO_IMPORTACION_LABELS } from '@ags/shared';
import type { EntregaRow as Row } from '../../utils/entregasResolver';
import { SEMAFORO_COLORS, SEMAFORO_LABELS } from '../../utils/entregasResolver';
import type { EntregaItemPatch } from '../../hooks/useEntregas';
import { EntregaPresupuestoCell, EntregaOCProveedorCell } from './EntregaDocsCells';
import { EntregaDireccionCell } from './EntregaDireccionCell';
import type { DireccionEntrega } from '@ags/shared';
import { useEstablecimientoSuffix } from '../../hooks/useEstablecimientoSuffix';

interface Props {
  row: Row;
  onUpdate: (patch: EntregaItemPatch) => Promise<void>;
  /** Fila desplegada bajo un grupo de OC completa — fondo diferenciado. */
  nested?: boolean;
  /** Direcciones de entrega del cliente de esta fila. */
  direcciones: DireccionEntrega[];
  /** Abre la gestión de direcciones con este cliente preseleccionado. */
  onCargarDireccion: (clienteId: string) => void;
}

const TONO_DISPONIBILIDAD: Record<'ok' | 'camino' | 'nada', string> = {
  ok:     'bg-emerald-50 text-emerald-700',
  camino: 'bg-amber-50 text-amber-700',
  nada:   'bg-slate-100 text-slate-500',
};

const TITULO_DISPONIBILIDAD: Record<string, string> = {
  en_stock:    'Hay stock libre suficiente en el depósito',
  reservado:   'Hay unidades reservadas para este presupuesto',
  importacion: 'Viene por una importación — el estado es el del embarque',
  a_importar:  'Hay un requerimiento de compra, todavía sin embarcar',
  sin_stock:   'Sin stock y sin compra en marcha',
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  } catch {
    return '—';
  }
};

const formatMoney = (n: number, m: 'USD' | 'ARS' | 'EUR' | null): string => {
  const prefix = m === 'ARS' ? '$' : m === 'EUR' ? '€' : 'U$D';
  return `${prefix} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const EntregaRowComponent: React.FC<Props> = ({ row, onUpdate, nested, direcciones, onCargarDireccion }) => {
  const sufijoEstab = useEstablecimientoSuffix();
  const [otDraft, setOtDraft] = useState(row.otNumeroVinculada ?? '');
  const [fechaDraft, setFechaDraft] = useState((row.fechaComprometida ?? '').slice(0, 10));
  const [saving, setSaving] = useState(false);

  const runUpdate = async (patch: EntregaItemPatch, revert?: () => void) => {
    setSaving(true);
    try {
      await onUpdate(patch);
    } catch (err) {
      console.error('[EntregaRow] update failed', err);
      revert?.();
    } finally {
      setSaving(false);
    }
  };

  const commitOt = () => {
    const next = otDraft.trim() === '' ? null : otDraft.trim();
    if (next === (row.otNumeroVinculada ?? null)) return;
    void runUpdate({ otNumeroVinculada: next }, () => setOtDraft(row.otNumeroVinculada ?? ''));
  };

  const commitFecha = () => {
    const current = (row.fechaComprometida ?? '').slice(0, 10);
    const next = fechaDraft === '' ? null : fechaDraft;
    if ((next ?? '') === current) return;
    void runUpdate({ fechaComprometida: next }, () => setFechaDraft(current));
  };

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${nested ? 'bg-slate-50/60' : ''}`}>
      <td className="px-3 py-2 text-xs font-semibold text-teal-700 truncate max-w-[160px]" title={`${row.clienteNombre}${sufijoEstab(row.clienteId, row.establecimientoId)}`}>
        {row.clienteNombre}{sufijoEstab(row.clienteId, row.establecimientoId)}
      </td>
      <td className="px-3 py-2 text-xs font-mono text-slate-700 whitespace-nowrap" title={row.codigoProducto ?? ''}>
        {row.codigoProducto ?? <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[220px]" title={row.descripcion}>
        {row.descripcion}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 text-right font-mono">
        {row.cantidad}
        {/* Envase cotizado: la cantidad es de envases, el stock se mide en
            unidades base (Fase 3 presentaciones, 2026-08-13). */}
        {row.presentacionCodigo && (
          <span className="block text-[9px] text-slate-400" title={`Cotizado por ${row.presentacionCodigo}`}>
            = {row.cantidadBase} u.
          </span>
        )}
      </td>
      {/* Stock REAL de hoy (2026-08-13): `Disp.` es la promesa hecha al
          presupuestar y no se recalcula nunca; acá va lo que hay. En rojo
          cuando la promesa dice "stock" y no alcanza para cubrir la cantidad. */}
      <td className="px-3 py-2 text-xs text-right font-mono whitespace-nowrap">
        {row.stockArticuloId ? (
          (() => {
            const cubre = row.stockReservado + row.stockLibre;
            const prometeStock = (row.disponibilidad ?? row.disponibilidadSugerida) === 'stock';
            // Contra unidades BASE: cotizar 1 envase de 10 necesita 10.
            const falta = prometeStock && cubre < row.cantidadBase && !row.entregadoManual;
            return (
              <span
                className={falta ? 'text-red-600 font-semibold' : 'text-slate-600'}
                title={`${row.stockReservado} reservada(s) para este presupuesto · ${row.stockLibre} libre(s) en estante`
                  + (falta ? `\nNo alcanza para las ${row.cantidadBase} unidades comprometidas.` : '')}
              >
                {row.stockReservado > 0 ? `${row.stockReservado}R` : ''}
                {row.stockReservado > 0 && row.stockLibre > 0 ? ' + ' : ''}
                {row.stockLibre > 0 || row.stockReservado === 0 ? `${row.stockLibre}L` : ''}
                {falta ? ' ⚠' : ''}
              </span>
            );
          })()
        ) : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 text-right font-mono whitespace-nowrap">
        {formatMoney(row.precioUnitario, row.moneda)}
      </td>
      <td className="px-3 py-2 text-xs">
        <EntregaPresupuestoCell row={row} />
      </td>
      <td className="px-3 py-2 text-xs">
        <input
          type="text"
          value={otDraft}
          onChange={(e) => setOtDraft(e.target.value)}
          onBlur={commitOt}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="OT#"
          disabled={saving}
          className="w-20 text-xs font-mono border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
          data-testid={`ot-input-${row.itemId}`}
        />
      </td>
      <td className="px-3 py-2 text-xs font-mono">
        <EntregaOCProveedorCell row={row} />
      </td>
      <td className="px-3 py-2 text-xs">
        {row.importacionNumero ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-slate-600">{row.importacionNumero}</span>
            {row.importacionEstado && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[row.importacionEstado as EstadoImportacion] ?? 'bg-slate-100 text-slate-500'}`}>
                {ESTADO_IMPORTACION_LABELS[row.importacionEstado as EstadoImportacion] ?? row.importacionEstado}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {/* Estado CALCULADO, no elegible (2026-08-24). Antes era un selector con
            un valor congelado al aceptar el presupuesto: decía "A importar" con
            el embarque ya en aduana, y había que corregirlo a mano. Ahora sale
            de la importación y del stock de hoy, y se mueve solo. */}
        <span
          className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
            TONO_DISPONIBILIDAD[row.disponibilidadCalculada.tono]
          }`}
          title={TITULO_DISPONIBILIDAD[row.disponibilidadCalculada.clave]}
        >
          {row.disponibilidadCalculada.label}
        </span>
        {/* Hay mercadería y no se puede entregar: el presupuesto se cobra por
            adelantado (2026-08-24). Solo aparece cuando IMPORTA — si además
            falta el stock, el problema es otro y este aviso sería ruido. */}
        {row.pagoAnticipado && (row.stockLibre > 0 || row.stockReservado > 0) && (
          <div className="text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 mt-0.5"
            title="El presupuesto es de pago anticipado: hay stock, pero no se entrega hasta confirmar el pago">
            ⚠ Pago anticipado
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-[10px] whitespace-nowrap">
        <input
          type="date"
          value={fechaDraft}
          onChange={(e) => setFechaDraft(e.target.value)}
          onBlur={commitFecha}
          disabled={saving}
          className="text-[10px] font-mono border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
        />
        {!row.fechaComprometida && row.etaFecha && (
          <div className="text-[9px] text-slate-400 mt-0.5">calc: {formatDate(row.etaFecha)}</div>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        <EntregaDireccionCell row={row} direcciones={direcciones}
          onUpdate={onUpdate} onCargar={onCargarDireccion} />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={row.entregadoManual === true}
          onChange={(e) => void runUpdate({ entregadoManual: e.target.checked })}
          disabled={saving}
          className="h-3.5 w-3.5 accent-teal-600 cursor-pointer disabled:opacity-50"
          title="Marcar como entregado"
        />
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">
        {row.semaforo === 'sin_eta' ? (
          <span className="text-slate-300 text-[10px]">—</span>
        ) : (
          <span className={`font-mono font-medium ${SEMAFORO_COLORS[row.semaforo]}`}>
            {row.diasRestantes != null ? `${row.diasRestantes}d` : '—'}
          </span>
        )}
        <span className="ml-1.5 text-[9px] text-slate-400">{SEMAFORO_LABELS[row.semaforo]}</span>
      </td>
    </tr>
  );
};
