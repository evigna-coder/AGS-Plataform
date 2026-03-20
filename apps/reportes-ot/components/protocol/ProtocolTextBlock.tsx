import React from 'react';

export interface ProtocolTextBlockProps {
  title?: string;
  content: string;
}

/**
 * Bloque de texto simple para secciones type: 'text'. Escala informe (11–12px).
 */
export const ProtocolTextBlock: React.FC<ProtocolTextBlockProps> = ({
  title,
  content,
}) => {
  return (
    <div className="space-y-1">
      {title && (
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
          {title}
        </h4>
      )}
      <p
        className="text-[11px] text-slate-700 leading-snug whitespace-pre-wrap"
        style={{ fontSize: '11px' }}
      >
        {content}
      </p>
    </div>
  );
};
