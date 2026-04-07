import { useState, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { PresupuestoSeccionesVisibles, TipoPresupuesto } from '@ags/shared';
import { PRESUPUESTO_SECCIONES_LABELS } from '@ags/shared';
import { PRESUPUESTO_TEMPLATES } from '@ags/shared';
import { useConfirm } from '../ui/ConfirmDialog';

type SeccionKey = keyof PresupuestoSeccionesVisibles;

const SECCION_KEYS: SeccionKey[] = [
  'notasTecnicas',
  'notasAdministrativas',
  'garantia',
  'variacionTipoCambio',
  'condicionesComerciales',
  'aceptacionPresupuesto',
];

interface PresupuestoCondicionesEditorProps {
  tipo: TipoPresupuesto;
  seccionesVisibles: PresupuestoSeccionesVisibles;
  values: Record<SeccionKey, string>;
  onSeccionToggle: (key: SeccionKey, visible: boolean) => void;
  onValueChange: (key: SeccionKey, value: string) => void;
}

export const PresupuestoCondicionesEditor = ({
  tipo,
  seccionesVisibles,
  values,
  onSeccionToggle,
  onValueChange,
}: PresupuestoCondicionesEditorProps) => {
  const [expanded, setExpanded] = useState<SeccionKey | null>(null);


  const confirm = useConfirm();
  const getTemplate = useCallback((key: SeccionKey): string => {
    if (tipo === 'contrato') {
      const contratoTemplates = PRESUPUESTO_TEMPLATES.contrato as Record<string, string>;
      if (key === 'notasTecnicas' && contratoTemplates.notasSobrePresupuesto) {
        return contratoTemplates.notasSobrePresupuesto;
      }
      if (key === 'condicionesComerciales' && contratoTemplates.condicionesComerciales) {
        return contratoTemplates.condicionesComerciales;
      }
    }
    const val = (PRESUPUESTO_TEMPLATES as Record<string, unknown>)[key];
    return typeof val === 'string' ? val : '';
  }, [tipo]);

  const handleLoadTemplate = async (key: SeccionKey) => {
    const template = getTemplate(key);
    if (!template) return;
    if (values[key] && !await confirm('Esto reemplazará el contenido actual. ¿Continuar?')) return;
    onValueChange(key, template);
  };

  const handleLoadAll = async () => {
    if (!await confirm('¿Cargar todas las plantillas predeterminadas? Se reemplazará el contenido existente.')) return;
    for (const key of SECCION_KEYS) {
      const template = getTemplate(key);
      if (template) {
        onValueChange(key, template);
        onSeccionToggle(key, true);
      }
    }
  };

  return (
    <Card compact>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
          Condiciones del presupuesto
        </h3>
        <Button variant="ghost" size="sm" onClick={handleLoadAll}>
          Cargar plantillas
        </Button>
      </div>

      <div className="space-y-1">
        {SECCION_KEYS.map((key) => {
          const isVisible = seccionesVisibles[key] !== false;
          const isExpanded = expanded === key;
          const hasContent = !!values[key];
          const label = PRESUPUESTO_SECCIONES_LABELS[key];

          return (
            <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
                {/* Toggle visibility */}
                <button
                  onClick={() => onSeccionToggle(key, !isVisible)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isVisible
                      ? 'bg-teal-600 border-teal-600'
                      : 'bg-white border-slate-300'
                  }`}
                  title={isVisible ? 'Ocultar en PDF' : 'Mostrar en PDF'}
                >
                  {isVisible && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>

                {/* Section label + expand */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  className="flex-1 text-left flex items-center gap-2"
                >
                  <span className={`text-xs font-medium ${isVisible ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                    {label}
                  </span>
                  {hasContent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  )}
                  <svg
                    className={`w-3 h-3 text-slate-400 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Load template button */}
                <button
                  onClick={() => handleLoadTemplate(key)}
                  className="text-[10px] text-teal-600 hover:text-teal-800 font-medium"
                  title="Cargar plantilla predeterminada"
                >
                  Plantilla
                </button>
              </div>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1">
                  <textarea
                    value={values[key] || ''}
                    onChange={(e) => onValueChange(key, e.target.value)}
                    rows={8}
                    placeholder={`Escriba el contenido de ${label.toLowerCase()}...`}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none bg-white focus:ring-1 focus:ring-teal-500 resize-y"
                  />
                  {!isVisible && (
                    <p className="text-[10px] text-amber-600 mt-1">
                      Esta sección no se mostrará en el PDF (desactivada)
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
