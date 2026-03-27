import type { ModuloSistema, CategoriaModulo } from '@ags/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { ModuloFormData } from './ModulosList';

const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5';

interface Props {
  form: ModuloFormData;
  setForm: (f: ModuloFormData) => void;
  categoriasModulos: CategoriaModulo[];
  editingModulo: ModuloSistema | null;
  onSave: () => void;
  onClose: () => void;
}

export const ModuloModal: React.FC<Props> = ({ form, setForm, categoriasModulos, editingModulo, onSave, onClose }) => {
  const selectedCategoria = categoriasModulos.find(c => c.id === form.categoriaModuloId);
  const selectedModelo = selectedCategoria?.modelos.find(m => m.codigo === form.modeloCodigo);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={editingModulo ? 'Editar Modulo' : 'Nuevo Modulo'}
      maxWidth="sm"
      minimizable={false}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={onSave}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={lbl}>Categoria de Modulo</label>
          <SearchableSelect
            value={form.categoriaModuloId}
            onChange={(value) => setForm({ ...form, categoriaModuloId: value, modeloCodigo: '', nombre: '', marca: '', descripcion: '' })}
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
                    marca: modelo?.marca || form.marca,
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
          <label className={lbl}>Marca</label>
          <Input inputSize="sm" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} placeholder="Ej: Agilent, Shimadzu..." />
        </div>
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
    </Modal>
  );
};
