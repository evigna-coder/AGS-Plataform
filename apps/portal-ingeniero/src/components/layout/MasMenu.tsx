import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessModulo } from '@ags/shared';

interface MoreItem {
  to: string;
  label: string;
  adminOnly?: boolean;
  recepcionOnly?: boolean;
  pagosOnly?: boolean;
  engineerOnly?: boolean;
}

const MORE_ITEMS: MoreItem[] = [
  { to: '/ordenes-trabajo', label: 'Mis OTs', engineerOnly: true },
  { to: '/historial', label: 'Historial', engineerOnly: true },
  { to: '/viaticos', label: 'Viáticos', engineerOnly: true },
  { to: '/recepcion', label: 'Recepción', recepcionOnly: true },
  { to: '/recepcion/fotos', label: 'Sumar fotos', recepcionOnly: true },
  { to: '/qf-documentos', label: 'Documentos QF', adminOnly: true },
  { to: '/pagos-vep', label: 'Pagos VEP', pagosOnly: true },
  { to: '/perfil', label: 'Perfil' },
];

interface MasMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MasMenu({ open, onClose }: MasMenuProps) {
  const { hasRole, usuario } = useAuth();
  const canSeeQF = hasRole('admin', 'admin_ing_soporte');
  const canRecepcion = hasRole('admin', 'admin_soporte');
  const canPagos = usuario ? canAccessModulo(usuario, 'pagos') : false;
  const isEngineer = usuario ? canAccessModulo(usuario, 'ordenes-trabajo') : false;
  const items = MORE_ITEMS.filter(i => {
    if (i.adminOnly && !canSeeQF) return false;
    if (i.recepcionOnly && !canRecepcion) return false;
    if (i.pagosOnly && !canPagos) return false;
    if (i.engineerOnly && !isEngineer) return false;
    return true;
  });

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
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
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
