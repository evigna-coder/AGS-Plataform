import { NavLink } from 'react-router-dom';

const MORE_ITEMS = [
  { to: '/perfil', label: 'Perfil' },
];

interface MasMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MasMenu({ open, onClose }: MasMenuProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />
      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">Más opciones</p>
        <nav className="space-y-1">
          {MORE_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
