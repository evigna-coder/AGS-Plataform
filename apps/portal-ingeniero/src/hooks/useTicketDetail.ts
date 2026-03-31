import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Lead } from '@ags/shared';

function parseLead(id: string, d: Record<string, unknown>): Lead {
  return {
    ...d,
    id,
    createdAt: (d.createdAt as any)?.toDate?.()?.toISOString?.() ?? d.createdAt ?? '',
    updatedAt: (d.updatedAt as any)?.toDate?.()?.toISOString?.() ?? d.updatedAt ?? '',
    postas: Array.isArray(d.postas) ? d.postas : [],
    presupuestosIds: Array.isArray(d.presupuestosIds) ? d.presupuestosIds : [],
    otIds: Array.isArray(d.otIds) ? d.otIds : [],
    adjuntos: Array.isArray(d.adjuntos) ? d.adjuntos : [],
  } as Lead;
}

export function useLeadDetail(leadId: string) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!leadId) { setLead(null); setLoading(false); return; }
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = onSnapshot(
      doc(db, 'leads', leadId),
      (snap) => {
        if (snap.exists()) {
          setLead(parseLead(snap.id, snap.data() as Record<string, unknown>));
        } else {
          setLead(null);
        }
        setLoading(false);
      },
      (err) => { console.error('[LeadDetail] Subscription error:', err); setLoading(false); },
    );
    return () => { unsubRef.current?.(); };
  }, [leadId]);

  return { lead, loading, refresh: () => {} };
}
