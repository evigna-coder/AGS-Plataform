import { useEffect, useState } from 'react';
import { conceptosServicioService, categoriasPresupuestoService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import type { ConceptoServicio, CategoriaPresupuesto, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const MONEDAS: MonedaPresupuesto[] = ['USD', 'ARS', 'EUR'];

export function ConceptosServicio() {
  const goBack = useNavigateBack();
  const confirm = useConfirm();
  const [conceptos, setConceptos] = useState<ConceptoServicio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPresupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFactorModal, setShowFactorModal] = useState(false);
  const [factorGlobal, setFactorGlobal] = useState('1.00');

  // Form
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [valorBase, setValorBase] = useState(0);
  const [moneda, setMoneda] = useState<MonedaPresupuesto>('USD');
  const [factor, setFactor] = useState(1);
  const [catId, setCatId] = useState('');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [c, cats] = await Promise.all([conceptosServicioService.getAll(), categoriasPresupuestoService.getAll()]);
    setConceptos(c);
    setCategorias(cats);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setCodigo(''); setDescripcion(''); setValorBase(0); setMoneda('USD'); setFactor(1); setCatId(''); setActivo(true); setEditingId(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (c: ConceptoServicio) => {
    setEditingId(c.id);
    setCodigo(c.codigo || '');
    setDescripcion(c.descripcion);
    setValorBase(c.valorBase);
    setMoneda(c.moneda);
    setFactor(c.factorActualizacion);
    setCatId(c.categoriaPresupuestoId || '');
    setActivo(c.activo);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!descripcion.trim()) return;
    setSaving(true);
    try {
      const data = {
        codigo: codigo.trim() || null,
        descripcion: descripcion.trim(),
        valorBase,
        moneda,
        factorActualizacion: factor,
        categoriaPresupuestoId: catId || null,
        activo,
      };
      if (editingId) {
        await conceptosServicioService.update(editingId, data);
      } else {
        await conceptosServicioService.create(data);
      }
      setShowModal(false);
      resetForm();
      await loadData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('Eliminar este concepto?')) return;
    await conceptosServicioService.delete(id);
    await loadData();
  };

  const handleFactorGlobal = async () => {
    const f = parseFloat(factorGlobal);
    if (isNaN(f) || f <= 0) return;
    setSaving(true);
    try {
      await Promise.all(conceptos.filter(c => c.activo).map(c =>
        conceptosServicioService.update(c.id, { factorActualizacion: f })
      ));
      setShowFactorModal(false);
      await loadData();
    } finally { setSaving(false); }
  };

  const getCatNombre = (id?: string | null) => {
    if (!id) return '—';
    return categorias.find(c => c.id === id)?.nombre || '—';
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Conceptos de servicio"
        subtitle="Catálogo de precios para presupuestos"
        count={conceptos.length}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowFactorModal(true)}>Actualizar factor</Button>
            <Button variant="primary" size="sm" onClick={openCreate}>+ Nuevo concepto</Button>
          </div>
        }
      >
        <button onClick={() => goBack()} className="text-xs text-teal-600 hover:underline">← Volver a presupuestos</button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <p className="text-center text-slate-400 py-12">Cargando...</p>
        ) : conceptos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm mb-3">No hay conceptos de servicio</p>
            <Button size="sm" onClick={openCreate}>Crear primer concepto</Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-28">Codigo</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-24">Valor base</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-16">Moneda</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-16">Factor</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-28">Precio efectivo</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-28">Categoria</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-16">Estado</th>
                  <th className="px-4 py-2 text-center text-[11px] font-medium text-slate-400 tracking-wider w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conceptos.map(c => {
                  const precioEfectivo = c.valorBase * c.factorActualizacion;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{c.codigo || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">{c.descripcion}</td>
                      <td className="px-4 py-2.5 text-xs text-center text-slate-600">
                        {MONEDA_SIMBOLO[c.moneda]} {c.valorBase.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-center text-slate-500">{c.moneda}</td>
                      <td className="px-4 py-2.5 text-xs text-center text-slate-500">x{c.factorActualizacion}</td>
                      <td className="px-4 py-2.5 text-xs text-center font-semibold text-teal-700">
                        {MONEDA_SIMBOLO[c.moneda]} {precioEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{getCatNombre(c.categoriaPresupuestoId)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center space-x-2">
                        <button className="text-xs text-teal-600 hover:underline" onClick={() => openEdit(c)}>Editar</button>
                        <button className="text-xs text-red-500 hover:underline" onClick={() => handleDelete(c.id)}>Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingId ? 'Editar concepto' : 'Nuevo concepto de servicio'}>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Input size="sm" label="Codigo" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej: MP1_CN_60" />
            <Input size="sm" label="Descripcion *" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Servicio de calibración GC MSD rango 30 km" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input size="sm" label="Valor base *" type="number" min={0} step={0.01} value={String(valorBase)} onChange={e => setValorBase(Number(e.target.value) || 0)} />
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Moneda</label>
              <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={moneda} onChange={e => setMoneda(e.target.value as MonedaPresupuesto)}>
                {MONEDAS.map(m => <option key={m} value={m}>{m} ({MONEDA_SIMBOLO[m]})</option>)}
              </select>
            </div>
            <Input size="sm" label="Factor actualiz." type="number" min={0} step={0.01} value={String(factor)} onChange={e => setFactor(Number(e.target.value) || 1)} />
          </div>
          <p className="text-[11px] text-slate-400">
            Precio efectivo: <span className="font-semibold text-teal-700">{MONEDA_SIMBOLO[moneda]} {(valorBase * factor).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </p>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Categoria impositiva</label>
            <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" value={catId} onChange={e => setCatId(e.target.value)}>
              <option value="">Sin categoria</option>
              {categorias.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="rounded border-slate-300" />
            Activo
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <Button variant="secondary" size="sm" onClick={() => { setShowModal(false); resetForm(); }}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !descripcion.trim()}>
            {saving ? 'Guardando...' : editingId ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </Modal>

      {/* Factor global modal */}
      <Modal open={showFactorModal} onClose={() => setShowFactorModal(false)} title="Actualizar factor global" subtitle="Aplica a todos los conceptos activos">
        <div className="p-5 space-y-3">
          <Input size="sm" label="Nuevo factor de actualizacion" type="number" min={0} step={0.01} value={factorGlobal} onChange={e => setFactorGlobal(e.target.value)} placeholder="Ej: 1.15" />
          <p className="text-[11px] text-slate-400">Esto actualizará el factor de <strong>todos</strong> los conceptos activos. El valor base no se modifica.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <Button variant="secondary" size="sm" onClick={() => setShowFactorModal(false)}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleFactorGlobal} disabled={saving}>
            {saving ? 'Aplicando...' : 'Aplicar a todos'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
