import React, { useMemo, useState } from 'react';
import type { AnexoBuildResult, AnexoBuildWarning } from './pdf';
import { generateAnexoConsumiblesPDF } from './pdf';

/**
 * Sub-componente del EnviarPresupuestoModal — gestiona el toggle de anexos de
 * consumibles + preview en nueva pestaña + banners de warnings (no bloqueantes).
 *
 * Inputs son data-driven: el hook padre `useEnviarPresupuesto` ya pre-cargó
 * `anexos[]` y `warnings[]` vía `loadAnexos()` (Plan 04-05 / Task 2).
 *
 * Convenciones Editorial Teal:
 *   - banner contenedor `bg-amber-50/30 border-amber-100`
 *   - link "Ver anexo" en `text-teal-700 hover:text-teal-900`
 *   - banner terminal (sistema sin módulos ni plantilla) `bg-amber-100 border-amber-300`
 */
interface Props {
  anexos: AnexoBuildResult[];
  warnings: AnexoBuildWarning[];
  includeAnexos: boolean;
  onToggleIncludeAnexos: (v: boolean) => void;
  /** true cuando el flujo de envío está corriendo — bloquea cambios de toggle/preview. */
  disabled?: boolean;
}

export const EnviarAnexosSection: React.FC<Props> = ({
  anexos,
  warnings,
  includeAnexos,
  onToggleIncludeAnexos,
  disabled,
}) => {
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  const { softWarnings, terminalWarnings } = useMemo(() => {
    const soft: AnexoBuildWarning[] = [];
    const terminal: AnexoBuildWarning[] = [];
    for (const w of warnings) {
      if (w.tipo === 'sistema_sin_modulos_ni_plantilla') terminal.push(w);
      else soft.push(w);
    }
    return { softWarnings: soft, terminalWarnings: terminal };
  }, [warnings]);

  const handlePreview = async () => {
    if (anexos.length === 0) return;
    const target = anexos[previewIdx];
    if (!target) return;
    try {
      setPreviewing(true);
      const blob = await generateAnexoConsumiblesPDF(target.data);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        // Popup blocker → fallback a descarga directa.
        const a = document.createElement('a');
        a.href = url;
        a.download = target.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // Liberar el URL después de un rato (la pestaña ya está cargando el blob).
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      console.error('Error generando preview anexo:', err);
      alert('No se pudo generar el preview del anexo');
    } finally {
      setPreviewing(false);
    }
  };

  if (anexos.length === 0 && warnings.length === 0) return null;

  return (
    <div className="border border-amber-100 bg-amber-50/30 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled || anexos.length === 0}
            checked={includeAnexos}
            onChange={(e) => onToggleIncludeAnexos(e.target.checked)}
            className="w-3.5 h-3.5 text-teal-700 rounded"
          />
          <span className="text-xs font-medium text-slate-700">
            Adjuntar anexos de consumibles ({anexos.length})
          </span>
        </label>

        {includeAnexos && anexos.length > 0 && (
          <div className="flex items-center gap-2">
            {anexos.length > 1 && (
              <select
                className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white"
                value={previewIdx}
                onChange={(e) => setPreviewIdx(parseInt(e.target.value, 10))}
                disabled={previewing || disabled}
              >
                {anexos.map((a, i) => (
                  <option key={a.itemId + i} value={i}>
                    Anexo {i + 1} — {a.data.sistemaNombre}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing || disabled}
              className="text-[11px] font-medium text-teal-700 hover:text-teal-900 disabled:text-slate-400"
            >
              {previewing ? 'Generando…' : 'Ver anexo'}
            </button>
          </div>
        )}
      </div>

      {includeAnexos && anexos.length > 0 && (
        <ul className="text-[10px] text-slate-500 space-y-0.5 ml-5">
          {anexos.map((a, i) => (
            <li key={a.itemId + i}>• {a.filename}</li>
          ))}
        </ul>
      )}

      {terminalWarnings.length > 0 && (
        <div className="rounded bg-amber-100 border border-amber-300 p-2 text-[11px] text-amber-900">
          <p className="font-semibold mb-1">
            Atención: {terminalWarnings.length} item(s) sin anexo posible
          </p>
          <ul className="space-y-0.5">
            {terminalWarnings.map((w, i) => (
              <li key={w.itemId + i}>• {w.detalle}</li>
            ))}
          </ul>
          <p className="mt-1.5 italic">El email se enviará sin anexo para esos items.</p>
        </div>
      )}

      {softWarnings.length > 0 && (
        <details className="text-[10px] text-amber-800">
          <summary className="cursor-pointer hover:underline">
            {softWarnings.length} aviso(s) sobre módulos sin consumibles en catálogo
          </summary>
          <ul className="mt-1 ml-3 space-y-0.5">
            {softWarnings.map((w, i) => (
              <li key={w.itemId + i}>• {w.detalle}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
