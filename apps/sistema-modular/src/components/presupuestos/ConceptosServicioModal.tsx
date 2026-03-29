import { useEffect, useState } from 'react';
import { conceptosServicioService, categoriasPresupuestoService } from '../../services/firebaseService';
import type { ConceptoServicio, CategoriaPresupuesto, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props { open: boolean; onClose: () => void; }

const MONEDAS: MonedaPresupuesto[] = ['USD', 'ARS', 'EUR'];

export const ConceptosServicioModal: React.FC<Props> = ({ open, onClose }) => {
  const [conceptos, setConceptos] = useState<ConceptoServicio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPresupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit/Create form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [valorBase, setValorBase] = useState(0);
  const [moneda, setMoneda] = useState<MonedaPresupuesto>('USD');
  const [factor, setFactor] = useState(1);
  const [catId, setCatId] = useState('');
  const [activo, setActivo] = useState(true);

  // Factor global
  const [showFactor, setShowFactor] = useState(false);
  const [factorGlobal, setFactorGlobal] = useState('1.00');

  useEffect(() => { if (open) loadData(); }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [c, cats] = await Promise.all([conceptosServicioService.getAll(), categoriasPresupuestoService.getAll()]);
    setConceptos(c); setCategorias(cats); setLoading(false);
  };

  const resetForm = () => {
    setCodigo(''); setDescripcion(''); setValorBase(0); setMoneda('USD'); setFactor(1); setCatId(''); setActivo(true);
    setEditingId(null); setShowForm(false);
  };

  const openEdit = (c: ConceptoServicio) => {
    setEditingId(c.id); setCodigo(c.codigo || ''); setDescripcion(c.descripcion);
    setValorBase(c.valorBase); setMoneda(c.moneda); setFactor(c.factorActualizacion);
    setCatId(c.categoriaPresupuestoId || ''); setActivo(c.activo); setShowForm(true);
  };

  const handleSave = async () => {
    if (!descripcion.trim()) return;
    setSaving(true);
    try {
      const data = { codigo: codigo.trim() || null, descripcion: descripcion.trim(), valorBase, moneda, factorActualizacion: factor, categoriaPresupuestoId: catId || null, activo };
      if (editingId) await conceptosServicioService.update(editingId, data);
      else await conceptosServicioService.create(data);
      resetForm(); await loadData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este concepto?')) return;
    await conceptosServicioService.delete(id); await loadData();
  };

  const handleFactorGlobal = async () => {
    const f = parseFloat(factorGlobal);
    if (isNaN(f) || f <= 0) return;
    setSaving(true);
    try {
      await Promise.all(conceptos.filter(c => c.activo).map(c => conceptosServicioService.update(c.id, { factorActualizacion: f })));
      setShowFactor(false); await loadData();
    } finally { setSaving(false); }
  };

  const getCatNombre = (id?: string | null) => categorias.find(c => c.id === id)?.nombre || '—';
  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";

  return (
    <>
      <Modal open={open} onClose={() => { resetForm(); onClose(); }} title="Conceptos de servicio" subtitle={`${conceptos.length} conceptos`} maxWidth="2xl">
        <div className="space-y-3">
          {!showForm && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowFactor(true)}>Actualizar factor</Button>
              <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Nuevo concepto</Button>
            </div>
          )}

          {showForm && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700">{editingId ? 'Editar concepto' : 'Nuevo concepto'}</p>
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <div>
                  <label className={lbl}>Código</label>
                  <Input inputSize="sm" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="MP1_CN_60" />
                </div>
                <div>
                  <label className={lbl}>Descripción *</label>
                  <Input inputSize="sm" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Servicio de calibración..." />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Valor base *</label>
                  <Input inputSize="sm" type="number" min={0} step={0.01} value={String(valorBase)} onChange={e => setValorBase(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <label className={lbl}>Moneda</label>
                  <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    value={moneda} onChange={e => setMoneda(e.target.value as MonedaPresupuesto)}>
                    {MONEDAS.map(m => <option key={m} value={m}>{m} ({MONEDA_SIMBOLO[m]})</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Factor</label>
                  <Input inputSize="sm" type="number" min={0} step={0.01} value={String(factor)} onChange={e => setFactor(Number(e.target.value) || 1)} />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Precio efectivo: <span className="font-semibold text-teal-700">{MONEDA_SIMBOLO[moneda]} {(valorBase * factor).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </p>
              <div>
                <label className={lbl}>Categoría impositiva</label>
                <select className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                  value={catId} onChange={e => setCatId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categorias.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="rounded border-slate-300" />
                Activo
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="secondary" size="sm" onClick={resetForm}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !descripcion.trim()}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center text-slate-400 text-xs py-6">Cargando...</p>
          ) : conceptos.length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-6">No hay conceptos de servicio</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Código</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Descripción</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Valor base</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Factor</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Precio efectivo</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Categoría</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {conceptos.map(c => {
                    const precio = c.valorBase * c.factorActualizacion;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 font-mono">{c.codigo || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{c.descripcion}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{MONEDA_SIMBOLO[c.moneda]} {c.valorBase.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-left text-slate-500">x{c.factorActualizacion}</td>
                        <td className="px-3 py-2 text-right font-semibold text-teal-700">{MONEDA_SIMBOLO[c.moneda]} {precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-slate-500">{getCatNombre(c.categoriaPresupuestoId)}</td>
                        <td className="px-3 py-2 text-left">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right space-x-2">
                          <button className="text-teal-600 hover:underline" onClick={() => openEdit(c)}>Editar</button>
                          <button className="text-red-500 hover:underline" onClick={() => handleDelete(c.id)}>Eliminar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Factor global modal */}
      <Modal open={showFactor} onClose={() => setShowFactor(false)} title="Actualizar factor global" subtitle="Aplica a todos los conceptos activos" maxWidth="sm">
        <div className="space-y-3">
          <div>
            <label className={lbl}>Nuevo factor</label>
            <Input inputSize="sm" type="number" min={0} step={0.01} value={factorGlobal} onChange={e => setFactorGlobal(e.target.value)} placeholder="1.15" />
          </div>
          <p className="text-[10px] text-slate-400">Actualiza el factor de <strong>todos</strong> los conceptos activos. El valor base no se modifica.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setShowFactor(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleFactorGlobal} disabled={saving}>
            {saving ? 'Aplicando...' : 'Aplicar a todos'}
          </Button>
        </div>
      </Modal>
    </>
  );
};
