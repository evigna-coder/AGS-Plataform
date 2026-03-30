import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkOrder, Part } from '@ags/shared';
import { otService } from '../services/firebaseService';

export function useOTForm(otNumber?: string) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ot, setOt] = useState<WorkOrder | null>(null);
  const hasInteracted = useRef(false);
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  const [reporteTecnico, setReporteTecnico] = useState('');
  const [problemaFallaInicial, setProblemaFallaInicial] = useState('');
  const [accionesTomar, setAccionesTomar] = useState('');
  const [materialesParaServicio, setMaterialesParaServicio] = useState('');
  const [horasTrabajadas, setHorasTrabajadas] = useState('');
  const [tiempoViaje, setTiempoViaje] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [articulos, setArticulos] = useState<Part[]>([]);
  const [aclaracionEspecialista, setAclaracionEspecialista] = useState('');
  const [aclaracionCliente, setAclaracionCliente] = useState('');
  const [status, setStatus] = useState<'BORRADOR' | 'FINALIZADO'>('BORRADOR');

  /** Populate form fields from OT data */
  const populateForm = useCallback((data: WorkOrder) => {
    setOt(data);
    setReporteTecnico(data.reporteTecnico || '');
    setProblemaFallaInicial((data as WorkOrder & { problemaFallaInicial?: string }).problemaFallaInicial || '');
    setAccionesTomar(data.accionesTomar || '');
    setMaterialesParaServicio((data as WorkOrder & { materialesParaServicio?: string }).materialesParaServicio || '');
    setHorasTrabajadas(data.horasTrabajadas || '');
    setTiempoViaje(data.tiempoViaje || '');
    setFechaInicio(data.fechaInicio || '');
    setFechaFin(data.fechaFin || '');
    setArticulos(data.articulos || []);
    setAclaracionEspecialista(data.aclaracionEspecialista || '');
    setAclaracionCliente(data.aclaracionCliente || '');
    setStatus(data.status || 'BORRADOR');
  }, []);

  // Real-time subscription to OT document
  useEffect(() => {
    if (!otNumber) return;
    setLoading(true);
    initialLoadDone.current = false;

    const unsub = otService.subscribeByOtNumber(
      otNumber,
      (data) => {
        if (!data) {
          // OT not found — redirect
          navigate('/ordenes-trabajo');
          return;
        }

        // Skip subscription updates while the user has unsaved edits
        if (dirtyRef.current) {
          // Still update the base OT object (for non-form fields like assigned engineer, etc.)
          setOt(data);
          return;
        }

        populateForm(data);

        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          setLoading(false);
        }
      },
      (err) => {
        console.error('[OTForm] Subscription error:', err);
        setLoading(false);
      },
    );

    return () => {
      unsub();
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [otNumber, navigate, populateForm]);

  // Autosave — debounce 2s
  useEffect(() => {
    if (!hasInteracted.current || !otNumber || loading) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => save(), 2000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporteTecnico, problemaFallaInicial, accionesTomar, materialesParaServicio,
      horasTrabajadas, tiempoViaje, fechaInicio, fechaFin, articulos,
      aclaracionEspecialista, aclaracionCliente]);

  const touch = () => {
    if (!hasInteracted.current) hasInteracted.current = true;
    dirtyRef.current = true;
  };

  async function save() {
    if (!otNumber) return;
    setSaving(true);
    try {
      await otService.update(otNumber, {
        reporteTecnico: reporteTecnico || '',
        ...(problemaFallaInicial ? { problemaFallaInicial } : {}),
        accionesTomar: accionesTomar || '',
        ...(materialesParaServicio ? { materialesParaServicio } : {}),
        horasTrabajadas: horasTrabajadas || '',
        tiempoViaje: tiempoViaje || '',
        fechaInicio: fechaInicio || '',
        fechaFin: fechaFin || '',
        articulos,
        aclaracionEspecialista: aclaracionEspecialista || '',
        aclaracionCliente: aclaracionCliente || '',
        status,
      });
      // Save succeeded — mark clean so subscription can update form again
      dirtyRef.current = false;
    } catch (err) {
      console.error('[OTForm] Error guardando:', err);
    } finally {
      setSaving(false);
    }
  }

  async function finalize(sigEngineer: string, sigClient: string) {
    if (!otNumber) return;
    setSaving(true);
    try {
      await otService.update(otNumber, {
        status: 'FINALIZADO',
        reporteTecnico: reporteTecnico || '',
        accionesTomar: accionesTomar || '',
        horasTrabajadas: horasTrabajadas || '',
        tiempoViaje: tiempoViaje || '',
        fechaInicio: fechaInicio || '',
        fechaFin: fechaFin || '',
        articulos,
        aclaracionEspecialista: aclaracionEspecialista || '',
        aclaracionCliente: aclaracionCliente || '',
        signatureEngineer: sigEngineer || null,
        signatureClient: sigClient || null,
      });
      // Subscription will pick up the status change and update form
      dirtyRef.current = false;
    } catch (err) {
      console.error('[OTForm] Error finalizando:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  const mk = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); touch(); };

  const addPart = () => {
    setArticulos(prev => [...prev, { id: `part-${Date.now()}`, codigo: '', descripcion: '', cantidad: 1, origen: '' }]);
    touch();
  };
  const updatePart = (id: string, field: keyof Part, value: string | number) => {
    setArticulos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    touch();
  };
  const removePart = (id: string) => { setArticulos(prev => prev.filter(p => p.id !== id)); touch(); };

  return {
    ot, loading, saving,
    status, readOnly: status === 'FINALIZADO',
    reporteTecnico, setReporteTecnico: mk(setReporteTecnico),
    problemaFallaInicial, setProblemaFallaInicial: mk(setProblemaFallaInicial),
    accionesTomar, setAccionesTomar: mk(setAccionesTomar),
    materialesParaServicio, setMaterialesParaServicio: mk(setMaterialesParaServicio),
    horasTrabajadas, setHorasTrabajadas: mk(setHorasTrabajadas),
    tiempoViaje, setTiempoViaje: mk(setTiempoViaje),
    fechaInicio, setFechaInicio: mk(setFechaInicio),
    fechaFin, setFechaFin: mk(setFechaFin),
    articulos, addPart, updatePart, removePart,
    aclaracionEspecialista, setAclaracionEspecialista: mk(setAclaracionEspecialista),
    aclaracionCliente, setAclaracionCliente: mk(setAclaracionCliente),
    save, finalize,
  };
}
