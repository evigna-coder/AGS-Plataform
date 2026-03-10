import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/authService';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function PerfilPage() {
  const { usuario } = useAuth();

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Perfil" />
      <div className="flex-1 p-4 space-y-4">
        <Card>
          <div className="flex items-center gap-4">
            {usuario?.photoURL ? (
              <img src={usuario.photoURL} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-xl font-bold text-indigo-700">
                  {usuario?.displayName?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900">{usuario?.displayName}</p>
              <p className="text-sm text-slate-500">{usuario?.email}</p>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">{usuario?.role?.replace('_', ' ') ?? 'Sin rol'}</p>
            </div>
          </div>
        </Card>

        <Button variant="danger" size="lg" className="w-full" onClick={() => signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
