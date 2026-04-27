import { useState, useEffect } from 'react';
import { ordenesTrabajoService, tiposServicioService } from '../../services/firebaseService';
import type { WorkOrder, TipoServicio } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Props {
  open: boolean;
  parentOt: WorkOrder | null;
  onClose: () => void;
  onCreated: () => void;
}

const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';

/** Modal para crear un sub-item OT bajo un parent. Antes vivía nested en OTList.tsx. */
export const NewItemOTModal: React.FC<Props> = ({ open, parentOt, onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [form, setForm] = useState({ tipoServicio: '', descripcion: '' });

  useEffect(() => {
    if (open) tiposServicioService.getAll().then(setTiposServicio);
  }, [open]);

  const handleCreate = async () => {
    if (!parentOt) return;
    const parentBase = parentOt.otNumber.includes('.') ? parentOt.otNumber.split('.')[0] : parentOt.otNumber;
    if (!form.tipoServicio.trim()) { alert('Seleccione tipo de servicio'); return; }
    setSaving(true);
    try {
      const nextNum = await ordenesTrabajoService.getNextItemNumber(parentBase);
      const itemData: any = {
        otNumber: nextNum,
        status: 'BORRADOR' as const,
        estadoAdmin: parentOt.estadoAdmin || 'CREADA',
        estadoAdminFecha: new Date().toISOString(),
        estadoHistorial: [{ estado: 'CREADA' as const, fecha: new Date().toISOString() }],
        budgets: parentOt.budgets || [],
        ordenCompra: parentOt.ordenCompra || '',
        tipoServicio: form.tipoServicio,
        esFacturable: parentOt.esFacturable ?? true,
        tieneContrato: parentOt.tieneContrato ?? false,
        esGarantia: false,
        razonSocial: parentOt.razonSocial,
        contacto: parentOt.contacto || '',
        direccion: parentOt.direccion || '',
        localidad: parentOt.localidad || '',
        provincia: parentOt.provincia || '',
        sistema: parentOt.sistema || '',
        moduloModelo: parentOt.moduloModelo || '',
        moduloDescripcion: parentOt.moduloDescripcion || '',
        moduloSerie: parentOt.moduloSerie || '',
        codigoInternoCliente: parentOt.codigoInternoCliente || '',
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFin: new Date().toISOString().split('T')[0],
        fechaServicioAprox: parentOt.fechaServicioAprox || '',
        horasTrabajadas: '',
        tiempoViaje: '',
        reporteTecnico: form.descripcion || '',
        accionesTomar: '',
        articulos: [],
        emailPrincipal: parentOt.emailPrincipal || '',
        signatureEngineer: null,
        aclaracionEspecialista: '',
        signatureClient: null,
        aclaracionCliente: '',
        materialesParaServicio: '',
        problemaFallaInicial: parentOt.problemaFallaInicial || '',
        updatedAt: new Date().toISOString(),
        clienteId: parentOt.clienteId || null,
        sistemaId: parentOt.sistemaId || null,
        moduloId: parentOt.moduloId || null,
        ingenieroAsignadoId: parentOt.ingenieroAsignadoId || null,
        ingenieroAsignadoNombre: parentOt.ingenieroAsignadoNombre || null,
      };
      await ordenesTrabajoService.create(itemData);
      setForm({ tipoServicio: '', descripcion: '' });
      onClose();
      onCreated();
    } catch (err) {
      console.error('Error creando item OT:', err);
      alert(err instanceof Error ? err.message : 'Error al crear el item');
    }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Nuevo item para OT-${parentOt?.otNumber || ''}`}
      subtitle="Crear sub-orden de trabajo"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleCreate} disabled={saving}>
          {saving ? 'Creando...' : 'Crear Item'}
        </Button>
      </>}>
      <div className="space-y-3">
        <div>
          <label className={lbl}>Tipo de servicio *</label>
          <SearchableSelect value={form.tipoServicio}
            onChange={v => setForm(f => ({ ...f, tipoServicio: v }))}
            options={tiposServicio.map(t => ({ value: t.nombre, label: t.nombre }))}
            placeholder="Seleccionar..." />
        </div>
        <div>
          <label className={lbl}>Descripción del trabajo</label>
          <textarea value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
            rows={3} placeholder="Describa brevemente..."
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-400" />
        </div>
      </div>
    </Modal>
  );
};
