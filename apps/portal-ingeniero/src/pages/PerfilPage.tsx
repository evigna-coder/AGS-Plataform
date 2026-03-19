import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/authService';
import { usuariosService } from '../services/firebaseService';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SignaturePad, type SignaturePadHandle } from '../components/ordenes-trabajo/SignaturePad';

export default function PerfilPage() {
  const { usuario, firebaseUser } = useAuth();
  const padRef = useRef<SignaturePadHandle>(null);

  const [nombreAclaracion, setNombreAclaracion] = useState('');
  const [savedFirma, setSavedFirma] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingFirma, setLoadingFirma] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing firma on mount
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    usuariosService.getFirma(firebaseUser.uid).then(data => {
      if (data.firmaBase64) setSavedFirma(data.firmaBase64);
      setNombreAclaracion(data.nombreAclaracion || usuario?.displayName || '');
      setLoadingFirma(false);
    }).catch(() => {
      setNombreAclaracion(usuario?.displayName || '');
      setLoadingFirma(false);
    });
  }, [firebaseUser?.uid, usuario?.displayName]);

  const handleSave = async () => {
    if (!firebaseUser?.uid || !padRef.current) return;

    const isEmpty = padRef.current.isEmpty();
    if (isEmpty && !savedFirma) {
      setMessage({ type: 'error', text: 'Dibujá tu firma antes de guardar.' });
      return;
    }
    if (!nombreAclaracion.trim()) {
      setMessage({ type: 'error', text: 'Ingresá tu nombre/aclaración.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const firmaData = isEmpty ? savedFirma! : padRef.current.getDataURL();
      await usuariosService.saveFirma(firebaseUser.uid, firmaData, nombreAclaracion.trim());
      setSavedFirma(firmaData);
      setEditing(false);
      setMessage({ type: 'success', text: 'Firma guardada correctamente.' });
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar la firma.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    padRef.current?.clear();
    setSavedFirma(null);
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Perfil" />
      <div className="flex-1 p-4 space-y-4">
        {/* User info */}
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

        {/* Firma digital */}
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Firma digital</h3>
              {savedFirma && !editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Tu firma se cargará automáticamente en cada reporte nuevo.
            </p>

            {loadingFirma ? (
              <div className="h-28 flex items-center justify-center">
                <p className="text-xs text-slate-400 animate-pulse">Cargando firma...</p>
              </div>
            ) : savedFirma && !editing ? (
              /* Preview saved signature */
              <div className="space-y-2">
                <div className="h-40 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center p-2">
                  <img src={savedFirma} alt="Firma" className="max-h-full max-w-full object-contain" />
                </div>
                <p className="text-xs font-semibold text-slate-700 text-center">{nombreAclaracion}</p>
              </div>
            ) : (
              /* Drawing mode */
              <div className="space-y-3">
                <SignaturePad ref={padRef} />
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleClear}>
                    Limpiar
                  </Button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre / Aclaración</label>
                  <input
                    type="text"
                    value={nombreAclaracion}
                    onChange={e => setNombreAclaracion(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  {editing && (
                    <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                      Cancelar
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar firma'}
                  </Button>
                </div>
              </div>
            )}

            {message && (
              <p className={`text-xs font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
          </div>
        </Card>

        <Button variant="danger" size="sm" onClick={() => signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
