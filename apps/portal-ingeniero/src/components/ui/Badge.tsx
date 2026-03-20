interface BadgeProps {
  label: string;
  colorClass?: string;
}

export function Badge({ label, colorClass = 'bg-slate-100 text-slate-600' }: BadgeProps) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}
