import { useState, useEffect, useCallback } from 'react';
import { otService, type WorkOrderWithPdf } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';

export type OTStatusFilter = 'all' | 'BORRADOR' | 'FINALIZADO';

export function useOTList() {
  const { usuario } = useAuth();
  const [ots, setOts] = useState<WorkOrderWithPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OTStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [misOTs, setMisOTs] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { status?: string; ingenieroId?: string } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (misOTs && usuario?.id) filters.ingenieroId = usuario.id;
      const data = await otService.getAll(filters);
      setOts(data);
    } catch (err) {
      console.error('[OTList] Error cargando OTs:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, misOTs, usuario?.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = ots.filter(ot => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      ot.otNumber?.toLowerCase().includes(s) ||
      ot.razonSocial?.toLowerCase().includes(s) ||
      ot.sistema?.toLowerCase().includes(s) ||
      ot.tipoServicio?.toLowerCase().includes(s)
    );
  });

  return {
    ots: filtered,
    loading,
    search, setSearch,
    statusFilter, setStatusFilter,
    misOTs, setMisOTs,
    refresh: load,
  };
}
