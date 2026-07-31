import { useEffect, useState } from 'react';
import { establecimientoUnicoId } from '@ags/shared';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService, establecimientosService, type EstablecimientoMini } from '../../services/firebaseService';

export interface DatosBasicosForm {
  clienteId: string;
  clienteNombre: string;
  establecimientoId: string | null;
  establecimientoNombre: string | null;
}

interface Props {
  onSubmit: (form: DatosBasicosForm) => void;
  onBack: () => void;
}

/**
 * Paso 2 — cliente + establecimiento.
 *
 * Sistema, módulo, serie, problema, accesorios, vía de ingreso, etc. se completan
 * después desde sistema-modular. Acá solo necesitamos lo mínimo para que la ficha
 * exista y se le puedan colgar fotos.
 *
 * Establecimiento (2026-07-31): si el cliente tiene UNO se autoselecciona (regla
 * del proyecto, `establecimientoUnicoId`); con varios hay que elegir; sin ninguno
 * se puede continuar igual (la ficha lo admite null).
 *
 * Solo se muestra si el paso 1 no trajo OT — si vino OT, el cliente sale de ahí
 * y saltamos directo a fotos.
 */
export function DatosBasicosStep({ onSubmit, onBack }: Props) {
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [establecimientos, setEstablecimientos] = useState<EstablecimientoMini[]>([]);
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [loadingEsts, setLoadingEsts] = useState(false);

  useEffect(() => {
    void clientesService.getAll().then(setClientes);
  }, []);

  // Cascada cliente → establecimientos: reset + carga + autoselección de único.
  useEffect(() => {
    setEstablecimientoId('');
    if (!clienteId) { setEstablecimientos([]); return; }
    let cancelled = false;
    setLoadingEsts(true);
    establecimientosService.getByCliente(clienteId)
      .then(ests => {
        if (cancelled) return;
        const activos = ests.filter(e => e.activo);
        setEstablecimientos(activos);
        const unico = establecimientoUnicoId(activos);
        if (unico) setEstablecimientoId(unico);
      })
      .catch(() => { if (!cancelled) setEstablecimientos([]); })
      .finally(() => { if (!cancelled) setLoadingEsts(false); });
    return () => { cancelled = true; };
  }, [clienteId]);

  const cliente = clientes.find(c => c.id === clienteId);
  const establecimiento = establecimientos.find(e => e.id === establecimientoId) || null;
  // Con varios establecimientos hay que elegir uno; sin ninguno se continúa igual.
  const canSubmit = !!cliente && !loadingEsts && (establecimientos.length === 0 || !!establecimiento);

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

      {clienteId && establecimientos.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Establecimiento {establecimientos.length > 1 ? '*' : ''}
          </label>
          <SearchableSelect
            value={establecimientoId}
            onChange={setEstablecimientoId}
            options={establecimientos.map(e => ({
              value: e.id,
              label: `${e.nombre}${e.localidad ? ` — ${e.localidad}` : ''}`,
            }))}
            placeholder="Seleccionar establecimiento…"
          />
        </div>
      )}
      {clienteId && loadingEsts && (
        <p className="text-xs text-slate-400">Cargando establecimientos…</p>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack} size="lg" className="flex-1">
          Atrás
        </Button>
        <Button
          onClick={() => cliente && onSubmit({
            clienteId: cliente.id,
            clienteNombre: cliente.razonSocial,
            establecimientoId: establecimiento?.id ?? null,
            establecimientoNombre: establecimiento?.nombre ?? null,
          })}
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
