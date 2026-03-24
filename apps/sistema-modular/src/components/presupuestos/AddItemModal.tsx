import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, Sistema, ModuloSistema } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

const categoriaOptions = (cats: CategoriaPresupuesto[]) => [
  { value: '', label: 'Sin categoria' },
  ...cats.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
];

interface AddItemModalProps {
  newItem: Partial<PresupuestoItem>;
  setNewItem: (v: Partial<PresupuestoItem>) => void;
  categoriasPresupuesto: CategoriaPresupuesto[];
  conceptosServicio: ConceptoServicio[];
  moneda?: string;
  onAdd: () => void;
  onClose: () => void;
  /** Sistemas del cliente — enables equipo selector for contratos */
  sistemas?: Sistema[];
  /** Cargar módulos de un sistema */
  loadModulos?: (sistemaId: string) => Promise<ModuloSistema[]>;
  /** Tipo de presupuesto — shows equipo fields when 'contrato' */
  tipoPresupuesto?: string;
}

export const AddItemModal = ({ newItem, setNewItem, categoriasPresupuesto, conceptosServicio, moneda, onAdd, onClose, sistemas, loadModulos }: AddItemModalProps) => {
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [loadingModulos, setLoadingModulos] = useState(false);
  // Load módulos when sistema changes (skip for "all systems")
  useEffect(() => {
    if (!newItem.sistemaId || newItem.sistemaId === ALL_SISTEMAS_VALUE || !loadModulos) { setModulos([]); return; }
    setLoadingModulos(true);
    loadModulos(newItem.sistemaId)
      .then(setModulos)
      .catch(() => setModulos([]))
      .finally(() => setLoadingModulos(false));
  }, [newItem.sistemaId, loadModulos]);

  const ALL_SISTEMAS_VALUE = '__ALL_SISTEMAS__';

  const handleSistemaChange = (sistemaId: string) => {
    if (sistemaId === ALL_SISTEMAS_VALUE) {
      setNewItem({
        ...newItem,
        sistemaId: ALL_SISTEMAS_VALUE,
        sistemaNombre: 'Todos los sistemas/equipos',
        moduloId: null,
        moduloNombre: null,
        moduloSerie: null,
        moduloMarca: null,
      });
      return;
    }
    const sistema = sistemas?.find(s => s.id === sistemaId);
    setNewItem({
      ...newItem,
      sistemaId: sistemaId || null,
      sistemaNombre: sistema?.nombre || null,
      sistemaCodigoInterno: sistema?.codigoInternoCliente || null,
      moduloId: null,
      moduloNombre: null,
      moduloSerie: null,
      moduloMarca: null,
    });
  };

  const handleModuloChange = (moduloId: string) => {
    const modulo = modulos.find(m => m.id === moduloId);
    setNewItem({
      ...newItem,
      moduloId: moduloId || null,
      moduloNombre: modulo?.nombre || null,
      moduloSerie: modulo?.serie || null,
      moduloMarca: modulo?.marca || null,
    });
  };

  const base = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
  const subtotal = newItem.descuento ? base * (1 - newItem.descuento / 100) : base;
  const categoria = categoriasPresupuesto.find(c => c.id === newItem.categoriaPresupuestoId);
  const sym = MONEDA_SIMBOLO[(moneda as keyof typeof MONEDA_SIMBOLO) || 'USD'] || '$';

  const handleSelectConcepto = (conceptoId: string) => {
    const concepto = conceptosServicio.find(c => c.id === conceptoId);
    if (!concepto) return;
    const precio = concepto.valorBase * concepto.factorActualizacion;
    setNewItem({
      ...newItem,
      descripcion: concepto.descripcion,
      precioUnitario: precio,
      codigoProducto: concepto.codigo || newItem.codigoProducto || null,
      categoriaPresupuestoId: concepto.categoriaPresupuestoId || newItem.categoriaPresupuestoId,
      conceptoServicioId: concepto.id,
    });
  };

  const taxPreview = () => {
    if (!categoria) return null;
    let iva = 0, ganancias = 0, iibb = 0;
    if (categoria.incluyeIva && categoria.porcentajeIva) {
      iva = categoria.ivaReduccion && categoria.porcentajeIvaReduccion
        ? subtotal * (categoria.porcentajeIvaReduccion / 100)
        : subtotal * (categoria.porcentajeIva / 100);
    }
    if (categoria.incluyeGanancias && categoria.porcentajeGanancias) ganancias = (subtotal + iva) * (categoria.porcentajeGanancias / 100);
    if (categoria.incluyeIIBB && categoria.porcentajeIIBB) iibb = (subtotal + iva) * (categoria.porcentajeIIBB / 100);
    const total = subtotal + iva + ganancias + iibb;
    return (
      <div className="mt-2 bg-teal-50 p-3 rounded-lg text-xs">
        <p className="font-semibold text-slate-700 mb-1">Calculo con "{categoria.nombre}":</p>
        <div className="space-y-0.5 text-slate-600">
          <p>Subtotal: {sym} {subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          {iva > 0 && <p>IVA ({categoria.ivaReduccion && categoria.porcentajeIvaReduccion ? categoria.porcentajeIvaReduccion : categoria.porcentajeIva}%): {sym} {iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
          {ganancias > 0 && <p>Ganancias ({categoria.porcentajeGanancias}%): {sym} {ganancias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
          {iibb > 0 && <p>IIBB ({categoria.porcentajeIIBB}%): {sym} {iibb.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
          <p className="font-semibold text-teal-700 mt-1">Total: {sym} {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>
    );
  };

  const conceptoOptions = conceptosServicio.filter(c => c.activo).map(c => ({
    value: c.id,
    label: `${c.codigo ? `[${c.codigo}] ` : ''}${c.descripcion} — ${MONEDA_SIMBOLO[c.moneda]} ${(c.valorBase * c.factorActualizacion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
  }));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <Card compact className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-3">Agregar item</h3>
        <div className="space-y-3">
          {/* Concepto picker */}
          {conceptoOptions.length > 0 && (
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Seleccionar del catalogo</label>
              <SearchableSelect value="" onChange={handleSelectConcepto} options={[{ value: '', label: 'Carga manual...' }, ...conceptoOptions]} placeholder="Buscar concepto..." />
            </div>
          )}
          {/* Equipo selector */}
          {sistemas && sistemas.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg space-y-2">
              <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Vincular a equipo</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Sistema/Equipo</label>
                  <SearchableSelect
                    value={newItem.sistemaId || ''}
                    onChange={handleSistemaChange}
                    options={[
                      { value: '', label: 'Sin equipo' },
                      { value: ALL_SISTEMAS_VALUE, label: 'Todos los sistemas/equipos' },
                      ...sistemas.map(s => ({ value: s.id, label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}` })),
                    ]}
                    placeholder="Seleccionar equipo..."
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Módulo</label>
                  {newItem.sistemaId === ALL_SISTEMAS_VALUE ? (
                    <span className="text-[11px] text-blue-500 block py-1.5 italic">Aplica a todos</span>
                  ) : loadingModulos ? (
                    <span className="text-xs text-slate-400 block py-1.5">Cargando...</span>
                  ) : (
                    <SearchableSelect
                      value={newItem.moduloId || ''}
                      onChange={handleModuloChange}
                      options={[
                        { value: '', label: 'Sin módulo' },
                        ...modulos.map(m => ({ value: m.id, label: `${m.nombre}${m.serie ? ` — ${m.serie}` : ''}` })),
                      ]}
                      placeholder="Seleccionar módulo..."
                    />
                  )}
                </div>
              </div>
              {newItem.moduloSerie && (
                <p className="text-[10px] text-blue-600">Serie: {newItem.moduloSerie} | Marca: {newItem.moduloMarca || '-'}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Cod. servicio</label>
                  <input value={newItem.servicioCode || ''} onChange={(e) => setNewItem({ ...newItem, servicioCode: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="Ej: ATI_BAS_00C" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Sub-item</label>
                  <input value={newItem.subItem || ''} onChange={(e) => setNewItem({ ...newItem, subItem: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="Ej: 1.1" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={newItem.esBonificacion || false}
                  onChange={(e) => setNewItem({ ...newItem, esBonificacion: e.target.checked })}
                  className="rounded border-slate-300" />
                Es bonificación (descuento 100%)
              </label>
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Código artículo</label>
            <input value={newItem.codigoProducto || ''} onChange={(e) => setNewItem({ ...newItem, codigoProducto: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="Ej: G1312-60067" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Descripcion *</label>
            <textarea value={newItem.descripcion} onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })}
              rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Descripcion del item..." />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Cantidad *</label>
              <input type="number" min="0" step="0.01" value={newItem.cantidad || ''} onChange={(e) => setNewItem({ ...newItem, cantidad: Number(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Unidad</label>
              <input value={newItem.unidad || 'unidad'} onChange={(e) => setNewItem({ ...newItem, unidad: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Precio unit. *</label>
              <input type="number" min="0" step="0.01" value={newItem.precioUnitario || ''} onChange={(e) => setNewItem({ ...newItem, precioUnitario: Number(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Dto %</label>
              <input type="number" min="0" max="100" step="0.5" value={newItem.descuento || ''} onChange={(e) => setNewItem({ ...newItem, descuento: Number(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Categoria (reglas tributarias)</label>
            <SearchableSelect value={newItem.categoriaPresupuestoId || ''} onChange={(v) => setNewItem({ ...newItem, categoriaPresupuestoId: v || undefined })}
              options={categoriaOptions(categoriasPresupuesto)} placeholder="Seleccionar categoria..." />
            <Link to="/presupuestos/categorias" className="text-[11px] text-teal-600 hover:underline mt-0.5 inline-block">Gestionar categorias →</Link>
            {newItem.categoriaPresupuestoId && taxPreview()}
          </div>
          {newItem.cantidad && newItem.precioUnitario && !newItem.categoriaPresupuestoId && (
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs font-semibold text-slate-700">Subtotal: {sym} {subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Seleccione una categoria para ver impuestos</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={onAdd}>Agregar</Button>
        </div>
      </Card>
    </div>
  );
};
