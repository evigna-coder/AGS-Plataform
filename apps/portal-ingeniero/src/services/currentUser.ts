import type { UsuarioAGS } from '@ags/shared';

let _currentUser: UsuarioAGS | null = null;

export function setCurrentUser(u: UsuarioAGS | null): void {
  _currentUser = u;
}

export function getCurrentUser(): UsuarioAGS | null {
  return _currentUser;
}

export function getCreateTrace() {
  return {
    createdBy: _currentUser?.id ?? null,
    createdByName: _currentUser?.displayName ?? null,
  };
}

export function getUpdateTrace() {
  return {
    updatedBy: _currentUser?.id ?? null,
    updatedByName: _currentUser?.displayName ?? null,
  };
}

export function getCurrentUserTrace(): { uid: string; name: string } | null {
  if (!_currentUser) return null;
  return { uid: _currentUser.id, name: _currentUser.displayName };
}
