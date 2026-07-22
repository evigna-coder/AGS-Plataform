import { Card } from '../ui/Card';
import type { Importacion } from '@ags/shared';
import { pendienteDeItem, resumenRecepcion } from '../../utils/importacionRecepcion';

interface ImportacionItemsSectionProps {
  imp: Importacion;
}

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';
const tdClass = 'px-3 py-2 text-xs text-slate-600';

export const ImportacionItemsSection: React.FC<ImportacionItemsSectionProps> = ({ imp }) => {
  const items = imp.items ?? [];
  const resumen = resumenRecepcion(imp);

  return (
    <Card title="ÍTEMS DEL EMBARQUE" compact>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">No hay ítems registrados en este embarque.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={thClass}>Código</th>
                <th className={thClass}>Descripción</th>
                <th className={`${thClass} text-right`}>Cant. Pedida</th>
                <th className={`${thClass} text-right`}>Cant. Recibida</th>
                <th className={`${thClass} text-right`}>Pendiente</th>
                <th className={`${thClass} text-right`}>Precio Unit.</th>
                <th className={thClass}>Moneda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => {
                const pendiente = pendienteDeItem(item);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className={tdClass}>{item.articuloCodigo || '—'}</td>
                    <td className={tdClass}>{item.descripcion}</td>
                    <td className={`${tdClass} text-right`}>{item.cantidadPedida}</td>
                    <td className={`${tdClass} text-right`}>{item.cantidadRecibida != null ? item.cantidadRecibida : '—'}</td>
                    <td className={`${tdClass} text-right ${pendiente > 0 && resumen.huboRecepcion ? 'text-amber-600 font-medium' : ''}`}>
                      {pendiente > 0 ? pendiente : '—'}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {item.precioUnitario != null
                        ? item.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>
                    <td className={tdClass}>{item.moneda || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {resumen.huboRecepcion && (
            <p className={`text-[11px] mt-2 ${resumen.completo ? 'text-teal-600' : 'text-amber-600'}`}>
              Recibido {resumen.recibido} de {resumen.pedido} unidades
              {resumen.completo ? ' — recepción completa' : ` — ${resumen.faltantes.length} ítem${resumen.faltantes.length > 1 ? 's' : ''} con faltante`}
              {imp.recepcionCerradaIncompleta ? ' · recepción cerrada incompleta' : ''}
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
