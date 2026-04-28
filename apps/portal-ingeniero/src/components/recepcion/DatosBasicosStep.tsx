import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService } from '../../services/firebaseService';

export interface DatosBasicosForm {
  clienteId: string;
  clienteNombre: string;
}

interface Props {
  onSubmit: (form: DatosBasicosForm) => void;
  onBack: () => void;
}

/**
 * Paso 2 — solo cliente.
 *
 * Sistema, módulo, serie, problema, accesorios, vía de ingreso, etc. se completan
 * después desde sistema-modular. Acá solo necesitamos lo mínimo para que la ficha
 * exista y se le puedan colgar fotos.
 *
 * Solo se muestra si el paso 1 no trajo OT — si vino OT, el cliente sale de ahí
 * y saltamos directo a fotos.
 */
export function DatosBasicosStep({ onSubmit, onBack }: Props) {
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [clienteId, setClienteId] = useState('');

  useEffect(() => {
    void clientesService.getAll().then(setClientes);
  }, []);

  const cliente = clientes.find(c => c.id === clienteId);
  const canSubmit = !!cliente;

  return (
    <div className="space-y-4 pb-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono mb-1">
          Paso 2 · Cliente
        </p>
        <h2 className="text-lg font-semibold text-slate-800">¿De qué cliente es?</h2>
        <p className="text-xs text-slate-500 mt-1">
          Solo necesitamos el cliente para crear la ficha. El resto se completa después desde sistema-modular.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
        <SearchableSelect
          value={clienteId}
          onChange={setClienteId}
          options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
          placeholder="Buscar cliente…"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack} size="lg" className="flex-1">
          Atrás
        </Button>
        <Button
          onClick={() => cliente && onSubmit({ clienteId: cliente.id, clienteNombre: cliente.razonSocial })}
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
