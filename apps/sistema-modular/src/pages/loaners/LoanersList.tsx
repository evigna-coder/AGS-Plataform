import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loanersService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { CreateLoanerModal } from '../../components/loaners/CreateLoanerModal';
import type { Loaner, EstadoLoaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS, ESTADO_LOANER_COLORS } from '@ags/shared';

const ALERTA_DIAS = 30;

function diasPrestamo(fechaSalida: string): number {
  return Math.floor((Date.now() - new Date(fechaSalida).getTime()) / (1000 * 60 * 60 * 24));
}

export function LoanersList() {
  const navigate = useNavigate();
  const [loaners, setLoaners] = useState<Loaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('');
  const [showInactivos, setShowInactivos] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loanersService.getAll({ activoOnly: !showInactivos })
      .then(setLoaners)
      .finally(() => setLoading(false));
  }, [showInactivos]);

  const filtered = loaners.filter(l => {
    if (filterEstado && l.estado !== filterEstado) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este loaner?')) return;
    await loanersService.delete(id);
    setLoaners(prev => prev.filter(l => l.id !== id));
  };

  const getPrestamoActivo = (l: Loaner) => l.prestamos.find(p => p.estado === 'activo');

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Loaners"
        subtitle="Equipos de la empresa para prestamo y venta"
        count={filtered.length}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            + Nuevo loaner
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
            {(Object.keys(ESTADO_LOANER_LABELS) as EstadoLoaner[]).map(e => (
              <option key={e} value={e}>{ESTADO_LOANER_LABELS[e]}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={showInactivos}
              onChange={e => setShowInactivos(e.target.checked)}
              className="rounded border-slate-300"
            />
            Mostrar inactivos
          </label>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <p className="text-center text-slate-400 py-12">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-12">No hay loaners registrados</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Codigo</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Descripcion</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Categoria</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Serie</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Estado</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider">Ubicacion actual</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-slate-400 tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(l => {
                  const prestamo = getPrestamoActivo(l);
                  const diasFuera = prestamo ? diasPrestamo(prestamo.fechaSalida) : 0;
                  const alerta = prestamo && diasFuera > ALERTA_DIAS;

                  return (
                    <tr key={l.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/loaners/${l.id}`)}>
                      <td className="px-4 py-2.5 text-sm font-medium text-indigo-600">{l.codigo}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-700 max-w-[200px] truncate">{l.descripcion}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{l.categoriaEquipo || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{l.serie || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ESTADO_LOANER_COLORS[l.estado]}`}>
                          {ESTADO_LOANER_LABELS[l.estado]}
                        </span>
                        {alerta && (
                          <span className="ml-1.5 inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700" title={`${diasFuera} dias en cliente`}>
                            {diasFuera}d
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {prestamo ? prestamo.clienteNombre : l.estado === 'en_base' ? 'AGS Base' : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {l.estado === 'en_base' && (
                          <button
                            className="text-xs text-red-500 hover:text-red-700"
                            onClick={e => { e.stopPropagation(); handleDelete(l.id); }}
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateLoanerModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {
        loanersService.getAll({ activoOnly: !showInactivos }).then(setLoaners);
      }} />
    </div>
  );
}
