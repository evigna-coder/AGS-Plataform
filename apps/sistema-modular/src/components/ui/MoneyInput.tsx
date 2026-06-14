import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** Se llama al presionar Enter (después de commitear el valor). */
  onEnter?: () => void;
}

/**
 * Input de monto: muestra el valor con 2 decimales (81 → "81.00") cuando no está
 * en foco. Al enfocar muestra el número crudo y selecciona; al salir/Enter formatea.
 */
export const MoneyInput: React.FC<Props> = ({ value, onChange, className, autoFocus, placeholder, onEnter }) => {
  const [text, setText] = useState(value != null ? value.toFixed(2) : '');
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value != null ? value.toFixed(2) : '');
  }, [value]);

  // Propaga el valor en tiempo real para que un Enter/botón que actúe inmediatamente
  // ya tenga el número (no queda atrapado hasta el blur).
  const handleChange = (raw: string) => {
    setText(raw);
    const n = parseFloat(raw.replace(',', '.'));
    onChange(isNaN(n) ? null : n);
  };

  const format = () => {
    focused.current = false;
    setText(value != null ? value.toFixed(2) : '');
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onFocus={e => {
        focused.current = true;
        const el = e.currentTarget;
        setText(value != null ? String(value) : '');
        // El setText re-renderiza y pierde la selección → seleccionar tras el render.
        requestAnimationFrame(() => el.select());
      }}
      onChange={e => handleChange(e.target.value)}
      onBlur={format}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); format(); onEnter?.(); }
      }}
    />
  );
};
