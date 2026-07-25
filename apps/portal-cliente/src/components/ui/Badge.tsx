import { cn } from '@/lib/cn';

export type BadgeTone = 'success' | 'warn' | 'danger' | 'info' | 'teal' | 'neutral';

const TONE_PILL: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success',
  warn: 'bg-warn-bg text-warn',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  teal: 'bg-teal-50 text-teal-700',
  neutral: 'bg-surface-muted text-ink-soft',
};

const TONE_DOT: Record<BadgeTone, string> = {
  success: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
  teal: 'bg-teal-500',
  neutral: 'bg-ink-faint',
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}

export function Badge({ label, tone = 'neutral', dot = true, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'font-mono text-[11px] font-medium',
        TONE_PILL[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-2 w-2 rounded-full', TONE_DOT[tone])} />}
      {label}
    </span>
  );
}
