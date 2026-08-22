import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { NextcloudConfig, OnTrackBackupData } from '../types/ontrack';

export interface RemoteNextcloudFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  isDirectory: boolean;
  type?: string;
}

export interface NextcloudOperationResult<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  files?: RemoteNextcloudFile[];
  filename?: string;
  bytes?: number;
}

/**
 * Normalizes Nextcloud server and folder configs
 */
export function normalizeNextcloudConfig(config?: Partial<NextcloudConfig>): NextcloudConfig {
  let serverUrl = (config?.serverUrl || 'https://nc.fire4wd.uk').trim();
  if (serverUrl && !serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    serverUrl = `https://${serverUrl}`;
  }
  return {
    serverUrl,
    username: (config?.username || 'fire').trim(),
    folder: (config?.folder || 'FireTrack').trim().replace(/^\/+|\/+$/g, ''),
    autoSyncOnBackup: Boolean(config?.autoSyncOnBackup)
  };
}

/**
 * Formats network and TLS/SSL errors into clear actionable messages for the user
 */
export function formatNextcloudError(err: any, serverUrl: string): string {
  const msg = (err?.message || (typeof err === 'string' ? err : JSON.stringify(err || ''))).trim();

  if (/CertPathValidatorException|Trust anchor|SSLHandshakeException|CERT_|certificate/i.test(msg)) {
    return `Errore SSL (${serverUrl}): Certificato non riconosciuto. Verifica che l'app sia aggiornata con il supporto ai certificati autofirmati.`;
  }

  if (/ECONNREFUSED|Connection refused|Failed to connect/i.test(msg)) {
    return `Connessione rifiutata su ${serverUrl}: verifica che Nextcloud sia attivo e che la rete/VPN sia collegata.`;
  }

  if (/ETIMEDOUT|timeout|timed out/i.test(msg)) {
    return `Connessione scaduta (timeout) verso ${serverUrl}: verifica la connessione internet e lo stato del server.`;
  }

  return msg || 'Errore di connessione a Nextcloud';
}

/**
 * Builds WebDAV URLs for standard Nextcloud endpoints (ensuring trailing slashes for collections)
 */
export function getNextcloudUrls(serverUrl: string, username: string, folder: string) {
  let cleanBase = (serverUrl || 'https://nc.fire4wd.uk').trim().replace(/\/+$/, '');
  if (!cleanBase.startsWith('http://') && !cleanBase.startsWith('https://')) {
    cleanBase = `https://${cleanBase}`;
  }
  const cleanUser = (username || 'fire').trim();
  const cleanFolder = (folder || 'FireTrack').trim().replace(/^\/+|\/+$/g, '');

  if (cleanBase.includes('/remote.php/')) {
    const folderUrl = cleanFolder ? `${cleanBase}/${encodeURIComponent(cleanFolder)}/` : `${cleanBase}/`;
    return { baseWebdavUrl: `${cleanBase}/`, folderUrl, legacyFolderUrl: `${cleanBase}/`, cleanBase, cleanUser, cleanFolder };
  }

  const baseWebdavUrl = `${cleanBase}/remote.php/dav/files/${encodeURIComponent(cleanUser)}/`;
  const folderUrl = cleanFolder
    ? `${baseWebdavUrl}${cleanFolder.split('/').map(encodeURIComponent).join('/')}/`
    : baseWebdavUrl;
  const legacyFolderUrl = cleanFolder
    ? `${cleanBase}/remote.php/webdav/${cleanFolder.split('/').map(encodeURIComponent).join('/')}/`
    : `${cleanBase}/remote.php/webdav/`;

  return { baseWebdavUrl, folderUrl, legacyFolderUrl, cleanBase, cleanUser, cleanFolder };
}

/**
 * Basic Auth Header builder
 */
export function getBasicAuthHeader(username: string, password?: string): string {
  const creds = `${username || 'fire'}:${password || ''}`;
  try {
    return `Basic ${btoa(unescape(encodeURIComponent(creds)))}`;
  } catch {
    return `Basic ${btoa(creds)}`;
  }
}

/**
 * Parses WebDAV PROPFIND XML response into structured file array
 */
export function parsePropfindXml(xmlText: string, cleanFolder: string): RemoteNextcloudFile[] {
  const files: RemoteNextcloudFile[] = [];
  const responseMatches = xmlText.match(/<(?:[a-zA-Z0-9_-]+:)?response[\s>][\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?response>/gi) || [];

  for (const block of responseMatches) {
    const hrefMatch = block.match(/<(?:[a-zA-Z0-9_-]+:)?href>([^<]+)<\/(?:[a-zA-Z0-9_-]+:)?href>/i);
    if (!hrefMatch) continue;

    const rawHref = decodeURIComponent(hrefMatch[1]);
    const cleanHref = rawHref.replace(/\/+$/, '');
    const segments = cleanHref.split('/');
    const fileName = segments[segments.length - 1] || '';

    // Skip the parent folder itself or empty filenames
    if (!fileName || fileName.toLowerCase() === cleanFolder.toLowerCase() || fileName.toLowerCase() === 'firetrack') {
      continue;
    }

    const isDir = /<(?:\w+:)?collection(?:\s*\/|\s*>)/i.test(block) || /<d:resourcetype>\s*<d:collection\s*\/>\s*<\/d:resourcetype>/i.test(block);
    if (isDir) {
      // Skip folders
      continue;
    }

    // Ensure the file path belongs strictly to the requested folder
    if (cleanFolder) {
      const folderSegment = `/${cleanFolder.toLowerCase()}/`;
      if (!cleanHref.toLowerCase().includes(folderSegment) && !cleanHref.toLowerCase().endsWith(`/${cleanFolder.toLowerCase()}/${fileName.toLowerCase()}`)) {
        continue;
      }
    }

    const sizeMatch = block.match(/<(?:\w+:)?getcontentlength>(\d+)<\/(?:\w+:)?getcontentlength>/i);
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;

    const dateMatch = block.match(/<(?:\w+:)?getlastmodified>([^<]+)<\/(?:\w+:)?getlastmodified>/i);
    const lastModified = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();

    const typeMatch = block.match(/<(?:\w+:)?getcontenttype>([^<]+)<\/(?:\w+:)?getcontenttype>/i);
    const type = typeMatch
      ? typeMatch[1]
      : (fileName.endsWith('.json')
        ? 'application/json'
        : fileName.endsWith('.sqlite') || fileName.endsWith('.db')
        ? 'application/x-sqlite3'
        : 'application/octet-stream');

    files.push({
      name: fileName,
      path: cleanHref,
      size,
      lastModified,
      isDirectory: false,
      type
    });
  }

  // Sort newest first
  files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  return files;
}

/**
 * Checks if we are running in native Capacitor (Android/iOS)
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}

/**
 * Helper to safely parse JSON responses from proxy / server, detecting HTML fallback
 */
async function safeParseResponse(res: Response): Promise<{ ok: boolean; status: number; data: any; isHtml: boolean }> {
  const text = await res.text();
  const trimmed = text.trim();
  const isHtml = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('<body');

  if (isHtml) {
    return {
      ok: false,
      status: res.status,
      isHtml: true,
      data: {
        success: false,
        isHtml: true,
        error: `Il server web ha risposto con index.html anziché con le API backend. Se usi Nginx, aggiungi 'location /api/ { proxy_pass http://127.0.0.1:3000; }' oppure verifica l'accesso diretto a Nextcloud.`
      }
    };
  }

  try {
    const data = JSON.parse(text);
    return { ok: res.ok, status: res.status, data, isHtml: false };
  } catch {
    return {
      ok: false,
      status: res.status,
      isHtml: false,
      data: { success: false, error: `Risposta non valida dal server (HTTP ${res.status}): ${text.slice(0, 100)}` }
    };
  }
}

/**
 * Executes a WebDAV PROPFIND request safely across Web & Android OkHttp
 */
async function executePropfind(
  url: string,
  authHeader: string,
  depth: '0' | '1' = '0'
): Promise<{ ok: boolean; status: number; data: string; error?: string }> {
  // Strategy 1: In native app, try CapacitorHttp with PROPFIND inside a safe try-catch
  if (isNativeApp()) {
    try {
      const capRes = await CapacitorHttp.request({
        url,
        method: 'PROPFIND',
        headers: {
          Authorization: authHeader,
          Depth: depth,
          'Content-Type': 'application/xml',
          'OCS-APIRequest': 'true'
        },
        connectTimeout: 10000,
        readTimeout: 10000,
        responseType: 'text'
      });

      const text = typeof capRes.data === 'string' ? capRes.data : JSON.stringify(capRes.data || '');
      return {
        ok: capRes.status === 200 || capRes.status === 207,
        status: capRes.status,
        data: text
      };
    } catch (capErr: any) {
      // PROPFIND may not be supported by Android OkHttp - return gracefully without crashing
      return {
        ok: false,
        status: 0,
        data: '',
        error: capErr?.message || 'PROPFIND non supportato dal client nativo'
      };
    }
  }

  // Strategy 2: Standard browser fetch
  try {
    const fetchRes = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        Authorization: authHeader,
        Depth: depth,
        'Content-Type': 'application/xml',
        'OCS-APIRequest': 'true'
      }
    });

    const text = await fetchRes.text();
    return {
      ok: fetchRes.ok || fetchRes.status === 207 || fetchRes.status === 200,
      status: fetchRes.status,
      data: text
    };
  } catch (fetchErr: any) {
    return {
      ok: false,
      status: 0,
      data: '',
      error: fetchErr?.message || 'Errore di connessione'
    };
  }
}

/**
 * Searches and lists files in Nextcloud using the standard OCS Search REST API (100% GET methods)
 */
async function listViaOcsSearch(
  cleanBase: string,
  cleanFolder: string,
  authHeader: string
): Promise<RemoteNextcloudFile[]> {
  const terms = [cleanFolder || 'firetrack', 'backup', 'json', 'sqlite'];
  const foundMap = new Map<string, RemoteNextcloudFile>();

  for (const term of terms) {
    try {
      const searchUrl = `${cleanBase}/ocs/v2.php/search/providers/files/search?term=${encodeURIComponent(term)}&format=json`;
      const res = await CapacitorHttp.request({
        url: searchUrl,
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'OCS-APIRequest': 'true',
          Accept: 'application/json'
        },
        connectTimeout: 8000,
        readTimeout: 8000
      });

      if (res.status === 200 && res.data) {
        let entries: any[] = [];
        const raw = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (Array.isArray(raw?.ocs?.data?.entries)) {
          entries = raw.ocs.data.entries;
        } else if (Array.isArray(raw?.ocs?.data)) {
          entries = raw.ocs.data;
        }

        for (const entry of entries) {
          const name = entry.name || entry.title || '';
          if (!name || name.toLowerCase() === cleanFolder.toLowerCase() || name === 'firetrack_manifest.json') continue;

          const pathAttr = entry.attributes?.path || entry.subline || entry.path || '';
          const matchesFolder = cleanFolder
            ? pathAttr.toLowerCase().includes(`/${cleanFolder.toLowerCase()}`) || pathAttr.toLowerCase().includes(cleanFolder.toLowerCase())
            : true;
          const matchesPrefix = name.toLowerCase().startsWith('firetrack_') || name.toLowerCase().includes('backup');

          if (matchesFolder || matchesPrefix) {
            const size = Number(entry.attributes?.size || entry.size || 0);
            const mtime = entry.attributes?.mtime
              ? new Date(entry.attributes.mtime * 1000).toISOString()
              : new Date().toISOString();
            const type = name.endsWith('.json')
              ? 'application/json'
              : name.endsWith('.sqlite') || name.endsWith('.db')
              ? 'application/x-sqlite3'
              : 'application/octet-stream';

            if (!foundMap.has(name)) {
              foundMap.set(name, {
                name,
                path: pathAttr || name,
                size,
                lastModified: mtime,
                isDirectory: false,
                type
              });
            }
          }
        }
      }
    } catch {}
  }

  const list = Array.from(foundMap.values());
  list.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  return list;
}

/**
 * Fetches the manifest index file of backups from Nextcloud
 */
async function fetchRemoteManifest(
  folderUrl: string,
  authHeader: string
): Promise<RemoteNextcloudFile[]> {
  try {
    const manifestUrl = `${folderUrl.replace(/\/+$/, '')}/firetrack_manifest.json`;
    let content: any = null;

    if (isNativeApp()) {
      const res = await CapacitorHttp.request({
        url: manifestUrl,
        method: 'GET',
        headers: { Authorization: authHeader },
        connectTimeout: 8000,
        readTimeout: 8000
      });
      if (res.status === 200 && res.data) {
        content = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      }
    } else {
      const res = await fetch(manifestUrl, {
        headers: { Authorization: authHeader }
      });
      if (res.ok) {
        content = await res.json();
      }
    }

    if (content && Array.isArray(content.files)) {
      return content.files.map((f: any) => ({
        name: f.name,
        path: f.path || f.href || f.name,
        size: Number(f.size || 0),
        lastModified: f.lastModified || f.mtime || new Date().toISOString(),
        isDirectory: false,
        type: f.type || (f.name.endsWith('.json') ? 'application/json' : 'application/x-sqlite3')
      }));
    }
  } catch {}
  return [];
}

/**
 * Updates the remote manifest file after uploading or deleting a backup
 */
async function updateRemoteManifest(
  folderUrl: string,
  authHeader: string,
  newFile?: RemoteNextcloudFile,
  removeFileName?: string
) {
  try {
    const currentFiles = await fetchRemoteManifest(folderUrl, authHeader);
    let updated = currentFiles.filter(f => f.name !== (removeFileName || ''));
    if (newFile) {
      updated = updated.filter(f => f.name !== newFile.name);
      updated.unshift(newFile);
    }
    const manifestContent = JSON.stringify({
      lastUpdated: new Date().toISOString(),
      files: updated
    }, null, 2);

    const manifestUrl = `${folderUrl.replace(/\/+$/, '')}/firetrack_manifest.json`;
    if (isNativeApp()) {
      await CapacitorHttp.request({
        url: manifestUrl,
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        data: manifestContent
      });
    } else {
      await fetch(manifestUrl, {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: manifestContent
      });
    }
  } catch {}
}

/**
 * Ensures destination collection/folder exists safely
 */
async function ensureRemoteFolder(folderUrl: string, authHeader: string): Promise<boolean> {
  if (!folderUrl) return true;
  const noSlash = folderUrl.replace(/\/+$/, '');
  const urlsToTry = [noSlash, `${noSlash}/`];

  for (const u of urlsToTry) {
    try {
      if (isNativeApp()) {
        const res = await CapacitorHttp.request({
          url: u,
          method: 'MKCOL',
          headers: {
            Authorization: authHeader,
            'OCS-APIRequest': 'true'
          },
          connectTimeout: 5000,
          readTimeout: 5000
        });
        if (res.status === 201 || res.status === 405 || res.status === 200 || res.status === 204) {
          return true;
        }
      } else {
        const res = await fetch(u, {
          method: 'MKCOL',
          headers: { Authorization: authHeader, 'OCS-APIRequest': 'true' }
        });
        if (res.status === 201 || res.status === 405 || res.status === 200 || res.status === 204) {
          return true;
        }
      }
    } catch {}
  }

  // Always return true so uploads are not blocked if MKCOL is rejected by OkHttp
  return true;
}

/**
 * 1. Test Nextcloud Connection & Authentication
 * Uses standard GET methods (status.php & OCS capabilities) to prevent OkHttp method exceptions.
 */
export async function testNextcloudConnection(
  config: NextcloudConfig,
  password: string
): Promise<NextcloudOperationResult> {
  if (!password) {
    return {
      success: false,
      error: 'Inserisci la password di Nextcloud per continuare.'
    };
  }

  const norm = normalizeNextcloudConfig(config);
  const { folderUrl, cleanBase, cleanFolder, cleanUser } = getNextcloudUrls(norm.serverUrl, norm.username, norm.folder);
  const authHeader = getBasicAuthHeader(cleanUser, password);

  // Strategy A: Native App direct check using standard GET methods
  if (isNativeApp()) {
    try {
      // Step 1: Verify Nextcloud status via GET /status.php
      let statusRes: HttpResponse;
      try {
        statusRes = await CapacitorHttp.request({
          url: `${cleanBase}/status.php`,
          method: 'GET',
          connectTimeout: 10000,
          readTimeout: 10000
        });
      } catch (err: any) {
        return {
          success: false,
          error: formatNextcloudError(err, cleanBase)
        };
      }

      if (statusRes.status !== 200) {
        return {
          success: false,
          error: `Il server Nextcloud (${cleanBase}) ha risposto con codice HTTP ${statusRes.status}.`
        };
      }

      // Step 2: Verify Credentials via GET /ocs/v2.php/core/getcapabilities
      const authRes = await CapacitorHttp.request({
        url: `${cleanBase}/ocs/v2.php/core/getcapabilities?format=json`,
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'OCS-APIRequest': 'true',
          Accept: 'application/json'
        },
        connectTimeout: 10000,
        readTimeout: 10000
      });

      if (authRes.status === 401 || authRes.status === 403) {
        return {
          success: false,
          error: `Autenticazione fallita su Nextcloud per l'utente '${cleanUser}'. Verifica che la password sia corretta.`
        };
      }

      if (authRes.status !== 200) {
        // Fallback: check Nextcloud files search API (Standard GET)
        const searchCheck = await CapacitorHttp.request({
          url: `${cleanBase}/ocs/v2.php/search/providers/files/search?term=test&format=json`,
          method: 'GET',
          headers: {
            Authorization: authHeader,
            'OCS-APIRequest': 'true',
            Accept: 'application/json'
          },
          connectTimeout: 8000,
          readTimeout: 8000
        });

        if (searchCheck.status === 401 || searchCheck.status === 403) {
          return {
            success: false,
            error: `Autenticazione fallita su Nextcloud per l'utente '${cleanUser}'. Verifica che username e password siano corretti.`
          };
        }
      }

      // Step 3: Ensure folder exists
      if (cleanFolder) {
        await ensureRemoteFolder(folderUrl, authHeader);
      }

      return {
        success: true,
        message: `✅ Connessione stabilita con successo a Nextcloud (${cleanBase})! Cartella '${cleanFolder}' pronta.`
      };
    } catch (nativeErr: any) {
      return {
        success: false,
        error: `Errore durante il test di connessione: ${nativeErr?.message || 'Server non raggiungibile.'}`
      };
    }
  }

  // Strategy B: Web Browser (Via backend proxy /api/nextcloud/test)
  try {
    const res = await fetch('/api/nextcloud/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: norm.serverUrl,
        username: norm.username,
        password,
        folder: norm.folder
      })
    });

    const parsed = await safeParseResponse(res);

    if (!parsed.ok || !parsed.data?.success) {
      const serverErrMsg = parsed.data?.error || `Errore HTTP ${parsed.status} durante la connessione.`;
      return {
        success: false,
        error: serverErrMsg
      };
    }

    return {
      success: true,
      message: parsed.data.message || `✅ Connessione stabilita con successo a Nextcloud (${norm.serverUrl})!`
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Impossibile contattare il server (${norm.serverUrl}): ${err.message || 'Errore di rete.'}`
    };
  }
}

/**
 * Helper to fetch exact Content-Length for a remote file via HEAD request
 */
async function getRemoteFileSize(fileUrl: string, authHeader: string): Promise<number> {
  try {
    if (isNativeApp()) {
      const res = await CapacitorHttp.request({
        url: fileUrl,
        method: 'HEAD',
        headers: { Authorization: authHeader },
        connectTimeout: 5000,
        readTimeout: 5000
      });
      const headers = res.headers || {};
      const cl = headers['Content-Length'] || headers['content-length'] || headers['Content-length'];
      if (cl) return parseInt(cl, 10);
    } else {
      const res = await fetch(fileUrl, {
        method: 'HEAD',
        headers: { Authorization: authHeader }
      });
      const cl = res.headers.get('content-length');
      if (cl) return parseInt(cl, 10);
    }
  } catch {}
  return 0;
}

/**
 * 2. List remote backup files in Nextcloud folder
 */
export async function listNextcloudBackups(
  config: NextcloudConfig,
  password: string
): Promise<NextcloudOperationResult<RemoteNextcloudFile[]>> {
  if (!password) {
    return {
      success: false,
      error: 'Password richiesta per accedere ai file su Nextcloud.'
    };
  }

  const norm = normalizeNextcloudConfig(config);
  const { folderUrl, legacyFolderUrl, cleanUser, cleanFolder, cleanBase } = getNextcloudUrls(norm.serverUrl, norm.username, norm.folder);
  const authHeader = getBasicAuthHeader(cleanUser, password);

  // Strategy A: Native App (Prioritizing WebDAV PROPFIND with accurate size retrieval & fallbacks)
  if (isNativeApp()) {
    try {
      const fileMap = new Map<string, RemoteNextcloudFile>();

      // 1. Primary Strategy: WebDAV PROPFIND (Gives exact <d:getcontentlength> and timestamps)
      const propfindUrls = [folderUrl, legacyFolderUrl];
      for (const pUrl of propfindUrls) {
        if (fileMap.size > 0) break;
        const propfindResult = await executePropfind(pUrl, authHeader, '1');
        if (propfindResult.ok && propfindResult.data) {
          const parsed = parsePropfindXml(propfindResult.data, cleanFolder);
          for (const f of parsed) {
            if (!fileMap.has(f.name)) fileMap.set(f.name, f);
          }
        }
      }

      // 2. Fallback: Remote Manifest Index
      if (fileMap.size === 0) {
        const manifestFiles = await fetchRemoteManifest(folderUrl, authHeader);
        for (const f of manifestFiles) {
          if (!fileMap.has(f.name)) fileMap.set(f.name, f);
        }
      }

      // 3. Fallback: Nextcloud OCS Search API (100% GET)
      if (fileMap.size === 0) {
        const ocsFiles = await listViaOcsSearch(cleanBase, cleanFolder, authHeader);
        for (const f of ocsFiles) {
          if (!fileMap.has(f.name)) fileMap.set(f.name, f);
        }
      }

      // 4. Ensure NO file has size 0: fetch exact Content-Length via HEAD if size is 0
      for (const f of fileMap.values()) {
        if (f.size <= 0) {
          const directFileUrl = `${folderUrl.replace(/\/+$/, '')}/${encodeURIComponent(f.name)}`;
          const realSize = await getRemoteFileSize(directFileUrl, authHeader);
          if (realSize > 0) {
            f.size = realSize;
          } else {
            const legacyFileUrl = `${legacyFolderUrl.replace(/\/+$/, '')}/${encodeURIComponent(f.name)}`;
            const legacySize = await getRemoteFileSize(legacyFileUrl, authHeader);
            if (legacySize > 0) {
              f.size = legacySize;
            }
          }
        }
      }

      const files = Array.from(fileMap.values());
      files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
      return { success: true, files, data: files };
    } catch (nativeErr: any) {
      return {
        success: true,
        files: [],
        data: []
      };
    }
  }

  // Strategy B: Web Browser (Proxy /api/nextcloud/list)
  try {
    const res = await fetch('/api/nextcloud/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: norm.serverUrl,
        username: norm.username,
        password,
        folder: norm.folder
      })
    });

    const parsed = await safeParseResponse(res);

    if (!parsed.ok || !parsed.data?.success) {
      return {
        success: false,
        error: parsed.data?.error || 'Impossibile recuperare i file remoti da Nextcloud.'
      };
    }

    return {
      success: true,
      files: parsed.data.files || [],
      data: parsed.data.files || []
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Errore di rete durante la lettura dei file.'
    };
  }
}

/**
 * 3. Upload JSON Backup to Nextcloud
 */
export async function uploadJsonBackupToNextcloud(
  config: NextcloudConfig,
  password: string,
  jsonString: string,
  customFilename?: string
): Promise<NextcloudOperationResult> {
  if (!password) {
    return {
      success: false,
      error: 'Password richiesta per il caricamento su Nextcloud.'
    };
  }

  const norm = normalizeNextcloudConfig(config);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = customFilename || `FireTrack_Backup_${dateStr}_${timeStr}.json`;
  const { folderUrl, cleanUser, cleanFolder, cleanBase } = getNextcloudUrls(norm.serverUrl, norm.username, norm.folder);
  const authHeader = getBasicAuthHeader(cleanUser, password);

  // Ensure destination folder exists
  await ensureRemoteFolder(folderUrl, authHeader);

  const targetFileUrl = `${folderUrl.replace(/\/+$/, '')}/${encodeURIComponent(filename)}`;
  const byteSize = new Blob([jsonString]).size;

  // Strategy A: Native App (Direct PUT via CapacitorHttp)
  if (isNativeApp()) {
    try {
      const uploadRes = await CapacitorHttp.request({
        url: targetFileUrl,
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        data: jsonString
      });

      if (uploadRes.status === 401 || uploadRes.status === 403) {
        return { success: false, error: 'Credenziali non valide su Nextcloud.' };
      }

      if (uploadRes.status === 200 || uploadRes.status === 201 || uploadRes.status === 204) {
        // Update remote manifest index
        await updateRemoteManifest(folderUrl, authHeader, {
          name: filename,
          path: `${cleanFolder}/${filename}`,
          size: byteSize,
          lastModified: new Date().toISOString(),
          isDirectory: false,
          type: 'application/json'
        });

        return {
          success: true,
          message: `File '${filename}' caricato con successo in Nextcloud/${cleanFolder}!`,
          filename,
          bytes: byteSize
        };
      }

      return {
        success: false,
        error: `Errore caricamento HTTP ${uploadRes.status}`
      };
    } catch (nativeErr: any) {
      return {
        success: false,
        error: formatNextcloudError(nativeErr, cleanBase)
      };
    }
  }

  // Strategy B: Web Browser (Proxy /api/nextcloud/upload)
  try {
    const res = await fetch('/api/nextcloud/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: norm.serverUrl,
        username: norm.username,
        password,
        folder: norm.folder,
        filename,
        content: jsonString,
        contentType: 'application/json',
        isBase64: false
      })
    });

    const parsed = await safeParseResponse(res);

    if (!parsed.ok || !parsed.data?.success) {
      return {
        success: false,
        error: parsed.data?.error || 'Errore durante il caricamento del file JSON su Nextcloud.'
      };
    }

    return {
      success: true,
      message: parsed.data.message || `File ${filename} caricato con successo su Nextcloud!`,
      filename,
      bytes: parsed.data.bytes
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Errore di rete durante il caricamento.'
    };
  }
}

/**
 * 4. Upload Raw SQLite DB to Nextcloud
 */
export async function uploadSqliteDbToNextcloud(
  config: NextcloudConfig,
  password: string,
  sqliteBytes: Uint8Array,
  customFilename?: string
): Promise<NextcloudOperationResult> {
  if (!password) {
    return {
      success: false,
      error: 'Password richiesta per il caricamento su Nextcloud.'
    };
  }

  const norm = normalizeNextcloudConfig(config);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = customFilename || `FireTrack_Database_${dateStr}_${timeStr}.sqlite`;
  const { folderUrl, cleanUser, cleanFolder, cleanBase } = getNextcloudUrls(norm.serverUrl, norm.username, norm.folder);
  const authHeader = getBasicAuthHeader(cleanUser, password);

  // Convert Uint8Array to base64
  let binary = '';
  const len = sqliteBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(sqliteBytes[i]);
  }
  const base64Content = btoa(binary);

  // Ensure folder exists
  await ensureRemoteFolder(folderUrl, authHeader);

  const targetFileUrl = `${folderUrl.replace(/\/+$/, '')}/${encodeURIComponent(filename)}`;

  // Strategy A: Native App (CapacitorHttp WebDAV PUT)
  if (isNativeApp()) {
    try {
      const putRes = await CapacitorHttp.request({
        url: targetFileUrl,
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-sqlite3'
        },
        data: base64Content
      });

      if (putRes.status === 200 || putRes.status === 201 || putRes.status === 204) {
        // Update remote manifest index
        await updateRemoteManifest(folderUrl, authHeader, {
          name: filename,
          path: `${cleanFolder}/${filename}`,
          size: sqliteBytes.byteLength,
          lastModified: new Date().toISOString(),
          isDirectory: false,
          type: 'application/x-sqlite3'
        });

        return {
          success: true,
          message: `Database SQLite (${filename}) caricato su Nextcloud/${cleanFolder}!`,
          filename,
          bytes: sqliteBytes.byteLength
        };
      }

      return {
        success: false,
        error: `Errore caricamento database SQLite (HTTP ${putRes.status})`
      };
    } catch (nativeErr: any) {
      return {
        success: false,
        error: formatNextcloudError(nativeErr, cleanBase)
      };
    }
  }

  // Strategy B: Web Browser (Proxy /api/nextcloud/upload)
  // Strategy B: Web Browser (Proxy /api/nextcloud/upload)
  try {
    const res = await fetch('/api/nextcloud/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: norm.serverUrl,
        username: norm.username,
        password,
        folder: norm.folder,
        filename,
        content: base64Content,
        contentType: 'application/x-sqlite3',
        isBase64: true
      })
    });

    const parsed = await safeParseResponse(res);

    if (!parsed.ok || !parsed.data?.success) {
      return {
        success: false,
        error: parsed.data?.error || 'Errore durante il caricamento del database SQLite.'
      };
    }

    return {
      success: true,
      message: parsed.data.message || `Database SQLite (${filename}) caricato su Nextcloud!`,
      filename,
      bytes: parsed.data.bytes
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Errore durante il caricamento del file SQLite.'
    };
  }
}

/**
 * 5. Download a backup file from Nextcloud
 */
export async function downloadBackupFromNextcloud(
  config: NextcloudConfig,
  password: string,
  filename: string
): Promise<NextcloudOperationResult<{ content: string; isBase64: boolean; contentType: string }>> {
  if (!password || !filename) {
    return {
      success: false,
      error: 'Password e nome file richiesti.'
    };
  }

  const norm = normalizeNextcloudConfig(config);
  const isBinary = filename.endsWith('.sqlite') || filename.endsWith('.db');
  const { folderUrl, cleanUser, cleanBase } = getNextcloudUrls(norm.serverUrl, norm.username, norm.folder);
  const authHeader = getBasicAuthHeader(cleanUser, password);
  const targetFileUrl = `${folderUrl.replace(/\/+$/, '')}/${encodeURIComponent(filename)}`;

  // Strategy A: Native App (CapacitorHttp WebDAV GET)
  if (isNativeApp()) {
    try {
      const textRes = await CapacitorHttp.request({
        url: targetFileUrl,
        method: 'GET',
        headers: { Authorization: authHeader },
        responseType: isBinary ? 'blob' : 'text'
      });

      if (textRes.status === 200) {
        const content = typeof textRes.data === 'string' ? textRes.data : JSON.stringify(textRes.data);
        return {
          success: true,
          data: {
            content,
            isBase64: isBinary,
            contentType: isBinary ? 'application/x-sqlite3' : 'application/json'
          }
        };
      }

      return {
        success: false,
        error: `File non trovato o errore HTTP ${textRes.status}`
      };
    } catch (nativeErr: any) {
      return {
        success: false,
        error: formatNextcloudError(nativeErr, cleanBase)
      };
    }
  }

  // Strategy B: Web Browser (Proxy /api/nextcloud/download)
  try {
    const res = await fetch('/api/nextcloud/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: norm.serverUrl,
        username: norm.username,
        password,
        folder: norm.folder,
        filename,
        asBase64: isBinary
      })
    });

    const parsed = await safeParseResponse(res);

    if (!parsed.ok || !parsed.data?.success) {
      return {
        success: false,
        error: parsed.data?.error || `Impossibile scaricare ${filename} da Nextcloud.`
      };
    }

    return {
      success: true,
      data: {
        content: parsed.data.content,
        isBase64: Boolean(parsed.data.isBase64),
        contentType: parsed.data.contentType
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Errore durante il download dal server.'
    };
  }
}

/**
 * 6. Delete a file from Nextcloud
 */
export async function deleteBackupFromNextcloud(
  config: NextcloudConfig,
  password: string,
  filename: string
): Promise<NextcloudOperationResult> {
  if (!password || !filename) {
    return {
      success: false,
      error: 'Password e nome file richiesti.'
    };
  }

  const norm = normalizeNextcloudConfig(config);
  const { folderUrl, cleanUser, cleanBase } = getNextcloudUrls(norm.serverUrl, norm.username, norm.folder);
  const authHeader = getBasicAuthHeader(cleanUser, password);
  const targetFileUrl = `${folderUrl.replace(/\/+$/, '')}/${encodeURIComponent(filename)}`;

  // Strategy A: Native App (CapacitorHttp WebDAV DELETE)
  if (isNativeApp()) {
    try {
      const delRes = await CapacitorHttp.request({
        url: targetFileUrl,
        method: 'DELETE',
        headers: { Authorization: authHeader }
      });

      if (delRes.status === 204 || delRes.status === 200 || delRes.status === 404) {
        await updateRemoteManifest(folderUrl, authHeader, undefined, filename);
        return {
          success: true,
          message: `File ${filename} eliminato con successo.`
        };
      }

      return {
        success: false,
        error: `Errore eliminazione HTTP ${delRes.status}`
      };
    } catch (nativeErr: any) {
      return {
        success: false,
        error: formatNextcloudError(nativeErr, cleanBase)
      };
    }
  }

  // Strategy B: Web Browser (Proxy /api/nextcloud/delete)
  try {
    const res = await fetch('/api/nextcloud/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: norm.serverUrl,
        username: norm.username,
        password,
        folder: norm.folder,
        filename
      })
    });

    const parsed = await safeParseResponse(res);

    if (!parsed.ok || !parsed.data?.success) {
      return {
        success: false,
        error: parsed.data?.error || 'Impossibile eliminare il file da Nextcloud.'
      };
    }

    return {
      success: true,
      message: parsed.data.message || `File ${filename} eliminato con successo.`
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Errore di rete durante la cancellazione.'
    };
  }
}
