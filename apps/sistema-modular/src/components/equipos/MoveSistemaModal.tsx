import { useState, useEffect } from 'react';
import type { Establecimiento } from '@ags/shared';
import { establecimientosService, sistemasService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

interface SistemaToMove {
  id: string;
  nombre: string;
  establecimientoId?: string | null;
  sector?: string | null;
}

interface MoveSistemaModalProps {
  sistemas: SistemaToMove[];
  clienteCuit: string;
  onClose: () => void;
  onMoved: () => void;
}

export const MoveSistemaModal: React.FC<MoveSistemaModalProps> = ({
  sistemas,
  clienteCuit,
  onClose,
  onMoved,
}) => {
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [targetEstId, setTargetEstId] = useState('');
  const [targetSector, setTargetSector] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSingle = sistemas.length === 1;

  useEffect(() => {
    establecimientosService.getByCliente(clienteCuit).then(list => {
      setEstablecimientos(list);
      // Pre-seleccionar si es uno solo
      if (isSingle) {
        setTargetEstId(sistemas[0].establecimientoId || '');
        setTargetSector(sistemas[0].sector || '');
      }
      setLoading(false);
    });
  }, [clienteCuit]);

  const selectedEst = establecimientos.find(e => e.id === targetEstId);
  const sectores = selectedEst?.sectores || [];

  const hasTarget = targetEstId !== '';

  const handleMove = async () => {
    if (!hasTarget) return;
    setSaving(true);
    try {
      await Promise.all(
        sistemas.map(s =>
          sistemasService.update(s.id, {
            establecimientoId: targetEstId || undefined,
            sector: targetSector || undefined,
          })
        )
      );
      onMoved();
    } catch (err) {
      console.error('Error moviendo sistema(s):', err);
      alert('Error al mover los sistemas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          {isSingle ? 'Mover Sistema' : `Mover ${sistemas.length} Sistemas`}
        </h3>
        {isSingle ? (
          <p className="text-xs text-slate-500 mb-4">
            <span className="font-medium text-slate-700">{sistemas[0].nombre}</span>
            {' → '}Seleccionar destino
          </p>
        ) : (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {sistemas.map(s => (
                <span key={s.id} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full">
                  {s.nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-slate-400 py-4 text-center">Cargando establecimientos...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Establecimiento</label>
              <SearchableSelect
                value={targetEstId}
                onChange={(val) => {
                  setTargetEstId(val);
                  if (val !== targetEstId) setTargetSector('');
                }}
                options={establecimientos.map(e => ({ value: e.id, label: e.nombre }))}
                placeholder="Seleccionar establecimiento..."
              />
            </div>

            {sectores.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Sector</label>
                <SearchableSelect
                  value={targetSector}
                  onChange={setTargetSector}
                  options={[
                    { value: '', label: 'Sin sector' },
                    ...sectores.map(s => ({ value: s, label: s })),
                  ]}
                  placeholder="Seleccionar sector..."
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleMove} disabled={saving || !hasTarget}>
            {saving ? 'Moviendo...' : isSingle ? 'Mover' : `Mover ${sistemas.length}`}
          </Button>
        </div>
      </Card>
    </div>
  );
};
