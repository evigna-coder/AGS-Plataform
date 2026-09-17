import { useCallback, useState } from 'react';
import type { PreferenciasUsuario } from '@ags/shared';
import { useAuth } from '../contexts/AuthContext';
import { usuariosService } from '../services/personalService';

/**
 * Preferencia de pantalla que sigue al USUARIO (2026-09-17): vive en su doc de
 * `usuarios` (`preferencias.<clave>`), así la ve igual en cualquier PC. Se lee
 * del perfil cargado al login, se mantiene en memoria mientras dura la sesión
 * y cada cambio se guarda en segundo plano (best-effort: si falla, la sesión
 * sigue con el valor elegido).
 */
export function usePreferenciaUsuario<K extends keyof PreferenciasUsuario>(
  clave: K,
  valorDefault: NonNullable<PreferenciasUsuario[K]>,
): [NonNullable<PreferenciasUsuario[K]>, (patch: Partial<NonNullable<PreferenciasUsuario[K]>>) => void] {
  const { usuario } = useAuth();
  const [valor, setValor] = useState<NonNullable<PreferenciasUsuario[K]>>(() => ({
    ...valorDefault,
    ...((usuario?.preferencias?.[clave] ?? {}) as Partial<NonNullable<PreferenciasUsuario[K]>>),
  }));

  const set = useCallback((patch: Partial<NonNullable<PreferenciasUsuario[K]>>) => {
    setValor(prev => {
      const next = { ...prev, ...patch };
      if (usuario?.id) {
        usuariosService.updatePreferencias(usuario.id, { [clave]: next } as Partial<PreferenciasUsuario>)
          .catch(err => console.warn('[usePreferenciaUsuario] no se pudo guardar la preferencia', clave, err));
      }
      return next;
    });
  }, [clave, usuario?.id]);

  return [valor, set];
}
