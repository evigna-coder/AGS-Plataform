import { useMemo, useState } from 'react';
import type { PresupuestoItem, Sistema } from '@ags/shared';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

interface Props {
  sistemas: Sistema[];
  items: PresupuestoItem[];
  /** Alcance del contrato: ids de sistemas a cubrir (persistido en el presupuesto). */
  plan: string[];
  onChangePlan: (ids: string[]) => void;
  /** Cargar equipos: abre el modal de carga con esos equipos ya elegidos.
   *  Un solo id desde el chip; todos los pendientes desde "Cargar todos juntos". */
  onCargarSistemas: (sistemaIds: string[]) => void;
}

/**
 * Cola de carga de sistemas del contrato (2026-08-04): primero se elige el
 * ALCANCE (todos los sistemas que cubre el contrato), después se cargan — de a
 * uno, o varios juntos compartiendo la misma lista de servicios (2026-09-02).
 * Cada equipo cargado se consume de la cola. Evita el error de la carga libre:
 * duplicar un equipo u olvidarse alguno.
 */
export function ContratoSistemasQueue({ sistemas, items, plan, onChangePlan, onCargarSistemas }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const cargadosIds = useMemo(
    () => new Set(items.map(i => i.sistemaId).filter(Boolean) as string[]),
    [items],
  );
  const sistemaById = useMemo(() => new Map(sistemas.map(s => [s.id, s])), [sistemas]);
  const nombreDe = (id: string) => {
    const s = sistemaById.get(id);
    return s ? `${s.nombre}${s.codigoInternoCliente ? ` — ${s.codigoInternoCliente}` : ''}` : id;
  };

  const pendientes = plan.filter(id => !cargadosIds.has(id));
  const cargadosDelPlan = plan.filter(id => cargadosIds.has(id));

  const abrirPicker = () => {
    // Preselección = plan actual ∪ ya cargados (los cargados no se pueden desmarcar).
    setSeleccion(new Set([...plan, ...cargadosIds]));
    setBusqueda('');
    setShowPicker(true);
  };

  const toggle = (id: string) => {
    if (cargadosIds.has(id)) return; // ya tiene items — sale del plan solo borrando el grupo
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const confirmarPicker = () => {
    onChangePlan([...seleccion]);
    setShowPicker(false);
  };

  const sistemasFiltrados = sistemas.filter(s =>
    !busqueda || `${s.nombre} ${s.codigoInternoCliente ?? ''}`.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
          Sistemas del contrato
          {plan.length > 0 && (
            <span className="ml-2 text-teal-700 font-semibold">{cargadosDelPlan.length} de {plan.length} cargados</span>
          )}
        </p>
        <Button size="sm" variant="outline" onClick={abrirPicker}>
          {plan.length === 0 ? 'Elegir sistemas del contrato' : 'Editar alcance'}
        </Button>
      </div>

      {plan.length === 0 ? (
        <p className="text-[11px] text-slate-400">
          Elegí primero TODOS los sistemas que cubre el contrato — después se cargan (de a uno o varios juntos) y se van consumiendo de la lista.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {pendientes.map(id => (
            <button key={id} onClick={() => onCargarSistemas([id])}
              title="Cargar los servicios de este equipo"
              className="text-[11px] px-2 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium">
              {nombreDe(id)} →
            </button>
          ))}
          {cargadosDelPlan.map(id => (
            <span key={id}
              className="text-[11px] px-2 py-1 rounded-full border border-teal-200 bg-teal-50 text-teal-700 inline-flex items-center gap-1">
              ✓ {nombreDe(id)}
            </span>
          ))}
          {pendientes.length > 1 && (
            <button onClick={() => onCargarSistemas(pendientes)}
              title="Cargar los mismos servicios para todos los equipos que faltan, de una sola vez"
              className="text-[11px] px-2 py-1 rounded-full border border-teal-300 bg-teal-600 text-white hover:bg-teal-700 font-medium">
              Cargar los {pendientes.length} juntos
            </button>
          )}
          {pendientes.length === 0 && (
            <span className="text-[11px] text-teal-700 font-medium self-center">Todos los sistemas del alcance están cargados ✓</span>
          )}
        </div>
      )}

      <Modal open={showPicker} onClose={() => setShowPicker(false)} maxWidth="lg"
        title="Alcance del contrato"
        subtitle="Marcá todos los sistemas que cubre el contrato. Los ya cargados no se pueden desmarcar."
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setShowPicker(false)}>Cancelar</Button>
          <Button size="sm" onClick={confirmarPicker}>Confirmar ({seleccion.size})</Button>
        </>}>
        <div className="space-y-2">
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar sistema…" autoFocus
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {sistemasFiltrados.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Sin sistemas para este cliente.</p>
            )}
            {sistemasFiltrados.map(s => {
              const cargado = cargadosIds.has(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${cargado ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={seleccion.has(s.id)} disabled={cargado}
                    onChange={() => toggle(s.id)} className="rounded border-slate-300 accent-teal-600" />
                  <span className="text-slate-700 flex-1">{s.nombre}</span>
                  {s.codigoInternoCliente && <span className="font-mono text-[10px] text-slate-400">{s.codigoInternoCliente}</span>}
                  {cargado && <span className="text-[9px] text-teal-700 font-medium">cargado</span>}
                </label>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
