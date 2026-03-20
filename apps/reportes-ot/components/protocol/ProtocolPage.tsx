import React from 'react';

export const ProtocolPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="protocol-page"
    style={{
      width: '210mm',
      height: '297mm',
      background: 'white',
      boxSizing: 'border-box',
      padding: '10mm',
      overflow: 'hidden',
      pageBreakAfter: 'always',
    }}
  >
    {children}
  </div>
);
