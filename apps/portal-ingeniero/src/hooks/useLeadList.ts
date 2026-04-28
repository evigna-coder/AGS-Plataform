import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, usuariosService } from '../services/firebaseService';
import type { Lead, TicketEstado } from '@ags/shared';

export function useLeadList() {
  const { usuario } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<TicketEstado | ''>('');
  const [misLeads, setMisLeads] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const userMapRef = useRef<Map<string, string> | null>(null);

  const queryFilters = useMemo(() => {
    const f: { estado?: TicketEstado; asignadoA?: string } = {};
    if (estadoFilter) f.estado = estadoFilter;
    if (misLeads && usuario?.id) f.asignadoA = usuario.id;
    return f;
  }, [estadoFilter, misLeads, usuario?.id]);

  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();

    unsubRef.current = leadsService.subscribe(
      queryFilters,
      async (data) => {
        // Resolve asignadoNombre for leads that only have asignadoA (legacy data)
        const needsResolve = data.some(l => l.asignadoA && !l.asignadoNombre);
        if (needsResolve) {
          if (!userMapRef.current) {
            const allUsers = await usuariosService.getIngenieros();
            userMapRef.current = new Map(allUsers.map(u => [u.id, u.displayName]));
          }
          for (const l of data) {
            if (l.asignadoA && !l.asignadoNombre) {
              l.asignadoNombre = userMapRef.current.get(l.asignadoA) || null;
            }
          }
        }
        setLeads(data);
        setLoading(false);
      },
      (err) => { console.error('[LeadList] Subscription error:', err); setLoading(false); },
    );

    return () => { unsubRef.current?.(); };
  }, [queryFilters]);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      l.razonSocial.toLowerCase().includes(q) ||
      l.contacto.toLowerCase().includes(q) ||
      (l.descripcion ?? '').toLowerCase().includes(q) ||
      l.motivoContacto.toLowerCase().includes(q)
    );
  }, [leads, search]);

  return {
    leads: filtered,
    loading,
    search, setSearch,
    estadoFilter, setEstadoFilter,
    misLeads, setMisLeads,
    refresh: () => {},
  };
}
