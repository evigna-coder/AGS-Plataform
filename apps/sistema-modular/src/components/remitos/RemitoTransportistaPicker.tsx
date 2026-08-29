import { useMemo } from 'react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { RemitoPartyFields } from './RemitoPartyFields';
import { proveedorEsCategoria } from '@ags/shared';
import type { Proveedor } from '@ags/shared';
import type { DatosTransportista } from '../../services/stockService';
import { domicilioSinLocalidadNiProvincia } from '../../utils/domicilioRemito';

export const EMPTY_PARTY: DatosTransportista = {
  razonSocial: '', domicilio: '', localidad: '', provincia: '', iva: '', cuit: '',
};

/**
 * Datos de remito a partir de un proveedor del catálogo.
 *
 * Usa los campos reales de dirección (2026-08-10). Antes dejaba `localidad`
 * VACÍA y metía el PAÍS en `provincia`, así que el papel salía con Localidad en
 * blanco, "Argentina" en Provincia y la dirección entera —calle, código postal,
 * ciudad y país— apretada en Domicilio, desbordando sobre el recuadro del
 * transportista. `Proveedor` tiene `localidad`, `provincia` y `condicionIva`
 * desde el 2026-08-07, agregados justamente para este papel.
 *
 * `pais` solo se usa como provincia para proveedores del exterior, donde no hay
 * provincia argentina que poner.
 */
export function partyFromProveedor(p: Proveedor): DatosTransportista {
  const esExterior = p.tipo === 'internacional';
  const provincia = p.provincia || (esExterior ? (p.pais ?? '') : '');
  return {
    razonSocial: p.nombre,
    // Sin la localidad/provincia concatenadas (2026-08-28): varios proveedores
    // tienen la dirección entera en `direccion` y salía repetida en el papel.
    domicilio: domicilioSinLocalidadNiProvincia(p.direccion, p.localidad, provincia),
    localidad: p.localidad ?? '',
    provincia,
    iva: p.condicionIva || (esExterior ? 'Exterior' : ''),
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
