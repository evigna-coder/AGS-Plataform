import { useCallback, MutableRefObject } from 'react';
import type { Cliente, Sistema, ModuloSistema, ContactoCliente, Part, OTEstadoAdmin, UsuarioAGS } from '@ags/shared';
import { OT_ESTADO_ORDER } from '@ags/shared';
import type { OTFormState } from './useOTFormState';

interface Params {
  form: OTFormState;
  setField: <K extends keyof OTFormState>(field: K, value: OTFormState[K]) => void;
  setFields: (partial: Partial<OTFormState>) => void;
  markInteracted: () => void;
  validate: (estado?: OTEstadoAdmin) => Record<string, string>;
  dirtyRef: MutableRefObject<boolean>;
  clientes: Cliente[];
  contactos: ContactoCliente[];
  sistemasFiltrados: Sistema[];
  modulosFiltrados: ModuloSistema[];
  ingenieros: UsuarioAGS[];
}

export function useOTFieldHandlers({ form, setField, setFields, markInteracted, validate, dirtyRef, clientes, contactos, sistemasFiltrados, modulosFiltrados, ingenieros }: Params) {
  const dirty = () => { dirtyRef.current = true; };

  const handleFieldChange = useCallback((field: string, value: string) => {
    dirty(); markInteracted(); setField(field as keyof OTFormState, value as any);
  }, [markInteracted, setField]);

  const handleCheckboxChange = useCallback((field: string, checked: boolean) => {
    dirty(); markInteracted(); setField(field as keyof OTFormState, checked as any);
  }, [markInteracted, setField]);

  const handleClienteChange = useCallback((id: string) => {
    const c = clientes.find(cl => cl.id === id);
    if (!c) return;
    dirty();
    setFields({
      clienteId: id, razonSocial: c.razonSocial,
      direccion: c.direccion || '', localidad: c.localidad || '', provincia: c.provincia || '',
      sistemaId: undefined, moduloId: undefined,
      sistemaNombre: '', moduloModelo: '', moduloDescripcion: '', moduloSerie: '',
    });
    markInteracted();
  }, [clientes, setFields, markInteracted]);

  const handleContactoChange = useCallback((id: string) => {
    const c = contactos.find(ct => ct.id === id);
    if (c) { dirty(); setFields({ contacto: c.nombre, emailPrincipal: c.email || '' }); markInteracted(); }
  }, [contactos, setFields, markInteracted]);

  const handleSistemaChange = useCallback((id: string) => {
    const s = sistemasFiltrados.find(si => si.id === id);
    if (!s) return;
    dirty();
    setFields({ sistemaId: id, sistemaNombre: s.nombre, codigoInternoCliente: s.codigoInternoCliente, moduloId: undefined });
    markInteracted();
  }, [sistemasFiltrados, setFields, markInteracted]);

  const handleModuloChange = useCallback((id: string) => {
    const m = modulosFiltrados.find(mo => mo.id === id);
    if (m) { dirty(); setFields({ moduloId: id, moduloModelo: m.nombre || '', moduloDescripcion: m.descripcion || '', moduloSerie: m.serie || '' }); markInteracted(); }
  }, [modulosFiltrados, setFields, markInteracted]);

  const handleIngenieroChange = useCallback((uid: string) => {
    const u = ingenieros.find(i => i.id === uid);
    dirty();
    setFields({ ingenieroAsignadoId: u?.id ?? null, ingenieroAsignadoNombre: u?.displayName ?? null });
    markInteracted();
  }, [ingenieros, setFields, markInteracted]);

  // ── Estado admin ──────────────────────────────────────────────
  const handleEstadoAdminChange = useCallback((nuevoEstado: OTEstadoAdmin) => {
    const currentIdx = OT_ESTADO_ORDER.indexOf(form.estadoAdmin);
    const targetIdx = OT_ESTADO_ORDER.indexOf(nuevoEstado);
    if (targetIdx > currentIdx) {
      const errors = validate(nuevoEstado);
      if (Object.keys(errors).length > 0) { alert('No se puede avanzar el estado:\n' + Object.values(errors).join('\n')); return; }
    }
    const ahora = new Date().toISOString();
    dirty();
    setFields({
      estadoAdmin: nuevoEstado, estadoAdminFecha: ahora,
      estadoHistorial: [...form.estadoHistorial, { estado: nuevoEstado, fecha: ahora }],
      ...(nuevoEstado === 'FINALIZADO' ? { status: 'FINALIZADO' as const } : {}),
    });
    markInteracted();
  }, [form.estadoAdmin, form.estadoHistorial, setFields, markInteracted, validate]);

  // ── Cierre administrativo ─────────────────────────────────────
  const handleCierreChange = useCallback((field: string, value: any) => {
    dirty(); setField('cierreAdmin', { ...form.cierreAdmin, [field]: value }); markInteracted();
  }, [form.cierreAdmin, setField, markInteracted]);

  // ── Reabrir OT ──────────────────────────────────────────────
  const handleReabrirOT = useCallback(() => {
    if (!window.confirm('Reabrir esta OT? Volvera al estado Cierre Administrativo.')) return;
    const ahora = new Date().toISOString();
    dirty();
    setFields({
      estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin,
      estadoAdminFecha: ahora,
      status: 'BORRADOR' as const,
      estadoHistorial: [...form.estadoHistorial, { estado: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin, fecha: ahora, nota: 'Reabierta desde Finalizado' }],
      cierreAdmin: { ...form.cierreAdmin, avisoAdminEnviado: false, fechaCierreAdmin: undefined },
    });
    markInteracted();
  }, [form.estadoHistorial, form.cierreAdmin, setFields, markInteracted]);

  // ── Parts ─────────────────────────────────────────────────────
  const addPart = useCallback((prefill?: { codigo: string; descripcion: string }) => {
    dirty();
    setField('articulos', [...form.articulos, {
      id: `part-${Date.now()}`, codigo: prefill?.codigo || '', descripcion: prefill?.descripcion || '', cantidad: 1, origen: prefill ? 'stock' : '',
    }]);
    markInteracted();
  }, [form.articulos, setField, markInteracted]);

  const updatePart = useCallback((id: string, field: keyof Part, value: any) => {
    dirty(); setField('articulos', form.articulos.map(p => p.id === id ? { ...p, [field]: value } : p)); markInteracted();
  }, [form.articulos, setField, markInteracted]);

  const removePart = useCallback((id: string) => {
    dirty(); setField('articulos', form.articulos.filter(p => p.id !== id)); markInteracted();
  }, [form.articulos, setField, markInteracted]);

  // ── Budgets ───────────────────────────────────────────────────
  const addBudget = useCallback(() => { dirty(); setField('budgets', [...form.budgets, '']); markInteracted(); }, [form.budgets, setField, markInteracted]);
  const updateBudget = useCallback((idx: number, val: string) => {
    dirty(); const u = [...form.budgets]; u[idx] = val.substring(0, 15); setField('budgets', u); markInteracted();
  }, [form.budgets, setField, markInteracted]);
  const removeBudget = useCallback((idx: number) => {
    dirty(); setField('budgets', form.budgets.length > 1 ? form.budgets.filter((_, i) => i !== idx) : ['']); markInteracted();
  }, [form.budgets, setField, markInteracted]);

  return {
    handleFieldChange, handleCheckboxChange,
    handleClienteChange, handleContactoChange, handleSistemaChange, handleModuloChange, handleIngenieroChange,
    handleEstadoAdminChange, handleCierreChange, handleReabrirOT,
    addPart, updatePart, removePart,
    addBudget, updateBudget, removeBudget,
  };
}
