import { useState } from 'react';
import type { ModuloSistema, CategoriaModulo } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';

const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5';

interface ModulosListProps {
  sistemaId: string;
  modulos: ModuloSistema[];
  categoriasModulos: CategoriaModulo[];
  onSave: (data: ModuloFormData, editingId?: string) => Promise<void>;
  onDelete: (moduloId: string) => Promise<void>;
}

export interface ModuloFormData {
  categoriaModuloId: string;
  modeloCodigo: string;
  nombre: string;
  descripcion: string;
  serie: string;
  firmware: string;
  observaciones: string;
}

const emptyForm: ModuloFormData = {
  categoriaModuloId: '',
  modeloCodigo: '',
  nombre: '',
  descripcion: '',
  serie: '',
  firmware: '',
  observaciones: '',
};

export const ModulosList: React.FC<ModulosListProps> = ({
  modulos,
  categoriasModulos,
  onSave,
  onDelete,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingModulo, setEditingModulo] = useState<ModuloSistema | null>(null);
  const [form, setForm] = useState<ModuloFormData>({ ...emptyForm });

  const openNew = () => {
    setEditingModulo(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (modulo: ModuloSistema) => {
    setEditingModulo(modulo);
    let categoriaId = '';
    let modeloCodigo = '';
    for (const cat of categoriasModulos) {
      const modelo = cat.modelos.find(m => m.codigo === modulo.nombre);
      if (modelo) {
        categoriaId = cat.id;
        modeloCodigo = modelo.codigo;
        break;
      }
    }
    setForm({
      categoriaModuloId: categoriaId,
      modeloCodigo,
      nombre: modulo.nombre,
      descripcion: modulo.descripcion || '',
      serie: modulo.serie || '',
      firmware: modulo.firmware || '',
      observaciones: modulo.observaciones || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    await onSave(form, editingModulo?.id);
    setShowModal(false);
    setEditingModulo(null);
    setForm({ ...emptyForm });
  };

  return (
    <>
      <Card compact>
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
            Modulos del Sistema
          </p>
          <Button size="sm" onClick={openNew}>+ Agregar</Button>
        </div>

        {modulos.length > 0 ? (
          <div className="space-y-2">
            {modulos.map((modulo) => (
              <ModuloRow
                key={modulo.id}
                modulo={modulo}
                onEdit={() => openEdit(modulo)}
                onDelete={() => onDelete(modulo.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <p className="text-slate-400 text-xs mb-2">No hay modulos registrados</p>
            <Button variant="outline" size="sm" onClick={openNew}>
              + Agregar Primer Modulo
            </Button>
          </div>
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <ModuloModal
          form={form}
          setForm={setForm}
          categoriasModulos={categoriasModulos}
          editingModulo={editingModulo}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingModulo(null); }}
        />
      )}
    </>
  );
};

const ModuloRow: React.FC<{ modulo: ModuloSistema; onEdit: () => void; onDelete: () => void }> = ({ modulo, onEdit, onDelete }) => (
  <div className="flex justify-between items-start p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors">
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-900 tracking-tight">{modulo.nombre}</p>
      {modulo.descripcion && <p className="text-[11px] text-slate-500 mt-0.5">{modulo.descripcion}</p>}
      <div className="flex gap-3 mt-1 text-[11px] text-slate-400">
        {modulo.serie && <span>Serie: <span className="font-medium text-slate-500">{modulo.serie}</span></span>}
        {modulo.firmware && <span>FW: <span className="font-medium text-slate-500">{modulo.firmware}</span></span>}
      </div>
      {modulo.observaciones && <p className="text-[11px] text-slate-400 italic mt-1">{modulo.observaciones}</p>}
    </div>
    <div className="flex gap-1 ml-2 shrink-0">
      <button onClick={onEdit} className="text-indigo-600 hover:bg-indigo-50 text-[11px] font-medium px-1.5 py-0.5 rounded">Editar</button>
      <button onClick={onDelete} className="text-red-500 hover:bg-red-50 text-[11px] font-medium px-1.5 py-0.5 rounded">Eliminar</button>
    </div>
  </div>
);

const ModuloModal: React.FC<{
  form: ModuloFormData; setForm: (f: ModuloFormData) => void;
  categoriasModulos: CategoriaModulo[]; editingModulo: ModuloSistema | null;
  onSave: () => void; onClose: () => void;
}> = ({ form, setForm, categoriasModulos, editingModulo, onSave, onClose }) => {
  const selectedCategoria = categoriasModulos.find(c => c.id === form.categoriaModuloId);
  const selectedModelo = selectedCategoria?.modelos.find(m => m.codigo === form.modeloCodigo);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card compact className="max-w-md w-full">
        <p className="text-sm font-semibold text-slate-900 tracking-tight mb-4">
          {editingModulo ? 'Editar Modulo' : 'Nuevo Modulo'}
        </p>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Categoria de Modulo</label>
            <SearchableSelect
              value={form.categoriaModuloId}
              onChange={(value) => setForm({ ...form, categoriaModuloId: value, modeloCodigo: '', nombre: '', descripcion: '' })}
              options={categoriasModulos.map(cat => ({ value: cat.id, label: cat.nombre }))}
              placeholder="Seleccionar categoria (opcional)..."
            />
            <p className="mt-0.5 text-[10px] text-slate-400">O deje vacio para escribir manualmente</p>
          </div>

          {form.categoriaModuloId ? (
            <>
              <div>
                <label className={lbl}>Modelo *</label>
                <SearchableSelect
                  value={form.modeloCodigo}
                  onChange={(value) => {
                    const modelo = selectedCategoria?.modelos.find(m => m.codigo === value);
                    setForm({
                      ...form,
                      modeloCodigo: value,
                      nombre: modelo?.codigo || '',
                      descripcion: modelo?.descripcion || '',
                    });
                  }}
                  options={selectedCategoria?.modelos.map(m => ({ value: m.codigo, label: `${m.codigo} - ${m.descripcion}` })) || []}
                  placeholder="Seleccionar modelo..."
                  required
                />
              </div>
              {selectedModelo && (<>
                <div><label className={lbl}>Codigo del Modelo</label><Input inputSize="sm" value={selectedModelo.codigo} disabled className="bg-slate-100 text-slate-600 cursor-not-allowed" /></div>
                <div><label className={lbl}>Descripcion</label><Input inputSize="sm" value={selectedModelo.descripcion} disabled className="bg-slate-100 text-slate-600 cursor-not-allowed" /></div>
              </>)}
            </>
          ) : (
            <>
              <div>
                <label className={lbl}>Nombre *</label>
                <Input inputSize="sm" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Bomba, Inyector, Detector..." required />
              </div>
              <div>
                <label className={lbl}>Descripcion</label>
                <Input inputSize="sm" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
            </>
          )}

          <div>
            <label className={lbl}>Numero de Serie</label>
            <Input inputSize="sm" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Version Firmware</label>
            <Input inputSize="sm" value={form.firmware} onChange={(e) => setForm({ ...form, firmware: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
              placeholder="Ej: bomba tiene canal c anulado..."
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={onSave}>Guardar</Button>
        </div>
      </Card>
    </div>
  );
};
