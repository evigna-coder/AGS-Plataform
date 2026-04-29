import { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import type { PresupuestoSeccionesVisibles, TipoPresupuesto, PlantillaTextoPresupuesto } from '@ags/shared';
import { PRESUPUESTO_SECCIONES_LABELS } from '@ags/shared';
import { useConfirm } from '../ui/ConfirmDialog';
import { RichTextEditor } from '../ui/RichTextEditor';
import { plantillasTextoPresupuestoService } from '../../services/firebaseService';
import { PlantillasTextoModal } from './PlantillasTextoModal';

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
  const [plantillas, setPlantillas] = useState<PlantillaTextoPresupuesto[]>([]);
  const [showGestion, setShowGestion] = useState(false);
  const confirm = useConfirm();

  const loadPlantillas = async () => {
    try {
      const list = await plantillasTextoPresupuestoService.getAll();
      setPlantillas(list);
    } catch (e) {
      console.error('Error loading plantillas:', e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    plantillasTextoPresupuestoService.getAll()
      .then(list => { if (!cancelled) setPlantillas(list); })
      .catch(e => console.error('Error loading plantillas:', e));
    return () => { cancelled = true; };
  }, []);

  const plantillasBySeccion = useMemo(() => {
    const map: Partial<Record<SeccionKey, PlantillaTextoPresupuesto[]>> = {};
    for (const p of plantillas) {
      if (!p.activo) continue;
      if (!p.tipoPresupuestoAplica.includes(tipo)) continue;
      (map[p.tipo] ||= []).push(p);
    }
    return map;
  }, [plantillas, tipo]);

  const handleLoadPlantilla = async (key: SeccionKey, plantillaId: string) => {
    if (!plantillaId) return;
    const plantilla = plantillas.find(p => p.id === plantillaId);
    if (!plantilla) return;
    if (values[key] && !await confirm('Esto reemplazará el contenido actual. ¿Continuar?')) return;
    onValueChange(key, plantilla.contenido);
  };

  const handleGestionClose = () => {
    setShowGestion(false);
    loadPlantillas();
  };

  return (
    <Card compact>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
          Condiciones del presupuesto
        </h3>
        <button
          type="button"
          onClick={() => setShowGestion(true)}
          className="text-[11px] text-teal-700 hover:text-teal-900 hover:underline"
          title="Abrir modal de gestión de plantillas"
        >
          Gestionar plantillas →
        </button>
      </div>

      <div className="space-y-1">
        {SECCION_KEYS.map((key) => {
          const isVisible = seccionesVisibles[key] !== false;
          const isExpanded = expanded === key;
          const hasContent = !!values[key];
          const label = PRESUPUESTO_SECCIONES_LABELS[key];
          const opts = plantillasBySeccion[key] || [];

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

                {/* Per-section plantilla dropdown */}
                {opts.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => { handleLoadPlantilla(key, e.target.value); e.target.value = ''; }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-white text-teal-700 max-w-[180px]"
                    title="Cargar plantilla"
                  >
                    <option value="">Cargar plantilla…</option>
                    {opts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.esDefault ? '★ ' : ''}{p.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1">
                  <RichTextEditor
                    value={values[key] || ''}
                    onChange={(html) => onValueChange(key, html)}
                    placeholder={`Escriba el contenido de ${label.toLowerCase()}...`}
                    minHeight={240}
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

      <PlantillasTextoModal open={showGestion} onClose={handleGestionClose} />
    </Card>
  );
};
