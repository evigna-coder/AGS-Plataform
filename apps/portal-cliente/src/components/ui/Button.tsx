import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-teal-700 text-ink-inv hover:bg-teal-800',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-muted',
  ghost: 'bg-transparent text-teal-700 hover:bg-teal-50',
  inverse: 'bg-surface text-teal-700 hover:bg-surface-muted',
};

const SIZES: Record<Size, string> = {
  sm: 'text-[13px] px-3.5 py-2 gap-1.5',
  md: 'text-sm px-5 py-3 gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  icon,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
