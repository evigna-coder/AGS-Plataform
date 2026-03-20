interface StatusBadgeProps {
  label: string;
  colorClass: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, colorClass }) => {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
      {label}
    </span>
  );
};
