import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EstadoImportacion, Disponibilidad } from '@ags/shared';
import { ESTADO_IMPORTACION_COLORS, ESTADO_IMPORTACION_LABELS, DISPONIBILIDAD_LABELS } from '@ags/shared';
import type { EntregaRow as Row } from '../../utils/entregasResolver';
import { SEMAFORO_COLORS, SEMAFORO_LABELS } from '../../utils/entregasResolver';
import type { EntregaItemPatch } from '../../hooks/useEntregas';
import { ordenesCompraService } from '../../services/firebaseService';
import { proveedoresService } from '../../services/personalService';
import { previewOrdenCompraPDF } from '../../components/stock/pdf/generateOrdenCompraPDF';

interface Props {
  row: Row;
  onUpdate: (patch: EntregaItemPatch) => Promise<void>;
  /** Fila desplegada bajo un grupo de OC completa — fondo diferenciado. */
  nested?: boolean;
}

const DISPONIBILIDAD_OPCIONES = Object.entries(DISPONIBILIDAD_LABELS) as [Disponibilidad, string][];

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

export const EntregaRowComponent: React.FC<Props> = ({ row, onUpdate, nested }) => {
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

  const [loadingPdf, setLoadingPdf] = useState(false);
  const abrirPdfOC = async () => {
    if (!row.ocId) return;
    setLoadingPdf(true);
    try {
      const oc = await ordenesCompraService.getById(row.ocId);
      if (!oc) { alert('No se encontró la orden de compra.'); return; }
      const prov = await proveedoresService.getById(oc.proveedorId).catch(() => null);
      await previewOrdenCompraPDF(oc, prov);
    } catch (err) {
      console.error('[EntregaRow] error abriendo PDF de OC', err);
      alert('No se pudo abrir el PDF de la orden de compra.');
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${nested ? 'bg-slate-50/60' : ''}`}>
      <td className="px-3 py-2 text-xs font-semibold text-teal-700 truncate max-w-[160px]">
        {row.clienteNombre}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[220px]" title={row.descripcion}>
        {row.descripcion}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 text-right font-mono">
        {row.cantidad}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 text-right font-mono whitespace-nowrap">
        {formatMoney(row.precioUnitario, row.moneda)}
      </td>
      <td className="px-3 py-2 text-xs">
        <Link to={`/presupuestos/${row.presupuestoId}`} className="text-teal-700 hover:underline font-mono">
          {row.presupuestoNumero}
        </Link>
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
        {row.ocNumero ? (
          row.ocId ? (
            <button
              type="button"
              onClick={abrirPdfOC}
              disabled={loadingPdf}
              title="Abrir PDF de la orden de compra"
              className="text-teal-700 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
            >
              {row.ocNumero}
              <span className="text-[9px]">{loadingPdf ? '…' : '↗'}</span>
            </button>
          ) : (
            <span className="text-slate-600">{row.ocNumero}</span>
          )
        ) : (
          <span className="text-slate-300">—</span>
        )}
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
        <select
          value={row.disponibilidad ?? row.disponibilidadSugerida}
          onChange={(e) => void runUpdate({ disponibilidad: (e.target.value || null) as Disponibilidad | null })}
          disabled={saving}
          className="text-[10px] border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50 bg-white"
        >
          {DISPONIBILIDAD_OPCIONES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {row.disponibilidad == null && (
          <div className="text-[9px] text-slate-400 mt-0.5" title="Derivado del stock al aceptar: sin requerimiento = había stock; con requerimiento = a importar">
            auto
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
