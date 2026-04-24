/**
 * FLOW-07: Configuración de flujos automáticos.
 *
 * Rol admin gated en TabContentManager.
 *
 * Campos:
 *  - usuarioSeguimientoId (FLOW-01): auto-ticket de seguimiento al enviado.
 *  - usuarioCoordinadorOTId (FLOW-02): notificación post-cargaOC.
 *  - usuarioResponsableComexId (FLOW-03, opcional): derivación Importaciones.
 *  - mailFacturacion (FLOW-04): destinatario del aviso al cierre admin.
 *
 * Validación al guardar: cada usuarioXxxId seleccionado debe tener status === 'activo'
 * y existir en /usuarios. Mail debe contener '@'.
 *
 * Submit usa adminConfigService.update(data, uid, name) — no auto-save.
 */
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Card } from '../../components/ui/Card';
import { adminConfigService } from '../../services/adminConfigService';
import { usuariosService } from '../../services/personalService';
import { useAuth } from '../../contexts/AuthContext';
import type { AdminConfigFlujos, UsuarioAGS } from '@ags/shared';

const EMPTY_COMEX_OPTION = { value: '', label: '(Sin usuario fijo — derivar por área)' };

export default function ConfigFlujosPage() {
  const { firebaseUser, usuario } = useAuth();
  const [form, setForm] = useState<Partial<AdminConfigFlujos>>({ mailFacturacion: '' });
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, allUsuarios] = await Promise.all([
          adminConfigService.getWithDefaults(),
          usuariosService.getAll(),
        ]);
        if (cancelled) return;
        setForm(cfg);
        // Solo usuarios activos aparecen en el dropdown — inactivos invisibles.
        setUsuarios(allUsuarios.filter(u => u.status === 'activo'));
      } catch (err: any) {
        if (!cancelled) setError(`Error cargando configuración: ${err?.message || err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const buildUserOptions = (includeEmpty: boolean) => {
    const opts = usuarios.map(u => ({
      value: u.id,
      label: `${u.displayName} (${u.email})`,
    }));
    return includeEmpty ? [EMPTY_COMEX_OPTION, ...opts] : opts;
  };

  const validateUserActive = (label: string, userId: string | null | undefined): string | null => {
    if (!userId) return null; // campo opcional
    const u = usuarios.find(x => x.id === userId);
    if (!u) return `Usuario ${label} no encontrado`;
    if (u.status !== 'activo') return `Usuario ${label} no está activo (status=${u.status})`;
    return null;
  };

  const handleSave = async () => {
    if (!firebaseUser) {
      setError('No autenticado');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Validar cada usuario seleccionado esté activo.
      for (const [label, userId] of [
        ['Seguimiento comercial', form.usuarioSeguimientoId],
        ['Coordinador OT', form.usuarioCoordinadorOTId],
        ['Responsable Comex', form.usuarioResponsableComexId],
        ['Responsable Materiales', form.usuarioMaterialesId],
      ] as const) {
        const err = validateUserActive(label, userId);
        if (err) throw new Error(err);
      }
      // Validar mail básico.
      if (!form.mailFacturacion || !form.mailFacturacion.includes('@')) {
        throw new Error('Mail facturación debe contener "@"');
      }
      await adminConfigService.update(
        {
          usuarioSeguimientoId: form.usuarioSeguimientoId || null,
          usuarioCoordinadorOTId: form.usuarioCoordinadorOTId || null,
          usuarioResponsableComexId: form.usuarioResponsableComexId || null,
          usuarioMaterialesId: form.usuarioMaterialesId || null,
          mailFacturacion: form.mailFacturacion,
        },
        firebaseUser.uid,
        usuario?.displayName,
      );
      setSuccessMsg('Configuración guardada');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Cargando configuración…</div>;
  }

  const fieldLabel = 'block text-[10px] font-mono uppercase tracking-wide text-slate-600 mb-1.5';

  return (
    <div className="max-w-2xl p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-slate-900 mb-1">Configuración de Flujos</h1>
        <p className="text-sm text-slate-500">Usuarios fijos y destinatarios para las derivaciones automáticas.</p>
      </div>

      <Card className="space-y-5 p-6">
        <div>
          <label className={fieldLabel}>Seguimiento comercial (FLOW-01)</label>
          <SearchableSelect
            value={form.usuarioSeguimientoId || ''}
            onChange={v => setForm({ ...form, usuarioSeguimientoId: v })}
            options={buildUserOptions(false)}
            placeholder="Seleccionar usuario…"
            emptyMessage="No hay usuarios activos"
          />
          <p className="mt-1 text-[11px] text-slate-500">Crea el auto-ticket cuando se envía un presupuesto sin ticket origen.</p>
        </div>

        <div>
          <label className={fieldLabel}>Coordinador OT (FLOW-02)</label>
          <SearchableSelect
            value={form.usuarioCoordinadorOTId || ''}
            onChange={v => setForm({ ...form, usuarioCoordinadorOTId: v })}
            options={buildUserOptions(false)}
            placeholder="Seleccionar usuario…"
            emptyMessage="No hay usuarios activos"
          />
          <p className="mt-1 text-[11px] text-slate-500">Recibe notificación al cargar la OC del cliente para coordinar la OT.</p>
        </div>

        <div>
          <label className={fieldLabel}>Responsable Comex (FLOW-03, opcional)</label>
          <SearchableSelect
            value={form.usuarioResponsableComexId || ''}
            onChange={v => setForm({ ...form, usuarioResponsableComexId: v })}
            options={buildUserOptions(true)}
            placeholder="Seleccionar usuario…"
            emptyMessage="No hay usuarios activos"
          />
          <p className="mt-1 text-[11px] text-slate-500">Derivación a Importaciones al aceptar presupuestos con ítems importados. Si se deja vacío, el ticket queda en el área sin usuario fijo.</p>
        </div>

        <div>
          <label className={fieldLabel}>Responsable Materiales (FLOW-05)</label>
          <SearchableSelect
            value={form.usuarioMaterialesId || ''}
            onChange={v => setForm({ ...form, usuarioMaterialesId: v })}
            options={buildUserOptions(false)}
            placeholder="Seleccionar usuario…"
            emptyMessage="No hay usuarios activos"
          />
          <p className="mt-1 text-[11px] text-slate-500">Ejecuta el cierre administrativo (descarga de artículos + facturación) tras el cierre técnico. El ticket se deriva automáticamente a este usuario cuando la OT pasa a CIERRE_TECNICO.</p>
        </div>

        <div>
          <label className={fieldLabel}>Mail facturación (FLOW-04)</label>
          <Input
            type="email"
            value={form.mailFacturacion || ''}
            onChange={e => setForm({ ...form, mailFacturacion: e.target.value })}
            placeholder="mbarrios@agsanalitica.com"
          />
          <p className="mt-1 text-[11px] text-slate-500">Destinatario del aviso automático al cerrar una OT administrativamente.</p>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-lg p-3">
            {successMsg}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
