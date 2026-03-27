import { useState, useEffect } from 'react';
import type { ModuloSistema, Sistema } from '@ags/shared';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SearchableSelect } from '../ui/SearchableSelect';
import { sistemasService } from '../../services/firebaseService';

interface Props {
  modulo: ModuloSistema;
  currentSistemaId: string;
  onMove: (targetSistemaId: string) => Promise<void>;
  onClose: () => void;
}

export const MoveModuloModal: React.FC<Props> = ({ modulo, currentSistemaId, onMove, onClose }) => {
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetId, setTargetId] = useState('');
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    sistemasService.getAll().then(all => {
      setSistemas(all.filter(s => s.id !== currentSistemaId));
      setLoading(false);
    });
  }, [currentSistemaId]);

  const handleMove = async () => {
    if (!targetId) return;
    setMoving(true);
    try { await onMove(targetId); }
    catch { alert('Error al mover el modulo'); }
    finally { setMoving(false); }
  };

  const target = sistemas.find(s => s.id === targetId);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Mover modulo"
      subtitle={modulo.nombre + (modulo.serie ? ' (S/N: ' + modulo.serie + ')' : '')}
      maxWidth="sm"
      minimizable={false}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleMove} disabled={!targetId || moving}>
            {moving ? 'Moviendo...' : 'Mover'}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-xs text-slate-400 py-4 text-center">Cargando sistemas...</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5">Sistema destino</label>
            <SearchableSelect
              value={targetId}
              onChange={setTargetId}
              options={sistemas.map(s => ({ value: s.id, label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}` }))}
              placeholder="Buscar sistema destino..."
            />
          </div>
          {target && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 text-[11px]">
              <p className="font-medium text-slate-700">{target.nombre}</p>
              {target.codigoInternoCliente && <p className="text-slate-400">Codigo: {target.codigoInternoCliente}</p>}
              {target.sector && <p className="text-slate-400">Sector: {target.sector}</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
