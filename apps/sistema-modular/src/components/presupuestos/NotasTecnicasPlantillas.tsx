import { useEffect, useMemo, useState } from 'react';
import type { PlantillaTextoPresupuesto, TipoPresupuesto } from '@ags/shared';
import { plantillasTextoPresupuestoService } from '../../services/firebaseService';
import { PlantillasTextoModal } from './PlantillasTextoModal';

interface Props {
  /** Tipo del presupuesto — filtra qué plantillas aplican. */
  tipo?: TipoPresupuesto;
  /** HTML actual de las notas técnicas. */
  value: string;
  onChange: (html: string) => void;
}

/**
 * Selector de notas técnicas estandarizadas (2026-08-20).
 *
 * Las notas técnicas son texto libre —se pega información, se redacta a medida—
 * pero hay un puñado que se repite siempre igual y conviene que salgan idénticas.
 * El catálogo ya existía (`plantillas_texto_presupuesto` con `tipo: 'notasTecnicas'`)
 * y se administra desde "Gestionar plantillas"; lo que faltaba era poder usarlas
 * desde donde se escribe la nota.
 *
 * AGREGA, no reemplaza — al revés que el selector de Condiciones. Acá el caso es
 * componer: dos o tres notas estándar más lo que se escriba a mano. Reemplazar
 * borraría lo ya redactado, que es justo lo que no se quiere.
 */
export function NotasTecnicasPlantillas({ tipo, value, onChange }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaTextoPresupuesto[]>([]);
  const [showGestion, setShowGestion] = useState(false);

  const cargar = () => {
    plantillasTextoPresupuestoService.getAll()
      .then(setPlantillas)
      .catch(e => console.error('[NotasTecnicasPlantillas] cargando plantillas:', e));
  };

  useEffect(() => {
    let cancelled = false;
    plantillasTextoPresupuestoService.getAll()
      .then(list => { if (!cancelled) setPlantillas(list); })
      .catch(e => console.error('[NotasTecnicasPlantillas] cargando plantillas:', e));
    return () => { cancelled = true; };
  }, []);

  const opciones = useMemo(
    () => plantillas.filter(p =>
      p.activo
      && p.tipo === 'notasTecnicas'
      // Sin tipo de presupuesto todavía (alta en curso) se muestran todas: es
      // preferible ofrecer de más que dejar el selector vacío sin explicación.
      && (!tipo || p.tipoPresupuestoAplica.includes(tipo))),
    [plantillas, tipo],
  );

  const agregar = (plantillaId: string) => {
    const p = opciones.find(x => x.id === plantillaId);
    if (!p) return;
    const actual = value?.trim();
    // El editor trabaja en HTML: la separación entre notas es un párrafo, no un \n.
    onChange(actual ? `${actual}<p></p>${p.contenido}` : p.contenido);
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        {opciones.length > 0 ? (
          <select
            value=""
            onChange={e => { agregar(e.target.value); e.target.value = ''; }}
            className="text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white text-teal-700 max-w-[260px]"
            title="Agregar una nota técnica estandarizada al final del texto"
          >
            <option value="">Agregar nota estándar…</option>
            {opciones.map(p => (
              <option key={p.id} value={p.id}>{p.esDefault ? '★ ' : ''}{p.nombre}</option>
            ))}
          </select>
        ) : (
          <span className="text-[11px] text-slate-400">Sin notas estándar cargadas.</span>
        )}
        <button
          type="button"
          onClick={() => setShowGestion(true)}
          className="text-[11px] text-teal-700 hover:text-teal-900 hover:underline"
        >
          Gestionar plantillas →
        </button>
      </div>

      {showGestion && (
        <PlantillasTextoModal
          open
          onClose={() => { setShowGestion(false); cargar(); }}
        />
      )}
    </>
  );
}
