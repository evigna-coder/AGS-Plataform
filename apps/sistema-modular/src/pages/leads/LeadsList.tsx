import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Lead, LeadEstado, MotivoLlamado, UsuarioAGS, Cliente } from '@ags/shared';
import {
  LEAD_ESTADO_LABELS, LEAD_ESTADO_COLORS,
  MOTIVO_LLAMADO_LABELS, MOTIVO_LLAMADO_COLORS,
} from '@ags/shared';
import { leadsService, usuariosService, clientesService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { CrearLeadModal } from '../../components/leads/CrearLeadModal';

export const LeadsList = () => {
  const { usuario } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<LeadEstado | ''>('');
  const [filtroMotivo, setFiltroMotivo] = useState<MotivoLlamado | ''>('');
  const [filtroResponsable, setFiltroResponsable] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [soloMios, setSoloMios] = useState(false);
  const [ordenFecha, setOrdenFecha] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    Promise.all([usuariosService.getAll(), clientesService.getAll(true)]).then(([u, c]) => {
      setUsuarios(u);
      setClientes(c);
    });
  }, []);

  useEffect(() => { loadLeads(); }, [filtroEstado, filtroMotivo, filtroResponsable, soloMios]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const responsableFilter = soloMios && usuario ? usuario.id : filtroResponsable || undefined;
      const data = await leadsService.getAll({
        ...(filtroEstado ? { estado: filtroEstado } : {}),
        ...(filtroMotivo ? { motivoLlamado: filtroMotivo } : {}),
        ...(responsableFilter ? { asignadoA: responsableFilter } : {}),
      });
      setLeads(data);
    } catch (err) {
      console.error('Error al cargar leads:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtro cliente + ordenamiento fecha (client-side)
  const leadsFiltered = useMemo(() => {
    let result = leads;
    if (filtroCliente) result = result.filter(l => l.clienteId === filtroCliente);
    if (ordenFecha === 'asc') result = [...result].reverse();
    return result;
  }, [leads, filtroCliente, ordenFecha]);

  const limpiar = () => {
    setFiltroEstado(''); setFiltroMotivo('');
    setFiltroResponsable(''); setFiltroCliente('');
    setSoloMios(false); setOrdenFecha('desc');
  };

  const getResponsableNombre = (id: string | null) => {
    if (!id) return '—';
    return usuarios.find(u => u.id === id)?.displayName || '—';
  };

  const selectCls = 'text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  if (loading && leads.length === 0) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Cargando leads...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Leads / Consultas" count={leadsFiltered.length}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Lead</Button>}>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as LeadEstado | '')} className={selectCls}>
            <option value="">Estado</option>
            {Object.entries(LEAD_ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value as MotivoLlamado | '')} className={selectCls}>
            <option value="">Motivo</option>
            {Object.entries(MOTIVO_LLAMADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {!soloMios && (
            <select value={filtroResponsable} onChange={e => setFiltroResponsable(e.target.value)} className={selectCls}>
              <option value="">Responsable</option>
              {usuarios.filter(u => u.status === 'activo').map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </select>
          )}
          <div className="w-48">
            <SearchableSelect value={filtroCliente} onChange={setFiltroCliente}
              options={[{ value: '', label: 'Todos los clientes' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente..." />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={soloMios} onChange={e => setSoloMios(e.target.checked)} className="rounded border-slate-300" />
            Mis leads
          </label>
          <Button size="sm" variant="ghost" onClick={limpiar}>Limpiar</Button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {leadsFiltered.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400 mb-4">No se encontraron leads</p>
            <Button size="sm" onClick={() => setShowCreate(true)}>Crear primer lead</Button>
          </div></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-1 text-left text-[11px] font-medium text-slate-400 tracking-wider">Razón Social</th>
                    <th className="px-3 py-1 text-left text-[11px] font-medium text-slate-400 tracking-wider">Contacto</th>
                    <th className="px-3 py-1 text-left text-[11px] font-medium text-slate-400 tracking-wider">Motivo</th>
                    <th className="px-3 py-1 text-left text-[11px] font-medium text-slate-400 tracking-wider">Responsable</th>
                    <th className="px-3 py-1 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-3 py-1 text-left text-[11px] font-medium text-slate-400 tracking-wider cursor-pointer select-none"
                      onClick={() => setOrdenFecha(p => p === 'desc' ? 'asc' : 'desc')}>
                      Creado {ordenFecha === 'desc' ? '↓' : '↑'}
                    </th>
                    <th className="px-3 py-1 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadsFiltered.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-1">
                        <Link to={`/leads/${lead.id}`} className="text-xs font-medium text-slate-900 hover:text-indigo-600">{lead.razonSocial}</Link>
                      </td>
                      <td className="px-3 py-1 text-xs text-slate-500 truncate max-w-[140px]">{lead.contacto}</td>
                      <td className="px-3 py-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[lead.motivoLlamado]}`}>
                          {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado]}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-xs text-slate-600">{getResponsableNombre(lead.asignadoA)}</td>
                      <td className="px-3 py-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_ESTADO_COLORS[lead.estado]}`}>
                          {LEAD_ESTADO_LABELS[lead.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-[11px] text-slate-400">{new Date(lead.createdAt).toLocaleDateString('es-AR')}</td>
                      <td className="px-3 py-1 text-right">
                        <Link to={`/leads/${lead.id}`} className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium">Ver</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {showCreate && <CrearLeadModal onClose={() => setShowCreate(false)} onCreated={loadLeads} />}
    </div>
  );
};
