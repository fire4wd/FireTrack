import React, { useState, useEffect } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { 
  Database, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Calendar, 
  Check, 
  AlertCircle, 
  Loader2,
  Info,
  Share2,
  Copy,
  FileCode,
  ClipboardCheck,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Server,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Sliders,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { LogEntryItem, HealthCategory, HealthSubType, BloodTestParameter, BloodTestRecord, NextcloudConfig, UserSettings } from '../../types/ontrack';
import { 
  downloadBackupJSON, 
  shareBackupJSON,
  copyBackupJSONToClipboard,
  downloadLogbookCSV,
  downloadBloodTestsCSV,
  getBackupJSONString,
  loadUserSettings,
  saveUserSettings,
  defaultNextcloudConfig
} from '../../utils/ontrackStorage';
import { 
  downloadRawSqliteDbFile, 
  shareRawSqliteDbFile, 
  getRawSqliteDbBytes, 
  loadRawSqliteDbBytes,
  loadRawSqliteDbFile
} from '../../utils/sqliteDb';
import {
  testNextcloudConnection,
  listNextcloudBackups,
  uploadJsonBackupToNextcloud,
  uploadSqliteDbToNextcloud,
  downloadBackupFromNextcloud,
  deleteBackupFromNextcloud,
  RemoteNextcloudFile,
  normalizeNextcloudConfig
} from '../../utils/nextcloudClient';

interface BackupRestoreScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  entries: LogEntryItem[];
  categories: HealthCategory[];
  subTypes: HealthSubType[];
  bloodTestParams?: BloodTestParameter[];
  bloodTestRecords?: BloodTestRecord[];
  showToast: (msg: string) => void;
  onRestoreSqliteFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRestoreJsonText?: (jsonText: string) => Promise<boolean>;
  userSettings?: UserSettings;
  onUpdateUserSettings?: (settings: UserSettings) => void;
  onReloadAllData?: () => Promise<void>;
}

export const BackupRestoreScreen: React.FC<BackupRestoreScreenProps> = ({
  onBack,
  onNavigate,
  entries,
  categories,
  subTypes,
  bloodTestParams,
  bloodTestRecords,
  showToast,
  onRestoreSqliteFile,
  onRestoreJsonText,
  userSettings: propUserSettings,
  onUpdateUserSettings,
  onReloadAllData
}) => {
  // Export Logbook state
  const [exportPeriod, setExportPeriod] = useState<'30' | '60' | '90' | 'all' | 'custom'>('30');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [logbookNotification, setLogbookNotification] = useState<string | null>(null);
  const [isExportingSqlite, setIsExportingSqlite] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isSharingSqlite, setIsSharingSqlite] = useState(false);
  const [isSharingJson, setIsSharingJson] = useState(false);
  const [isCopyingJson, setIsCopyingJson] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isExportingLogbook, setIsExportingLogbook] = useState(false);
  const [isExportingBlood, setIsExportingBlood] = useState(false);

  // Restore state
  const [restoreTab, setRestoreTab] = useState<'file' | 'text'>('file');
  const [pastedJsonText, setPastedJsonText] = useState('');
  const [isRestoringText, setIsRestoringText] = useState(false);

  // -------------------------------------------------------------------------
  // Nextcloud State
  // -------------------------------------------------------------------------
  const [userSettings, setUserSettings] = useState<UserSettings>(() => propUserSettings || loadUserSettings());
  const [ncConfig, setNcConfig] = useState<NextcloudConfig>(() => 
    userSettings.nextcloud || defaultNextcloudConfig
  );
  
  // Password stored and remembered locally
  const [ncPassword, setNcPassword] = useState<string>(() => {
    return userSettings.nextcloud?.password || localStorage.getItem('ontrack_nc_password') || '';
  });
  const [showNcPassword, setShowNcPassword] = useState(false);
  const [showNcConfigForm, setShowNcConfigForm] = useState(false);

  // Nextcloud Async Loading States
  const [isTestingNc, setIsTestingNc] = useState(false);
  const [isUploadingNc, setIsUploadingNc] = useState(false);
  const [isLoadingNcFiles, setIsLoadingNcFiles] = useState(false);
  const [isRestoringNcFile, setIsRestoringNcFile] = useState<string | null>(null);
  const [ncFeedback, setNcFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [remoteFiles, setRemoteFiles] = useState<RemoteNextcloudFile[]>([]);
  const [hasFetchedRemoteFiles, setHasFetchedRemoteFiles] = useState(false);

  useEffect(() => {
    if (propUserSettings) {
      setUserSettings(propUserSettings);
      if (propUserSettings.nextcloud) {
        setNcConfig(propUserSettings.nextcloud);
        if (propUserSettings.nextcloud.password) {
          setNcPassword(propUserSettings.nextcloud.password);
        }
      }
    }
  }, [propUserSettings]);

  const handlePasswordChange = (newPass: string) => {
    setNcPassword(newPass);
    try {
      localStorage.setItem('ontrack_nc_password', newPass);
    } catch {}
    const updatedConfig: NextcloudConfig = normalizeNextcloudConfig({
      ...ncConfig,
      password: newPass
    });
    setNcConfig(updatedConfig);
    const updatedSettings: UserSettings = {
      ...userSettings,
      nextcloud: updatedConfig
    };
    setUserSettings(updatedSettings);
    saveUserSettings(updatedSettings);
    if (onUpdateUserSettings) {
      onUpdateUserSettings(updatedSettings);
    }
  };

  const handleSaveNcConfig = () => {
    const updatedConfig: NextcloudConfig = normalizeNextcloudConfig({
      ...ncConfig,
      password: ncPassword
    });
    const updatedSettings: UserSettings = {
      ...userSettings,
      nextcloud: updatedConfig
    };
    setUserSettings(updatedSettings);
    saveUserSettings(updatedSettings);
    try {
      localStorage.setItem('ontrack_nc_password', ncPassword);
    } catch {}
    if (onUpdateUserSettings) {
      onUpdateUserSettings(updatedSettings);
    }
    setShowNcConfigForm(false);
    showToast('✅ Impostazioni e password server Nextcloud salvate.');
  };

  // Test Nextcloud Connection
  const handleTestNextcloud = async () => {
    if (!ncPassword) {
      setNcFeedback({
        type: 'error',
        message: 'Inserisci la password di Nextcloud prima di effettuare il test.'
      });
      return;
    }
    setIsTestingNc(true);
    setNcFeedback(null);
    try {
      const res = await testNextcloudConnection(ncConfig, ncPassword);
      if (res.success) {
        setNcFeedback({
          type: 'success',
          message: res.message || '✅ Connessione stabilita con successo!'
        });
        showToast('✅ Connessione Nextcloud verificata!');
        // Fetch files automatically on successful connection test
        handleListNextcloudFiles(false);
      } else {
        setNcFeedback({
          type: 'error',
          message: res.error || 'Connessione non riuscita. Verifica host, porta e credenziali.'
        });
      }
    } catch (err: any) {
      setNcFeedback({
        type: 'error',
        message: `Errore imprevisto: ${err.message || 'Errore di connessione'}`
      });
    } finally {
      setIsTestingNc(false);
    }
  };

  // Upload Backup (JSON + SQLite) to Nextcloud
  const handleUploadToNextcloud = async () => {
    if (!ncPassword) {
      setNcFeedback({
        type: 'error',
        message: 'Inserisci la password di Nextcloud per caricare il backup.'
      });
      return;
    }

    setIsUploadingNc(true);
    setNcFeedback(null);

    try {
      // 1. Upload JSON backup
      const jsonStr = getBackupJSONString(entries, categories, subTypes, bloodTestParams, bloodTestRecords);
      const jsonRes = await uploadJsonBackupToNextcloud(ncConfig, ncPassword, jsonStr);

      if (!jsonRes.success) {
        throw new Error(jsonRes.error || 'Impossibile caricare il backup JSON.');
      }

      // 2. Upload SQLite binary database backup
      const dbBytes = await getRawSqliteDbBytes();
      let sqliteResMsg = '';
      if (dbBytes) {
        const sqliteRes = await uploadSqliteDbToNextcloud(ncConfig, ncPassword, dbBytes);
        if (sqliteRes.success) {
          sqliteResMsg = ' e database SQLite (.sqlite)';
        }
      }

      const successMsg = `✅ Backup salvato su Nextcloud nella cartella '${ncConfig.folder || 'FireTrack'}'! (JSON${sqliteResMsg})`;
      setNcFeedback({
        type: 'success',
        message: successMsg
      });
      showToast(successMsg);

      // Refresh remote file list
      await handleListNextcloudFiles(false);
    } catch (err: any) {
      setNcFeedback({
        type: 'error',
        message: `❌ Errore caricamento: ${err.message || 'operazione fallita'}`
      });
      showToast(`❌ Errore upload: ${err.message}`);
    } finally {
      setIsUploadingNc(false);
    }
  };

  // Fetch list of remote backups from Nextcloud
  const handleListNextcloudFiles = async (showErrorFeedback = true) => {
    if (!ncPassword) {
      if (showErrorFeedback) {
        setNcFeedback({
          type: 'error',
          message: 'Inserisci la password di Nextcloud per visualizzare i backup remoti.'
        });
      }
      return;
    }

    setIsLoadingNcFiles(true);
    if (showErrorFeedback) setNcFeedback(null);

    try {
      const res = await listNextcloudBackups(ncConfig, ncPassword);
      if (res.success && res.files) {
        setRemoteFiles(res.files);
        setHasFetchedRemoteFiles(true);
        if (res.files.length === 0 && showErrorFeedback) {
          setNcFeedback({
            type: 'success',
            message: `Nessun file di backup trovato nella cartella '${ncConfig.folder}'. Effettua il primo caricamento.`
          });
        }
      } else if (showErrorFeedback) {
        setNcFeedback({
          type: 'error',
          message: res.error || 'Impossibile recuperare i file.'
        });
      }
    } catch (err: any) {
      if (showErrorFeedback) {
        setNcFeedback({
          type: 'error',
          message: `Errore recupero lista: ${err.message}`
        });
      }
    } finally {
      setIsLoadingNcFiles(false);
    }
  };

  // Restore a specific backup file from Nextcloud
  const handleRestoreFromNextcloud = async (file: RemoteNextcloudFile) => {
    if (!ncPassword) {
      setNcFeedback({
        type: 'error',
        message: 'Password richiesta per il download e ripristino.'
      });
      return;
    }

    const confirmRestore = window.confirm(
      `Sei sicuro di voler ripristinare il backup "${file.name}" da Nextcloud? I dati correnti verranno aggiornati con quelli del backup.`
    );
    if (!confirmRestore) return;

    setIsRestoringNcFile(file.name);
    try {
      const res = await downloadBackupFromNextcloud(ncConfig, ncPassword, file.name);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Download fallito.');
      }

      if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
        // Restore SQLite binary
        if (res.data.isBase64 && res.data.content) {
          const binaryString = atob(res.data.content);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await loadRawSqliteDbBytes(bytes);
          if (onReloadAllData) {
            await onReloadAllData();
          } else {
            window.location.reload();
          }
          showToast('✅ Database SQLite ripristinato con successo da Nextcloud!');
        }
      } else {
        // Restore JSON
        if (onRestoreJsonText) {
          const success = await onRestoreJsonText(res.data.content);
          if (success) {
            showToast(`✅ Backup ${file.name} ripristinato con successo da Nextcloud!`);
          }
        }
      }
    } catch (err: any) {
      showToast(`❌ Errore durante il ripristino: ${err.message}`);
      setNcFeedback({
        type: 'error',
        message: `Errore ripristino: ${err.message}`
      });
    } finally {
      setIsRestoringNcFile(null);
    }
  };

  // Delete a backup file from Nextcloud
  const handleDeleteFromNextcloud = async (fileName: string) => {
    if (!ncPassword) return;
    const confirmDel = window.confirm(`Vuoi eliminare definitivamente "${fileName}" da Nextcloud?`);
    if (!confirmDel) return;

    try {
      const res = await deleteBackupFromNextcloud(ncConfig, ncPassword, fileName);
      if (res.success) {
        showToast(`File ${fileName} eliminato da Nextcloud.`);
        setRemoteFiles(prev => prev.filter(f => f.name !== fileName));
      } else {
        showToast(`❌ ${res.error}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore eliminazione: ${err.message}`);
    }
  };

  // Format file sizes
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // -------------------------------------------------------------------------
  // Local Backup & Export Handlers
  // -------------------------------------------------------------------------
  const handleExportLogbook = async () => {
    setIsExportingLogbook(true);
    try {
      const res = await downloadLogbookCSV(entries, exportPeriod, startDate, endDate);
      if (!res.success) {
        alert('Nessuna lettura trovata per il periodo selezionato.');
        return;
      }
      const msg = `✅ Logbook (${res.count} misurazioni) esportato con successo!`;
      setLogbookNotification(msg);
      showToast(msg);
      setTimeout(() => setLogbookNotification(null), 5000);
    } catch (err: any) {
      showToast(`Errore esportazione: ${err?.message || 'operazione fallita'}`);
    } finally {
      setIsExportingLogbook(false);
    }
  };

  const handleDownloadSqlite = async () => {
    setIsExportingSqlite(true);
    try {
      const result = await downloadRawSqliteDbFile();
      if (result.success) {
        const msg = `✅ ${result.message || 'File .SQLITE salvato nei Download!'}`;
        setLogbookNotification(msg);
        showToast(msg);
        setTimeout(() => setLogbookNotification(null), 5000);
      } else {
        showToast(`❌ ${result.message}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore durante il backup SQLite: ${err?.message || 'imprevisto'}`);
    } finally {
      setIsExportingSqlite(false);
    }
  };

  const handleShareSqlite = async () => {
    setIsSharingSqlite(true);
    try {
      const result = await shareRawSqliteDbFile();
      showToast(result.message);
    } catch (err: any) {
      showToast(`❌ Errore condivisione SQLite: ${err?.message || 'imprevisto'}`);
    } finally {
      setIsSharingSqlite(false);
    }
  };

  const handleDownloadJson = async () => {
    setIsExportingJson(true);
    try {
      const result = await downloadBackupJSON(entries, categories, subTypes, bloodTestParams, bloodTestRecords);
      if (result.success) {
        const msg = `✅ ${result.message || 'Backup JSON salvato nei Download!'}`;
        setLogbookNotification(msg);
        showToast(msg);
        setTimeout(() => setLogbookNotification(null), 5000);
      } else {
        showToast(`❌ ${result.message}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore durante il backup JSON: ${err?.message || 'imprevisto'}`);
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleShareJson = async () => {
    setIsSharingJson(true);
    try {
      const result = await shareBackupJSON(entries, categories, subTypes, bloodTestParams, bloodTestRecords);
      showToast(result.message);
    } catch (err: any) {
      showToast(`❌ Errore condivisione: ${err?.message || 'imprevisto'}`);
    } finally {
      setIsSharingJson(false);
    }
  };

  const handleCopyJson = async () => {
    setIsCopyingJson(true);
    try {
      const res = await copyBackupJSONToClipboard(entries, categories, subTypes, bloodTestParams, bloodTestRecords);
      if (res.success) {
        setIsCopied(true);
        showToast(`📋 Dati di backup copiati negli appunti! (${res.count} letture)`);
        setTimeout(() => setIsCopied(false), 4000);
      } else {
        showToast('❌ Impossibile copiare negli appunti.');
      }
    } catch (err: any) {
      showToast('❌ Errore durante la copia.');
    } finally {
      setIsCopyingJson(false);
    }
  };

  const handleRestoreFromText = async () => {
    if (!pastedJsonText.trim()) {
      showToast('Incolla il testo del backup JSON prima di procedere.');
      return;
    }
    if (!onRestoreJsonText) {
      showToast('Funzione di ripristino non disponibile.');
      return;
    }

    setIsRestoringText(true);
    try {
      const ok = await onRestoreJsonText(pastedJsonText);
      if (ok) {
        setPastedJsonText('');
      }
    } finally {
      setIsRestoringText(false);
    }
  };

  const handleDownloadBloodTests = async () => {
    if (!bloodTestRecords || !bloodTestParams) return;
    setIsExportingBlood(true);
    try {
      await downloadBloodTestsCSV(bloodTestRecords, bloodTestParams);
      showToast('✅ CSV Esami del Sangue esportato!');
    } catch (err: any) {
      showToast(`Errore CSV esami: ${err?.message || 'errore'}`);
    } finally {
      setIsExportingBlood(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-[#f1f5f9] to-[#e2e8f0] dark:from-[#121418] dark:to-[#1a1d24] text-stone-900 dark:text-stone-100 transition-colors">
      
      {/* Header */}
      <OnTrackHeader
        title="Backup & Ripristino"
        showBack={true}
        onBack={onBack}
        showToolsMenu={false}
        onNavigate={onNavigate}
      />

      {/* Main Container */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-6 space-y-5 pb-16">
        
        {/* Success notification banner */}
        {logbookNotification && (
          <div className="bg-emerald-600 text-white p-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between shadow-md animate-fadeIn">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>{logbookNotification}</span>
            </div>
            <button onClick={() => setLogbookNotification(null)} className="text-emerald-200 hover:text-white text-xs underline cursor-pointer">
              Chiudi
            </button>
          </div>
        )}

        {/* Informative Header Banner */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs p-4 sm:p-5 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#e3f4f6] dark:bg-[#15343d] text-[#13808c] dark:text-[#45c3d2] flex items-center justify-center shrink-0 shadow-inner">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
              Backup, Ripristino & Nextcloud
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Sincronizza con Nextcloud, esporta il registro (CSV/Excel) o salva il database.
            </p>
          </div>
        </div>

        {/* ================================================================= */}
        {/* CARD 0: NEXTCLOUD CLOUD BACKUP & RESTORE                          */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border-2 border-blue-500/40 dark:border-blue-500/30 shadow-md p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                    Sincronizzazione Nextcloud
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    WebDAV
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Salva e ripristina i tuoi dati direttamente sul tuo server Nextcloud
                </p>
              </div>
            </div>
          </div>

          {/* Nextcloud Configuration Fields (directly editable & customizable) */}
          <div className="bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Parametri Connessione (Modificabili in qualsiasi momento):</span>
              </span>
              <button
                type="button"
                onClick={handleSaveNcConfig}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
              >
                Salva Parametri
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                  Server URL
                </label>
                <input
                  type="text"
                  value={ncConfig.serverUrl}
                  onChange={(e) => setNcConfig({ ...ncConfig, serverUrl: e.target.value })}
                  placeholder="https://nc.fire4wd.uk"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                  Nome Utente
                </label>
                <input
                  type="text"
                  value={ncConfig.username}
                  onChange={(e) => setNcConfig({ ...ncConfig, username: e.target.value })}
                  placeholder="fire"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                  Cartella Remota
                </label>
                <input
                  type="text"
                  value={ncConfig.folder}
                  onChange={(e) => setNcConfig({ ...ncConfig, folder: e.target.value })}
                  placeholder="FireTrack"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {ncConfig.serverUrl.startsWith('https://') && (
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg p-2 text-[11px] text-blue-800 dark:text-blue-300 flex items-start space-x-1.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <span>
                  <strong>Connessione HTTPS:</strong> L'app è configurata per supportare sia certificati validi sia certificati autofirmati su reti private e Tailscale (porta 4443).
                </span>
              </div>
            )}
          </div>

          {/* Password Input (saved locally on device) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Password o Password Applicativa Nextcloud:</span>
              </label>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {ncPassword ? '✓ Password memorizzata in locale' : 'Memorizzata in locale'}
              </span>
            </div>
            <div className="relative">
              <input
                type={showNcPassword ? 'text' : 'password'}
                value={ncPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Inserisci password o Password per l'applicazione..."
                className="w-full pl-3 pr-10 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowNcPassword(!showNcPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                title={showNcPassword ? 'Nascondi password' : 'Mostra password'}
              >
                {showNcPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
              💡 <strong>Suggerimento:</strong> Se sul tuo account Nextcloud è attiva l'autenticazione a due fattori (2FA) o ricevi errore 401, genera una <em>Password per l'applicazione</em> da Nextcloud (<strong>Impostazioni Personali → Sicurezza → Dispositivi e sessioni</strong>) e inseriscila qui.
            </p>
          </div>

          {/* Feedback message if any */}
          {ncFeedback && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-start space-x-2 animate-fadeIn ${
              ncFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}>
              {ncFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{ncFeedback.message}</span>
            </div>
          )}

          {/* Action Buttons: Test, Upload, Browse/List */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* 1. Test Connection */}
            <button
              type="button"
              disabled={isTestingNc || !ncPassword}
              onClick={handleTestNextcloud}
              className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 disabled:opacity-50 text-stone-800 dark:text-stone-200 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all border border-stone-300 dark:border-stone-700 cursor-pointer"
            >
              {isTestingNc ? (
                <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
              ) : (
                <RefreshCw className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              )}
              <span>Verifica Connessione</span>
            </button>

            {/* 2. Upload to Nextcloud */}
            <button
              type="button"
              disabled={isUploadingNc || !ncPassword}
              onClick={handleUploadToNextcloud}
              className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            >
              {isUploadingNc ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Caricamento...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4 text-white" />
                  <span>Carica su Nextcloud</span>
                </>
              )}
            </button>

            {/* 3. Browse / List Remote Backups */}
            <button
              type="button"
              disabled={isLoadingNcFiles || !ncPassword}
              onClick={() => handleListNextcloudFiles(true)}
              className="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 disabled:opacity-50 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              {isLoadingNcFiles ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
              ) : (
                <FolderOpen className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
              )}
              <span>Esplora File Remoti</span>
            </button>
          </div>

          {/* Remote Files Table / List */}
          {hasFetchedRemoteFiles && (
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <span className="flex items-center space-x-1.5">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  <span>Backup disponibili su Nextcloud ({remoteFiles.length}):</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleListNextcloudFiles(false)}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-bold hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Aggiorna</span>
                </button>
              </div>

              {remoteFiles.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 py-3 text-center bg-stone-50 dark:bg-stone-900/40 rounded-xl border border-dashed border-stone-300 dark:border-stone-700">
                  Nessun file di backup presente nella cartella remota.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {remoteFiles.map((file) => {
                    const isSqlite = file.name.endsWith('.sqlite') || file.name.endsWith('.db');
                    const isRestoringThis = isRestoringNcFile === file.name;
                    return (
                      <div
                        key={file.name}
                        className="p-2.5 bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-xl flex items-center justify-between text-xs transition-all hover:bg-stone-100 dark:hover:bg-stone-800/80"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isSqlite 
                                ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800' 
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            }`}>
                              {isSqlite ? 'SQLITE' : 'JSON'}
                            </span>
                            <span className="font-bold text-stone-800 dark:text-stone-200 truncate" title={file.name}>
                              {file.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                            {formatBytes(file.size)} • {new Date(file.lastModified).toLocaleString('it-IT')}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {/* Restore Button */}
                          <button
                            type="button"
                            disabled={Boolean(isRestoringNcFile)}
                            onClick={() => handleRestoreFromNextcloud(file)}
                            className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 shadow-2xs transition-colors cursor-pointer"
                            title="Ripristina questo backup nell'app"
                          >
                            {isRestoringThis ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CloudDownload className="w-3 h-3" />
                            )}
                            <span>Ripristina</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFromNextcloud(file.name)}
                            className="p-1 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Elimina file da Nextcloud"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* CARD 1: Esporta Logbook (CSV / Excel)                             */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-teal-200/80 dark:border-teal-800/50 shadow-xs p-4 sm:p-6 space-y-4">
          <div className="flex items-center space-x-3 border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Esporta Logbook (CSV)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Scarica il registro dati in formato CSV per fogli di calcolo Excel
              </p>
            </div>
          </div>

          {/* Period selector */}
          <div className="space-y-3 text-xs sm:text-sm">
            <label className="block text-stone-700 dark:text-stone-300 font-bold">Seleziona Periodo di Esportazione:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setExportPeriod('30')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  exportPeriod === '30'
                    ? 'bg-[#13808c] text-white border-[#13808c] shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                }`}
              >
                30 Giorni
              </button>

              <button
                type="button"
                onClick={() => setExportPeriod('60')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  exportPeriod === '60'
                    ? 'bg-[#13808c] text-white border-[#13808c] shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                }`}
              >
                60 Giorni
              </button>

              <button
                type="button"
                onClick={() => setExportPeriod('90')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  exportPeriod === '90'
                    ? 'bg-[#13808c] text-white border-[#13808c] shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                }`}
              >
                90 Giorni
              </button>

              <button
                type="button"
                onClick={() => setExportPeriod('all')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  exportPeriod === 'all'
                    ? 'bg-[#13808c] text-white border-[#13808c] shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                }`}
              >
                TUTTO ({entries.length})
              </button>
            </div>

            {/* Custom Date Range Option */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setExportPeriod('custom')}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  exportPeriod === 'custom'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Periodo Personalizzato</span>
              </button>
            </div>

            {/* Date Inputs if Custom selected */}
            {exportPeriod === 'custom' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold text-teal-900 dark:text-teal-200 mb-1">Data Inizio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-stone-900 border border-teal-300 dark:border-teal-700 rounded-lg text-stone-800 dark:text-stone-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-teal-900 dark:text-teal-200 mb-1">Data Fine</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-stone-900 border border-teal-300 dark:border-teal-700 rounded-lg text-stone-800 dark:text-stone-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action button */}
          <button
            type="button"
            disabled={isExportingLogbook}
            onClick={handleExportLogbook}
            className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            {isExportingLogbook ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generazione CSV in corso...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Scarica CSV Logbook ({entries.length} Letture)</span>
              </>
            )}
          </button>
        </div>

        {/* ================================================================= */}
        {/* CARD 2: Esporta Database Locale (SQLite / JSON)                   */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs p-4 sm:p-6 space-y-4">
          <div className="flex items-center space-x-3 border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="w-10 h-10 rounded-xl bg-[#13808c] text-white flex items-center justify-center shadow-xs shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Backup Locale (Dispositivo)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Salva una copia fisica del database SQLite o del backup JSON sul tuo dispositivo
              </p>
            </div>
          </div>

          {/* Primary Action Buttons: Direct Downloads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={isExportingSqlite}
              onClick={handleDownloadSqlite}
              className="py-3 px-4 bg-[#13808c] hover:bg-[#0f6c77] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              {isExportingSqlite ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvataggio...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Scarica File .SQLITE</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isExportingJson}
              onClick={handleDownloadJson}
              className="py-3 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 disabled:opacity-50 text-stone-800 dark:text-stone-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 border border-stone-300 dark:border-stone-700 cursor-pointer"
            >
              {isExportingJson ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
                  <span>Salvataggio...</span>
                </>
              ) : (
                <>
                  <FileCode className="w-4 h-4 text-stone-600 dark:text-stone-300" />
                  <span>Scarica Backup JSON</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={isSharingJson}
              onClick={handleShareJson}
              className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              {isSharingJson ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              ) : (
                <Share2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              )}
              <span>Condividi / Salva con App</span>
            </button>

            <button
              type="button"
              disabled={isCopyingJson}
              onClick={handleCopyJson}
              className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              {isCopied ? (
                <>
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-300">Copiato negli Appunti!</span>
                </>
              ) : isCopyingJson ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                  <span>Copia in corso...</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>Copia Backup negli Appunti</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Blood Tests CSV export */}
          {bloodTestRecords && bloodTestRecords.length > 0 && bloodTestParams && (
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
              <span className="text-stone-500 dark:text-stone-400">
                Esami del sangue ({bloodTestRecords.length} prelievi registrati):
              </span>
              <button
                type="button"
                disabled={isExportingBlood}
                onClick={handleDownloadBloodTests}
                className="font-bold text-purple-700 dark:text-purple-400 hover:text-purple-900 hover:underline flex items-center space-x-1 cursor-pointer"
              >
                {isExportingBlood ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>Esporta CSV Esami</span>
              </button>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* CARD 3: Ripristina Backup Locale (File o Testo)                   */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs p-4 sm:p-6 space-y-4">
          <div className="flex items-center space-x-3 border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Ripristina Backup Locale
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Carica un file <code>.sqlite</code> / <code>.json</code> dal dispositivo o incolla il testo
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-stone-100 dark:bg-stone-900 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setRestoreTab('file')}
              className={`flex-1 py-2 rounded-lg transition-all text-center cursor-pointer ${
                restoreTab === 'file'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              📁 Carica File (.sqlite / .json)
            </button>
            <button
              type="button"
              onClick={() => setRestoreTab('text')}
              className={`flex-1 py-2 rounded-lg transition-all text-center cursor-pointer ${
                restoreTab === 'text'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              📋 Incolla Testo Backup
            </button>
          </div>

          {/* Tab 1: File Upload */}
          {restoreTab === 'file' && (
            <label className="w-full py-5 border-2 border-dashed border-[#13808c] hover:bg-[#e3f4f6]/50 dark:hover:bg-[#13808c]/10 text-[#13808c] font-bold text-xs rounded-xl transition-colors flex flex-col items-center justify-center space-y-1.5 cursor-pointer animate-fadeIn">
              <Upload className="w-6 h-6" />
              <span>Seleziona File di Backup (.sqlite / .db / .json)</span>
              <span className="text-[10px] text-stone-400 font-normal">Tocca qui per sfogliare la memoria del dispositivo</span>
              <input
                type="file"
                accept=".sqlite,.db,.json"
                onChange={onRestoreSqliteFile}
                className="hidden"
              />
            </label>
          )}

          {/* Tab 2: Text Paste */}
          {restoreTab === 'text' && (
            <div className="space-y-3 animate-fadeIn">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Incolla qui il codice o testo di backup JSON:
                </label>
                <textarea
                  rows={4}
                  value={pastedJsonText}
                  onChange={(e) => setPastedJsonText(e.target.value)}
                  placeholder='{"version":"1.0.1","appName":"FireTrack","entries":[...]}'
                  className="w-full p-3 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#13808c]"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  disabled={isRestoringText || !pastedJsonText.trim()}
                  onClick={handleRestoreFromText}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {isRestoringText ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Ripristino in corso...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Ripristina Dati da Testo</span>
                    </>
                  )}
                </button>

                {pastedJsonText && (
                  <button
                    type="button"
                    onClick={() => setPastedJsonText('')}
                    className="px-4 py-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs rounded-xl border border-stone-300 dark:border-stone-700 cursor-pointer"
                  >
                    Cancella
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
