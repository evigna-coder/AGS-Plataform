import { useEffect, useMemo, useState } from 'react';
import { TICKET_AREA_LABELS, getUserTicketAreas } from '@ags/shared';
import type { TicketArea, Proveedor, UsuarioAGS } from '@ags/shared';
import { proveedoresService, usuariosService } from '../../services/firebaseService';
import { facturasService } from '../../services/facturasService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

interface CargarFacturaModalProps {
  onClose: () => void;
  onCreated?: () => void;
}

const labelClass = 'text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1 block';
const selectClass = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';
// El área 'sistema' es de pasaje (sin responsable), no se ofrece como destino.
const AREAS = (Object.keys(TICKET_AREA_LABELS) as TicketArea[]).filter(a => a !== 'sistema');

export const CargarFacturaModal = ({ onClose, onCreated }: CargarFacturaModalProps) => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [proveedorValue, setProveedorValue] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [areaDestino, setAreaDestino] = useState<TicketArea | ''>('');
  const [responsableId, setResponsableId] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([proveedoresService.getAll(true), usuariosService.getAll()])
      .then(([p, u]) => { setProveedores(p); setUsuarios(u.filter(x => x.status === 'activo')); })
      .catch(err => console.error('Error cargando datos de carga de factura:', err));
  }, []);

  const proveedorOptions = useMemo(
    () => proveedores.map(p => ({ value: p.id, label: p.nombre })),
    [proveedores],
  );

  const responsablesOptions = useMemo(() => usuarios.filter(u => {
    if (!areaDestino) return true;
    if (u.role === 'admin') return true;
    return getUserTicketAreas(u).includes(areaDestino);
  }), [usuarios, areaDestino]);

  const handleFile = (files: FileList | null) => {
    const f = files?.[0] ?? null;
    if (f && f.type !== 'application/pdf') {
      setErrors(prev => ({ ...prev, pdf: 'El archivo debe ser un PDF' }));
      setPdfFile(null);
      return;
    }
    setErrors(prev => ({ ...prev, pdf: '' }));
    setPdfFile(f);
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!proveedorValue.trim()) errs.proveedor = 'Obligatorio';
    if (!pdfFile) errs.pdf = 'Adjuntá el PDF';
    if (!areaDestino) errs.area = 'Obligatorio';
    if (!responsableId) errs.responsable = 'Obligatorio';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // El SearchableSelect creatable emite el id (si eligió del catálogo) o el texto
    // libre tipeado. Distinguimos por coincidencia con una opción del catálogo.
    const matched = proveedores.find(p => p.id === proveedorValue);
    const responsable = usuarios.find(u => u.id === responsableId);

    setSaving(true);
    try {
      await facturasService.crearConTicket({
        proveedorId: matched ? matched.id : null,
        proveedorNombre: matched ? matched.nombre : proveedorValue.trim(),
        pdfFile: pdfFile!,
        areaDestino: areaDestino as TicketArea,
        responsableId,
        responsableNombre: responsable?.displayName ?? '',
      });
      onCreated?.();
      onClose();
    } catch (err) {
      console.error('Error al cargar la factura:', err);
      alert('Error al cargar la factura');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Cargar factura" subtitle="Control de facturas a pagar" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Proveedor *</label>
          <SearchableSelect
            value={proveedorValue}
            onChange={setProveedorValue}
            options={proveedorOptions}
            placeholder="Buscar o escribir proveedor..."
            creatable
            createLabel="Usar proveedor nuevo"
          />
          {errors.proveedor && <p className="text-xs text-red-600 mt-0.5">{errors.proveedor}</p>}
        </div>

        <div>
          <label className={labelClass}>PDF de la factura *</label>
          <input type="file" accept="application/pdf" onChange={e => handleFile(e.target.files)}
            className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100" />
          {pdfFile && <p className="text-[11px] text-slate-500 mt-1 truncate">{pdfFile.name}</p>}
          {errors.pdf && <p className="text-xs text-red-600 mt-0.5">{errors.pdf}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Área destino *</label>
            <select value={areaDestino} onChange={e => { setAreaDestino(e.target.value as TicketArea | ''); setResponsableId(''); }} className={selectClass}>
              <option value="">Seleccionar...</option>
              {AREAS.map(a => <option key={a} value={a}>{TICKET_AREA_LABELS[a]}</option>)}
            </select>
            {errors.area && <p className="text-xs text-red-600 mt-0.5">{errors.area}</p>}
          </div>
          <div>
            <label className={labelClass}>Responsable *</label>
            <select value={responsableId} onChange={e => setResponsableId(e.target.value)} className={selectClass}>
              <option value="">Seleccionar...</option>
              {responsablesOptions.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </select>
            {errors.responsable && <p className="text-xs text-red-600 mt-0.5">{errors.responsable}</p>}
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Al cargar se deriva un ticket al responsable elegido para validar y pagar la factura.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Cargando...' : 'Cargar factura'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
