import { useEffect, useState } from 'react';
import type { OrdenCompra, RequerimientoCompra } from '@ags/shared';
import { ORIGEN_REQUERIMIENTO_LABELS } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ocRequerimientosService } from '../../services/ocRequerimientosService';
import { seleccionInicial, idsSeleccionados, repartirCantidad, type GrupoConciliacion, type SeleccionConciliacion } from '../../utils/conciliarRequerimientosOC';
import { notify } from '../../utils/notify';

interface Props {
  open: boolean;
  oc: OrdenCompra;
  /** Se resolvió: se vincularon (o no había nada que vincular / se omitió). El caller sigue con el envío. */
  onResuelto: () => void;
  /** El usuario cerró sin decidir: el caller NO sigue con el envío. */
  onCancelar: () => void;
  /** Acción manual: si no hay candidatos, avisar en vez de resolverse en silencio. */
  avisarSiVacio?: boolean;
}

/** Cliente / presupuesto / stock mínimo de un requerimiento, para elegir con contexto. */
function detalleReq(r: RequerimientoCompra): string {
  const partes = (r.desglose ?? []).map(d =>
    d.concepto === 'cliente'
      ? `${d.cantidad} para ${d.clienteNombre || 'cliente'}${d.presupuestoNumero ? ` (Ppto ${d.presupuestoNumero})` : ''}`
      : `${d.cantidad} stock mínimo`);
  if (partes.length > 0) return partes.join(' + ');
  if (r.presupuestoNumero) return `Ppto ${r.presupuestoNumero}`;
  return ORIGEN_REQUERIMIENTO_LABELS[r.origen] ?? r.origen;
}

/**
 * Paso previo al envío de una OC (2026-09-10): propone los requerimientos
 * abiertos que corresponden a sus ítems para que no queden vivos en la
 * planilla. Si no hay candidatos se resuelve solo, sin mostrar nada.
 */
export const ConciliarRequerimientosModal: React.FC<Props> = ({ open, oc, onResuelto, onCancelar, avisarSiVacio = false }) => {
  const [grupos, setGrupos] = useState<GrupoConciliacion[] | null>(null);
  const [seleccion, setSeleccion] = useState<SeleccionConciliacion>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setGrupos(null); return; }
    let vivo = true;
    ocRequerimientosService.candidatos(oc)
      .then(gs => {
        if (!vivo) return;
        if (gs.length === 0) {
          if (avisarSiVacio) notify.info('No hay requerimientos abiertos para los artículos de esta OC.');
          onResuelto();
          return;
        }
        setGrupos(gs);
        setSeleccion(seleccionInicial(gs));
      })
      .catch(err => {
        // Sin candidatos no se frena el envío: se avisa y se sigue.
        console.warn('[ConciliarRequerimientosModal] no se pudieron buscar requerimientos:', err);
        if (vivo) onResuelto();
      });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, oc.id]);

  const toggle = (itemId: string, reqId: string) => {
    setSeleccion(prev => {
      const next = new Map(prev);
      const cur = next.get(itemId) ?? [];
      next.set(itemId, cur.includes(reqId) ? cur.filter(id => id !== reqId) : [...cur, reqId]);
      return next;
    });
  };

  const total = idsSeleccionados(seleccion).length;

  const handleVincular = async () => {
    if (!grupos) return;
    setSaving(true);
    try {
      const n = await ocRequerimientosService.vincular(oc, seleccion, grupos.flatMap(g => g.candidatos));
      if (n > 0) notify.success(`${n} requerimiento(s) vinculados a ${oc.numero}`);
      onResuelto();
    } catch (err) {
      console.error('[ConciliarRequerimientosModal] vincular falló:', err);
      notify.error('No se pudieron vincular los requerimientos');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !grupos) return null;

  return (
    <Modal open={open} onClose={onCancelar} maxWidth="lg"
      title="Requerimientos de esta compra"
      subtitle={`OC ${oc.numero} · hay requerimientos abiertos de los mismos artículos`}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onResuelto} disabled={saving}>Omitir</Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onCancelar} disabled={saving}>Cancelar</Button>
        <Button size="sm" onClick={handleVincular} disabled={saving}>
          {saving ? 'Vinculando...' : total > 0 ? `Vincular ${total} y continuar` : 'Continuar sin vincular'}
        </Button>
      </>}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Marcá a qué requerimiento(s) responde cada ítem. Los vinculados pasan a
          <span className="font-medium text-teal-700"> En compra</span> y salen de la planilla;
          se cierran solos al ingresar la mercadería. Si la OC no cubre la cantidad,
          el saldo queda en un requerimiento nuevo pendiente.
        </p>
        {grupos.map(({ item, candidatos }) => {
          const sel = seleccion.get(item.id) ?? [];
          // Reparto en el orden en que se tildaron: cuánto cubre la OC de cada uno.
          const elegidos = sel.map(id => candidatos.find(r => r.id === id)).filter((r): r is RequerimientoCompra => !!r);
          const reparto = new Map(repartirCantidad(item, elegidos).map(r => [r.req.id, r]));
          return (
            <div key={item.id} className="border border-slate-200 rounded-lg px-3 py-2">
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <p className="text-xs font-medium text-slate-800 truncate">
                  {item.articuloCodigo && <span className="font-mono text-teal-700 mr-1.5">{item.articuloCodigo}</span>}
                  {item.descripcion}
                </p>
                <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">{item.cantidad} {item.unidadMedida}</span>
              </div>
              {candidatos.length > 1 && (
                <p className="text-[10px] text-amber-700 mb-1">Varios requerimientos de este artículo: elegí cuál(es) cubre esta OC.</p>
              )}
              <div className="space-y-1">
                {candidatos.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input type="checkbox" className="accent-teal-600" checked={sel.includes(r.id)} onChange={() => toggle(item.id, r.id)} />
                    <span className="font-mono text-slate-500">{r.numero}</span>
                    <span className="font-mono">{r.cantidad} {r.unidadMedida}</span>
                    <span className="text-slate-500 truncate">· {detalleReq(r)}</span>
                    {(() => {
                      const rp = reparto.get(r.id);
                      if (!rp || rp.saldo === 0) return null;
                      return rp.cubierta === 0
                        ? <span className="ml-auto text-[10px] text-red-600 whitespace-nowrap">la OC no llega a cubrirlo</span>
                        : <span className="ml-auto text-[10px] text-amber-700 whitespace-nowrap">cubre {rp.cubierta} · quedan {rp.saldo} pendientes</span>;
                    })()}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
