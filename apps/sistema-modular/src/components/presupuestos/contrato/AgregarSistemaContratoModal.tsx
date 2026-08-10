import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { SearchableSelect } from '../../ui/SearchableSelect';
import { PresupuestoAddItemCompleto } from '../PresupuestoAddItemCompleto';
import type { PresupuestoItem, Sistema, ModuloSistema, ConceptoServicio, CategoriaPresupuesto, MonedaPresupuesto } from '@ags/shared';
import { makeSubItem, nextGrupoNumber, nextSubForGrupo } from './contratoItemHelpers';

interface Props {
  open: boolean;
  onClose: () => void;
  sistemas: Sistema[];
  loadModulos: (sistemaId: string) => Promise<ModuloSistema[]>;
  existingItems: PresupuestoItem[];
  onConfirm: (newItems: PresupuestoItem[]) => void;
  /** Cola de carga (2026-08-04): sistema FIJO a cargar — el selector queda
   *  bloqueado en ese sistema (viene de la cola de alcance del contrato). */
  sistemaFijoId?: string | null;
  /** Loop de servicios embebido (rediseño 2026-08-04): buscador + Enter. */
  conceptosServicio?: ConceptoServicio[];
  categoriasPresupuesto?: CategoriaPresupuesto[];
  moneda?: MonedaPresupuesto;
}

const labelCls = 'block text-[11px] font-medium text-slate-500 mb-1';

/**
 * Carga de UN sistema al contrato (rediseño 2026-08-04, pedido UAT): se eligió
 * el sistema (o vino fijo desde la cola), se generan la cabecera + módulos S/L
 * automáticamente, y los SERVICIOS se cargan en loop con el mismo buscador de
 * la carga de items (buscar → cantidad → Enter → vuelve al buscador). Sin
 * sector ni plantillas (se volaron a pedido del user).
 */
export const AgregarSistemaContratoModal: React.FC<Props> = ({
  open, onClose, sistemas, loadModulos, existingItems, onConfirm,
  sistemaFijoId = null, conceptosServicio = [], categoriasPresupuesto = [], moneda,
}) => {
  const [sistemaId, setSistemaId] = useState('');
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [servicios, setServicios] = useState<PresupuestoItem[]>([]);

  // Reset al cerrar; al abrir desde la cola, prefijar el sistema.
  useEffect(() => {
    if (!open) {
      setSistemaId(''); setModulos([]); setServicios([]);
    } else if (sistemaFijoId) {
      setSistemaId(sistemaFijoId);
    }
  }, [open, sistemaFijoId]);

  const selectedSistema = useMemo(() => sistemas.find(s => s.id === sistemaId) || null, [sistemas, sistemaId]);

  // Cambio de sistema: módulos reales frescos y servicios cargados en cero.
  useEffect(() => {
    setServicios([]);
    if (!selectedSistema) { setModulos([]); return; }
    let cancelled = false;
    loadModulos(selectedSistema.id)
      .then(mods => { if (!cancelled) setModulos(mods); })
      .catch(() => { if (!cancelled) setModulos([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistemaId]);

  // Los sistemas YA cargados al contrato no se ofrecen (anti-duplicado).
  const sistemaOptions = useMemo(() => {
    const cargados = new Set(existingItems.map(i => i.sistemaId).filter(Boolean));
    return sistemas
      .filter(s => s.id === sistemaId || !cargados.has(s.id))
      .map(s => ({
        value: s.id,
        label: `${s.nombre}${s.codigoInternoCliente ? ` — ${s.codigoInternoCliente}` : ''}`,
      }));
  }, [sistemas, existingItems, sistemaId]);

  const grupo = useMemo(() => nextGrupoNumber(existingItems), [existingItems]);

  /** Alta de un servicio desde la carga completa embebida (loop con Enter).
   *  La configuración del equipo NO entra como items (2026-08-04: el bloque
   *  "Módulos del sistema" del PDF ya la muestra) — solo van los servicios. */
  const handleAddServicio = (p: Partial<PresupuestoItem>) => {
    if (!selectedSistema) return;
    const cantidad = p.cantidad || 1;
    const precioUnitario = p.precioUnitario || 0;
    const descuento = p.descuento || 0;
    const base = cantidad * precioUnitario;
    const sub = servicios.length === 0 ? 1 : nextSubForGrupo(servicios, grupo);
    setServicios(prev => [...prev, {
      id: crypto.randomUUID(),
      codigoProducto: p.codigoProducto ?? '',
      descripcion: p.descripcion || '',
      cantidad,
      unidad: p.unidad || 'servicio',
      precioUnitario,
      descuento,
      factor: p.factor ?? null,
      categoriaPresupuestoId: p.categoriaPresupuestoId,
      conceptoServicioId: p.conceptoServicioId ?? null,
      stockArticuloId: p.stockArticuloId ?? null,
      itemRequiereImportacion: p.itemRequiereImportacion ?? false,
      disponibilidad: p.disponibilidad ?? null,
      etaDiasEstimados: p.etaDiasEstimados ?? null,
      subtotal: descuento ? base * (1 - descuento / 100) : base,
      grupo,
      subItem: makeSubItem(grupo, sub),
      sistemaId: selectedSistema.id,
      sistemaCodigoInterno: selectedSistema.codigoInternoCliente ?? null,
      sistemaNombre: selectedSistema.nombre,
      sectorNombre: selectedSistema.sector?.trim() || null,
      // Serie del módulo principal: ancla el S/N del header de la card del PDF
      // (antes lo aportaba el item cabecera, que ya no se genera).
      moduloSerie: modulos[0]?.serie ?? null,
    }]);
  };

  const updateServicio = (itemId: string, field: 'precioUnitario' | 'cantidad', value: number) => {
    setServicios(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      const base = (updated.cantidad || 0) * (updated.precioUnitario || 0);
      updated.subtotal = updated.descuento ? base * (1 - updated.descuento / 100) : base;
      return updated;
    }));
  };

  const handleConfirm = () => {
    if (!selectedSistema) { alert('Seleccione un sistema'); return; }
    if (servicios.length === 0) { alert('Cargá al menos un servicio para este sistema'); return; }
    onConfirm(servicios);
    onClose();
  };

  if (!open) return null;

  const totalServicios = servicios.reduce((s, i) => s + (i.subtotal || 0), 0);

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl" title="Cargar sistema al contrato"
      subtitle="La cabecera y los módulos se generan solos — cargá los servicios en loop con el buscador."
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleConfirm} disabled={!selectedSistema || servicios.length === 0}>
          Agregar {servicios.length > 0 ? `(${servicios.length} servicio${servicios.length > 1 ? 's' : ''})` : ''}
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Sistema *</label>
          <SearchableSelect value={sistemaId} onChange={setSistemaId}
            options={sistemaOptions}
            placeholder="Seleccionar..."
            disabled={!!sistemaFijoId} />
          {sistemaFijoId && (
            <p className="text-[10px] text-teal-700 mt-0.5">Desde la cola del contrato — al confirmar se consume de la lista.</p>
          )}
        </div>

        {selectedSistema && (
          <>
            {/* Configuración del equipo — SOLO informativa (2026-08-04): no entra
                como items; el PDF ya la muestra en el bloque Módulos del sistema. */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
                  Equipo · {modulos.length > 0 ? `${modulos.length} módulos (va al PDF como detalle, no como items)` : 'sin módulos cargados'}
                </span>
              </div>
              {modulos.length > 0 && (
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {modulos.map(m => (
                        <tr key={m.id} className="border-t border-slate-100 first:border-0">
                          <td className="px-2 py-1 text-slate-500 font-mono text-[10px] w-32 truncate">{m.nombre || '—'}</td>
                          <td className="px-2 py-1 text-slate-600 truncate">{m.descripcion || '—'}</td>
                          <td className="px-2 py-1 text-slate-400 font-mono text-[10px] w-28 truncate">{m.serie || '—'}</td>
                          <td className="px-2 py-1 text-slate-400 text-[10px] w-24 truncate">{m.marca || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Loop de servicios: buscador → cantidad → Enter → vuelve al buscador */}
            <PresupuestoAddItemCompleto
              inline
              conceptosServicio={conceptosServicio}
              categoriasPresupuesto={categoriasPresupuesto}
              moneda={moneda}
              onAdd={handleAddServicio}
            />

            {/* Servicios cargados a este sistema */}
            {servicios.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-teal-50/60 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wide text-teal-700">
                    Servicios · {servicios.length}
                  </span>
                  <span className="text-[10px] font-mono text-teal-700 font-semibold">
                    Subtotal {totalServicios.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {servicios.map(item => (
                      <tr key={item.id} className="border-t border-slate-100 first:border-0">
                        <td className="px-2 py-1 text-slate-400 font-mono text-[10px] w-10">{item.subItem}</td>
                        <td className="px-2 py-1 text-slate-500 font-mono text-[10px] w-32 truncate">{item.codigoProducto}</td>
                        <td className="px-2 py-1 text-slate-700">{item.descripcion}</td>
                        <td className="px-2 py-1 w-16">
                          <input type="number" min="0" value={item.cantidad}
                            onChange={e => updateServicio(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-right" />
                        </td>
                        <td className="px-2 py-1 w-24">
                          <input type="number" min="0" step="any" value={item.precioUnitario || ''}
                            onChange={e => updateServicio(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-20 border border-slate-200 rounded px-1 py-0.5 text-xs text-right" />
                        </td>
                        <td className="px-2 py-1 w-8 text-center">
                          <button onClick={() => setServicios(prev => prev.filter(s => s.id !== item.id))}
                            className="text-red-400 hover:text-red-600 text-sm leading-none" title="Quitar">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
