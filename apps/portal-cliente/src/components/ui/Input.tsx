import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, icon, trailing, wrapperClassName, className, id, ...rest },
  ref,
) {
  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className="font-mono text-[10px] tracking-wide text-ink-soft">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-3.5 transition-colors focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500">
        {icon && <span className="text-ink-faint">{icon}</span>}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full bg-transparent py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none',
            className,
          )}
          {...rest}
        />
        {trailing}
      </div>
    </div>
  );
});
