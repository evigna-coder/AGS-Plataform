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
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
import { CrearLeadModal } from '../../components/leads/CrearLeadModal';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

export const LeadsList = () => {
  const { usuario } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [filters, setFilters] = useState({
    estado: '' as LeadEstado | '',
    motivo: '' as MotivoLlamado | '',
    responsable: '',
    cliente: '',
    soloMios: false,
  });
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (f: string) => {
    const s = toggleSort(f, sortField, sortDir);
    setSortField(s.field);
    setSortDir(s.dir);
  };

  useEffect(() => {
    Promise.all([usuariosService.getAll(), clientesService.getAll(true)]).then(([u, c]) => {
      setUsuarios(u);
      setClientes(c);
    });
  }, []);

  useEffect(() => { loadLeads(); }, [filters.estado, filters.motivo, filters.responsable, filters.soloMios]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const responsableFilter = filters.soloMios && usuario ? usuario.id : filters.responsable || undefined;
      const data = await leadsService.getAll({
        ...(filters.estado ? { estado: filters.estado } : {}),
        ...(filters.motivo ? { motivoLlamado: filters.motivo } : {}),
        ...(responsableFilter ? { asignadoA: responsableFilter } : {}),
      });
      setLeads(data);
    } catch (err) {
      console.error('Error al cargar leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const leadsFiltered = useMemo(() => {
    let result = leads;
    if (filters.cliente) result = result.filter(l => l.clienteId === filters.cliente);
    return sortByField(result, sortField, sortDir);
  }, [leads, filters.cliente, sortField, sortDir]);

  const getResponsableNombre = (id: string | null) => {
    if (!id) return '—';
    return usuarios.find(u => u.id === id)?.displayName || '—';
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    try { return new Date(dateString).toLocaleDateString('es-AR'); } catch { return dateString; }
  };

  if (loading && leads.length === 0) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando leads...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Leads / Consultas" count={leadsFiltered.length}
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>+ Nuevo Lead</Button>}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[140px]">
            <SearchableSelect value={filters.estado}
              onChange={(v) => setFilters({ ...filters, estado: v as LeadEstado | '' })}
              options={[{ value: '', label: 'Todos' }, ...Object.entries(LEAD_ESTADO_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
              placeholder="Estado" />
          </div>
          <div className="min-w-[140px]">
            <SearchableSelect value={filters.motivo}
              onChange={(v) => setFilters({ ...filters, motivo: v as MotivoLlamado | '' })}
              options={[{ value: '', label: 'Todos' }, ...Object.entries(MOTIVO_LLAMADO_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
              placeholder="Motivo" />
          </div>
          {!filters.soloMios && (
            <div className="min-w-[160px]">
              <SearchableSelect value={filters.responsable}
                onChange={(v) => setFilters({ ...filters, responsable: v })}
                options={[{ value: '', label: 'Todos' }, ...usuarios.filter(u => u.status === 'activo').map(u => ({ value: u.id, label: u.displayName }))]}
                placeholder="Responsable" />
            </div>
          )}
          <div className="min-w-[160px]">
            <SearchableSelect value={filters.cliente} onChange={(v) => setFilters({ ...filters, cliente: v })}
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.razonSocial }))]}
              placeholder="Cliente" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={filters.soloMios} onChange={e => setFilters({ ...filters, soloMios: e.target.checked })} className="rounded border-slate-300" />
            Mis leads
          </label>
          <Button size="sm" variant="ghost" onClick={() => setFilters({ estado: '', motivo: '', responsable: '', cliente: '', soloMios: false })}>
            Limpiar
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 min-h-0 px-5 pb-4">
        {leadsFiltered.length === 0 ? (
          <Card><div className="text-center py-12">
            <p className="text-slate-400">No se encontraron leads</p>
            <button onClick={() => setShowCreate(true)}
              className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
              Crear primer lead
            </button>
          </div></Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col />
                <col style={{ width: '11%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <SortableHeader label="Razón Social" field="razonSocial" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Contacto</th>
                  <SortableHeader label="Motivo" field="motivoLlamado" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={thClass}>Responsable</th>
                  <SortableHeader label="Estado" field="estado" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <SortableHeader label="Creado" field="createdAt" currentField={sortField} currentDir={sortDir} onSort={handleSort} className={thClass} />
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadsFiltered.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/leads/${lead.id}`}>
                    <td className="px-3 py-2 text-xs font-semibold text-indigo-600 truncate" title={lead.razonSocial}>
                      {lead.razonSocial}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 truncate" title={lead.contacto}>{lead.contacto}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_LLAMADO_COLORS[lead.motivoLlamado]}`}>
                        {MOTIVO_LLAMADO_LABELS[lead.motivoLlamado]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate">{getResponsableNombre(lead.asignadoA)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAD_ESTADO_COLORS[lead.estado]}`}>
                        {LEAD_ESTADO_LABELS[lead.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(lead.createdAt)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/leads/${lead.id}`}
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CrearLeadModal onClose={() => setShowCreate(false)} onCreated={loadLeads} />}
    </div>
  );
};
