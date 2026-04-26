import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService } from '../../services/firebaseService';
import type { WorkOrder, ViaIngreso } from '@ags/shared';
import { VIA_INGRESO_LABELS } from '@ags/shared';

export interface DatosBasicosForm {
  clienteId: string;
  clienteNombre: string;
  sistemaNombre: string;
  moduloNombre: string;
  moduloSerie: string;
  descripcionLibre: string;
  viaIngreso: ViaIngreso;
  traidoPor: string;
  descripcionProblema: string;
  condicionFisica: string;
}

interface Props {
  ot: WorkOrder | null;
  onSubmit: (form: DatosBasicosForm) => void;
  onBack: () => void;
}

/**
 * Paso 2 — completar lo mínimo necesario para crear la ficha.
 * Si vino una OT del paso anterior, prepoblamos cliente y equipo.
 */
export function DatosBasicosStep({ ot, onSubmit, onBack }: Props) {
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [form, setForm] = useState<DatosBasicosForm>({
    clienteId: ot?.clienteId ?? '',
    clienteNombre: ot?.razonSocial ?? '',
    sistemaNombre: ot?.sistema ?? '',
    moduloNombre: ot?.moduloModelo ?? '',
    moduloSerie: ot?.moduloSerie ?? '',
    descripcionLibre: '',
    viaIngreso: 'envio',
    traidoPor: '',
    descripcionProblema: ot?.problemaFallaInicial ?? '',
    condicionFisica: '',
  });

  useEffect(() => {
    if (ot) return; // sin OT vamos a buscar cliente
    void clientesService.getAll().then(setClientes);
  }, [ot]);

  const canSubmit = form.clienteNombre.trim() && form.descripcionProblema.trim() && form.traidoPor.trim();

  const set = <K extends keyof DatosBasicosForm>(k: K, v: DatosBasicosForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleClienteChange = (clienteId: string) => {
    const c = clientes.find(x => x.id === clienteId);
    set('clienteId', clienteId);
    set('clienteNombre', c?.razonSocial ?? '');
  };

  return (
    <div className="space-y-4 pb-24">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono mb-1">
          Paso 2 · Datos del equipo
        </p>
        <h2 className="text-lg font-semibold text-slate-800">
          {ot ? `Confirmar datos · OT-${ot.otNumber}` : 'Datos del equipo recibido'}
        </h2>
      </div>

      {!ot && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
          <SearchableSelect
            value={form.clienteId}
            onChange={handleClienteChange}
            options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
            placeholder="Buscar cliente…"
          />
        </div>
      )}

      {ot && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-mono">Cliente</p>
          <p className="text-slate-800 font-medium">{form.clienteNombre}</p>
        </div>
      )}

      <Input
        label="Sistema / equipo"
        value={form.sistemaNombre}
        onChange={e => set('sistemaNombre', e.target.value)}
        placeholder="Ej: HPLC 1260 Infinity"
      />

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Módulo / modelo"
          value={form.moduloNombre}
          onChange={e => set('moduloNombre', e.target.value)}
          placeholder="Ej: Bomba"
        />
        <Input
          label="N° serie"
          value={form.moduloSerie}
          onChange={e => set('moduloSerie', e.target.value)}
          placeholder="Ej: AB12345"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Vía de ingreso</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(VIA_INGRESO_LABELS) as ViaIngreso[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => set('viaIngreso', v)}
              className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                form.viaIngreso === v
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {VIA_INGRESO_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Traído por *"
        value={form.traidoPor}
        onChange={e => set('traidoPor', e.target.value)}
        placeholder="Nombre del ingeniero o empresa de transporte"
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Problema reportado *
        </label>
        <textarea
          value={form.descripcionProblema}
          onChange={e => set('descripcionProblema', e.target.value)}
          rows={3}
          className="w-full border border-slate-300 rounded-xl bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          placeholder="¿Qué falla tiene? ¿Qué reporta el cliente?"
        />
      </div>

      <Input
        label="Condición física al recibir"
        value={form.condicionFisica}
        onChange={e => set('condicionFisica', e.target.value)}
        placeholder="Ej: golpes, raspaduras, falta tapa"
      />

      <div className="fixed bottom-3 left-3 right-3 z-20 flex gap-2 md:relative md:bottom-auto md:left-auto md:right-auto">
        <Button variant="outline" onClick={onBack} size="lg" className="flex-1">
          Atrás
        </Button>
        <Button
          onClick={() => onSubmit(form)}
          disabled={!canSubmit}
          size="lg"
          className="flex-[2]"
        >
          Continuar a fotos
        </Button>
      </div>
    </div>
  );
}
