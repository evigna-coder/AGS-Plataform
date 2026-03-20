interface OTStatusBadgeProps {
  status: string;
}

export function OTStatusBadge({ status }: OTStatusBadgeProps) {
  const isFinal = status === 'FINALIZADO';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
      isFinal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {isFinal ? 'Finalizado' : 'Borrador'}
    </span>
  );
}
