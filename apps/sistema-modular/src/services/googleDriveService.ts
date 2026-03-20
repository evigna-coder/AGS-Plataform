/**
 * Google Drive Service
 *
 * Maneja upload/download/delete de fotos en Google Drive usando la REST API v3.
 * La autenticación (Service Account JWT → access token) se hace en el main process
 * de Electron vía IPC. El renderer solo recibe el token y hace fetch directo.
 *
 * Requisitos:
 *   1. Archivo ~/.ags/service-account.json con las credenciales del Service Account
 *   2. Google Drive API habilitada en el proyecto de Google Cloud
 *   3. Ejecutar en modo Electron (en web puro, upload no funciona)
 *
 * Estructura en Drive:
 *   AGS - Fichas Propiedad/
 *     └── FPC-0001/
 *         ├── 1709312400000_foto1.jpg
 *         └── 1709312500000_foto2.png
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const ROOT_FOLDER_NAME = 'AGS - Fichas Propiedad';

async function getToken(): Promise<string> {
  if (!window.driveAPI) {
    throw new Error('Google Drive solo disponible en modo Electron');
  }
  const result = await window.driveAPI.getToken();
  if (result.error || !result.token) {
    throw new Error(result.error || 'No se pudo obtener token de Google Drive');
  }
  return result.token;
}

async function driveRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const resp = await fetch(`${DRIVE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive API error ${resp.status}: ${err}`);
  }
  return resp;
}

/** Find a folder by name inside a parent (or root if no parent). */
async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`;
  const resp = await driveRequest(`/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
  const data = await resp.json();
  return data.files?.[0]?.id || null;
}

/** Create a folder. Returns the new folder ID. */
async function createFolder(name: string, parentId?: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) metadata.parents = [parentId];

  const resp = await driveRequest('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  const data = await resp.json();
  return data.id;
}

/** Get or create the root "AGS - Fichas Propiedad" folder. Caches ID in drive-config.json. */
async function getRootFolderId(): Promise<string> {
  // Check cached config
  if (window.driveAPI) {
    const config = await window.driveAPI.getConfig();
    if (config.rootFolderId) {
      return config.rootFolderId;
    }
  }

  // Search for existing
  let folderId = await findFolder(ROOT_FOLDER_NAME);
  if (!folderId) {
    folderId = await createFolder(ROOT_FOLDER_NAME);
  }

  // Cache for next time
  if (window.driveAPI) {
    await window.driveAPI.saveConfig({ rootFolderId: folderId });
  }
  return folderId;
}

/** Get or create the subfolder for a specific ficha. */
async function getFichaFolderId(fichaNumero: string): Promise<string> {
  const rootId = await getRootFolderId();
  let folderId = await findFolder(fichaNumero, rootId);
  if (!folderId) {
    folderId = await createFolder(fichaNumero, rootId);
  }
  return folderId;
}

export const googleDriveService = {
  /** Check if Drive integration is available and configured. */
  async isAvailable(): Promise<boolean> {
    if (!window.driveAPI) return false;
    try {
      return await window.driveAPI.isConfigured();
    } catch {
      return false;
    }
  },

  /**
   * Upload a file to the ficha's folder in Google Drive.
   * Returns metadata for storing in Firestore.
   */
  async uploadFile(fichaNumero: string, file: File): Promise<{
    driveFileId: string;
    url: string;
    viewUrl: string;
  }> {
    const folderId = await getFichaFolderId(fichaNumero);
    const token = await getToken();

    const fileName = `${Date.now()}_${file.name}`;
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    // Multipart upload
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    );
    form.append('file', file);

    const uploadResp = await fetch(
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    );
    if (!uploadResp.ok) {
      const err = await uploadResp.text();
      throw new Error(`Error subiendo archivo: ${err}`);
    }
    const data = await uploadResp.json();

    // Make file publicly viewable (anyone with link)
    await driveRequest(`/files/${data.id}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    return {
      driveFileId: data.id,
      url: `https://drive.google.com/thumbnail?id=${data.id}&sz=w1200`,
      viewUrl: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    };
  },

  /** Delete a file from Google Drive by its file ID. */
  async deleteFile(driveFileId: string): Promise<void> {
    const token = await getToken();
    const resp = await fetch(`${DRIVE_API}/files/${driveFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Error eliminando archivo de Drive: ${resp.status}`);
    }
  },
};
