import { Link, useNavigate } from 'react-router-dom';
import type { WorkOrder, Part, TipoServicio, Cliente } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

const sec = 'text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3';
const thCls = 'text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3 text-left';

export interface OTItemsSectionProps {
  readOnly: boolean;
  otNumber?: string;
  // Parts
  articulos: Part[];
  onAddPart: () => void;
  onUpdatePart: (id: string, field: keyof Part, value: any) => void;
  onRemovePart: (id: string) => void;
  // Sub-items
  items: WorkOrder[];
  // New item modal
  showNewItemModal: boolean;
  setShowNewItemModal: (v: boolean) => void;
  newItemData: { necesitaPresupuesto: boolean; clienteConfiable: boolean; tieneContrato: boolean; tipoServicio: string; descripcion: string };
  setNewItemData: (d: any) => void;
  tiposServicio: TipoServicio[];
  cliente: Cliente | null;
  onCreateNewItem: () => void;
}

export const OTItemsSection: React.FC<OTItemsSectionProps> = ({
  readOnly, otNumber, articulos, onAddPart, onUpdatePart, onRemovePart,
  items, showNewItemModal, setShowNewItemModal, newItemData, setNewItemData,
  tiposServicio, cliente, onCreateNewItem,
}) => {
  const navigate = useNavigate();
  const isParent = otNumber && !otNumber.includes('.');

  return (
    <div className="space-y-4">
      {/* Materials / Parts */}
      <Card compact>
        <div className="flex justify-between items-center mb-2">
          <p className={sec + ' !mb-0'}>Materiales / Repuestos</p>
          {!readOnly && (
            <button onClick={onAddPart} className="text-[11px] font-medium text-indigo-600 hover:underline">+ Item</button>
          )}
        </div>
        {articulos.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${thCls} w-28`}>Codigo</th>
                  <th className={thCls}>Descripcion</th>
                  <th className={`${thCls} w-14 text-center`}>Cant.</th>
                  <th className={`${thCls} w-24`}>Origen</th>
                  {!readOnly && <th className="w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {articulos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <input value={p.codigo} maxLength={18} disabled={readOnly} onChange={e => onUpdatePart(p.id, 'codigo', e.target.value)} className="w-full outline-none bg-transparent text-xs disabled:text-slate-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={p.descripcion} maxLength={90} disabled={readOnly} onChange={e => onUpdatePart(p.id, 'descripcion', e.target.value)} className="w-full outline-none bg-transparent text-xs disabled:text-slate-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={p.cantidad} disabled={readOnly} onChange={e => onUpdatePart(p.id, 'cantidad', Number(e.target.value) || 0)} className="w-full outline-none text-center bg-transparent text-xs disabled:text-slate-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={p.origen} maxLength={12} disabled={readOnly} onChange={e => onUpdatePart(p.id, 'origen', e.target.value)} className="w-full outline-none bg-transparent text-xs disabled:text-slate-400" />
                    </td>
                    {!readOnly && (
                      <td className="text-center">
                        <button onClick={() => onRemovePart(p.id)} className="text-red-400 hover:text-red-600 text-xs">x</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-3 text-center">No hay materiales registrados</p>
        )}
      </Card>

      {/* Sub-items list */}
      {isParent && items.length > 0 && (
        <Card compact>
          <p className={sec}>Items de esta OT</p>
          <div className="space-y-1.5">
            {items.map((item) => (
              <div key={item.otNumber} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100">
                <div>
                  <Link to={`/ordenes-trabajo/${item.otNumber}`} className="text-xs font-semibold text-indigo-700 hover:underline">
                    OT-{item.otNumber}
                  </Link>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.tipoServicio}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    item.status === 'FINALIZADO' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                  }`}>
                    {item.status === 'FINALIZADO' ? 'Finalizado' : 'Borrador'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/ordenes-trabajo/${item.otNumber}`)}>Ver</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* New item modal */}
      {showNewItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-4">
              Crear nuevo item para OT-{otNumber}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Tipo de servicio *</label>
                <SearchableSelect
                  value={newItemData.tipoServicio}
                  onChange={v => setNewItemData({ ...newItemData, tipoServicio: v })}
                  options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))}
                  placeholder="Seleccionar..."
                  required
                />
                <Link to="/tipos-servicio" className="text-[11px] text-indigo-600 hover:underline mt-1 inline-block">Gestionar tipos de servicio</Link>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Descripcion del trabajo</label>
                <textarea
                  value={newItemData.descripcion}
                  onChange={e => setNewItemData({ ...newItemData, descripcion: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  placeholder="Describa brevemente el trabajo a realizar..."
                />
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-[11px] font-medium text-slate-400 mb-1">Evaluacion para apertura</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newItemData.necesitaPresupuesto} onChange={e => setNewItemData({ ...newItemData, necesitaPresupuesto: e.target.checked })} className="w-3.5 h-3.5" />
                  <span className="text-xs text-slate-700">Requiere nuevo presupuesto</span>
                </label>
                {cliente && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newItemData.clienteConfiable} onChange={e => setNewItemData({ ...newItemData, clienteConfiable: e.target.checked })} className="w-3.5 h-3.5" disabled={(cliente as any).pagaEnTiempo === true} />
                      <span className="text-xs text-slate-700">
                        Cliente confiable{(cliente as any).pagaEnTiempo && <span className="text-emerald-600 ml-1">- Verificado</span>}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newItemData.tieneContrato || (cliente as any).tipoServicio === 'contrato'} onChange={e => setNewItemData({ ...newItemData, tieneContrato: e.target.checked })} className="w-3.5 h-3.5" disabled={(cliente as any).tipoServicio === 'contrato'} />
                      <span className="text-xs text-slate-700">
                        Con contrato{(cliente as any).tipoServicio === 'contrato' && <span className="text-emerald-600 ml-1">- Tiene contrato</span>}
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => { setShowNewItemModal(false); setNewItemData({ necesitaPresupuesto: false, clienteConfiable: false, tieneContrato: false, tipoServicio: '', descripcion: '' }); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={onCreateNewItem}>Crear Item</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
