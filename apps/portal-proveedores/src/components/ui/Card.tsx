import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Sin padding interno (para tablas u contenido a sangre). */
  flush?: boolean;
}

/** Contenedor base: superficie blanca, borde suave, esquinas 14px. */
export function Card({ children, flush = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface',
        !flush && 'p-6',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h3 className="font-display text-[17px] font-semibold text-ink">{title}</h3>
      {action}
    </div>
  );
}
