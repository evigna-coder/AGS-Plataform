import { useEffect, useMemo, useState } from 'react';
import {
  clientesService, establecimientosService, sistemasService, tiposServicioService,
} from '../../services/firebaseService';
import type { Cliente, Establecimiento, Sistema, TipoServicio } from '@ags/shared';
import { establecimientoPerteneceACliente, establecimientoUnicoId } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

export interface ReservaServicioDatos {
  clienteId: string | null;
  clienteNombre: string;
  establecimientoId: string | null;
  establecimientoNombre: string | null;
  sistemaId: string | null;
  sistemaNombre: string | null;
  equipoAgsId: string | null;
  tipoServicioId: string | null;
  tipoServicio: string;
  notas: string | null;
}

interface AgendaReservaModalProps {
  ingenieroNombre: string;
  fecha: string;
  onClose: () => void;
  onCreate: (datos: ReservaServicioDatos) => Promise<void>;
  /**
   * Valores iniciales para EDITAR una reserva ya creada (2026-08-20). Vienen de
   * la previsión, no de la entrada de agenda: la entrada guarda solo nombres y
   * los selectores necesitan ids.
   */
  initial?: {
    clienteId: string;
    establecimientoId: string;
    sistemaId: string;
    tipoServicioId: string;
    notas: string;
  } | null;
}

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide font-mono block mb-1">
      {label}
    </label>
    {children}
  </div>
);

/**
 * Reserva de agenda para un servicio SIN OT (pedido 2026-08-03): ocupa la
 * celda del ingeniero y crea una previsión pendiente de convertir a OT.
 * Caso típico: servicios del año siguiente que hoy solo existen como plan.
 */
export const AgendaReservaModal = ({ ingenieroNombre, fecha, onClose, onCreate, initial }: AgendaReservaModalProps) => {
  const editando = !!initial;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [tipos, setTipos] = useState<TipoServicio[]>([]);
  const [form, setForm] = useState(initial ?? { clienteId: '', establecimientoId: '', sistemaId: '', tipoServicioId: '', notas: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      clientesService.getAll(), establecimientosService.getAll(),
      sistemasService.getAll(), tiposServicioService.getAll(),
    ]).then(([cls, est, sis, tps]) => {
      setClientes(cls);
      setEstablecimientos(est);
      setSistemas(sis);
      setTipos(tps);
    }).catch(err => console.error('Error cargando catálogos para reserva:', err));
  }, []);

  const estFiltrados = useMemo(
    () => form.clienteId ? establecimientos.filter(e => establecimientoPerteneceACliente(e, form.clienteId)) : [],
    [establecimientos, form.clienteId],
  );
  // Regla del proyecto: cliente con un único establecimiento → autoseleccionarlo.
  useEffect(() => {
    const unico = establecimientoUnicoId(estFiltrados);
    if (unico) setForm(prev => (prev.establecimientoId ? prev : { ...prev, establecimientoId: unico }));
  }, [estFiltrados]);

  const sisFiltrados = useMemo(
    () => form.establecimientoId ? sistemas.filter(s => s.activo && s.establecimientoId === form.establecimientoId) : [],
    [sistemas, form.establecimientoId],
  );

  const clienteOpts = useMemo(() => clientes.map(c => ({ value: c.id, label: c.razonSocial })), [clientes]);
  const estOpts = useMemo(() => estFiltrados.map(e => ({ value: e.id, label: e.nombre })), [estFiltrados]);
  const sisOpts = useMemo(() => sisFiltrados.map(s => ({
    value: s.id,
    label: `${s.nombre}${s.codigoInternoCliente ? ` — ${s.codigoInternoCliente}` : ''}`,
  })), [sisFiltrados]);
  const tipoOpts = useMemo(() => tipos.map(t => ({ value: t.id, label: t.nombre })), [tipos]);

  const handleCrear = async () => {
    const cliente = clientes.find(c => c.id === form.clienteId);
    const tipo = tipos.find(t => t.id === form.tipoServicioId);
    if (!cliente || !tipo) return;
    const est = estFiltrados.find(e => e.id === form.establecimientoId);
    const sis = sisFiltrados.find(s => s.id === form.sistemaId);
    setSaving(true);
    try {
      await onCreate({
        clienteId: cliente.id,
        clienteNombre: cliente.razonSocial,
        establecimientoId: est?.id ?? null,
        establecimientoNombre: est?.nombre ?? null,
        sistemaId: sis?.id ?? null,
        sistemaNombre: sis?.nombre ?? null,
        equipoAgsId: sis ? (sis.codigoInternoCliente || sis.agsVisibleId || null) : null,
        tipoServicioId: tipo.id,
        tipoServicio: tipo.nombre,
        notas: form.notas.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error('Error creando la reserva de servicio:', err);
      alert('Error al crear la reserva');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editando ? 'Editar reserva de servicio' : 'Reservar servicio (sin OT)'} subtitle={`${ingenieroNombre} · ${fecha}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[11px] text-slate-500">
          {editando
            ? <>Los cambios se aplican también a la <span className="font-medium">previsión</span> en Órdenes de trabajo → Previsiones. Para cambiar el día o el ingeniero, arrastrá la celda.</>
            : <>Ocupa la agenda con un servicio que todavía no tiene orden de trabajo. Queda como <span className="font-medium">previsión</span> en Órdenes de trabajo → Previsiones, lista para convertirse en OT.</>}
        </p>
        <Campo label="Cliente">
          <SearchableSelect
            value={form.clienteId}
            onChange={v => setForm(prev => ({ ...prev, clienteId: v, establecimientoId: '', sistemaId: '' }))}
            options={clienteOpts}
            placeholder="Buscar cliente..."
            emptyMessage="Sin clientes"
          />
        </Campo>
        <Campo label="Establecimiento">
          <SearchableSelect
            value={form.establecimientoId}
            onChange={v => setForm(prev => ({ ...prev, establecimientoId: v, sistemaId: '' }))}
            options={estOpts}
            placeholder={form.clienteId ? 'Elegir establecimiento...' : 'Primero el cliente'}
            emptyMessage="Sin establecimientos"
            disabled={!form.clienteId}
          />
        </Campo>
        <Campo label="Equipo (opcional)">
          <SearchableSelect
            value={form.sistemaId}
            onChange={v => setForm(prev => ({ ...prev, sistemaId: v }))}
            options={sisOpts}
            placeholder={form.establecimientoId ? 'Elegir equipo...' : 'Primero el establecimiento'}
            emptyMessage="Sin equipos en el establecimiento"
            disabled={!form.establecimientoId}
          />
        </Campo>
        <Campo label="Tipo de servicio">
          <SearchableSelect
            value={form.tipoServicioId}
            onChange={v => setForm(prev => ({ ...prev, tipoServicioId: v }))}
            options={tipoOpts}
            placeholder="Elegir tipo de servicio..."
            emptyMessage="Sin tipos de servicio"
          />
        </Campo>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide font-mono block mb-1">
            Notas (opcional)
          </label>
          <textarea
            value={form.notas}
            onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))}
            rows={2}
            placeholder='Ej: "MP + calificación de operación — confirmar con el cliente en enero."'
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleCrear} disabled={saving || !form.clienteId || !form.tipoServicioId}>
            {saving ? (editando ? 'Guardando...' : 'Reservando...') : (editando ? 'Guardar cambios' : 'Reservar agenda')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
