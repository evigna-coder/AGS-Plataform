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
  // Default 'ilimitado' (decisión 2026-07-30: la gran mayoría de los contratos
  // son ilimitados; los de N visitas se ajustan a mano).
  tipoLimite: 'ilimitado', maxVisitas: '10',
  serviciosIncluidos: [], sistemaIds: [], notas: '',
};

/** Prefill del puente P5→Contrato: al aceptar un presupuesto tipo contrato se
 *  abre este modal PRE-CARGADO desde el presupuesto (cliente, vigencia, equipos
 *  detallados en los items). Servicios incluidos y límite los confirma el usuario. */
export interface ContratoPrefill {
  presupuestoId: string;
}

export function useCreateContratoForm(open: boolean, onClose: () => void, onCreated?: () => void, prefill?: ContratoPrefill | null) {
  const [saving, setSaving] = useState(false);
  const [prefillAplicado, setPrefillAplicado] = useState(false);
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

  // Puente P5→Contrato: precargar desde el presupuesto aceptado.
  useEffect(() => {
    if (!open) { setPrefillAplicado(false); return; }
    if (!prefill?.presupuestoId || prefillAplicado) return;
    setPrefillAplicado(true);
    presupuestosService.getById(prefill.presupuestoId).then(p => {
      if (!p) return;
      const sistemaIds = Array.from(new Set(
        (p.items ?? []).map(i => i.sistemaId).filter((x): x is string => !!x),
      ));
      // Ítem de visitas del contrato (unidad 'visitas'): su cantidad ES el
      // límite de visitas → pre-cargar tipoLimite/maxVisitas. Sin él: ilimitado.
      const itemVisitas = (p.items ?? []).find(i => (i.unidad || '').trim().toLowerCase() === 'visitas');
      setForm(prev => ({
        ...prev,
        clienteId: p.clienteId,
        presupuestoId: p.id,
        fechaInicio: p.contratoFechaInicio ? p.contratoFechaInicio.split('T')[0] : prev.fechaInicio,
        fechaFin: p.contratoFechaFin ? p.contratoFechaFin.split('T')[0] : prev.fechaFin,
        sistemaIds,
        ...(itemVisitas && itemVisitas.cantidad > 0
          ? { tipoLimite: 'visitas' as const, maxVisitas: String(itemVisitas.cantidad) }
          : {}),
      }));
    }).catch(err => console.error('[useCreateContratoForm] prefill desde presupuesto falló:', err));
  }, [open, prefill?.presupuestoId, prefillAplicado]);

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
