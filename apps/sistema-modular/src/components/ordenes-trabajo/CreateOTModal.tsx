import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ordenesTrabajoService, clientesService, sistemasService, tiposServicioService, contactosService } from '../../services/firebaseService';
import type { Cliente, Sistema, TipoServicio, ContactoCliente } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateOTModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [nextOtNumber, setNextOtNumber] = useState('');

  const [form, setForm] = useState({
    clienteId: '', sistemaId: '', tipoServicioId: '', contactoId: '',
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      clientesService.getAll(true), sistemasService.getAll(), tiposServicioService.getAll(),
      ordenesTrabajoService.getNextOtNumber(),
    ]).then(([c, s, ts, otNum]) => {
      setClientes(c); setSistemas(s); setTiposServicio(ts); setNextOtNumber(otNum);
    });
  }, [open]);

  useEffect(() => {
    if (form.clienteId) {
      setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
      contactosService.getByCliente(form.clienteId).then(setContactos).catch(() => setContactos([]));
    } else {
      setSistemasFiltrados([]); setContactos([]);
    }
  }, [form.clienteId, sistemas]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleClose = () => {
    onClose();
    setForm({ clienteId: '', sistemaId: '', tipoServicioId: '', contactoId: '' });
  };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Seleccione un cliente'); return; }
    if (!form.sistemaId) { alert('Seleccione un sistema'); return; }
    if (!form.tipoServicioId) { alert('Seleccione un tipo de servicio'); return; }

    const cliente = clientes.find(c => c.id === form.clienteId);
    const sistema = sistemasFiltrados.find(s => s.id === form.sistemaId);
    const tipoServ = tiposServicio.find(t => t.id === form.tipoServicioId);
    const contacto = contactos.find(c => c.id === form.contactoId);

    if (!cliente || !sistema || !tipoServ) { alert('Datos incompletos'); return; }

    setSaving(true);
    try {
      const otData = {
        otNumber: nextOtNumber,
        status: 'BORRADOR' as const,
        budgets: [],
        tipoServicio: tipoServ.nombre,
        esFacturable: true,
        tieneContrato: false,
        esGarantia: false,
        razonSocial: cliente.razonSocial,
        contacto: contacto?.nombre ?? '',
        direccion: '',
        localidad: '',
        provincia: '',
        sistema: sistema.nombre,
        moduloModelo: '',
        moduloDescripcion: '',
        moduloSerie: '',
        codigoInternoCliente: sistema.codigoInternoCliente ?? '',
        fechaInicio: new Date().toISOString().slice(0, 10),
        fechaFin: '',
        horasTrabajadas: '',
        tiempoViaje: '',
        reporteTecnico: '',
        accionesTomar: '',
        articulos: [],
        emailPrincipal: '',
        signatureEngineer: null,
        aclaracionEspecialista: '',
        signatureClient: null,
        aclaracionCliente: '',
        updatedAt: new Date().toISOString(),
        clienteId: form.clienteId,
        sistemaId: form.sistemaId,
      };
      await ordenesTrabajoService.create(otData);
      handleClose();
      onCreated();
      navigate(`/ordenes-trabajo/${nextOtNumber}`);
    } catch { alert('Error al crear la orden de trabajo'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";

  return (
    <Modal open={open} onClose={handleClose} title="Nueva orden de trabajo"
      subtitle={nextOtNumber ? `OT #${nextOtNumber}` : 'Generando numero...'}
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !nextOtNumber}>
          {saving ? 'Creando...' : 'Crear OT'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={lbl}>Cliente *</label>
          <SearchableSelect value={form.clienteId}
            onChange={v => { set('clienteId', v); set('sistemaId', ''); set('contactoId', ''); }}
            options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
            placeholder="Seleccionar cliente..." />
        </div>

        {form.clienteId && (
          <>
            <div>
              <label className={lbl}>Sistema / Equipo *</label>
              <SearchableSelect value={form.sistemaId}
                onChange={v => set('sistemaId', v)}
                options={sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))}
                placeholder="Seleccionar sistema..." />
            </div>

            <div>
              <label className={lbl}>Tipo de servicio *</label>
              <SearchableSelect value={form.tipoServicioId}
                onChange={v => set('tipoServicioId', v)}
                options={tiposServicio.map(t => ({ value: t.id, label: t.nombre }))}
                placeholder="Seleccionar tipo..." />
            </div>

            {contactos.length > 0 && (
              <div>
                <label className={lbl}>Contacto</label>
                <SearchableSelect value={form.contactoId}
                  onChange={v => set('contactoId', v)}
                  options={[
                    { value: '', label: 'Sin contacto especifico' },
                    ...contactos.map(c => ({ value: c.id, label: `${c.nombre}${c.cargo ? ` — ${c.cargo}` : ''}` })),
                  ]}
                  placeholder="Seleccionar contacto..." />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
