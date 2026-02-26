import React from 'react';

export interface ProtocolCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Checkbox unificado para protocolos (Conclusiones, Ver especificación, etc.).
 * Tamaño vía CSS --protocol-checkbox-size (ver constants/protocol.ts CHECKBOX_SIZE = 16).
 */
export const ProtocolCheckbox: React.FC<ProtocolCheckboxProps> = ({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
  className = '',
  ...rest
}) => (
  <input
    type="checkbox"
    checked={!!checked}
    onChange={onChange}
    disabled={disabled}
    aria-label={ariaLabel}
    className={`protocol-checkbox shrink-0 accent-slate-700 cursor-pointer ${className}`.trim()}
    {...rest}
  />
);
