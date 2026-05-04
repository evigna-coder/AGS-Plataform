import { useState, useEffect, useMemo } from 'react';
import { unidadesService, movimientosService } from '../../services/firebaseService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { UnidadStock } from '@ags/shared';

interface Props {
  minikitId: string;
  minikitCodigo: string;
  minikitNombre: string;
  /** Artículo a reponer */
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  deficit: number;
  /** Nombre del usuario que está reponiendo (para creadoPor del movimiento) */
  creadoPor: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal para reponer unidades a un minikit.
 *
 * Lista las unidades disponibles del artículo (`estado='disponible'` y
 * `ubicacion.tipo='posicion'`) y permite seleccionar N para mover al minikit.
 * Por cada unidad seleccionada:
 *   1. Update ubicacion → `{ tipo: 'minikit', referenciaId, referenciaNombre }`
 *   2. Crea MovimientoStock tipo 'transferencia' con origen=posicion previa, destino=minikit
 */
export const ReponerMinikitModal = ({
  minikitId, minikitCodigo, minikitNombre,
  articuloId, articuloCodigo, articuloDescripcion, deficit,
  creadoPor,
  onClose, onSuccess,
}: Props) => {
  const [allUnits, setAllUnits] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    unidadesService.getByArticulo(articuloId)
      .then(units => {
        const disponibles = units.filter(u =>
          u.activo && u.estado === 'disponible' && u.ubicacion?.tipo === 'posicion'
        );
        setAllUnits(disponibles);
      })
      .catch(err => {
        console.error('Error cargando unidades:', err);
        setError('Error al cargar unidades disponibles');
      })
      .finally(() => setLoading(false));
  }, [articuloId]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const minikitNombreCompleto = useMemo(() => `${minikitCodigo} - ${minikitNombre}`, [minikitCodigo, minikitNombre]);

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const targets = allUnits.filter(u => selected.has(u.id));
      for (const u of targets) {
        const origenTipo = u.ubicacion.tipo;
        const origenId = u.ubicacion.referenciaId;
        const origenNombre = u.ubicacion.referenciaNombre;
        // 1. Mover unidad al minikit
        await unidadesService.update(u.id, {
          ubicacion: { tipo: 'minikit', referenciaId: minikitId, referenciaNombre: minikitNombreCompleto },
        });
        // 2. Registrar movimiento de transferencia
        await movimientosService.create({
          tipo: 'transferencia',
          unidadId: u.id,
          articuloId: u.articuloId,
          articuloCodigo: u.articuloCodigo,
          articuloDescripcion: u.articuloDescripcion,
          cantidad: 1,
          origenTipo,
          origenId,
          origenNombre,
          destinoTipo: 'minikit',
          destinoId: minikitId,
          destinoNombre: minikitNombreCompleto,
          remitoId: null,
          otNumber: null,
          motivo: 'Reposición desde control físico',
          creadoPor,
        });
      }
      onSuccess();
    } catch (err) {
      console.error('Error reponiendo minikit:', err);
      setError('Error al reponer. Algunas unidades pueden haberse movido — verificá antes de reintentar.');
    } finally {
      setSaving(false);
    }
  };

  const enough = selected.size >= deficit;
  const tooMany = selected.size > deficit;

  return (
    <Modal
      open
      title="Reponer artículo al minikit"
      subtitle={`${articuloCodigo} — ${articuloDescripcion}`}
      onClose={onClose}
      maxWidth="lg"
      footer={
        <div className="flex justify-between items-center w-full">
          <p className="text-xs text-slate-500">
            {selected.size} seleccionada(s) · faltan {deficit}
            {tooMany && <span className="text-amber-600 font-medium ml-1.5">(estás agregando más de lo requerido)</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleConfirm} disabled={saving || selected.size === 0}>
              {saving ? 'Reponiendo...' : `Mover ${selected.size} al minikit`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600">
          <span className="text-slate-400">Destino:</span>{' '}
          <span className="font-mono text-teal-600 font-semibold">{minikitCodigo}</span>{' '}
          <span className="text-slate-700">— {minikitNombre}</span>
        </div>

        {error && (
          <p className="text-xs text-red-700 bg-red-50 px-3 py-2 rounded">{error}</p>
        )}

        {loading ? (
          <p className="text-xs text-slate-400 text-center py-6">Cargando unidades disponibles...</p>
        ) : allUnits.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-3 rounded text-center">
            No hay unidades disponibles de este artículo en posiciones de stock.
            <br />
            Necesitás ingresar nuevas unidades antes de reponer.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left pl-2 w-10"></th>
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Serie / Lote</th>
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Ubicación</th>
                  <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Condición</th>
                </tr>
              </thead>
              <tbody>
                {allUnits.map(u => {
                  const checked = selected.has(u.id);
                  const should = !enough && !checked;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => toggle(u.id)}
                      className={`border-b border-slate-50 last:border-0 cursor-pointer ${
                        checked ? 'bg-teal-50/60' : should ? 'hover:bg-slate-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2 pl-2">
                        <input type="checkbox" checked={checked} onChange={() => toggle(u.id)}
                          className="w-4 h-4 accent-teal-600" onClick={e => e.stopPropagation()} />
                      </td>
                      <td className="text-xs py-2 pr-3">
                        {u.nroSerie ? <span className="font-mono text-slate-700">S/N: {u.nroSerie}</span> :
                         u.nroLote ? <span className="font-mono text-slate-500">Lote: {u.nroLote}</span> :
                         <span className="text-slate-400">—</span>}
                      </td>
                      <td className="text-xs py-2 pr-3 text-slate-600">{u.ubicacion.referenciaNombre || '—'}</td>
                      <td className="text-xs py-2 text-center text-slate-500 capitalize">{u.condicion.replace('_', ' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
