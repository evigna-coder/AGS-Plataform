import { Hammer } from 'lucide-react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted">
        <Hammer className="h-6 w-6 text-teal-700" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
      <p className="max-w-sm text-sm text-ink-soft">
        Esta sección del portal está en construcción. Muy pronto vas a poder verla acá.
      </p>
    </div>
  );
}
