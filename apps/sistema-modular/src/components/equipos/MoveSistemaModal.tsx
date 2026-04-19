import { useState, useEffect } from 'react';
import type { Cliente, Establecimiento } from '@ags/shared';
import { clientesService, establecimientosService, sistemasService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SearchableSelect } from '../ui/SearchableSelect';

interface SistemaToMove {
  id: string;
  nombre: string;
  establecimientoId?: string | null;
  sector?: string | null;
  enContrato?: boolean;
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
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [targetClienteId, setTargetClienteId] = useState(clienteCuit);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [targetEstId, setTargetEstId] = useState('');
  const [targetSector, setTargetSector] = useState('');
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingEsts, setLoadingEsts] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSingle = sistemas.length === 1;
  const isCrossCliente = targetClienteId !== '' && targetClienteId !== clienteCuit;
  const sistemasEnContrato = sistemas.filter(s => s.enContrato);

  useEffect(() => {
    clientesService.getAll(true).then(list => {
      setClientes(list);
      setLoadingClientes(false);
    });
  }, []);

  useEffect(() => {
    if (!targetClienteId) { setEstablecimientos([]); setLoadingEsts(false); return; }
    setLoadingEsts(true);
    establecimientosService.getByCliente(targetClienteId).then(list => {
      setEstablecimientos(list);
      // Pre-seleccionar el establecimiento/sector actual solo cuando estamos en el cliente origen
      if (isSingle && targetClienteId === clienteCuit) {
        setTargetEstId(sistemas[0].establecimientoId || '');
        setTargetSector(sistemas[0].sector || '');
      }
      setLoadingEsts(false);
    });
  }, [targetClienteId]);

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
            establecimientoId: targetEstId,
            sector: targetSector || null,
            // Mantener el campo legado sincronizado: algunos queries todavía lo usan
            clienteId: targetClienteId,
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
    <Modal
      open={true}
      onClose={onClose}
      title={isSingle ? 'Mover Sistema' : `Mover ${sistemas.length} Sistemas`}
      maxWidth="sm"
      minimizable={false}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleMove} disabled={saving || !hasTarget}>
            {saving ? 'Moviendo...' : isSingle ? 'Mover' : `Mover ${sistemas.length}`}
          </Button>
        </>
      }
    >
      {isSingle ? (
        <p className="text-xs text-slate-500 mb-4">
          <span className="font-medium text-slate-700">{sistemas[0].nombre}</span>
          {' -> '}Seleccionar destino
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

      {loadingClientes ? (
        <p className="text-xs text-slate-400 py-4 text-center">Cargando...</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Cliente</label>
            <SearchableSelect
              value={targetClienteId}
              onChange={(val) => {
                if (val === targetClienteId) return;
                setTargetClienteId(val);
                setTargetEstId('');
                setTargetSector('');
              }}
              options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
              placeholder="Seleccionar cliente..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Establecimiento</label>
            {loadingEsts ? (
              <p className="text-xs text-slate-400 py-2">Cargando establecimientos...</p>
            ) : establecimientos.length === 0 ? (
              <p className="text-xs text-amber-600 py-2">Este cliente no tiene establecimientos.</p>
            ) : (
              <SearchableSelect
                value={targetEstId}
                onChange={(val) => {
                  setTargetEstId(val);
                  if (val !== targetEstId) setTargetSector('');
                }}
                options={establecimientos.map(e => ({ value: e.id, label: e.nombre }))}
                placeholder="Seleccionar establecimiento..."
              />
            )}
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

          {isCrossCliente && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <p className="font-medium mb-0.5">Movés el equipo a otro cliente.</p>
              <p className="text-amber-700">El historial de OTs, presupuestos y documentos queda vinculado al cliente original.</p>
            </div>
          )}

          {sistemasEnContrato.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
              <p className="font-medium mb-0.5">
                {sistemasEnContrato.length === 1
                  ? `"${sistemasEnContrato[0].nombre}" está en contrato.`
                  : `${sistemasEnContrato.length} sistemas están en contrato.`}
              </p>
              <p className="text-red-700">Revisá el contrato del cliente origen antes de mover — el flag `enContrato` no se modifica automáticamente.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
