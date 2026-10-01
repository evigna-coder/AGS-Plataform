import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PosicionComex, PresupuestoComex } from '@ags/shared';
import { presupuestosComexService } from '../services/presupuestosComexService';
import { calcularPresupuestoComex, GASTOS_DEFAULT, posicionVacia } from '../utils/presupuestoComex';
import { notify } from '../utils/notify';

const hoy = () => new Date().toLocaleDateString('en-CA');

function vacio(): PresupuestoComex {
  return {
    id: '', numero: '', titulo: '', cliente: null, fecha: hoy(),
    posiciones: [posicionVacia()],
    gastos: GASTOS_DEFAULT.map(g => ({ ...g, id: crypto.randomUUID() })),
    gastosBancarios: 0, costoFinancieroPct: 3, tipoCambio: null, notas: null,
    createdAt: '', updatedAt: '',
  };
}

/** Estado y guardado del presupuesto de comex (2026-10-01). `id` vacío = nuevo. */
export function usePresupuestoComexForm(id: string | undefined) {
  const [form, setForm] = useState<PresupuestoComex>(vacio);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [sucio, setSucio] = useState(false);

  useEffect(() => {
    if (!id) { setForm(vacio()); setLoading(false); return; }
    let vivo = true;
    setLoading(true);
    presupuestosComexService.getById(id)
      .then(p => { if (vivo && p) setForm(p); })
      .catch(err => { console.error('[usePresupuestoComexForm]', err); notify.error('No se pudo cargar el presupuesto'); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [id]);

  const set = useCallback(<K extends keyof PresupuestoComex>(k: K, v: PresupuestoComex[K]) => {
    setForm(prev => ({ ...prev, [k]: v })); setSucio(true);
  }, []);
  const setPosicion = useCallback((posId: string, patch: Partial<PosicionComex>) => {
    setForm(prev => ({ ...prev, posiciones: prev.posiciones.map(x => (x.id === posId ? { ...x, ...patch } : x)) })); setSucio(true);
  }, []);
  const agregarPosicion = useCallback(() => {
    setForm(prev => ({ ...prev, posiciones: [...prev.posiciones, posicionVacia()] })); setSucio(true);
  }, []);
  const quitarPosicion = useCallback((posId: string) => {
    setForm(prev => ({ ...prev, posiciones: prev.posiciones.filter(x => x.id !== posId) })); setSucio(true);
  }, []);

  const resultado = useMemo(() => calcularPresupuestoComex(form), [form]);

  /** Guarda y devuelve el id (nuevo o el mismo). */
  const guardar = useCallback(async (): Promise<string | null> => {
    if (!form.titulo.trim()) { notify.warning('Poné un título (ej.: "Cromatógrafo 7890B + SCD")'); return null; }
    setSaving(true);
    try {
      const { id: _id, numero: _n, createdAt: _c, updatedAt: _u, createdByName: _b, ...datos } = form;
      const limpio = { ...datos, titulo: datos.titulo.trim(), cliente: datos.cliente?.trim() || null, notas: datos.notas?.trim() || null };
      if (form.id) {
        await presupuestosComexService.update(form.id, limpio);
        setSucio(false);
        notify.success(`${form.numero} guardado`);
        return form.id;
      }
      const nuevoId = await presupuestosComexService.create(limpio);
      const creado = await presupuestosComexService.getById(nuevoId);
      if (creado) setForm(creado);
      setSucio(false);
      notify.success(`${creado?.numero ?? 'Presupuesto'} creado`);
      return nuevoId;
    } catch (err) {
      console.error('[usePresupuestoComexForm] guardar', err);
      notify.error('No se pudo guardar el presupuesto');
      return null;
    } finally {
      setSaving(false);
    }
  }, [form]);

  return { form, set, setPosicion, agregarPosicion, quitarPosicion, resultado, loading, saving, sucio, guardar };
}
