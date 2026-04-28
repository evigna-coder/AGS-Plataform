import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { proveedoresService, fichasService } from '../../services/firebaseService';
import type { FichaPropiedad, ItemFicha, Proveedor } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
  /** Item al que pertenecen las derivaciones. */
  item: ItemFicha;
  onUpdate: () => void;
}

/**
 * Derivaciones a proveedor por item — un item puede derivarse mientras otros del
 * mismo ingreso siguen en planta.
 *
 * Nota: la creación del REMITO de derivación se hace desde
 * `GenerarRemitoDevolucionModal` (puede agrupar items de varias fichas en un solo
 * remito). Acá solo registramos derivaciones "rápidas" sin remito asociado, y
 * permitimos marcar recibido cuando vuelve.
 */
export function FichaDerivacionSection({ ficha, item, onUpdate }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
  const [showModal, setShowModal] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showModal) proveedoresService.getAll().then(p => setProveedores(p.filter(x => x.activo)));
  }, [showModal]);

  const handleDerive = async () => {
    if (!proveedorId || !descripcion.trim()) return;
    setSaving(true);
    try {
      const prov = proveedores.find(p => p.id === proveedorId);
      await fichasService.addItemDerivacion(ficha.id, item.id, {
        proveedorId,
        proveedorNombre: prov?.nombre || '',
        remitoSalidaId: null,
        remitoRetornoId: null,
        fechaEnvio: new Date().toISOString(),
        fechaRetorno: null,
        descripcion: descripcion.trim(),
        estado: 'enviado',
      });
      setShowModal(false);
      setProveedorId('');
      setDescripcion('');
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReceived = async (derivIdx: number) => {
    const updated = [...item.derivaciones];
    updated[derivIdx] = { ...updated[derivIdx], estado: 'recibido', fechaRetorno: new Date().toISOString() };
    await fichasService.updateItem(ficha.id, item.id, { derivaciones: updated });
    onUpdate();
  };

  return (
    <>
      <Card
        title="Derivaciones a proveedor"
        actions={
          item.estado !== 'entregado' && (
            <Button variant="ghost" size="sm" onClick={() => setShowModal(true)}>+ Derivar</Button>
          )
        }
      >
        {item.derivaciones.length === 0 ? (
          <p className="text-sm text-slate-400">Sin derivaciones</p>
        ) : (
          <div className="space-y-3">
            {item.derivaciones.map((d, idx) => (
              <div key={d.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">{d.proveedorNombre}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    d.estado === 'recibido' ? 'bg-green-100 text-green-800' :
                    d.estado === 'enviado' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {d.estado === 'recibido' ? 'Recibido' : d.estado === 'enviado' ? 'Enviado' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{d.descripcion}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  {d.fechaEnvio && <span>Enviado: {new Date(d.fechaEnvio).toLocaleDateString('es-AR')}</span>}
                  {d.fechaRetorno && <span>Retorno: {new Date(d.fechaRetorno).toLocaleDateString('es-AR')}</span>}
                  {d.remitoSalidaId && (
                    <Link to={`/stock/remitos/${d.remitoSalidaId}`} state={fromState} className="text-teal-600 hover:underline">Ver remito</Link>
                  )}
                </div>
                {d.estado === 'enviado' && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => handleMarkReceived(idx)}>
                    Marcar recibido
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Derivar a proveedor" footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleDerive} disabled={!proveedorId || !descripcion.trim() || saving}>
            {saving ? 'Guardando…' : 'Derivar'}
          </Button>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor *</label>
            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
              <option value="">Seleccionar proveedor</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion de lo derivado *</label>
            <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Que se envia al proveedor y por que" />
          </div>
        </div>
      </Modal>
    </>
  );
}
