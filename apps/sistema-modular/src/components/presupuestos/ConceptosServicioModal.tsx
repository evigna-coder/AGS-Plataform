import { useEffect, useMemo, useRef, useState } from 'react';
import { conceptosServicioService, categoriasPresupuestoService } from '../../services/firebaseService';
import type { ConceptoServicio, CategoriaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useConfirm } from '../ui/ConfirmDialog';
import { ConceptoServicioForm, type ConceptoServicioFormData } from './ConceptoServicioForm';
import { matchesSearch } from '../../utils/searchTerms';

interface Props { open: boolean; onClose: () => void; }

export const ConceptosServicioModal: React.FC<Props> = ({ open, onClose }) => {
  const [conceptos, setConceptos] = useState<ConceptoServicio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPresupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);

  // Form en componente APARTE con estado propio (UAT 2026-07-30: tipear en el
  // form re-renderizaba la tabla completa del catálogo → cada letra demoraba).
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ConceptoServicio | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // "Editar" desde una fila baja en la lista: llevar la vista al formulario
  // (el form se renderiza arriba de la tabla — pedido 2026-07-30).
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm, editing]);

  // Factor global
  const [showFactor, setShowFactor] = useState(false);
  const [factorGlobal, setFactorGlobal] = useState('1.00');

  useEffect(() => { if (open) loadData(); }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [c, cats] = await Promise.all([conceptosServicioService.getAll(), categoriasPresupuestoService.getAll()]);
    setConceptos(c); setCategorias(cats); setLoading(false);
  };

  const resetForm = () => { setEditing(null); setShowForm(false); };

  const handleSave = async (data: ConceptoServicioFormData) => {
    setSaving(true);
    try {
      if (editing) await conceptosServicioService.update(editing.id, data);
      else await conceptosServicioService.create(data);
      resetForm(); await loadData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Eliminar este concepto?')) return;
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

  // Map precalculado — antes era un .find() POR FILA (O(n×m) en cada render).
  const catNombreById = useMemo(() => new Map(categorias.map(c => [c.id, c.nombre])), [categorias]);
  const getCatNombre = (id?: string | null) => (id && catNombreById.get(id)) || '—';

  const conceptosFiltrados = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return conceptos;
    return conceptos.filter(c => matchesSearch(q, c.codigo, c.descripcion, getCatNombre(c.categoriaPresupuestoId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptos, busqueda, catNombreById]);
  const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";

  return (
    <>
      <Modal open={open} onClose={() => { resetForm(); onClose(); }} title="Conceptos de servicio"
        subtitle={busqueda.trim() ? `${conceptosFiltrados.length} de ${conceptos.length} conceptos` : `${conceptos.length} conceptos`} maxWidth="2xl">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código, descripción o categoría…"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {!showForm && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowFactor(true)}>Actualizar factor</Button>
                <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Nuevo concepto</Button>
              </>
            )}
          </div>

          {showForm && (
            <div ref={formRef}>
              <ConceptoServicioForm
                key={editing?.id ?? 'nuevo'}
                initial={editing}
                categorias={categorias}
                saving={saving}
                onSave={handleSave}
                onCancel={resetForm}
              />
            </div>
          )}

          {loading ? (
            <p className="text-center text-slate-400 text-xs py-6">Cargando...</p>
          ) : conceptosFiltrados.length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-6">
              {conceptos.length === 0 ? 'No hay conceptos de servicio' : 'Sin resultados para la búsqueda'}
            </p>
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
                  {conceptosFiltrados.map(c => {
                    const precio = c.valorBase * c.factorActualizacion;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 font-mono">{c.codigo || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{c.descripcion}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{MONEDA_SIMBOLO[c.moneda]} {c.valorBase.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-center text-slate-500">x{c.factorActualizacion}</td>
                        <td className="px-3 py-2 text-center font-semibold text-teal-700">{MONEDA_SIMBOLO[c.moneda]} {precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-slate-500">{getCatNombre(c.categoriaPresupuestoId)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center space-x-2">
                          <button className="text-teal-600 hover:underline" onClick={() => { setEditing(c); setShowForm(true); }}>Editar</button>
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
