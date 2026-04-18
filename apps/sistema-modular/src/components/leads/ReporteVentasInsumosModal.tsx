import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { UsuarioAGS } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { leadsService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import {
  buildVentasInsumosRows,
  thisWeekRange,
  thisMonthRange,
  lastMonthRange,
  fmtDateShort,
  type VentasInsumosRangeLabel,
} from '../../utils/ventasInsumosReport';
import { exportVentasInsumosExcel } from '../../utils/exportVentasInsumosExcel';
import { ReporteVentasInsumosPDF } from './pdf/ReporteVentasInsumosPDF';

type Preset = 'semana' | 'mes' | 'anterior' | 'custom';

interface Props {
  open: boolean;
  onClose: () => void;
  usuarios: UsuarioAGS[];
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function resolveRange(preset: Preset, customDesde: string, customHasta: string): VentasInsumosRangeLabel {
  if (preset === 'semana') return thisWeekRange();
  if (preset === 'mes') return thisMonthRange();
  if (preset === 'anterior') return lastMonthRange();
  const desde = new Date(customDesde + 'T00:00:00').toISOString();
  const hastaD = new Date(customHasta + 'T23:59:59').toISOString();
  return { desde, hasta: hastaD, label: 'Custom' };
}

async function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReporteVentasInsumosModal({ open, onClose, usuarios }: Props) {
  const { usuario } = useAuth();
  const [preset, setPreset] = useState<Preset>('semana');
  const defaultWeek = thisWeekRange();
  const [customDesde, setCustomDesde] = useState(toDateInputValue(defaultWeek.desde));
  const [customHasta, setCustomHasta] = useState(toDateInputValue(defaultWeek.hasta));
  const [busyFormat, setBusyFormat] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async (format: 'pdf' | 'excel') => {
    setBusyFormat(format);
    setError(null);
    try {
      const range = resolveRange(preset, customDesde, customHasta);
      const leads = await leadsService.queryForVentasInsumosReport({ desde: range.desde, hasta: range.hasta });
      const rows = buildVentasInsumosRows(leads, usuarios);

      if (format === 'excel') {
        exportVentasInsumosExcel(rows, range);
      } else {
        const doc = (
          <ReporteVentasInsumosPDF
            rows={rows}
            range={range}
            generadoPor={usuario?.displayName || usuario?.email || 'Usuario'}
          />
        );
        const blob = await pdf(doc).toBlob();
        const filename = `ventas-insumos_${range.label.replace(/\s+/g, '-').toLowerCase()}_${fmtDateShort(new Date().toISOString()).replace(/\//g, '-')}.pdf`;
        await downloadPdfBlob(blob, filename);
      }
      onClose();
    } catch (err) {
      console.error('Error generando reporte:', err);
      setError(err instanceof Error ? err.message : 'Error inesperado al generar el reporte');
    } finally {
      setBusyFormat(null);
    }
  }, [preset, customDesde, customHasta, usuarios, usuario, onClose]);

  const previewRange = resolveRange(preset, customDesde, customHasta);

  return (
    <Modal open={open} onClose={onClose} title="Reporte · Ventas de Insumos" maxWidth="md">
      <div className="space-y-5 p-1">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Período</div>
          <div className="grid grid-cols-4 gap-2">
            {([
              ['semana', 'Esta semana'],
              ['mes', 'Este mes'],
              ['anterior', 'Mes anterior'],
              ['custom', 'Personalizado'],
            ] as [Preset, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`px-3 py-2 rounded text-sm border transition-colors ${
                  preset === key
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Desde</span>
              <input
                type="date"
                value={customDesde}
                onChange={e => setCustomDesde(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Hasta</span>
              <input
                type="date"
                value={customHasta}
                onChange={e => setCustomHasta(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        <div className="rounded bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-900">
          Incluye tickets creados o modificados entre{' '}
          <strong>{fmtDateShort(previewRange.desde)}</strong> y{' '}
          <strong>{fmtDateShort(previewRange.hasta)}</strong>, además de cualquier ticket abierto fuera de rango.
        </div>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busyFormat !== null}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('excel')}
            disabled={busyFormat !== null}
          >
            {busyFormat === 'excel' ? 'Generando…' : 'Exportar Excel'}
          </Button>
          <Button
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={busyFormat !== null}
          >
            {busyFormat === 'pdf' ? 'Generando…' : 'Exportar PDF'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
