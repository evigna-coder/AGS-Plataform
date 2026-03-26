import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ingresoEmpresasService, clientesService } from '../../services/firebaseService';
import type { IngresoEmpresa, Cliente, TipoIngresoCliente, DocumentoIngresoStatus, DocumentacionIngreso } from '@ags/shared';
import { TIPO_INGRESO_LABELS, DOCUMENTACION_INGRESO_KEYS, DOCUMENTO_INGRESO_LABELS, DEFAULT_DOCUMENTACION } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: IngresoEmpresa | null;
}

const STATUS_OPTIONS: DocumentoIngresoStatus[] = ['no_requerido', 'requerido', 'con_contrato', 'con_nomina', 'con_contrato_y_nomina'];

export const IngresoEmpresaModal: React.FC<Props> = ({ open, onClose, onSaved, editData }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      clienteId: '',
      clienteNombre: '',
      tipo: 'PI' as TipoIngresoCliente,
      induccion: { requerida: false, descripcion: '', duracion: '', horario: '' },
      contacto: '',
      documentacion: { ...DEFAULT_DOCUMENTACION },
      notas: '',
    };
  }

  useEffect(() => {
    if (open) {
      clientesService.getAll(true).then(setClientes).catch(console.error);
      if (editData) {
        setForm({
          clienteId: editData.clienteId,
          clienteNombre: editData.clienteNombre,
          tipo: editData.tipo,
          induccion: { requerida: editData.induccion.requerida, descripcion: editData.induccion.descripcion, duracion: editData.induccion.duracion ?? '', horario: editData.induccion.horario ?? '' },
          contacto: editData.contacto,
          documentacion: { ...DEFAULT_DOCUMENTACION, ...editData.documentacion },
          notas: editData.notas || '',
        });
      } else {
        setForm(getEmptyForm());
      }
    }
  }, [open, editData]);

  const handleClienteChange = (id: string) => {
    const c = clientes.find(c => c.id === id);
    setForm(f => ({ ...f, clienteId: id, clienteNombre: c?.razonSocial ?? '' }));
  };

  const setDocStatus = (key: keyof DocumentacionIngreso, val: DocumentoIngresoStatus) => {
    setForm(f => ({ ...f, documentacion: { ...f.documentacion, [key]: val } }));
  };

  const handleSave = async () => {
    if (!form.clienteId) return alert('Seleccioná un cliente');
    setSaving(true);
    try {
      const payload = {
        clienteId: form.clienteId,
        clienteNombre: form.clienteNombre,
        tipo: form.tipo,
        induccion: form.induccion,
        contacto: form.contacto,
        documentacion: form.documentacion,
        notas: form.notas,
        activo: true,
      };
      if (editData) {
        await ingresoEmpresasService.update(editData.id, payload);
      } else {
        await ingresoEmpresasService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error guardando ingreso:', err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editData ? 'Editar Ingreso' : 'Nuevo Ingreso a Empresa'} maxWidth="lg">
      <div className="space-y-4 p-4">
        {/* Cliente + Tipo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Cliente *</label>
            <SearchableSelect
              value={form.clienteId}
              onChange={handleClienteChange}
              options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
              placeholder="Buscar cliente..."
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoIngresoCliente }))}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {(Object.keys(TIPO_INGRESO_LABELS) as TipoIngresoCliente[]).map(k => (
                <option key={k} value={k}>{TIPO_INGRESO_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Inducción */}
        <fieldset className="border border-slate-200 rounded-lg p-3 space-y-2">
          <legend className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">Inducción</legend>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.induccion.requerida} onChange={e => setForm(f => ({ ...f, induccion: { ...f.induccion, requerida: e.target.checked } }))} className="w-3.5 h-3.5 rounded border-slate-300 accent-teal-700" />
            Requiere inducción
          </label>
          {form.induccion.requerida && (
            <div className="grid grid-cols-3 gap-2">
              <Input label="Descripción" value={form.induccion.descripcion} onChange={e => setForm(f => ({ ...f, induccion: { ...f.induccion, descripcion: e.target.value } }))} placeholder="Ej: Presencial, obligatoria" />
              <Input label="Duración" value={form.induccion.duracion || ''} onChange={e => setForm(f => ({ ...f, induccion: { ...f.induccion, duracion: e.target.value } }))} placeholder="Ej: 1 hora" />
              <Input label="Horario" value={form.induccion.horario || ''} onChange={e => setForm(f => ({ ...f, induccion: { ...f.induccion, horario: e.target.value } }))} placeholder="Ej: Viernes 9hs" />
            </div>
          )}
        </fieldset>

        {/* Contacto */}
        <Input label="Contacto / Portal / Email" value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} placeholder="Email, URL del portal, o nombre de contacto" />

        {/* Documentación grid */}
        <fieldset className="border border-slate-200 rounded-lg p-3">
          <legend className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">Documentación Requerida</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-1">
            {DOCUMENTACION_INGRESO_KEYS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-700 min-w-[120px]">{label}</span>
                <select
                  value={form.documentacion[key]}
                  onChange={e => setDocStatus(key, e.target.value as DocumentoIngresoStatus)}
                  className={`flex-1 px-2 py-1 border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                    form.documentacion[key] === 'no_requerido' ? 'text-slate-400' : 'text-slate-800 font-medium'
                  }`}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{DOCUMENTO_INGRESO_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>

        {/* Notas */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Notas</label>
          <textarea
            value={form.notas}
            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            rows={2}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Observaciones adicionales..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 bg-[#F0F0F0] border-t border-slate-200">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : editData ? 'Guardar cambios' : 'Crear ingreso'}
        </Button>
      </div>
    </Modal>
  );
};
