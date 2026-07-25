/** Marca del portal: logo AGS oficial + nombre del portal. */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo-ags.svg" alt="AGS Analítica" className="h-7 w-auto" />
      <span className="h-6 w-px bg-line" />
      <span className="font-display text-[15px] font-semibold text-ink">Portal Cliente</span>
    </div>
  );
}
