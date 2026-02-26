import React from 'react';
import type { ProtocolChecklistItem } from '../../types';

export interface ProtocolChecklistProps {
  items: ProtocolChecklistItem[];
  checkedIds: string[];
  readOnly?: boolean;
  onChange?: (newCheckedIds: string[]) => void;
}

/**
 * Checklist de protocolo: checkboxes pequeños, texto 11–12px, alineación limpia (estilo informe).
 */
export const ProtocolChecklist: React.FC<ProtocolChecklistProps> = ({
  items,
  checkedIds,
  readOnly = false,
  onChange,
}) => {
  return (
    <ul className="list-none space-y-1">
      {items.map((item) => {
        const isChecked = checkedIds.includes(item.id);
        const handleToggle = () => {
          if (readOnly || !onChange) return;
          const newIds = isChecked
            ? checkedIds.filter((id) => id !== item.id)
            : [...checkedIds, item.id];
          onChange(newIds);
        };

        return (
          <li
            key={item.id}
            className="flex items-center gap-2 text-[11px] text-slate-700"
          >
            {readOnly ? (
              <span className="text-slate-500 shrink-0" aria-hidden>
                {isChecked ? '☑' : '□'}
              </span>
            ) : (
              <input
                type="checkbox"
                checked={isChecked}
                onChange={handleToggle}
                className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                aria-label={item.label}
              />
            )}
            <span className="flex-1">{item.label}</span>
            {item.required && (
              <span className="text-[10px] text-slate-400 shrink-0">
                (requerido)
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
