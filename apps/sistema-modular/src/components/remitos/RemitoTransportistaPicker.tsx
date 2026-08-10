import { useMemo } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { RemitoPartyFields } from './RemitoPartyFields';
import { proveedorEsCategoria } from '@ags/shared';
import type { Proveedor } from '@ags/shared';
import type { DatosTransportista } from '../../services/stockService';

export const EMPTY_PARTY: DatosTransportista = {
  razonSocial: '', domicilio: '', localidad: '', provincia: '', iva: '', cuit: '',
};

/** Datos de remito a partir de un proveedor del catálogo. */
export function partyFromProveedor(p: Proveedor): DatosTransportista {
  return {
    razonSocial: p.nombre,
    domicilio: p.direccion ?? '',
    localidad: '',
    provincia: p.pais ?? '',
    iva: p.tipo === 'internacional' ? 'Exterior' : '',
    cuit: p.cuit ?? '',
  };
}

interface Props {
  /** Catálogo completo — el componente filtra los de categoría "transportista". */
  proveedores: Proveedor[];
  selectedId: string;
  value: DatosTransportista;
  onChange: (next: { id: string; datos: DatosTransportista }) => void;
}

/**
 * Bloque "quién transporta" del remito: elegir un transportista del catálogo
 * autocompleta los campos, que igual quedan editables (hay fletes que no están
 * dados de alta). Alimenta el recuadro Transportista del papel preimpreso, que
 * antes salía vacío en las derivaciones.
 *
 * Si no hay ningún proveedor con la categoría, el selector no se muestra y solo
 * quedan los campos libres — cargar el transportista en Proveedores lo habilita.
 */
export function RemitoTransportistaPicker({ proveedores, selectedId, value, onChange }: Props) {
  const transportistas = useMemo(
    () => proveedores.filter(p => proveedorEsCategoria(p, 'transportista')),
    [proveedores],
  );

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
      {transportistas.length > 0 && (
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Elegir transportista</p>
          <SearchableSelect
            value={selectedId}
            onChange={id => {
              const t = transportistas.find(x => x.id === id);
              onChange({ id, datos: t ? partyFromProveedor(t) : value });
            }}
            options={transportistas.map(t => ({ value: t.id, label: t.nombre }))}
            placeholder="Buscar transportista…"
          />
        </div>
      )}
      <RemitoPartyFields
        title="Transportista (opcional)"
        value={value}
        onChange={datos => onChange({ id: selectedId, datos })}
      />
    </div>
  );
}
