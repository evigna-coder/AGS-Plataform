import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { dispositivosService, normalizarIdInterno } from '../../services/firebaseService';
import type { Dispositivo, TipoDispositivo, EntornoDispositivo } from '@ags/shared';
import { EntornosEditor } from './EntornosEditor';
import { DispositivoGaleria } from './DispositivoGaleria';
import type { FotoAdicionalDispositivo } from '@ags/shared';

import { notify } from '../../utils/notify';
import { Select } from '../ui/Select';
interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: Dispositivo | null;
  /** Nombres de software ya cargados en otros equipos, para sugerir al tipear. */
  sugerenciasSoftware?: string[];
}

const TIPO_OPTIONS: { value: TipoDispositivo; label: string }[] = [
  { value: 'celular', label: 'Celular' },
  { value: 'computadora', label: 'Computadora' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'otro', label: 'Otro' },
];

const getEmpty = () => ({
  codigoInterno: '',
  tipo: 'celular' as TipoDispositivo,
  marca: '',
  modelo: '',
  serie: '',
  descripcion: '',
  passwordWindows: '',
  tieneGPIB: false,
  gpibDetalle: '',
  entornos: [] as EntornoDispositivo[],
  fotosAdicionales: [] as FotoAdicionalDispositivo[],
});

/** Frente y dorso viejos pasan a la galería única (2026-10-01). */
function galeriaDe(d: Dispositivo): FotoAdicionalDispositivo[] {
  const viejas = [[d.fotoFrenteUrl, d.fotoFrentePath], [d.fotoDorsoUrl, d.fotoDorsoPath]]
    .filter(([url, path]) => url && path)
    .map(([url, path]) => ({ id: path as string, url: url as string, path: path as string }));
  return [...viejas, ...(d.fotosAdicionales ?? [])];
}
/** Al guardar la galería, frente/dorso quedan vacíos (ya están dentro de la lista). */
const SIN_FRENTE_DORSO = { fotoFrenteUrl: null, fotoFrentePath: null, fotoDorsoUrl: null, fotoDorsoPath: null };

export const DispositivoModal: React.FC<Props> = ({ open, onClose, onSaved, editData, sugerenciasSoftware = [] }) => {
  const [form, setForm] = useState(getEmpty());
  const [saving, setSaving] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVerPassword(false);
    if (editData) {
      setForm({
        tipo: editData.tipo,
        marca: editData.marca,
        modelo: editData.modelo,
        serie: editData.serie,
        codigoInterno: editData.codigoInterno ?? '',
        descripcion: editData.descripcion ?? '',
        passwordWindows: editData.passwordWindows ?? '',
        tieneGPIB: editData.tieneGPIB === true,
        gpibDetalle: editData.gpibDetalle ?? '',
        entornos: editData.entornos ?? [],
        fotosAdicionales: galeriaDe(editData),
      });
    } else {
      setForm(getEmpty());
    }
  }, [open, editData]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  /** La foto se sube apenas se elige: el path ya está en Storage y hay que
   *  persistirlo aunque el usuario cierre sin apretar Guardar. */
  const setFotos = async (fotos: FotoAdicionalDispositivo[]) => {
    setForm(prev => ({ ...prev, fotosAdicionales: fotos }));
    if (editData) {
      await dispositivosService.update(editData.id, { fotosAdicionales: fotos, ...SIN_FRENTE_DORSO }).catch(err => {
        console.error('[DispositivoModal] no se pudieron guardar las fotos:', err);
        notify.error('La foto se subió pero no se pudo guardar en el dispositivo');
      });
      onSaved();
    }
  };

  const payload = () => ({
    tipo: form.tipo,
    marca: form.marca.trim(),
    modelo: form.modelo.trim(),
    serie: form.serie.trim(),
    codigoInterno: normalizarIdInterno(form.codigoInterno),
    descripcion: form.descripcion.trim() || null,
    passwordWindows: form.passwordWindows.trim() || null,
    tieneGPIB: form.tieneGPIB,
    gpibDetalle: form.tieneGPIB ? (form.gpibDetalle.trim() || null) : null,
    // Se descartan las líneas vacías: un renglón sin nombre no aporta y ensucia
    // la búsqueda de software.
    entornos: form.entornos
      .filter(e => e.nombre.trim() || (e.software ?? []).some(s => s.nombre.trim()))
      .map(e => ({ ...e, software: (e.software ?? []).filter(s => s.nombre.trim()) })),
    ...SIN_FRENTE_DORSO,
    fotosAdicionales: form.fotosAdicionales,
  });

  const handleSave = async () => {
    if (!form.marca.trim() || !form.modelo.trim()) {
      notify.warning('Complete marca y modelo');
      return;
    }
    // ID interno (2026-10-01): libre, con un guion en el medio, y sin repetir.
    if (form.codigoInterno.trim()) {
      const id = normalizarIdInterno(form.codigoInterno);
      if (!id) { notify.warning('El ID lleva un guion en el medio, por ejemplo AGS-B16 o NOT-12'); return; }
      const otro = await dispositivosService.buscarPorIdInterno(id, editData?.id).catch(() => null);
      if (otro) { notify.warning(`${id} ya lo tiene ${otro.marca} ${otro.modelo}${otro.serie ? ` (${otro.serie})` : ''}`); return; }
    }
    setSaving(true);
    try {
      if (editData) {
        await dispositivosService.update(editData.id, payload());
      } else {
        await dispositivosService.create({
          ...payload(), asignadoAId: null, asignadoANombre: null, activo: true,
        });
      }
      onClose();
      onSaved();
    } catch {
      notify.error('Error al guardar el dispositivo');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { onClose(); setForm(getEmpty()); };
  const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';
  const esComputadora = form.tipo === 'computadora';

  return (
    <Modal open={open} onClose={handleClose} maxWidth="lg"
      title={editData ? `Editar dispositivo${editData.codigoInterno ? ` · ${editData.codigoInterno}` : ''}` : 'Nuevo dispositivo'}
      subtitle="Celulares, computadoras, tablets y otros dispositivos."
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : editData ? 'Guardar cambios' : 'Crear dispositivo'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={lbl}>Tipo</label>
          <Select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="w-full">
            {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Marca *" value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Ej: Samsung" />
          <Input inputSize="sm" label="Modelo *" value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Ej: Galaxy S24" />
        </div>
        <Input inputSize="sm" label="ID interno" value={form.codigoInterno} onChange={e => set('codigoInterno', e.target.value)}
          onBlur={() => { const n = normalizarIdInterno(form.codigoInterno); if (n) set('codigoInterno', n); }}
          placeholder="AGS-B16" className="font-mono" />
        <Input inputSize="sm" label="Numero de serie" value={form.serie} onChange={e => set('serie', e.target.value)} placeholder="S/N" />
        <Input inputSize="sm" label="Descripcion" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Notas adicionales..." />

        <div className="border-t border-slate-100 pt-3">
          <DispositivoGaleria dispositivoId={editData?.id ?? null}
            fotos={form.fotosAdicionales} onChange={fotos => void setFotos(fotos)} />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <label className={lbl}>Contraseña de Windows</label>
          <div className="flex gap-2">
            <input
              type={verPassword ? 'text' : 'password'}
              value={form.passwordWindows}
              onChange={e => set('passwordWindows', e.target.value)}
              placeholder="Para poder entrar al equipo"
              className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <Button variant="outline" size="sm" onClick={() => setVerPassword(v => !v)}>
              {verPassword ? 'Ocultar' : 'Ver'}
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            La ve cualquiera con acceso al módulo Dispositivos.
          </p>
        </div>

        {esComputadora && (
          <div className="border-t border-slate-100 pt-3">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={form.tieneGPIB}
                onChange={e => set('tieneGPIB', e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              Tiene placa GPIB
            </label>
            <p className="text-[10px] text-slate-400 mt-0.5 ml-6">
              Placa adicional para conectar instrumentos viejos.
            </p>
            {form.tieneGPIB && (
              <div className="mt-2 ml-6">
                <Input inputSize="sm" label="Detalle de la placa" value={form.gpibDetalle}
                  onChange={e => set('gpibDetalle', e.target.value)}
                  placeholder="Ej: Agilent 82357B USB-GPIB" />
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-100 pt-3">
          <EntornosEditor
            entornos={form.entornos}
            sugerencias={sugerenciasSoftware}
            onChange={entornos => set('entornos', entornos)}
          />
        </div>
      </div>
    </Modal>
  );
};
