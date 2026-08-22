import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Converts a Blob to a Base64 data string (without the data URL prefix)
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

/**
 * Normalizes mime type based on file extension
 */
export function getMimeTypeForFilename(filename: string, defaultMime = 'application/octet-stream'): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.sqlite') || lower.endsWith('.db')) {
    return 'application/x-sqlite3';
  }
  if (lower.endsWith('.json')) {
    return 'application/json';
  }
  if (lower.endsWith('.csv')) {
    return 'text/csv;charset=utf-8;';
  }
  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (lower.endsWith('.txt')) {
    return 'text/plain;charset=utf-8;';
  }
  return defaultMime;
}

/**
 * Direct browser download triggered immediately on user action without async delays.
 * Optimized for Android Chrome, Samsung Internet, iOS Safari & Desktop browsers.
 */
export function triggerDirectDownload(blob: Blob, filename: string): boolean {
  try {
    const finalMimeType = getMimeTypeForFilename(filename);
    const typedBlob = blob.type === finalMimeType ? blob : new Blob([blob], { type: finalMimeType });

    const url = URL.createObjectURL(typedBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.setAttribute('download', filename);
    a.target = '_self';
    a.rel = 'noopener';

    document.body.appendChild(a);
    
    // Use click and synthetic MouseEvent for highest mobile browser compatibility
    try {
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
      });
      a.dispatchEvent(clickEvent);
    } catch {
      a.click();
    }

    // Keep object URL alive for 90s so Android Download Manager finishes receiving data
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 90000);

    return true;
  } catch (err) {
    console.error('Direct download failed:', err);
    return false;
  }
}

/**
 * Native Share sheet (Android Share / iOS Share Sheet / Capacitor)
 * Allows sending directly to Google Drive, WhatsApp, Gmail, Telegram, Files, etc.
 */
export async function shareFileNative({
  filename,
  blob,
  mimeType,
  dialogTitle = 'Condividi o Salva'
}: {
  filename: string;
  blob: Blob;
  mimeType?: string;
  dialogTitle?: string;
}): Promise<{ success: boolean; message: string }> {
  const finalMimeType = getMimeTypeForFilename(filename, mimeType);
  const typedBlob = blob.type === finalMimeType ? blob : new Blob([blob], { type: finalMimeType });

  // 1. Capacitor Native Android / iOS
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(typedBlob);
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      await Share.share({
        title: dialogTitle,
        text: filename,
        files: [writeResult.uri],
        dialogTitle: dialogTitle
      });

      return { success: true, message: 'Finestra di condivisione aperta con successo.' };
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('cancel') || err?.message?.includes('dismiss')) {
        return { success: true, message: 'Condivisione annullata.' };
      }
      console.warn('Capacitor share error:', err);
    }
  }

  // 2. Web Share API (Mobile Chrome / Safari)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      const file = new File([typedBlob], filename, { type: finalMimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: dialogTitle
        });
        return { success: true, message: 'Condivisione completata con successo.' };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: true, message: 'Condivisione annullata.' };
      }
      console.warn('Web Share API error:', shareErr);
    }
  }

  // Fallback to direct download if share isn't supported
  const dlSuccess = triggerDirectDownload(typedBlob, filename);
  return {
    success: dlSuccess,
    message: dlSuccess ? 'File scaricato nei Download.' : 'Impossibile condividere o scaricare il file.'
  };
}

/**
 * Universal file saver & sharer:
 * - In Capacitor native platform: Saves to device cache & opens native Share modal.
 * - In Web browsers (Android Chrome, Desktop, iOS): Triggers instant direct download to "Download" folder.
 */
export async function saveOrShareFile({
  filename,
  blob,
  mimeType,
  dialogTitle = 'Condividi o Salva File'
}: {
  filename: string;
  blob: Blob;
  mimeType?: string;
  dialogTitle?: string;
}): Promise<{ success: boolean; method: 'capacitor' | 'browser-download'; message: string }> {
  const finalMimeType = getMimeTypeForFilename(filename, mimeType);
  const normalizedBlob = blob.type === finalMimeType ? blob : new Blob([blob], { type: finalMimeType });

  // 1. Capacitor Native Platform (Android / iOS APK)
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(normalizedBlob);

      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      // Try Documents directory as well
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (docErr) {
        console.log('Optional Documents write:', docErr);
      }

      // Open Android native share sheet
      try {
        await Share.share({
          title: dialogTitle,
          text: filename,
          files: [writeResult.uri],
          dialogTitle: dialogTitle
        });
      } catch (shareErr) {
        console.warn('Capacitor share dismissed or unavailable:', shareErr);
      }

      return {
        success: true,
        method: 'capacitor',
        message: 'File salvato sul dispositivo (aperta schermata di salvataggio/condivisione).'
      };
    } catch (capError: any) {
      console.warn('Capacitor error, falling back to direct browser download:', capError);
    }
  }

  // 2. Direct Browser Download (Android Chrome, Firefox, Samsung Internet, Safari, Desktop)
  // Triggered directly without intermediary prompts to prevent losing user activation
  const ok = triggerDirectDownload(normalizedBlob, filename);
  return {
    success: ok,
    method: 'browser-download',
    message: ok ? 'Download avviato! Controlla la cartella Download o le notifiche.' : 'Errore durante il download.'
  };
}


