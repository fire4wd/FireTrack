import React, { useState } from 'react';
import { 
  Cloud, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Server, 
  Key, 
  Folder, 
  Eye, 
  EyeOff, 
  Lock,
  ArrowDownToLine,
  ArrowUpToLine,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { 
  NextcloudConfig,
  LogEntryItem, 
  HealthCategory, 
  HealthSubType, 
  BloodTestParameter, 
  BloodTestRecord 
} from '../../types/ontrack';
import { 
  testNextcloudConnection, 
  uploadJsonBackupToNextcloud, 
  downloadBackupFromNextcloud,
  normalizeNextcloudConfig
} from '../../utils/nextcloudClient';
import { 
  getBackupJSONString, 
  loadUserSettings, 
  saveUserSettings, 
  defaultNextcloudConfig 
} from '../../utils/ontrackStorage';

interface NextcloudSyncSectionProps {
  entries: LogEntryItem[];
  categories: HealthCategory[];
  subTypes: HealthSubType[];
  bloodTestParams?: BloodTestParameter[];
  bloodTestRecords?: BloodTestRecord[];
  showToast: (msg: string) => void;
  onRestoreRemoteData: (parsedData: any) => Promise<boolean>;
}

export const NextcloudSyncSection: React.FC<NextcloudSyncSectionProps> = ({
  entries,
  categories,
  subTypes,
  bloodTestParams,
  bloodTestRecords,
  showToast,
  onRestoreRemoteData,
}) => {
  const [config, setConfig] = useState<NextcloudConfig>(() => {
    const settings = loadUserSettings();
    return settings.nextcloud || defaultNextcloudConfig;
  });
  const [password, setPassword] = useState<string>(() => {
    const settings = loadUserSettings();
    return settings.nextcloud?.password || localStorage.getItem('ontrack_nc_password') || '';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  const [pendingRemoteData, setPendingRemoteData] = useState<any | null>(null);

  const updateConfig = (patch: Partial<NextcloudConfig>) => {
    const updated = normalizeNextcloudConfig({ ...config, ...patch });
    setConfig(updated);
    const settings = loadUserSettings();
    saveUserSettings({ ...settings, nextcloud: updated });
  };

  const handlePasswordChange = (newPass: string) => {
    setPassword(newPass);
    try {
      localStorage.setItem('ontrack_nc_password', newPass);
    } catch {}
    updateConfig({ password: newPass });
  };

  const handleTestConnection = async () => {
    if (!config.serverUrl.trim() || !config.username.trim() || !password.trim()) {
      showToast('⚠️ Inserisci URL del server, Nome Utente e Password per effettuare il test.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testNextcloudConnection(config, password);
      setTestResult({
        success: res.success,
        message: res.message || res.error || (res.success ? 'Connessione riuscita' : 'Connessione fallita')
      });
      if (res.success) {
        showToast('✅ ' + (res.message || 'Connessione verificata!'));
      } else {
        showToast('❌ ' + (res.error || 'Errore di connessione'));
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Errore imprevisto' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleUploadToNextcloud = async () => {
    if (!config.serverUrl.trim() || !config.username.trim() || !password.trim()) {
      showToast('⚠️ Configura prima i parametri e inserisci la password di Nextcloud.');
      return;
    }
    setIsUploading(true);
    try {
      const jsonBackupStr = getBackupJSONString(
        entries,
        categories,
        subTypes,
        bloodTestParams,
        bloodTestRecords
      );
      const res = await uploadJsonBackupToNextcloud(config, password, jsonBackupStr);
      if (res.success) {
        const msg = `✅ Backup (${entries.length} letture) salvato su Nextcloud!`;
        showToast(msg);
      } else {
        showToast(`❌ ${res.error || 'Caricamento non riuscito'}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore caricamento: ${err?.message || 'operazione fallita'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadFromNextcloud = async () => {
    if (!config.serverUrl.trim() || !config.username.trim() || !password.trim()) {
      showToast('⚠️ Inserisci la password di Nextcloud.');
      return;
    }
    setIsDownloading(true);
    try {
      const res = await downloadBackupFromNextcloud(config, password, 'FireTrack_Sync_Backup.json');
      if (res.success && res.data) {
        try {
          const parsed = JSON.parse(res.data.content);
          setPendingRemoteData(parsed);
          setIsConfirmRestoreOpen(true);
        } catch {
          showToast('❌ Il file scaricato non è un backup JSON valido.');
        }
      } else {
        showToast(`❌ ${res.error || 'Download non riuscito'}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore download da Nextcloud: ${err?.message || 'operazione fallita'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const confirmApplyRemoteBackup = async () => {
    if (!pendingRemoteData) return;
    try {
      const success = await onRestoreRemoteData(pendingRemoteData);
      if (success) {
        showToast('✅ Dati ripristinati con successo da Nextcloud!');
      }
    } finally {
      setIsConfirmRestoreOpen(false);
      setPendingRemoteData(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 sm:p-6 space-y-5 transition-colors">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0082c9] to-[#005580] text-white flex items-center justify-center shadow-xs shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Sincronizzazione Cloud Personale (Nextcloud)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0082c9]/10 text-[#0082c9] border border-[#0082c9]/20">
                WebDAV
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Salva e ripristina il tuo diario direttamente sulla tua istanza Nextcloud privata
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="self-start sm:self-auto text-xs font-semibold text-[#0082c9] hover:underline flex items-center space-x-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-[#0082c9]/10 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span>{showHelp ? 'Nascondi Guida' : 'Come ottenere la Password?'}</span>
        </button>
      </div>

      {/* Help Banner Guide */}
      {showHelp && (
        <div className="p-4 bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl text-xs text-sky-900 dark:text-sky-200 space-y-2 animate-fadeIn">
          <div className="font-bold flex items-center space-x-1.5 text-sky-800 dark:text-sky-300">
            <Lock className="w-4 h-4" />
            <span>Come creare una "Password per l'applicazione" su Nextcloud:</span>
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-[11px] leading-relaxed text-stone-700 dark:text-stone-300">
            <li>Accedi al tuo server Nextcloud dal browser.</li>
            <li>In alto a destra, clicca sul tuo profilo e vai su <strong>Impostazioni Personali</strong>.</li>
            <li>Nel menu a sinistra, clicca su <strong>Sicurezza</strong>.</li>
            <li>Scorri in basso fino alla sezione <strong>"Dispositivi e sessioni"</strong>.</li>
            <li>Scrivi un nome (es. <em>OnTrack App</em>) e clicca su <strong>Crea nuova password per applicazione</strong>.</li>
            <li>Copia la password generata e incollala qui sotto nel campo <em>App Password</em>.</li>
          </ol>
        </div>
      )}

      {/* Configuration Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nextcloud Server URL */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center space-x-1">
            <Server className="w-3.5 h-3.5 text-stone-500" />
            <span>URL Server Nextcloud:</span>
          </label>
          <input
            type="url"
            placeholder="https://cloud.tuodominio.it"
            value={config.serverUrl}
            onChange={(e) => updateConfig({ serverUrl: e.target.value })}
            className="w-full p-2.5 bg-stone-50 dark:bg-[#121418] border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#0082c9]"
          />
          <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 block">
            Esempio: <code>https://nextcloud.miosito.com</code>
          </span>
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center space-x-1">
            <span>Nome Utente Nextcloud:</span>
          </label>
          <input
            type="text"
            placeholder="mario_rossi"
            value={config.username}
            onChange={(e) => updateConfig({ username: e.target.value })}
            className="w-full p-2.5 bg-stone-50 dark:bg-[#121418] border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#0082c9]"
          />
        </div>

        {/* App Password */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Key className="w-3.5 h-3.5 text-stone-500" />
              <span>Password Applicazione:</span>
            </span>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[10px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center space-x-1 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{showPassword ? 'Nascondi' : 'Mostra'}</span>
            </button>
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="xxxx-xxxx-xxxx-xxxx"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            className="w-full p-2.5 bg-stone-50 dark:bg-[#121418] border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#0082c9]"
          />
        </div>

        {/* Remote Folder Path */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center space-x-1">
            <Folder className="w-3.5 h-3.5 text-stone-500" />
            <span>Cartella di Salvataggio su Nextcloud:</span>
          </label>
          <input
            type="text"
            placeholder="FireTrack"
            value={config.folder}
            onChange={(e) => updateConfig({ folder: e.target.value })}
            className="w-full p-2.5 bg-stone-50 dark:bg-[#121418] border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#0082c9]"
          />
          <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 block">
            Verrà creata automaticamente se non esiste ancora
          </span>
        </div>
      </div>

      {/* Test Connection Button & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          disabled={isTesting || !config.serverUrl.trim() || !config.username.trim() || !password.trim()}
          onClick={handleTestConnection}
          className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl border border-stone-300 dark:border-stone-700 flex items-center space-x-2 transition-all cursor-pointer"
        >
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#0082c9]" />
              <span>Verifica Connessione...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 text-[#0082c9]" />
              <span>Test Connessione Nextcloud</span>
            </>
          )}
        </button>

        {testResult && (
          <div className={`flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
            testResult.success 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="truncate max-w-xs">{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Action Buttons: Upload & Download */}
      <div className="pt-2 border-t border-stone-100 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Upload Button */}
        <button
          type="button"
          disabled={isUploading || isDownloading || !config.serverUrl.trim()}
          onClick={handleUploadToNextcloud}
          className="py-3 px-4 bg-gradient-to-r from-[#0082c9] to-[#006ba6] hover:from-[#0074b3] hover:to-[#005a8c] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvataggio su Nextcloud...</span>
            </>
          ) : (
            <>
              <ArrowUpToLine className="w-4 h-4" />
              <span>Carica Backup su Nextcloud</span>
            </>
          )}
        </button>

        {/* Download Button */}
        <button
          type="button"
          disabled={isDownloading || isUploading || !config.serverUrl.trim()}
          onClick={handleDownloadFromNextcloud}
          className="py-3 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 disabled:opacity-50 text-stone-800 dark:text-stone-200 font-bold text-xs uppercase tracking-wider rounded-xl border border-stone-300 dark:border-stone-700 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#0082c9]" />
              <span>Download da Nextcloud...</span>
            </>
          ) : (
            <>
              <ArrowDownToLine className="w-4 h-4 text-[#0082c9]" />
              <span>Ripristina da Nextcloud</span>
            </>
          )}
        </button>
      </div>

      {/* Confirmation Modal for Restore */}
      {isConfirmRestoreOpen && pendingRemoteData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e222b] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-700 space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Conferma Ripristino da Nextcloud
              </h4>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              È stato trovato un backup su Nextcloud contenente:
            </p>

            <div className="bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1 font-mono">
              <div>📊 <strong>Letture registrate:</strong> {pendingRemoteData.entries?.length || 0}</div>
              <div>🩸 <strong>Esami del sangue:</strong> {pendingRemoteData.bloodTestRecords?.length || 0}</div>
              <div>🏷️ <strong>Categorie personalizzate:</strong> {pendingRemoteData.categories?.length || 0}</div>
              {pendingRemoteData.exportDate && (
                <div className="text-[11px] text-stone-400 pt-1">
                  Data esportazione: {new Date(pendingRemoteData.exportDate).toLocaleString()}
                </div>
              )}
            </div>

            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              ⚠️ Il ripristino sostituirà i dati correnti nel database locale con la versione recuperata da Nextcloud.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmRestoreOpen(false);
                  setPendingRemoteData(null);
                }}
                className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-semibold text-xs cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmApplyRemoteBackup}
                className="px-5 py-2 bg-[#0082c9] hover:bg-[#006ba6] text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
              >
                Conferma e Ripristina
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
