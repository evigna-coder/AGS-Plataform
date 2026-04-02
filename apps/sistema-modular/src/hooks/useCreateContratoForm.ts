import { useState, useEffect } from 'react';
import { contratosService, clientesService, sistemasService, presupuestosService } from '../services/firebaseService';
import { tiposServicioService } from '../services/importacionesService';
import type { Cliente, Sistema, Presupuesto, TipoServicio, TipoLimiteContrato, ServicioContrato } from '@ags/shared';

export interface ContratoFormState {
  clienteId: string;
  presupuestoId: string;
  fechaInicio: string;
  fechaFin: string;
  tipoLimite: TipoLimiteContrato;
  maxVisitas: string;
  serviciosIncluidos: ServicioContrato[];
  sistemaIds: string[];
  notas: string;
}

const INITIAL_FORM: ContratoFormState = {
  clienteId: '', presupuestoId: '',
  fechaInicio: '', fechaFin: '',
  tipoLimite: 'visitas', maxVisitas: '10',
  serviciosIncluidos: [], sistemaIds: [], notas: '',
};

export function useCreateContratoForm(open: boolean, onClose: () => void, onCreated?: () => void) {
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [sistemasFiltrados, setSistemasFiltrados] = useState<Sistema[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [form, setForm] = useState<ContratoFormState>(INITIAL_FORM);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      clientesService.getAll(true),
      sistemasService.getAll(),
      tiposServicioService.getAll(),
    ]).then(([c, s, ts]) => {
      setClientes(c);
      setSistemas(s);
      setTiposServicio(ts.filter(t => t.activo));
    });
  }, [open]);

  // Filter sistemas and presupuestos by client
  useEffect(() => {
    if (!form.clienteId) {
      setSistemasFiltrados([]);
      setPresupuestos([]);
      return;
    }
    setSistemasFiltrados(sistemas.filter(s => s.clienteId === form.clienteId));
    presupuestosService.getAll({ clienteId: form.clienteId }).then(ps => {
      setPresupuestos(ps.filter(p => p.tipo === 'contrato' && p.estado !== 'anulado'));
    });
  }, [form.clienteId, sistemas]);

  const toggleServicio = (ts: TipoServicio) => {
    setForm(prev => {
      const exists = prev.serviciosIncluidos.some(s => s.tipoServicioId === ts.id);
      if (exists) {
        return { ...prev, serviciosIncluidos: prev.serviciosIncluidos.filter(s => s.tipoServicioId !== ts.id) };
      }
      return { ...prev, serviciosIncluidos: [...prev.serviciosIncluidos, { tipoServicioId: ts.id, tipoServicioNombre: ts.nombre }] };
    });
  };

  const toggleSistema = (sistemaId: string) => {
    setForm(prev => {
      const exists = prev.sistemaIds.includes(sistemaId);
      return { ...prev, sistemaIds: exists ? prev.sistemaIds.filter(id => id !== sistemaId) : [...prev.sistemaIds, sistemaId] };
    });
  };

  const handleClose = () => { onClose(); setForm(INITIAL_FORM); };

  const handleSave = async () => {
    if (!form.clienteId) { alert('Seleccione un cliente'); return; }
    if (!form.fechaInicio || !form.fechaFin) { alert('Ingrese fechas de vigencia'); return; }
    if (form.serviciosIncluidos.length === 0) { alert('Seleccione al menos un servicio'); return; }

    try {
      setSaving(true);
      const cliente = clientes.find(c => c.id === form.clienteId);
      const presupuesto = presupuestos.find(p => p.id === form.presupuestoId);

      await contratosService.create({
        clienteId: form.clienteId,
        clienteNombre: cliente?.razonSocial || '',
        sistemaIds: form.sistemaIds,
        presupuestoId: form.presupuestoId || null,
        presupuestoNumero: presupuesto?.numero || null,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        estado: 'activo',
        serviciosIncluidos: form.serviciosIncluidos,
        tipoLimite: form.tipoLimite,
        maxVisitas: form.tipoLimite === 'ilimitado' ? null : Number(form.maxVisitas) || 10,
        visitasUsadas: 0,
        notas: form.notas || null,
      });

      handleClose();
      onCreated?.();
    } catch (err) {
      console.error('Error creando contrato:', err);
      alert('Error al crear el contrato');
    } finally {
      setSaving(false);
    }
  };

  return {
    saving, form, setForm, handleClose, handleSave,
    clientes, sistemasFiltrados, presupuestos, tiposServicio,
    toggleServicio, toggleSistema,
  };
}
