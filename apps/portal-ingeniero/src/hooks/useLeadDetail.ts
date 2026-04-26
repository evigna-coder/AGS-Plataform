import { useState, useEffect, useRef } from 'react';
import type { Lead } from '@ags/shared';
import { leadsService } from '../services/firebaseService';

export function useLeadDetail(leadId: string) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!leadId) { setLead(null); setLoading(false); return; }
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = leadsService.subscribeById(
      leadId,
      (l) => { setLead(l); setLoading(false); },
      (err) => { console.error('[LeadDetail] Subscription error:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [leadId]);

  return { lead, loading, refresh: () => {} };
}
