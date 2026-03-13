import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, usuariosService } from '../services/firebaseService';
import type { Lead, LeadEstado } from '@ags/shared';

export function useLeadList() {
  const { usuario } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<LeadEstado | ''>('');
  const [misLeads, setMisLeads] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { estado?: LeadEstado; asignadoA?: string } = {};
      if (estadoFilter) filters.estado = estadoFilter;
      if (misLeads && usuario?.id) filters.asignadoA = usuario.id;
      const data = await leadsService.getAll(filters);

      // Resolve asignadoNombre for leads that only have asignadoA (legacy data)
      const needsResolve = data.some(l => l.asignadoA && !l.asignadoNombre);
      if (needsResolve) {
        const allUsers = await usuariosService.getIngenieros();
        const userMap = new Map(allUsers.map(u => [u.id, u.displayName]));
        for (const l of data) {
          if (l.asignadoA && !l.asignadoNombre) {
            l.asignadoNombre = userMap.get(l.asignadoA) || null;
          }
        }
      }

      setLeads(data);
    } finally {
      setLoading(false);
    }
  }, [estadoFilter, misLeads, usuario?.id]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

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
    refresh: fetchLeads,
  };
}
