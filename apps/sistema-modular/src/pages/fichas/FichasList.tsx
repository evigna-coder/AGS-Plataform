import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fichasService, clientesService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { CreateFichaModal } from '../../components/fichas/CreateFichaModal';
import type { FichaPropiedad, EstadoFicha, Cliente } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS } from '@ags/shared';

export function FichasList() {
  const navigate = useNavigate();
  const [fichas, setFichas] = useState<FichaPropiedad[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [showEntregadas, setShowEntregadas] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    Promise.all([
      fichasService.getAll({ activasOnly: !showEntregadas }),
      clientesService.getAll(),
    ]).then(([f, c]) => {
      setFichas(f);
      setClientes(c);
    }).finally(() => setLoading(false));
  }, [showEntregadas]);

  const filtered = fichas.filter(f => {
    if (filterEstado && f.estado !== filterEstado) return false;
    if (filterCliente && f.clienteId !== filterCliente) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta ficha?')) return;
    await fichasService.delete(id);
    setFichas(prev => prev.filter(f => f.id !== id));
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Fichas Propiedad del Cliente"
        subtitle="Módulos y equipos ingresados para reparación"
        count={filtered.length}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            + Nueva ficha
          </Button>
        }
      >
        <div className="flex items-center gap-3">
          <select
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_FICHA_LABELS) as EstadoFicha[]).map(e => (
              <option key={e} value={e}>{ESTADO_FICHA_LABELS[e]}</option>
            ))}
          </select>
          <select
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
            value={filterCliente}
            onChange={e => setFilterCliente(e.target.value)}
          >
            <option value="">Todos los clientes</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.razonSocial}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={showEntregadas}
              onChange={e => setShowEntregadas(e.target.checked)}
              className="rounded border-slate-300"
            />
            Mostrar entregadas
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <p className="text-center text-slate-400 py-12">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-12">No hay fichas registradas</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Numero</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Cliente</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Ingreso</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">OT Ref</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/fichas/${f.id}`)}>
                    <td className="px-4 py-2.5 text-sm font-medium text-indigo-600">{f.numero}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">{f.clienteNombre}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 max-w-[200px] truncate">
                      {f.moduloNombre || f.descripcionLibre || '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ESTADO_FICHA_COLORS[f.estado]}`}>
                        {ESTADO_FICHA_LABELS[f.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(f.fechaIngreso)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {f.otReferencia ? (
                        <Link to={`/ordenes-trabajo/${f.otReferencia}`} className="text-indigo-600 hover:underline" onClick={e => e.stopPropagation()}>
                          {f.otReferencia}
                        </Link>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {f.estado === 'recibido' && (
                        <button
                          className="text-xs text-red-500 hover:text-red-700"
                          onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateFichaModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {
        Promise.all([
          fichasService.getAll({ activasOnly: !showEntregadas }),
          clientesService.getAll(),
        ]).then(([f, c]) => { setFichas(f); setClientes(c); });
      }} />
    </div>
  );
}
