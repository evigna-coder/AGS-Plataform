import { useEffect, useMemo, useState } from 'react';
import type { Ticket } from '@ags/shared';
import { leadsService } from '../../services/leadsService';
import { clientesService } from '../../services/clientesService';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Card } from '../../components/ui/Card';
import { RevisionClienteIdRow } from './components/RevisionClienteIdRow';

/**
 * UI admin para resolver manualmente tickets con `pendienteClienteId: true`.
 * Se alimenta de `leadsService.listarPendientesClienteId()` y permite:
 *   - Elegir un cliente via SearchableSelect (lista pre-cargada de clientes activos).
 *   - "Usar este" cuando hay `candidatosPropuestos` del script de migración.
 *   - "Descartar" para sacar el ticket de la lista sin asignar clienteId.
 *
 * Filtros persistidos en URL (useUrlFilters):
 *   - soloAmbiguos: muestra solo tickets con >=1 candidato propuesto.
 *   - search: filtra por razón social client-side.
 */

interface RawCliente {
  id: string;
  razonSocial: string;
  cuit: string | null;
}

const FILTERS_SCHEMA = {
  soloAmbiguos: { type: 'boolean' as const, default: false },
  search: { type: 'string' as const, default: '' },
};

export default function RevisionClienteIdPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clientes, setClientes] = useState<RawCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilter] = useUrlFilters(FILTERS_SCHEMA);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ts, cs] = await Promise.all([
        leadsService.listarPendientesClienteId(),
        clientesService.getAll(true), // activos only
      ]);
      if (cancelled) return;
      setTickets(ts);
      setClientes(
        cs.map(c => ({
          id: c.id,
          razonSocial: c.razonSocial,
          cuit: c.cuit ?? null,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clienteOptions = useMemo(
    () =>
      clientes.map(c => ({
        value: c.id,
        label: c.cuit ? `${c.razonSocial} — ${c.cuit}` : c.razonSocial,
      })),
    [clientes]
  );

  const visible = useMemo(
    () =>
      tickets.filter(t => {
        const candidatos = t.candidatosPropuestos ?? [];
        if (filters.soloAmbiguos && candidatos.length === 0) return false;
        if (
          filters.search &&
          !t.razonSocial.toLowerCase().includes(filters.search.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [tickets, filters.soloAmbiguos, filters.search]
  );

  async function handleResolver(ticketId: string, clienteId: string) {
    await leadsService.resolverClienteIdPendiente(ticketId, clienteId);
    setTickets(prev => prev.filter(t => t.id !== ticketId));
  }

  async function handleDescartar(ticketId: string) {
    await leadsService.descartarRevisionClienteId(ticketId);
    setTickets(prev => prev.filter(t => t.id !== ticketId));
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-xs text-slate-400">Cargando tickets pendientes...</p>
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-5 pt-4 pb-3">
        <h1 className="text-xl font-serif text-slate-900 tracking-tight">
          Revisión de tickets sin cliente
        </h1>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Tickets con <code className="font-mono">clienteId</code> no resuelto por el script de
          migración. Asigná un cliente o descartá el ticket.
        </p>

        <div className="flex items-center gap-3 flex-wrap mt-3">
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            placeholder="Buscar por razón social..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 w-64"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.soloAmbiguos}
              onChange={e => setFilter('soloAmbiguos', e.target.checked)}
              className="rounded border-slate-300"
            />
            Solo ambiguos (con candidatos)
          </label>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-wide text-slate-400">
            {visible.length} / {tickets.length}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {visible.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400 text-xs">
                {tickets.length === 0
                  ? 'No hay tickets pendientes de revisión.'
                  : 'Ningún ticket coincide con los filtros aplicados.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    Razón Social
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-500">
                    Motivo
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-500">
                    Candidatos
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-500">
                    Asignar Cliente
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-wide text-slate-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(t => (
                  <RevisionClienteIdRow
                    key={t.id}
                    ticket={t}
                    clienteOptions={clienteOptions}
                    onResolver={handleResolver}
                    onDescartar={handleDescartar}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
