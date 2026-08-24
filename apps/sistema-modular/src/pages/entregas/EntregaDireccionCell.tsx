import React, { useMemo, useState } from 'react';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { formatDireccionEntrega } from '@ags/shared';
import type { DireccionEntrega } from '@ags/shared';
import type { EntregaRow } from '../../utils/entregasResolver';
import type { EntregaItemPatch } from '../../hooks/useEntregas';

/**
 * A dónde va este ítem (2026-08-24).
 *
 * Se elige de las direcciones cargadas para ese cliente. Se guardan las dos
 * cosas —el id y el texto armado en ese momento— porque una dirección se puede
 * corregir o dar de baja después, y lo que se comprometió no puede cambiar
 * retroactivamente.
 *
 * Si el cliente no tiene ninguna cargada, la celda ofrece cargarla en vez de
 * mostrar un selector vacío: es el momento exacto en que hace falta.
 */

interface Props {
  row: EntregaRow;
  direcciones: DireccionEntrega[];
  onUpdate: (patch: EntregaItemPatch) => Promise<void>;
  onCargar: (clienteId: string) => void;
}

export const EntregaDireccionCell: React.FC<Props> = ({ row, direcciones, onUpdate, onCargar }) => {
  const [guardando, setGuardando] = useState(false);

  // Las dadas de baja no se ofrecen, PERO si es la que tiene el ítem se agrega
  // igual: si no, la celda se vería vacía y parecería que nunca se eligió nada.
  const opciones = useMemo(() => {
    const activas = direcciones.filter(d => d.activo !== false);
    const elegida = row.direccionEntregaId
      ? direcciones.find(d => d.id === row.direccionEntregaId)
      : null;
    const lista = elegida && elegida.activo === false ? [...activas, elegida] : activas;
    const opts = lista.map(d => ({
      value: d.id,
      label: d.etiqueta + (d.activo === false ? ' (de baja)' : ''),
      subLabel: [d.direccion, d.localidad].filter(Boolean).join(', '),
    }));
    // Deseleccionar solo tiene sentido cuando ya hay algo elegido.
    return row.direccionEntregaId ? [{ value: '', label: '— Sin definir —' }, ...opts] : opts;
  }, [direcciones, row.direccionEntregaId]);

  const elegir = async (id: string) => {
    const d = direcciones.find(x => x.id === id) ?? null;
    setGuardando(true);
    try {
      await onUpdate({
        direccionEntregaId: id || null,
        direccionEntregaTexto: d ? formatDireccionEntrega(d) : null,
      });
    } catch (err) {
      console.error('[EntregaDireccionCell] no se pudo guardar la dirección', err);
    } finally {
      setGuardando(false);
    }
  };

  if (opciones.length === 0) {
    return (
      <div className="text-[10px]">
        {/* El texto viejo sobrevive aunque la dirección ya no exista. */}
        {row.direccionEntregaTexto && (
          <span className="block text-slate-500 truncate" title={row.direccionEntregaTexto}>
            {row.direccionEntregaTexto}
          </span>
        )}
        <button type="button" onClick={() => onCargar(row.clienteId)}
          className="text-teal-600 hover:underline"
          title="Este cliente no tiene direcciones de entrega cargadas">
          + Cargar dirección
        </button>
      </div>
    );
  }

  return (
    <div className="w-40" title={row.direccionEntregaTexto ?? undefined}>
      <SearchableSelect
        value={row.direccionEntregaId ?? ''}
        onChange={v => void elegir(v)}
        options={opciones}
        placeholder="Sin definir"
        emptyMessage="Sin direcciones"
        size="sm"
        disabled={guardando}
      />
    </div>
  );
};
