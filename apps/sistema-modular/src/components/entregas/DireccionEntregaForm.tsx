import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { AddressAutocomplete, type AutocompleteResult } from '../AddressAutocomplete';
import { direccionDesdeAutocomplete } from '../../utils/direccionDesdeAutocomplete';
import type { DireccionEntrega } from '@ags/shared';
import type { DireccionEntregaInput } from '../../services/direccionesEntregaService';

/**
 * Alta y edición de una dirección de entrega (2026-08-24).
 *
 * La calle usa el mismo autocompletado de Google que clientes, establecimientos
 * y proveedores: al elegir una sugerencia se completan localidad, provincia y
 * código postal, y quedan guardadas las coordenadas. Una dirección de entrega
 * mal escrita es un camión que da vueltas.
 *
 * Solo la etiqueta y la calle son obligatorias: parte de las direcciones se
 * cargan con lo que dijo el cliente por teléfono, y exigir todo haría que se
 * carguen mal en vez de que se carguen incompletas. Se puede tipear a mano sin
 * pasar por la sugerencia.
 */

interface Props {
  clienteId: string;
  inicial?: DireccionEntrega | null;
  onSubmit: (data: DireccionEntregaInput) => Promise<void>;
  onCancel: () => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

export const DireccionEntregaForm: React.FC<Props> = ({ clienteId, inicial, onSubmit, onCancel }) => {
  const [f, setF] = useState({
    etiqueta: inicial?.etiqueta ?? '',
    direccion: inicial?.direccion ?? '',
    localidad: inicial?.localidad ?? '',
    provincia: inicial?.provincia ?? '',
    codigoPostal: inicial?.codigoPostal ?? '',
    contacto: inicial?.contacto ?? '',
    telefono: inicial?.telefono ?? '',
    horario: inicial?.horario ?? '',
    notas: inicial?.notas ?? '',
    predeterminada: inicial?.predeterminada ?? false,
  });
  // Solo se pisan si Google las devuelve: tipear a mano no las borra.
  const [geo, setGeo] = useState<{ lat: number | null; lng: number | null; placeId: string | null }>({
    lat: inicial?.lat ?? null, lng: inicial?.lng ?? null, placeId: inicial?.placeId ?? null,
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  const puede = f.etiqueta.trim().length > 0 && f.direccion.trim().length > 0 && !guardando;

  const guardar = async () => {
    if (!puede) return;
    setGuardando(true);
    try {
      await onSubmit({
        clienteId,
        etiqueta: f.etiqueta.trim(),
        direccion: f.direccion.trim(),
        localidad: f.localidad.trim() || null,
        provincia: f.provincia.trim() || null,
        codigoPostal: f.codigoPostal.trim() || null,
        lat: geo.lat,
        lng: geo.lng,
        placeId: geo.placeId,
        contacto: f.contacto.trim() || null,
        telefono: f.telefono.trim() || null,
        horario: f.horario.trim() || null,
        notas: f.notas.trim() || null,
        predeterminada: f.predeterminada,
        activo: inicial?.activo !== false,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="border border-teal-200 bg-teal-50/30 rounded-lg p-3 space-y-2.5">
      <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">
        {inicial ? 'Editar dirección' : 'Nueva dirección'}
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        <Input inputSize="sm" label="Etiqueta" value={f.etiqueta} onChange={set('etiqueta')}
          placeholder="Depósito Pilar" description="Cómo la llaman internamente" />
        <div className="col-span-2">
          <AddressAutocomplete
            label="Dirección"
            value={f.direccion}
            onChange={set('direccion')}
            placeholder="Empezá a escribir y elegí la sugerencia"
            onSelectAddress={(res: AutocompleteResult) => {
              setF(prev => ({
                ...prev,
                direccion: direccionDesdeAutocomplete(res, prev.direccion),
                localidad: res.localidad || prev.localidad,
                provincia: res.provincia || prev.provincia,
                codigoPostal: res.codigoPostal || prev.codigoPostal,
              }));
              setGeo({ lat: res.lat ?? null, lng: res.lng ?? null, placeId: res.placeId ?? null });
            }}
          />
        </div>
        <Input inputSize="sm" label="Localidad" value={f.localidad} onChange={set('localidad')} />
        <Input inputSize="sm" label="Provincia" value={f.provincia} onChange={set('provincia')} />
        <Input inputSize="sm" label="Código postal" value={f.codigoPostal} onChange={set('codigoPostal')} />
        <Input inputSize="sm" label="Contacto" value={f.contacto} onChange={set('contacto')}
          placeholder="Quién recibe" />
        <Input inputSize="sm" label="Teléfono" value={f.telefono} onChange={set('telefono')} />
        <Input inputSize="sm" label="Horario de recepción" value={f.horario} onChange={set('horario')}
          placeholder="Lu a Vi 8 a 14" />
      </div>

      <div>
        <label className={lbl}>Notas</label>
        <textarea
          value={f.notas}
          onChange={e => setF(prev => ({ ...prev, notas: e.target.value }))}
          rows={2}
          placeholder="Entrar por portón 3, avisar el día anterior…"
          className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
        />
      </div>

      {!geo.placeId && f.direccion.trim().length > 0 && (
        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Dirección sin validar — se guarda igual, pero elegir la sugerencia de Google completa
          localidad, provincia y código postal, y deja las coordenadas.
        </p>
      )}

      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
        <input type="checkbox" checked={f.predeterminada}
          onChange={e => setF(prev => ({ ...prev, predeterminada: e.target.checked }))}
          className="w-3.5 h-3.5 rounded border-slate-300 accent-teal-700" />
        Predeterminada para este cliente
      </label>

      <div className="flex justify-end gap-2 pt-0.5">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={guardando}>Cancelar</Button>
        <Button size="sm" onClick={() => void guardar()} disabled={!puede}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
};
