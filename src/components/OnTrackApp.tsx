import React, { useState, useEffect } from 'react';
import { ActiveScreen, HealthCategory, HealthSubType, LogEntryItem, BloodTestParameter, BloodTestRecord } from '../types/ontrack';
import { defaultCategories, defaultSubTypes, defaultSampleEntries, defaultBloodTestParameters, defaultBloodTestRecords } from '../data/ontrackDefaults';
import { 
  fetchEntriesFromSqlite, 
  saveEntriesToSqlite, 
  fetchCategoriesFromSqlite, 
  saveCategoriesToSqlite, 
  fetchSubTypesFromSqlite, 
  saveSubTypesToSqlite,
  fetchBloodParamsFromSqlite,
  saveBloodParamsToSqlite,
  fetchBloodRecordsFromSqlite,
  saveBloodRecordsToSqlite,
  downloadRawSqliteDbFile,
  loadRawSqliteDbFile,
  clearSqliteCacheAndReload,
  clearAllEntriesFromSqlite,
  clearAllBloodRecordsFromSqlite
} from '../utils/sqliteDb';
import { downloadBackupJSON, downloadCSV, clearAllEntries, clearAllBloodTestRecords, loadUserSettings, saveUserSettings } from '../utils/ontrackStorage';
import { checkAndTriggerScheduledReminder } from '../utils/notifications';
import { UserSettings } from '../types/ontrack';

import { HomeScreen } from './ontrack/HomeScreen';
import { AddEntryScreen } from './ontrack/AddEntryScreen';
import { HistoryScreen } from './ontrack/HistoryScreen';
import { GraphsScreen } from './ontrack/GraphsScreen';
import { ReportsScreen } from './ontrack/ReportsScreen';
import { CalendarScreen } from './ontrack/CalendarScreen';
import { ToolsScreen } from './ontrack/ToolsScreen';
import { BloodTestsScreen } from './ontrack/BloodTestsScreen';
import { CustomizeScreen } from './ontrack/CustomizeScreen';
import { CustomizeCategoriesScreen } from './ontrack/CustomizeCategoriesScreen';
import { CustomizeSubTypesScreen } from './ontrack/CustomizeSubTypesScreen';
import { EditCategoryScreen } from './ontrack/EditCategoryScreen';
import { SystemSettingsScreen } from './ontrack/SystemSettingsScreen';
import { BackupRestoreScreen } from './ontrack/BackupRestoreScreen';
import { CsvImportModal } from './ontrack/CsvImportModal';
import { ConfirmClearModal } from './ontrack/ConfirmClearModal';
import { EditEntryModal } from './ontrack/EditEntryModal';
import { Download, Upload, AlertCircle, CheckCircle2, Database } from 'lucide-react';

export const OnTrackApp: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [editingCategory, setEditingCategory] = useState<HealthCategory | null>(null);
  const [editingEntry, setEditingEntry] = useState<LogEntryItem | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isConfirmClearBloodOpen, setIsConfirmClearBloodOpen] = useState(false);
  
  // Data States - Initialized with defaults so UI renders instantly on mount
  const [entries, setEntries] = useState<LogEntryItem[]>(defaultSampleEntries);
  const [categories, setCategories] = useState<HealthCategory[]>(defaultCategories);
  const [subTypes, setSubTypes] = useState<HealthSubType[]>(defaultSubTypes);
  const [bloodTestParams, setBloodTestParams] = useState<BloodTestParameter[]>(defaultBloodTestParameters);
  const [bloodTestRecords, setBloodTestRecords] = useState<BloodTestRecord[]>(defaultBloodTestRecords);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  
  // Storage Toast Notifications
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // User Settings with Theme
  const [userSettings, setUserSettings] = useState<UserSettings>(() => loadUserSettings());

  // Apply Theme to document.documentElement
  useEffect(() => {
    const isDark = userSettings.theme !== 'light'; // Default is dark
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [userSettings.theme]);

  // Periodic Reminder Notification Checker
  useEffect(() => {
    if (!userSettings.reminder?.enabled) return;

    // Check immediately on mount/settings change
    checkAndTriggerScheduledReminder(userSettings.reminder, userSettings.patientName);

    // Check every 30 seconds
    const interval = setInterval(() => {
      checkAndTriggerScheduledReminder(userSettings.reminder, userSettings.patientName);
    }, 30000);

    return () => clearInterval(interval);
  }, [userSettings.reminder, userSettings.patientName]);

  const handleUpdateUserSettings = (newSettings: UserSettings) => {
    setUserSettings(newSettings);
    saveUserSettings(newSettings);
  };

  // Initialize SQLite data on mount with fallback & timeout
  const reloadFromSqlite = async () => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('SQLite loading timeout')), 3500)
      );

      const loadPromise = async () => {
        let loadedEntries = await fetchEntriesFromSqlite();
        let loadedCategories = await fetchCategoriesFromSqlite();
        let loadedSubTypes = await fetchSubTypesFromSqlite();
        let loadedBloodParams = await fetchBloodParamsFromSqlite();
        let loadedBloodRecords = await fetchBloodRecordsFromSqlite();

        if (loadedCategories.length === 0) {
          console.log('Seeding default categories...');
          loadedCategories = defaultCategories;
          await saveCategoriesToSqlite(defaultCategories);
        }
        if (loadedSubTypes.length === 0) {
          console.log('Seeding default subtypes...');
          loadedSubTypes = defaultSubTypes;
          await saveSubTypesToSqlite(defaultSubTypes);
        }
        if (loadedBloodParams.length === 0) {
          loadedBloodParams = defaultBloodTestParameters;
          await saveBloodParamsToSqlite(defaultBloodTestParameters);
        }

        return { loadedEntries, loadedCategories, loadedSubTypes, loadedBloodParams, loadedBloodRecords };
      };

      const result = await Promise.race([loadPromise(), timeoutPromise]);
      if (result) {
        setEntries(result.loadedEntries);
        setCategories(result.loadedCategories);
        setSubTypes(result.loadedSubTypes);
        setBloodTestParams(result.loadedBloodParams);
        setBloodTestRecords(result.loadedBloodRecords);
      }
    } catch (err) {
      console.warn('SQLite load fallback to memory state:', err);
    } finally {
      setIsDbLoaded(true);
    }
  };

  useEffect(() => {
    reloadFromSqlite();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleForceResetData = async () => {
    try {
      setEntries(defaultSampleEntries);
      setCategories(defaultCategories);
      setSubTypes(defaultSubTypes);
      setBloodTestParams(defaultBloodTestParameters);
      setBloodTestRecords(defaultBloodTestRecords);
      await saveCategoriesToSqlite(defaultCategories);
      await saveSubTypesToSqlite(defaultSubTypes);
      await saveEntriesToSqlite(defaultSampleEntries);
      await saveBloodParamsToSqlite(defaultBloodTestParameters);
      await saveBloodRecordsToSqlite(defaultBloodTestRecords);
      showToast('✅ Dati di default ripristinati con successo!');
    } catch (err) {
      console.error('Error resetting data:', err);
      showToast('✅ Dati di default caricati in memoria.');
    }
  };

  const handleSaveBloodRecords = async (updatedRecords: BloodTestRecord[]) => {
    setBloodTestRecords(updatedRecords);
    await saveBloodRecordsToSqlite(updatedRecords);
    showToast('✅ Esami del sangue salvati nel database SQLite!');
  };

  const handleSaveBloodParameters = async (updatedParams: BloodTestParameter[]) => {
    setBloodTestParams(updatedParams);
    await saveBloodParamsToSqlite(updatedParams);
    showToast('✅ Parametri e range esami aggiornati nel database!');
  };

  // Handlers
  const handleSaveEntries = async (newEntries: LogEntryItem[]) => {
    const updated = [...newEntries, ...entries];
    setEntries(updated);
    await saveEntriesToSqlite(updated);
    showToast(`${newEntries.length} letture salvate in SQLite locale.`);
  };

  const handleDeleteEntry = async (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    await saveEntriesToSqlite(updated);
    showToast('Voce eliminata da SQLite.');
  };

  const handleUpdateEntry = async (updatedEntry: LogEntryItem) => {
    const updated = entries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    setEntries(updated);
    await saveEntriesToSqlite(updated);
    showToast('✅ Lettura modificata e salvata nel database SQLite!');
  };

  const handleUpdateCategories = async (updatedCategories: HealthCategory[]) => {
    setCategories(updatedCategories);
    await saveCategoriesToSqlite(updatedCategories);
    showToast('Categorie salvate nel DB SQLite.');
  };

  const handleSaveCategoryEdit = async (updatedCat: HealthCategory) => {
    const updated = categories.map(c => c.id === updatedCat.id ? updatedCat : c);
    setCategories(updated);
    await saveCategoriesToSqlite(updated);
    showToast(`Categoria "${updatedCat.name}" salvata.`);
  };

  const handleDeleteCategory = async (catId: string) => {
    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);
    await saveCategoriesToSqlite(updated);
    showToast('Categoria eliminata.');
  };

  const handleUpdateSubTypes = async (updatedSubTypes: HealthSubType[]) => {
    setSubTypes(updatedSubTypes);
    await saveSubTypesToSqlite(updatedSubTypes);
    showToast('SubTypes salvati nel DB SQLite.');
  };

  // Restore Raw .sqlite File Handler
  const handleRestoreParsedJsonData = async (parsed: any): Promise<boolean> => {
    if (parsed && Array.isArray(parsed.entries)) {
      const entryCount = parsed.entries.length;
      const catCount = Array.isArray(parsed.categories) ? parsed.categories.length : 0;
      const subTypeCount = Array.isArray(parsed.subTypes) ? parsed.subTypes.length : 0;
      const bloodRecordCount = Array.isArray(parsed.bloodTestRecords) ? parsed.bloodTestRecords.length : 0;
      const bloodParamCount = Array.isArray(parsed.bloodTestParams) ? parsed.bloodTestParams.length : 0;
      const totalRecords = entryCount + catCount + subTypeCount + bloodRecordCount + bloodParamCount;

      setEntries(parsed.entries);
      await saveEntriesToSqlite(parsed.entries);

      if (Array.isArray(parsed.categories)) {
        setCategories(parsed.categories);
        await saveCategoriesToSqlite(parsed.categories);
      }

      if (Array.isArray(parsed.subTypes)) {
        setSubTypes(parsed.subTypes);
        await saveSubTypesToSqlite(parsed.subTypes);
      }

      if (Array.isArray(parsed.bloodTestParams)) {
        setBloodTestParams(parsed.bloodTestParams);
        await saveBloodParamsToSqlite(parsed.bloodTestParams);
      }

      if (Array.isArray(parsed.bloodTestRecords)) {
        setBloodTestRecords(parsed.bloodTestRecords);
        await saveBloodRecordsToSqlite(parsed.bloodTestRecords);
      }

      showToast(`✅ Ripristino completato! ${totalRecords} record totali ripristinati (${entryCount} misurazioni, ${catCount} categorie, ${subTypeCount} sottotipi, ${bloodRecordCount} esami).`);
      setActiveScreen('home');
      return true;
    }
    return false;
  };

  const handleRestoreJsonText = async (jsonText: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonText);
      const success = await handleRestoreParsedJsonData(parsed);
      if (!success) {
        showToast('❌ Formato dati non valido: elenco letture mancante.');
      }
      return success;
    } catch {
      showToast('❌ Errore nel testo JSON inserito. Verifica che sia valido.');
      return false;
    }
  };

  const handleRestoreSqliteFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
        await loadRawSqliteDbFile(file);
        await reloadFromSqlite();
        const loadedEntries = await fetchEntriesFromSqlite();
        const loadedCategories = await fetchCategoriesFromSqlite();
        const loadedBlood = await fetchBloodRecordsFromSqlite();
        const total = loadedEntries.length + loadedCategories.length + loadedBlood.length;
        showToast(`✅ Database SQLite caricato con successo! ${total} record trattati (${loadedEntries.length} misurazioni, ${loadedCategories.length} categorie, ${loadedBlood.length} esami).`);
        setActiveScreen('home');
      } else if (file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);
            const success = await handleRestoreParsedJsonData(parsed);
            if (!success) {
              showToast('❌ File non valido: struttura dati non riconosciuta.');
            }
          } catch {
            showToast('❌ File JSON non valido o corrotto.');
          }
        };
        reader.readAsText(file);
      } else {
        showToast('Seleziona un file .sqlite, .db o .json');
      }
    } catch {
      showToast('❌ Errore durante il caricamento del database.');
    }
  };

  const handlePurgeAll = async () => {
    setEntries([]);
    await clearAllEntriesFromSqlite();
    clearAllEntries();
    showToast('Database SQLite azzerato.');
    setActiveScreen('home');
  };

  const handleImportCsvEntries = async (importedEntries: LogEntryItem[]) => {
    const updated = [...importedEntries, ...entries];
    setEntries(updated);
    await saveEntriesToSqlite(updated);
    showToast(`✅ ${importedEntries.length} letture importate con successo nel database!`);
  };

  const handleClearAllReadings = async () => {
    setEntries([]);
    await clearAllEntriesFromSqlite();
    clearAllEntries();
    setIsConfirmClearOpen(false);
    showToast('✅ Tutte le letture sono state cancellate dal database.');
  };

  const handleClearAllBloodRecords = async () => {
    setBloodTestRecords([]);
    await clearAllBloodRecordsFromSqlite();
    clearAllBloodTestRecords();
    setIsConfirmClearBloodOpen(false);
    showToast('✅ Tutti gli esami di laboratorio sono stati cancellati dal database.');
  };

  return (
    <div className="w-full min-h-screen bg-[#e8ecee] text-stone-900 flex flex-col relative selection:bg-[#8cc63f] selection:text-black">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-[#1e293b] border border-[#8cc63f] text-stone-100 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#8cc63f]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Confirmation Modal for Clearing All Readings */}
      <ConfirmClearModal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        onConfirm={handleClearAllReadings}
        totalEntriesCount={entries.length}
      />

      {/* Confirmation Modal for Clearing All Blood Tests */}
      <ConfirmClearModal
        isOpen={isConfirmClearBloodOpen}
        onClose={() => setIsConfirmClearBloodOpen(false)}
        onConfirm={handleClearAllBloodRecords}
        totalEntriesCount={bloodTestRecords.length}
        title="Cancellare TUTTI gli esami del sangue?"
        itemTypeLabel="esami di laboratorio"
        confirmMessage={`Questa operazione eliminerà tutti i ${bloodTestRecords.length > 0 ? `${bloodTestRecords.length} ` : ''}prelievi registrati nello storico delle analisi di laboratorio. I parametri e i range di riferimento rimarranno intatti.`}
      />

      {/* Edit Reading / Entry Modal */}
      <EditEntryModal
        isOpen={!!editingEntry}
        entry={editingEntry}
        categories={categories}
        subTypes={subTypes}
        onClose={() => setEditingEntry(null)}
        onSave={handleUpdateEntry}
        onDelete={handleDeleteEntry}
      />

      {/* CSV Importer Modal with Live Preview */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        categories={categories}
        subTypes={subTypes}
        onImportComplete={(importedEntries, mode, targetSubTypes, categoryLabel) => {
          if (mode === 'replace') {
            if (targetSubTypes && targetSubTypes.length > 0) {
              // Sovrascrittura selettiva: cancella solo le letture della categoria riconosciuta e mantiene intatte tutte le altre
              const preservedEntries = entries.filter(e => !targetSubTypes.includes(e.subTypeId));
              const updated = [...importedEntries, ...preservedEntries];
              setEntries(updated);
              saveEntriesToSqlite(updated);
              showToast(`✅ Sostituite ${importedEntries.length} misurazioni di "${categoryLabel || 'categoria'}" (gli altri dati sono intatti)`);
            } else {
              // Sovrascrittura completa
              setEntries(importedEntries);
              saveEntriesToSqlite(importedEntries);
              showToast(`✅ Sostituite tutte le letture con ${importedEntries.length} nuove misurazioni!`);
            }
          } else {
            const updated = [...importedEntries, ...entries];
            setEntries(updated);
            saveEntriesToSqlite(updated);
            showToast(`✅ ${importedEntries.length} misurazioni aggiunte con successo al database!`);
          }
        }}
      />

      {/* Main Full Screen Container */}
      <div className="w-full flex-1 min-h-screen bg-[#e8ecee] dark:bg-[#121418] text-stone-900 dark:text-stone-100 flex flex-col relative overflow-hidden transition-colors">
        
        {/* Render Active Screen */}
        {activeScreen === 'home' && (
          <HomeScreen
            entries={entries}
            onNavigate={(screen) => setActiveScreen(screen)}
            onOpenTools={() => setActiveScreen('tools')}
            onResetData={handleForceResetData}
            onEditEntry={(entry) => setEditingEntry(entry)}
          />
        )}

        {activeScreen === 'add' && (
          <AddEntryScreen
            categories={categories}
            subTypes={subTypes}
            entries={entries}
            onSaveEntries={handleSaveEntries}
            onBack={() => setActiveScreen('home')}
            onOpenTools={() => setActiveScreen('tools')}
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
          />
        )}

        {activeScreen === 'history' && (
          <HistoryScreen
            entries={entries}
            onDeleteEntry={handleDeleteEntry}
            onEditEntry={(entry) => setEditingEntry(entry)}
            onClearAll={() => setIsConfirmClearOpen(true)}
            onBack={() => setActiveScreen('home')}
            onOpenTools={() => setActiveScreen('tools')}
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
          />
        )}

        {activeScreen === 'graphs' && (
          <GraphsScreen
            entries={entries}
            subTypes={subTypes}
            onBack={() => setActiveScreen('home')}
            onOpenTools={() => setActiveScreen('tools')}
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
            onEditEntry={(entry) => setEditingEntry(entry)}
          />
        )}

        {activeScreen === 'reports' && (
          <ReportsScreen
            entries={entries}
            categories={categories}
            subTypes={subTypes}
            onBack={() => setActiveScreen('home')}
            onOpenTools={() => setActiveScreen('tools')}
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
            onEditEntry={(entry) => setEditingEntry(entry)}
          />
        )}

        {activeScreen === 'calendar' && (
          <CalendarScreen
            entries={entries}
            categories={categories}
            subTypes={subTypes}
            onBack={() => setActiveScreen('home')}
            onOpenTools={() => setActiveScreen('tools')}
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
            onEditEntry={(entry) => setEditingEntry(entry)}
            onDeleteEntry={handleDeleteEntry}
          />
        )}

        {activeScreen === 'blood-tests' && (
          <BloodTestsScreen
            records={bloodTestRecords}
            parameters={bloodTestParams}
            onSaveRecords={handleSaveBloodRecords}
            onSaveParameters={handleSaveBloodParameters}
            onBack={() => setActiveScreen('home')}
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
            onOpenTools={() => setActiveScreen('tools')}
            patientName="Angelo F"
          />
        )}

        {activeScreen === 'tools' && (
          <ToolsScreen
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
            onBack={() => setActiveScreen('home')}
            onOpenCsvImport={() => setIsCsvModalOpen(true)}
            onClearAllEntries={() => setIsConfirmClearOpen(true)}
            onClearAllBloodRecords={() => setIsConfirmClearBloodOpen(true)}
          />
        )}

        {activeScreen === 'system-settings' && (
          <SystemSettingsScreen
            onBack={() => setActiveScreen('tools')}
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
            onOpenCsvImport={() => setIsCsvModalOpen(true)}
            onClearAllEntries={() => setIsConfirmClearOpen(true)}
            onClearAllBloodRecords={() => setIsConfirmClearBloodOpen(true)}
            userSettings={userSettings}
            onUpdateUserSettings={handleUpdateUserSettings}
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            onEditCategory={(cat) => {
              setEditingCategory(cat);
              setActiveScreen('edit-category');
            }}
            subTypes={subTypes}
            onUpdateSubTypes={handleUpdateSubTypes}
            entriesCount={entries.length}
            bloodRecordsCount={bloodTestRecords.length}
          />
        )}

        {activeScreen === 'customize' && (
          <CustomizeScreen
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
            onBack={() => setActiveScreen('tools')}
          />
        )}

        {activeScreen === 'customize-categories' && (
          <CustomizeCategoriesScreen
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            onEditCategory={(cat) => {
              setEditingCategory(cat);
              setActiveScreen('edit-category');
            }}
            onBack={() => setActiveScreen('customize')}
          />
        )}

        {activeScreen === 'edit-category' && (
          <EditCategoryScreen
            category={editingCategory}
            onSaveCategory={(catToSave) => {
              if (editingCategory && categories.some(c => c.id === catToSave.id)) {
                handleSaveCategoryEdit(catToSave);
              } else {
                const updated = [...categories, catToSave];
                handleUpdateCategories(updated);
              }
            }}
            onDeleteCategory={handleDeleteCategory}
            onBack={() => setActiveScreen('customize-categories')}
          />
        )}

        {activeScreen === 'customize-subtypes' && (
          <CustomizeSubTypesScreen
            subTypes={subTypes}
            onUpdateSubTypes={handleUpdateSubTypes}
            onBack={() => setActiveScreen('customize')}
          />
        )}

        {/* Backup, Restore & Export Unified Screen */}
        {(activeScreen === 'backup' || activeScreen === 'export' || activeScreen === 'restore') && (
          <BackupRestoreScreen
            entries={entries}
            categories={categories}
            subTypes={subTypes}
            bloodTestParams={bloodTestParams}
            bloodTestRecords={bloodTestRecords}
            onBack={() => setActiveScreen('tools')}
            onNavigate={(screen) => setActiveScreen(screen as ActiveScreen)}
            showToast={showToast}
            onRestoreSqliteFile={handleRestoreSqliteFile}
            onRestoreJsonText={handleRestoreJsonText}
            userSettings={userSettings}
            onUpdateUserSettings={handleUpdateUserSettings}
            onReloadAllData={reloadFromSqlite}
          />
        )}

        {/* Purge Modal */}
        {activeScreen === 'purge' && (
          <div className="p-6 bg-white min-h-full flex flex-col justify-center items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-stone-900">Svuota Database (Purge)</h3>
            <p className="text-xs text-stone-600 max-w-xs">
              Questa operazione cancellerà permanentemente tutte le letture e la cronologia dal database locale del browser.
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setActiveScreen('tools')}
                className="px-4 py-2 bg-stone-200 text-stone-700 text-xs font-semibold rounded"
              >
                Annulla
              </button>
              <button
                onClick={handlePurgeAll}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow"
              >
                Conferma Cancellazione
              </button>
            </div>
          </div>
        )}

        {/* Export Screen Shortcut */}
        {activeScreen === 'export' && (
          <div className="p-6 bg-white min-h-full flex flex-col justify-center items-center text-center space-y-4">
            <h3 className="text-xl font-bold text-stone-900">Esportazione Dati</h3>
            <p className="text-xs text-stone-600 max-w-xs">
              Scegli il formato desiderato per esportare i tuoi registri di salute:
            </p>
            <div className="flex flex-col space-y-2 w-full max-w-xs pt-2">
              <button
                onClick={() => {
                  downloadCSV(entries);
                  showToast('File CSV esportato!');
                }}
                className="w-full py-3 bg-[#e0b828] text-white font-bold text-sm rounded shadow"
              >
                Esporta in Formato CSV
              </button>
              <button
                onClick={() => setActiveScreen('reports')}
                className="w-full py-3 bg-[#5a6265] text-white font-bold text-sm rounded shadow"
              >
                Stampa Report PDF
              </button>
              <button
                onClick={() => setActiveScreen('tools')}
                className="w-full py-2.5 bg-stone-200 text-stone-700 text-xs font-semibold rounded mt-2"
              >
                Indietro
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
