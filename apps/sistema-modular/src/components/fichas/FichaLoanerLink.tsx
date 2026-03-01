import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { FichaPropiedad } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
}

export function FichaLoanerLink({ ficha }: Props) {
  if (!ficha.loanerId) return null;

  return (
    <Card title="Loaner asignado" compact>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{ficha.loanerCodigo}</p>
          <p className="text-xs text-slate-500">Equipo prestado al cliente</p>
        </div>
        <Link
          to={`/loaners/${ficha.loanerId}`}
          className="text-xs text-indigo-600 hover:underline font-medium"
        >
          Ver loaner
        </Link>
      </div>
    </Card>
  );
}
