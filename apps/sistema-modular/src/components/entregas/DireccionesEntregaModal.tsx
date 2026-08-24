import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useConfirm } from '../ui/ConfirmDialog';
import { DireccionEntregaForm } from './DireccionEntregaForm';
import { direccionesEntregaService, type DireccionEntregaInput } from '../../services/direccionesEntregaService';
import { clientesService } from '../../services/clientesService';
import type { DireccionEntrega } from '@ags/shared';

/**
 * Direcciones de entrega por cliente (2026-08-24).
 *
 * A dónde va la mercadería no vivía en ningún lado: se resolvía por teléfono o
 * en la memoria de quien despachaba. Se cargan acá, una vez por cliente, y
 * después se eligen de una lista en cada fila del visor de entregas.
 *
 * Las direcciones se dan de BAJA, no se borran: una entrega vieja apunta a la
 * dirección con la que se hizo.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Cliente preseleccionado — al abrir desde una fila del visor. */
  clienteIdInicial?: string | null;
  /** Se llama al cerrar si hubo cambios, para refrescar los selectores. */
  onCambios?: () => void;
}

export const DireccionesEntregaModal: React.FC<Props> = ({ open, onClose, clienteIdInicial, onCambios }) => {
  const confirm = useConfirm();
  const [clientes, setClientes] = useState<{ value: string; label: string }[]>([]);
  const [clienteId, setClienteId] = useState(clienteIdInicial ?? '');
  const [direcciones, setDirecciones] = useState<DireccionEntrega[]>([]);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState<DireccionEntrega | null>(null);
  const [creando, setCreando] = useState(false);
  const [verInactivas, setVerInactivas] = useState(false);
  const [huboCambios, setHuboCambios] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClienteId(clienteIdInicial ?? '');
    clientesService.getAll()
      .then((cs: any[]) => setClientes(
        cs.map(c => ({ value: c.id as string, label: (c.razonSocial ?? c.nombre ?? c.id) as string }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es')),
      ))
      .catch(err => console.error('[DireccionesEntregaModal] clientes', err));
  }, [open, clienteIdInicial]);

  const cargar = useCallback(async () => {
    if (!clienteId) { setDirecciones([]); return; }
    setCargando(true);
    try {
      setDirecciones(await direccionesEntregaService.getByCliente(clienteId));
    } catch (err) {
      console.error('[DireccionesEntregaModal] direcciones', err);
    } finally {
      setCargando(false);
    }
  }, [clienteId]);

  useEffect(() => { if (open) void cargar(); }, [open, cargar]);

  const visibles = useMemo(
    () => direcciones
      .filter(d => verInactivas || d.activo !== false)
      .sort((a, b) => Number(!!b.predeterminada) - Number(!!a.predeterminada) || a.etiqueta.localeCompare(b.etiqueta, 'es')),
    [direcciones, verInactivas],
  );

  const guardar = async (data: DireccionEntregaInput) => {
    if (editando) await direccionesEntregaService.update(editando.id, data);
    else await direccionesEntregaService.create(data);
    setEditando(null); setCreando(false); setHuboCambios(true);
    await cargar();
  };

  const alternarActivo = async (d: DireccionEntrega) => {
    if (d.activo !== false && !await confirm(`Dar de baja "${d.etiqueta}"?\n\nDeja de ofrecerse al elegir la dirección de una entrega. Las entregas ya cargadas con esta dirección no cambian.`)) return;
    if (d.activo === false) await direccionesEntregaService.reactivar(d.id);
    else await direccionesEntregaService.desactivar(d.id);
    setHuboCambios(true);
    await cargar();
  };

  const cerrar = () => { if (huboCambios) onCambios?.(); setHuboCambios(false); onClose(); };

  return (
    <Modal open={open} onClose={cerrar} title="Direcciones de entrega"
      subtitle="A dónde va la mercadería de cada cliente" maxWidth="xl"
      footer={<Button variant="secondary" size="sm" onClick={cerrar}>Cerrar</Button>}>
      <div className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide">Cliente</label>
            <SearchableSelect value={clienteId} onChange={v => { setClienteId(v); setCreando(false); setEditando(null); }}
              options={clientes} placeholder="Elegí un cliente" emptyMessage="Sin clientes" size="sm" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500 pb-1.5">
            <input type="checkbox" checked={verInactivas} onChange={e => setVerInactivas(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 accent-teal-700" />
            Ver dadas de baja
          </label>
          <Button size="sm" onClick={() => { setEditando(null); setCreando(true); }} disabled={!clienteId}>
            + Nueva dirección
          </Button>
        </div>

        {(creando || editando) && clienteId && (
          <DireccionEntregaForm
            clienteId={clienteId}
            inicial={editando}
            onSubmit={guardar}
            onCancel={() => { setCreando(false); setEditando(null); }}
          />
        )}

        {!clienteId ? (
          <p className="text-xs text-slate-400 italic py-6 text-center">Elegí un cliente para ver sus direcciones.</p>
        ) : cargando ? (
          <p className="text-xs text-slate-400 py-6 text-center">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-6 text-center">
            Este cliente no tiene direcciones de entrega cargadas.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 border border-[#E5E5E5] rounded-md">
            {visibles.map(d => (
              <div key={d.id} className={`flex items-start gap-3 px-3 py-2 ${d.activo === false ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    {d.etiqueta}
                    {d.predeterminada && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-teal-100 text-teal-700">Predeterminada</span>
                    )}
                    {d.activo === false && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-500">De baja</span>
                    )}
                    {/* Validada = se eligió de una sugerencia de Google, no se tipeó. */}
                    {!d.placeId && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-50 text-amber-700"
                        title="Cargada a mano, sin validar contra Google">Sin validar</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">
                    {[d.direccion, d.localidad, d.provincia, d.codigoPostal].filter(Boolean).join(', ')}
                  </p>
                  {(d.contacto || d.telefono || d.horario) && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {[d.contacto, d.telefono, d.horario].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {d.notas && <p className="text-[10px] text-slate-500 italic mt-0.5">{d.notas}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setCreando(false); setEditando(d); }}
                    className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">
                    Editar
                  </button>
                  <button onClick={() => void alternarActivo(d)}
                    className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 rounded transition-colors">
                    {d.activo === false ? 'Reactivar' : 'Dar de baja'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
