import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { PresupuestoAddItemCompleto } from '../PresupuestoAddItemCompleto';
import type { PresupuestoItem, Sistema, ModuloSistema, ConceptoServicio, CategoriaPresupuesto, MonedaPresupuesto } from '@ags/shared';
import { esUnidadDeServicio } from '@ags/shared';
import { materializarServiciosPorSistema, nextGrupoNumber } from './contratoItemHelpers';
import { SistemasMultiPicker } from './SistemasMultiPicker';
import { ServiciosPlantillaTable } from './ServiciosPlantillaTable';

interface Props {
  open: boolean;
  onClose: () => void;
  sistemas: Sistema[];
  loadModulos: (sistemaId: string) => Promise<ModuloSistema[]>;
  existingItems: PresupuestoItem[];
  onConfirm: (newItems: PresupuestoItem[]) => void;
  /** Cola de carga (2026-08-04): sistemas con los que abre la seleccion — vienen
   *  de los chips pendientes del alcance. Se pueden agregar o sacar mas. */
  sistemasFijados?: string[];
  /** Loop de servicios embebido (rediseno 2026-08-04): buscador + Enter. */
  conceptosServicio?: ConceptoServicio[];
  categoriasPresupuesto?: CategoriaPresupuesto[];
  moneda?: MonedaPresupuesto;
}

/**
 * Carga de equipos al contrato (rediseno 2026-08-04; multi-equipo 2026-09-02):
 * se eligen uno o VARIOS equipos, y los SERVICIOS se cargan UNA sola vez con el
 * mismo buscador de la carga de items (buscar -> cantidad -> Enter -> vuelve al
 * buscador). Al confirmar, esa lista se replica con sus precios a cada equipo,
 * cada uno en su propio grupo. Sin sector ni plantillas (se volaron a pedido).
 */
export const AgregarSistemaContratoModal: React.FC<Props> = ({
  open, onClose, sistemas, loadModulos, existingItems, onConfirm,
  sistemasFijados, conceptosServicio = [], categoriasPresupuesto = [], moneda,
}) => {
  const [sistemaIds, setSistemaIds] = useState<string[]>([]);
  const [modulosPorSistema, setModulosPorSistema] = useState<Map<string, ModuloSistema[]>>(new Map());
  const [servicios, setServicios] = useState<PresupuestoItem[]>([]);

  const fijadosKey = (sistemasFijados ?? []).join('|');

  // Reset al cerrar; al abrir desde la cola, prefijar los sistemas pendientes.
  useEffect(() => {
    if (!open) {
      setSistemaIds([]); setModulosPorSistema(new Map()); setServicios([]);
    } else {
      setSistemaIds(fijadosKey ? fijadosKey.split('|') : []);
    }
  }, [open, fijadosKey]);

  // Modulos reales de cada equipo elegido: se muestran al seleccionar y anclan
  // el S/N del header de la card del PDF al materializar.
  useEffect(() => {
    const faltantes = sistemaIds.filter(id => !modulosPorSistema.has(id));
    if (faltantes.length === 0) return;
    let cancelled = false;
    Promise.all(faltantes.map(id => loadModulos(id).catch(() => [] as ModuloSistema[])))
      .then(listas => {
        if (cancelled) return;
        setModulosPorSistema(prev => {
          const next = new Map(prev);
          faltantes.forEach((id, i) => next.set(id, listas[i]));
          return next;
        });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistemaIds]);

  // Los sistemas YA cargados al contrato no se ofrecen (anti-duplicado).
  const yaCargados = useMemo(
    () => new Set(existingItems.map(i => i.sistemaId).filter(Boolean) as string[]),
    [existingItems],
  );

  const seleccionados = useMemo(
    () => sistemaIds.map(id => sistemas.find(s => s.id === id)).filter((s): s is Sistema => !!s),
    [sistemaIds, sistemas],
  );

  const modulosDelUnico = seleccionados.length === 1
    ? (modulosPorSistema.get(seleccionados[0].id) ?? [])
    : [];

  /** Alta de un servicio desde la carga completa embebida (loop con Enter).
   *  Se guarda SIN datos de equipo: los estampa `materializarServiciosPorSistema`
   *  al confirmar, una copia por equipo. La configuracion del equipo NO entra
   *  como items (2026-08-04: el bloque "Modulos del sistema" del PDF ya la muestra). */
  const handleAddServicio = (p: Partial<PresupuestoItem>) => {
    const cantidad = p.cantidad || 1;
    const precioUnitario = p.precioUnitario || 0;
    const descuento = p.descuento || 0;
    const base = cantidad * precioUnitario;
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
      // El codigo de un servicio va tambien en `servicioCode` (2026-08-20): aca
      // se tipea en `codigoProducto` —que es para N° de parte— y quedaba solo
      // ahi. Sin este campo, el modulo de Entregas leia la linea como una parte
      // fisica a entregar, y el PDF no podia resolver el anexo de consumibles.
      servicioCode: p.servicioCode
        ?? (esUnidadDeServicio(p.unidad || 'servicio') ? (p.codigoProducto?.trim() || null) : null),
      grupo: 0,
      subItem: '',
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
    if (seleccionados.length === 0) { alert('Seleccione al menos un equipo'); return; }
    if (servicios.length === 0) { alert('Carga al menos un servicio'); return; }
    onConfirm(materializarServiciosPorSistema({
      plantilla: servicios,
      sistemas: seleccionados,
      modulosPorSistema,
      grupoBase: nextGrupoNumber(existingItems),
    }));
    onClose();
  };

  if (!open) return null;

  const totalItems = servicios.length * seleccionados.length;
  const varios = seleccionados.length > 1;
  const resumen = varios
    ? `${servicios.length} servicios × ${seleccionados.length} equipos = ${totalItems} items`
    : `${servicios.length} servicio${servicios.length > 1 ? 's' : ''}`;

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl" title="Cargar equipos al contrato"
      subtitle="Elegi uno o varios equipos y carga los servicios una sola vez — se replican con sus precios a cada equipo."
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleConfirm} disabled={seleccionados.length === 0 || servicios.length === 0}>
          Agregar {totalItems > 0 ? `(${resumen})` : ''}
        </Button>
      </>}>
      <div className="space-y-4">
        <SistemasMultiPicker
          sistemas={sistemas}
          seleccionados={sistemaIds}
          yaCargados={yaCargados}
          modulosPorSistema={modulosPorSistema}
          onChange={setSistemaIds}
        />

        {seleccionados.length > 0 && (
          <>
            {/* Configuracion del equipo — SOLO informativa (2026-08-04): no entra
                como items; el PDF ya la muestra en el bloque Modulos del sistema.
                Con varios equipos elegidos se resume en los chips, para no tapar
                la carga de servicios. */}
            {seleccionados.length === 1 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                  <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
                    Equipo · {modulosDelUnico.length > 0
                      ? `${modulosDelUnico.length} modulos (va al PDF como detalle, no como items)`
                      : 'sin modulos cargados'}
                  </span>
                </div>
                {modulosDelUnico.length > 0 && (
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {modulosDelUnico.map(m => (
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
            )}

            {/* Loop de servicios: buscador -> cantidad -> Enter -> vuelve al buscador */}
            <PresupuestoAddItemCompleto
              inline
              conceptosServicio={conceptosServicio}
              categoriasPresupuesto={categoriasPresupuesto}
              moneda={moneda}
              onAdd={handleAddServicio}
            />

            <ServiciosPlantillaTable
              servicios={servicios}
              cantidadEquipos={seleccionados.length}
              onUpdate={updateServicio}
              onRemove={id => setServicios(prev => prev.filter(s => s.id !== id))}
            />
          </>
        )}
      </div>
    </Modal>
  );
};
