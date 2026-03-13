import { useState, useEffect, useCallback } from 'react';
import { leadsService } from '../services/firebaseService';
import type { Lead } from '@ags/shared';

export function useLeadDetail(leadId: string) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await leadsService.getById(leadId);
      setLead(data);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { lead, loading, refresh: fetch };
}
