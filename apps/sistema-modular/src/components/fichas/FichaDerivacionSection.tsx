import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { fichasService } from '../../services/firebaseService';
import { useConfirm } from '../ui/ConfirmDialog';
import type { FichaPropiedad, ItemFicha } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
  /** Item al que pertenecen las derivaciones. */
  item: ItemFicha;
  onUpdate: () => void;
}

/**
 * Vista histórica de derivaciones a proveedor de un item.
 *
 * La creación se hace **siempre por remito** desde "Generar remito" a nivel ficha
 * (`GenerarRemitoDevolucionModal`). Acá solo se listan derivaciones existentes y
 * se registra la devolución cuando el módulo o la parte vuelve, o se cancelan
 * si se generaron por error (el item vuelve a su estado anterior).
 */
export function FichaDerivacionSection({ ficha, item, onUpdate }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
  const confirm = useConfirm();

  const handleMarkReceived = async (derivacionId: string) => {
    await fichasService.markDerivacionRecibida(ficha.id, item.id, derivacionId);
    onUpdate();
  };

  // Cancelar solo revierte la derivación en la ficha. El remito de salida NO se
  // toca: anularlo es un flujo aparte, a cargo del usuario desde Remitos.
  const handleCancel = async (derivacionId: string) => {
    const ok = await confirm({
      title: 'Cancelar derivación',
      message: '¿Cancelar esta derivación? El equipo vuelve a su estado anterior. El remito asociado no se modifica — si también hay que anularlo, hacelo desde el módulo de remitos.',
      confirmLabel: 'Cancelar derivación',
      cancelLabel: 'Volver',
      danger: true,
    });
    if (!ok) return;
    await fichasService.cancelarDerivacion(ficha.id, item.id, derivacionId);
    onUpdate();
  };

  return (
    <Card title="Derivaciones a proveedor">
      {item.derivaciones.length === 0 ? (
        <p className="text-sm text-slate-400">Sin derivaciones</p>
      ) : (
        <div className="space-y-3">
          {item.derivaciones.map((d) => {
            const esParte = d.alcance === 'parte';
            return (
              <div key={d.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{d.proveedorNombre}</span>
                    {esParte && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide bg-amber-100 text-amber-800 rounded">
                        Parte
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    d.estado === 'recibido' ? 'bg-green-100 text-green-800' :
                    d.estado === 'enviado' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {d.estado === 'recibido' ? 'Recibido' : d.estado === 'enviado' ? 'Enviado' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{d.descripcion}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                  {d.fechaEnvio && <span>Enviado: {new Date(d.fechaEnvio).toLocaleDateString('es-AR')}</span>}
                  {d.fechaRetorno && <span>Retorno: {new Date(d.fechaRetorno).toLocaleDateString('es-AR')}</span>}
                  {d.remitoSalidaId && (
                    <Link to={`/stock/remitos/${d.remitoSalidaId}`} state={fromState} className="text-teal-600 hover:underline font-mono">
                      {d.remitoSalidaNumero ?? 'Ver remito'}
                    </Link>
                  )}
                </div>
                {d.estado === 'enviado' && (
                  <div className="flex items-center gap-2 mt-2">
                    {/* Decía "Marcar recibido" y se leía como "el proveedor lo
                        recibió", así que nadie encontraba dónde registrar que el
                        equipo había vuelto — y la acción era justamente ésta
                        (2026-08-23). */}
                    <Button variant="ghost" size="sm" onClick={() => handleMarkReceived(d.id)}
                      title="El equipo volvió del proveedor: registra la fecha de retorno y lo devuelve al taller">
                      Registrar devolución
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleCancel(d.id)}>
                      Cancelar derivación
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
