import React from 'react';
import type { ProtocolSignatureItem } from '../../types';

export interface ProtocolSignaturesSectionProps {
  signatures: ProtocolSignatureItem[];
}

/**
 * Sección de firmas tipo informe: líneas de firma, labels pequeños uppercase.
 */
export const ProtocolSignaturesSection: React.FC<ProtocolSignaturesSectionProps> = ({
  signatures,
}) => {
  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200"
      style={{ marginTop: '6mm', paddingTop: '4mm' }}
    >
      {signatures.map((sig) => (
        <div key={sig.id} className="space-y-1">
          <div
            className="border-b border-slate-300 min-h-[24px]"
            style={{ minWidth: '80px' }}
            aria-label={sig.label}
          />
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
            {sig.label}
          </p>
        </div>
      ))}
    </section>
  );
};
