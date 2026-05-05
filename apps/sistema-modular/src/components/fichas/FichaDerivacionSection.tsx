import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { fichasService } from '../../services/firebaseService';
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
 * se permite marcarlas como recibidas cuando el módulo o la parte vuelve.
 */
export function FichaDerivacionSection({ ficha, item, onUpdate }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };

  const handleMarkReceived = async (derivIdx: number) => {
    const updated = [...item.derivaciones];
    updated[derivIdx] = { ...updated[derivIdx], estado: 'recibido', fechaRetorno: new Date().toISOString() };
    await fichasService.updateItem(ficha.id, item.id, { derivaciones: updated });
    onUpdate();
  };

  return (
    <Card title="Derivaciones a proveedor">
      {item.derivaciones.length === 0 ? (
        <p className="text-sm text-slate-400">Sin derivaciones</p>
      ) : (
        <div className="space-y-3">
          {item.derivaciones.map((d, idx) => {
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
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => handleMarkReceived(idx)}>
                    Marcar recibido
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
