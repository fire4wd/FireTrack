import { HealthCategory, HealthSubType, LogEntryItem, MealSlotConfig, UserSettings, OnTrackBackupData, BloodTestParameter, BloodTestRecord, DailyNote, MedicationItem, ActiveFastingSession, SavedFastingRecord, NextcloudConfig } from '../types/ontrack';
import { defaultCategories, defaultSampleEntries, defaultSubTypes, defaultBloodTestParameters, defaultBloodTestRecords, defaultMedications } from '../data/ontrackDefaults';
import { defaultEventNotes } from '../components/ontrack/EventNoteIcon';
import { saveOrShareFile, shareFileNative } from './fileDownloader';

const STORAGE_KEYS = {
  ENTRIES: 'ontrack_entries_v1',
  CATEGORIES: 'ontrack_categories_v1',
  SUBTYPES: 'ontrack_subtypes_v1',
  MEAL_SLOTS: 'ontrack_meal_slots_v1',
  EVENT_NOTES: 'ontrack_event_notes_v1',
  USER_SETTINGS: 'ontrack_user_settings_v1',
  BLOOD_TEST_PARAMS: 'ontrack_blood_test_params_v1',
  BLOOD_TEST_RECORDS: 'ontrack_blood_test_records_v1',
  DAILY_NOTES: 'ontrack_daily_notes_v1',
  MEDICATIONS: 'ontrack_medications_v1',
  ACTIVE_FASTING: 'ontrack_active_fasting_v1',
  SAVED_FASTINGS: 'ontrack_saved_fastings_v1',
};

export const defaultMealSlots: MealSlotConfig[] = [
  { id: 'night', name: 'Notte (Digiuno)', startTime: '00:00', endTime: '05:00', color: '#1f2c44', emoji: '🌙' },
  { id: 'bf', name: 'Colazione', startTime: '05:00', endTime: '11:00', color: '#0090d4', emoji: '🌅' },
  { id: 'lunch', name: 'Pranzo', startTime: '11:00', endTime: '14:30', color: '#14857b', emoji: '☀️' },
  { id: 'dinner', name: 'Cena', startTime: '17:00', endTime: '20:00', color: '#4944db', emoji: '🍽️' },
  { id: 'bed', name: 'Coricarsi', startTime: '22:00', endTime: '23:59', color: '#383896', emoji: '🛏️' },
];

export const defaultReminderSettings = {
  enabled: false,
  time: '20:00',
  daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // Every day (Mon-Sun)
  message: 'Ricordati di registrare la glicemia e i tuoi parametri sanitari in OnTrack!',
  soundEnabled: true,
  includeGlucosePrompt: true,
  includeBloodPressurePrompt: false,
};

export const defaultNextcloudConfig: NextcloudConfig = {
  serverUrl: 'https://nc.fire4wd.uk',
  username: 'fire',
  password: '',
  folder: 'FireTrack',
  autoSyncOnBackup: false
};

export const defaultUserSettings: UserSettings = {
  patientName: 'Angelo F',
  birthDate: '1973-05-07',
  unit: 'mg/dL',
  targetPreMin: 70,
  targetPreMax: 130,
  targetPostMin: 70,
  targetPostMax: 180,
  theme: 'dark',
  reminder: defaultReminderSettings,
  nextcloud: defaultNextcloudConfig,
};

export const loadMealSlots = (): MealSlotConfig[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEAL_SLOTS);
    if (!raw) {
      saveMealSlots(defaultMealSlots);
      return defaultMealSlots;
    }
    const parsed: MealSlotConfig[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveMealSlots(defaultMealSlots);
      return defaultMealSlots;
    }
    // Update old default names if matched
    let needsSave = false;
    const updated = parsed.map(slot => {
      if (slot.id === 'night' && slot.name === 'Notte') {
        needsSave = true;
        return { ...slot, name: 'Notte (Digiuno)', startTime: '00:00', endTime: '05:00', color: '#1e293b' };
      }
      if (slot.id === 'bed' && (slot.name === 'Ora di coricarsi' || slot.endTime === '0:00')) {
        needsSave = true;
        return { ...slot, name: 'Coricarsi', startTime: '22:00', endTime: '23:59', color: '#312e81' };
      }
      if (slot.id === 'bf' && slot.startTime === '5:00') {
        needsSave = true;
        return { ...slot, startTime: '05:00', endTime: '11:00', color: '#0284c7' };
      }
      if (slot.id === 'lunch' && slot.startTime === '11:00') {
        needsSave = true;
        return { ...slot, startTime: '11:00', endTime: '14:30', color: '#0f766e' };
      }
      if (slot.id === 'dinner' && slot.startTime === '17:00') {
        needsSave = true;
        return { ...slot, startTime: '17:00', endTime: '20:00', color: '#4338ca' };
      }
      return slot;
    });
    if (needsSave) {
      saveMealSlots(updated);
      return updated;
    }
    return parsed;
  } catch (e) {
    return defaultMealSlots;
  }
};

export const saveMealSlots = (slots: MealSlotConfig[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.MEAL_SLOTS, JSON.stringify(slots));
  } catch (e) {
    console.error('Error saving meal slots:', e);
  }
};

export const loadEventNotes = (): typeof defaultEventNotes => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENT_NOTES);
    if (!raw) {
      saveEventNotes(defaultEventNotes);
      return defaultEventNotes;
    }
    return JSON.parse(raw);
  } catch (e) {
    return defaultEventNotes;
  }
};

export const saveEventNotes = (notes: typeof defaultEventNotes): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.EVENT_NOTES, JSON.stringify(notes));
  } catch (e) {
    console.error('Error saving event notes:', e);
  }
};

export const loadUserSettings = (): UserSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    if (!raw) {
      saveUserSettings(defaultUserSettings);
      return defaultUserSettings;
    }
    const parsed = JSON.parse(raw);
    if (parsed.patientName === 'Mario Rossi' || parsed.patientName === 'Angelo D') {
      parsed.patientName = 'Angelo F';
    }
    if (!parsed.theme) {
      parsed.theme = 'dark';
    }
    if (!parsed.reminder) {
      parsed.reminder = { ...defaultReminderSettings };
    } else {
      parsed.reminder = {
        ...defaultReminderSettings,
        ...parsed.reminder
      };
    }
    if (!parsed.nextcloud) {
      parsed.nextcloud = { ...defaultNextcloudConfig };
    } else {
      parsed.nextcloud = {
        ...defaultNextcloudConfig,
        ...parsed.nextcloud
      };
      if (parsed.nextcloud.serverUrl === 'https://100.104.132.47:4443' || parsed.nextcloud.serverUrl === 'http://100.104.132.47:8080') {
        parsed.nextcloud.serverUrl = 'https://nc.fire4wd.uk';
      }
    }
    saveUserSettings(parsed);
    return parsed;
  } catch (e) {
    return defaultUserSettings;
  }
};

export const saveUserSettings = (settings: UserSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving user settings:', e);
  }
};

export const loadEntries = (): LogEntryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    if (!raw) {
      saveEntries(defaultSampleEntries);
      return defaultSampleEntries;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading entries:', e);
    return defaultSampleEntries;
  }
};

export const saveEntries = (entries: LogEntryItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
  } catch (e) {
    console.error('Error saving entries:', e);
  }
};

export const loadCategories = (): HealthCategory[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) {
      saveCategories(defaultCategories);
      return defaultCategories;
    }
    return JSON.parse(raw);
  } catch (e) {
    return defaultCategories;
  }
};

export const saveCategories = (categories: HealthCategory[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (e) {
    console.error('Error saving categories:', e);
  }
};

export const loadSubTypes = (): HealthSubType[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBTYPES);
    if (!raw) {
      saveSubTypes(defaultSubTypes);
      return defaultSubTypes;
    }
    const parsed: HealthSubType[] = JSON.parse(raw);
    // Normalize and filter out duplicate pulse / old names
    const cleaned = parsed
      .filter(st => st.id !== 'sub_pulse')
      .map(st => {
        if (st.id === 'sub_bp' || st.name.toLowerCase().includes('pressione')) {
          return { ...st, id: 'sub_bp', name: 'Pressione', unit: 'mmHg' };
        }
        return st;
      });
    return cleaned.length > 0 ? cleaned : defaultSubTypes;
  } catch (e) {
    return defaultSubTypes;
  }
};

export const saveSubTypes = (subTypes: HealthSubType[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SUBTYPES, JSON.stringify(subTypes));
  } catch (e) {
    console.error('Error saving subtypes:', e);
  }
};

// Creates standard Backup JSON string
export const getBackupJSONString = (
  entries: LogEntryItem[],
  categories: HealthCategory[],
  subTypes: HealthSubType[],
  bloodTestParams?: BloodTestParameter[],
  bloodTestRecords?: BloodTestRecord[]
): string => {
  const data: OnTrackBackupData = {
    version: '1.0.1',
    appName: 'FireTrack',
    exportDate: new Date().toISOString(),
    entries,
    categories,
    subTypes,
    bloodTestParams: bloodTestParams || loadBloodTestParams(),
    bloodTestRecords: bloodTestRecords || loadBloodTestRecords(),
  };
  return JSON.stringify(data, null, 2);
};

// Download backup JSON file
export const downloadBackupJSON = async (
  entries: LogEntryItem[],
  categories: HealthCategory[],
  subTypes: HealthSubType[],
  bloodTestParams?: BloodTestParameter[],
  bloodTestRecords?: BloodTestRecord[]
): Promise<{ success: boolean; message: string; totalRecords: number }> => {
  try {
    const totalRecords = entries.length + categories.length + subTypes.length + (bloodTestRecords?.length || 0) + (bloodTestParams?.length || 0);
    const jsonStr = getBackupJSONString(entries, categories, subTypes, bloodTestParams, bloodTestRecords);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const filename = `FireTrack_Backup_${new Date().toISOString().slice(0,10)}.json`;

    const res = await saveOrShareFile({
      filename,
      blob,
      mimeType: 'application/json',
      dialogTitle: `Salva o Condividi ${filename}`
    });

    return {
      success: res.success,
      message: res.message || `Backup JSON salvato con successo! (${totalRecords} record inclusi)`,
      totalRecords
    };
  } catch (err: any) {
    console.error('Error saving backup file:', err);
    return {
      success: false,
      message: `Errore durante il backup: ${err?.message || 'operazione fallita'}`,
      totalRecords: 0
    };
  }
};

// Share backup JSON directly via system share sheet (WhatsApp, Drive, Gmail, etc.)
export const shareBackupJSON = async (
  entries: LogEntryItem[],
  categories: HealthCategory[],
  subTypes: HealthSubType[],
  bloodTestParams?: BloodTestParameter[],
  bloodTestRecords?: BloodTestRecord[]
): Promise<{ success: boolean; message: string; totalRecords: number }> => {
  try {
    const totalRecords = entries.length + categories.length + subTypes.length + (bloodTestRecords?.length || 0) + (bloodTestParams?.length || 0);
    const jsonStr = getBackupJSONString(entries, categories, subTypes, bloodTestParams, bloodTestRecords);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const filename = `FireTrack_Backup_${new Date().toISOString().slice(0,10)}.json`;

    const res = await shareFileNative({
      filename,
      blob,
      mimeType: 'application/json',
      dialogTitle: `Condividi Backup FireTrack (${filename})`
    });

    return {
      ...res,
      totalRecords
    };
  } catch (err: any) {
    console.error('Error sharing backup file:', err);
    return {
      success: false,
      message: `Errore durante la condivisione: ${err?.message || 'errore'}`,
      totalRecords: 0
    };
  }
};

// Copy backup JSON string to device clipboard
export const copyBackupJSONToClipboard = async (
  entries: LogEntryItem[],
  categories: HealthCategory[],
  subTypes: HealthSubType[],
  bloodTestParams?: BloodTestParameter[],
  bloodTestRecords?: BloodTestRecord[]
): Promise<{ success: boolean; count: number; totalRecords: number }> => {
  try {
    const totalRecords = entries.length + categories.length + subTypes.length + (bloodTestRecords?.length || 0) + (bloodTestParams?.length || 0);
    const jsonStr = getBackupJSONString(entries, categories, subTypes, bloodTestParams, bloodTestRecords);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(jsonStr);
      return { success: true, count: entries.length, totalRecords };
    }
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = jsonStr;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return { success: true, count: entries.length, totalRecords };
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return { success: false, count: 0, totalRecords: 0 };
  }
};

// Generic helper to trigger CSV file download with UTF-8 BOM
const triggerCsvDownload = async (csvString: string, filename: string): Promise<{ success: boolean; message: string }> => {
  try {
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const res = await saveOrShareFile({
      filename,
      blob,
      mimeType: 'text/csv',
      dialogTitle: `Salva o Condividi ${filename}`
    });
    return {
      success: res.success,
      message: res.message || 'File CSV salvato con successo!'
    };
  } catch (err: any) {
    console.error('Error saving CSV file:', err);
    return {
      success: false,
      message: `Errore salvataggio CSV: ${err?.message || 'errore'}`
    };
  }
};

// Export CSV file with UTF-8 BOM for maximum compatibility
export const downloadCSV = (entries: LogEntryItem[], filenamePrefix: string = 'OnTrack_Report'): void => {
  const headers = ['Data', 'Ora', 'Tipo', 'Valore', 'Sistolica', 'Diastolica', 'Pulsazioni_bpm', 'Unita', 'Categoria', 'Momento_Pasto', 'Note'];

  const rows = entries.map(e => [
    `"${e.date || ''}"`,
    `"${e.time || ''}"`,
    `"${e.subTypeName || ''}"`,
    `"${e.value || ''}"`,
    `"${e.systolic || ''}"`,
    `"${e.diastolic || ''}"`,
    `"${e.pulse || ''}"`,
    `"${e.unit || ''}"`,
    `"${e.categoryName || ''}"`,
    `"${e.mealTiming === 'pre' ? 'Pre-pasto' : e.mealTiming === 'post' ? 'Post-pasto' : ''}"`,
    `"${(e.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `${filenamePrefix}_${new Date().toISOString().slice(0,10)}.csv`);
};

// Export Specific Glucose CSV Report
export const downloadGlucoseCSV = (
  entries: LogEntryItem[],
  patientName: string = 'Utente',
  periodLabel: string = 'Tutto'
): void => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const headers = ['Data', 'Ora', 'Glicemia (mg/dL)', 'Categoria / Fascia Oraria', 'Momento Pasto', 'Icona / Evento', 'Note'];

  const rows = entries.map(e => [
    `"${e.date || ''}"`,
    `"${e.time || ''}"`,
    `"${e.value || ''}"`,
    `"${e.categoryName || ''}"`,
    `"${e.mealTiming === 'pre' ? 'Pre pasto (Mela Intera)' : e.mealTiming === 'post' ? 'Post pasto (Torsolo Mela)' : ''}"`,
    `"${e.eventNoteIcon || ''}"`,
    `"${(e.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `Report_Glicemico_${cleanPeriod}_${cleanPatient}_${new Date().toISOString().slice(0,10)}.csv`);
};

// Export Specific Pressure & Pulse CSV Report
export const downloadPressureCSV = (
  entries: LogEntryItem[],
  patientName: string = 'Utente',
  periodLabel: string = 'Tutto'
): void => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const headers = ['Data', 'Ora', 'Sistolica (Max mmHg)', 'Diastolica (Min mmHg)', 'Pulsazioni (bpm)', 'Categoria', 'Note'];

  const rows = entries.map(e => [
    `"${e.date || ''}"`,
    `"${e.time || ''}"`,
    `"${e.systolic || e.value || ''}"`,
    `"${e.diastolic || ''}"`,
    `"${e.pulse || ''}"`,
    `"${e.categoryName || ''}"`,
    `"${(e.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `Report_Pressione_${cleanPeriod}_${cleanPatient}_${new Date().toISOString().slice(0,10)}.csv`);
};

// Export Specific Statistical Summary CSV Report
export const downloadStatsCSV = (
  temporalStats: { period: string; count: number; avg: string; status: string }[],
  categoryStats: { category: string; count: number; avg: string }[],
  estimatedHbA1c: string,
  patientName: string = 'Utente',
  periodLabel: string = 'Tutto'
): void => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');

  const section1Header = ['--- PROSPETTO MEDIE TEMPORALI ---', '', '', ''];
  const headers1 = ['Periodo di Riferimento', 'Numero Letture', 'Media Glicemica (mg/dL)', 'Stato Target'];
  const rows1 = temporalStats.map(s => [
    `"${s.period}"`,
    `"${s.count}"`,
    `"${s.avg}"`,
    `"${s.status}"`
  ]);
  const hba1cRow = ['"HbA1c Stimata"', '"-"', `"${estimatedHbA1c}"`, '"Formula media 90 giorni"'];

  const section2Header = ['', '', '', ''];
  const section2Title = [`--- MEDIE GLICEMICHE PER CATEGORIA (${cleanPeriod}) ---`, '', '', ''];
  const headers2 = ['Momento / Categoria', 'Numero Letture', 'Media Glicemica (mg/dL)', ''];
  const rows2 = categoryStats.map(c => [
    `"${c.category}"`,
    `"${c.count}"`,
    `"${c.avg}"`,
    '""'
  ]);

  const allLines = [
    section1Header.join(';'),
    headers1.join(';'),
    ...rows1.map(r => r.join(';')),
    hba1cRow.join(';'),
    section2Header.join(';'),
    section2Title.join(';'),
    headers2.join(';'),
    ...rows2.map(r => r.join(';'))
  ];

  triggerCsvDownload(allLines.join('\r\n'), `Statistiche_Glicemia_${cleanPeriod}_${cleanPatient}_${new Date().toISOString().slice(0,10)}.csv`);
};

// Export Specific Diary CSV Report (with optional Pressure & Pulse columns)
export const downloadDiaryCSV = (
  entries: LogEntryItem[],
  days: number | 'all' | string,
  patientName: string = 'Utente',
  includeVitals: boolean = true
): void => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const periodTag = typeof days === 'number' ? `${days}gg` : String(days).replace(/[^a-zA-Z0-9_-]/g, '_');

  const headers = includeVitals
    ? ['Data', 'Ora', 'Tipo Misurazione', 'Valore / Glicemia (mg/dL)', 'Sistolica (mmHg)', 'Diastolica (mmHg)', 'Battiti (bpm)', 'Fascia Oraria / Slot', 'Momento Pasto', 'Note / Terapia']
    : ['Data', 'Ora', 'Glicemia (mg/dL)', 'Fascia Oraria / Slot', 'Momento Pasto', 'Note / Terapia'];

  const rows = entries.map(e => {
    if (includeVitals) {
      return [
        `"${e.date || ''}"`,
        `"${e.time || ''}"`,
        `"${e.subTypeName || ''}"`,
        `"${e.value || ''}"`,
        `"${e.systolic || ''}"`,
        `"${e.diastolic || ''}"`,
        `"${e.pulse || ''}"`,
        `"${e.categoryName || ''}"`,
        `"${e.mealTiming === 'pre' ? 'Pre pasto' : e.mealTiming === 'post' ? 'Post pasto' : ''}"`,
        `"${(e.note || '').replace(/"/g, '""')}"`
      ];
    } else {
      return [
        `"${e.date || ''}"`,
        `"${e.time || ''}"`,
        `"${e.value || ''}"`,
        `"${e.categoryName || ''}"`,
        `"${e.mealTiming === 'pre' ? 'Pre pasto' : e.mealTiming === 'post' ? 'Post pasto' : ''}"`,
        `"${(e.note || '').replace(/"/g, '""')}"`
      ];
    }
  });

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `Diario_Completo_${periodTag}_${cleanPatient}_${new Date().toISOString().slice(0,10)}.csv`);
};

// Export Weight Report CSV
export const downloadWeightCSV = (
  entries: LogEntryItem[],
  patientName: string = 'Utente',
  periodLabel: string = 'Periodo'
): void => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');

  const headers = ['Data', 'Ora', 'Tipo', 'Peso (kg)', 'Quanto conforme siete stati?'];
  const rows = entries.map(e => [
    `"${e.date || ''}"`,
    `"${e.time || '12:00'}"`,
    `"Peso"`,
    `"${String(e.value || '').replace('.', ',')}"`,
    `"${(e.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `Report_Peso_${cleanPeriod}_${cleanPatient}_${new Date().toISOString().slice(0, 10)}.csv`);
};

// Export Nutrition Summary Report CSV
export const downloadNutritionCSV = (
  entries: LogEntryItem[],
  patientName: string = 'Utente',
  periodLabel: string = 'Periodo'
): void => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');

  const headers = ['Data', 'Ora', 'Tipo', 'Alimenti (Cal)', '% GDA', 'Grassi (g)', 'Proteine (g)', 'Carboidrati (g)', 'Esercizio (Cal)', 'Netto (Cal)', 'Note'];

  const rows = entries.map(e => {
    const note = e.note || '';
    const calMatch = note.match(/Calorie:\s*([\d.,]+)/i);
    const gdaMatch = note.match(/% GDA:\s*([\d.,]+)/i);
    const fatMatch = note.match(/Grassi:\s*([\d.,]+)/i);
    const protMatch = note.match(/Proteine:\s*([\d.,]+)/i);
    const carbMatch = note.match(/Carboidrati:\s*([\d.,]+)/i);
    const exerMatch = note.match(/Esercizio:\s*([\d.,]+)/i);
    const netMatch = note.match(/Netto:\s*([\d.,]+)/i);

    const calVal = e.calories ?? (calMatch ? calMatch[1] : (e.unit === 'Cal' ? String(e.value || '') : '-'));
    const gdaVal = e.gda ?? (gdaMatch ? gdaMatch[1] : '-');
    const fatVal = e.fat ?? (fatMatch ? fatMatch[1] : '-');
    const protVal = e.protein ?? (protMatch ? protMatch[1] : '-');
    const carbVal = e.carbs ?? (carbMatch ? carbMatch[1] : (e.unit === 'g' ? String(e.value || '') : '-'));
    const exerVal = e.exerciseCal ?? (exerMatch ? exerMatch[1] : '-');
    const netVal = e.netCal ?? (netMatch ? netMatch[1] : '-');

    return [
      `"${e.date || ''}"`,
      `"${e.time || '12:00'}"`,
      `"Alimenti"`,
      `"${calVal}"`,
      `"${gdaVal}"`,
      `"${fatVal}"`,
      `"${protVal}"`,
      `"${carbVal}"`,
      `"${exerVal}"`,
      `"${netVal}"`,
      `"${note.replace(/"/g, '""')}"`
    ];
  });

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `Report_Nutrizione_${cleanPeriod}_${cleanPatient}_${new Date().toISOString().slice(0, 10)}.csv`);
};

// Export Intermittent Fasting Report CSV
export const downloadFastingCSV = (
  sessions: any[],
  patientName: string = 'Utente',
  periodLabel: string = 'Periodo'
): void => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');

  const headers = ['Data', 'Inizio', 'Fine (Rottura)', 'Durata (Ore)', 'Split', 'Stadio Metabolico', 'Glicemia Inizio', 'Glicemia Fine', 'Note / Dettagli'];

  const rows = sessions.map(s => [
    `"${s.date || ''}"`,
    `"${s.startTime || ''}"`,
    `"${s.endTime || ''}"`,
    `"${String(s.durationHours || '').replace('.', ',')}"`,
    `"${s.protocol || ''}"`,
    `"${s.metabolicStage === 'autophagy' ? 'Autofagia (22h+)' : s.metabolicStage === 'ketosis' ? 'Chetosi (16-22h)' : 'Lipolisi (12-16h)'}"`,
    `"${s.startingGlucose || '-'}"`,
    `"${s.endingGlucose || '-'}"`,
    `"${(s.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `Report_Digiuno_Intermittente_${cleanPeriod}_${cleanPatient}_${new Date().toISOString().slice(0, 10)}.csv`);
};


// Export Logbook CSV with Custom Period Filtering
export const downloadLogbookCSV = (
  allEntries: LogEntryItem[],
  period: '7' | '14' | '30' | '60' | '90' | 'all' | 'custom',
  startDate?: string,
  endDate?: string
): { success: boolean; count: number } => {
  const now = Date.now();
  let filtered = allEntries;

  if (period === '7') {
    const cutoff = now - 7 * 86400000;
    filtered = allEntries.filter(e => e.timestamp >= cutoff);
  } else if (period === '14') {
    const cutoff = now - 14 * 86400000;
    filtered = allEntries.filter(e => e.timestamp >= cutoff);
  } else if (period === '30') {
    const cutoff = now - 30 * 86400000;
    filtered = allEntries.filter(e => e.timestamp >= cutoff);
  } else if (period === '60') {
    const cutoff = now - 60 * 86400000;
    filtered = allEntries.filter(e => e.timestamp >= cutoff);
  } else if (period === '90') {
    const cutoff = now - 90 * 86400000;
    filtered = allEntries.filter(e => e.timestamp >= cutoff);
  } else if (period === 'custom' && startDate && endDate) {
    filtered = allEntries.filter(e => {
      const eDate = e.date.includes('/')
        ? e.date.split('/').reverse().join('-')
        : e.date;
      return eDate >= startDate && eDate <= endDate;
    });
  }

  if (filtered.length === 0) {
    return { success: false, count: 0 };
  }

  const headers = [
    'Data',
    'Ora',
    'Tipo Misurazione',
    'Valore',
    'Sistolica',
    'Diastolica',
    'Pulsazioni_bpm',
    'Unita',
    'Fascia Oraria / Categoria',
    'Timing Pasto (Pre/Post)',
    'Note Evento / Icona',
    'Note'
  ];

  const rows = filtered.map(e => [
    `"${e.date || ''}"`,
    `"${e.time || ''}"`,
    `"${e.subTypeName || ''}"`,
    `"${e.value || ''}"`,
    `"${e.systolic || ''}"`,
    `"${e.diastolic || ''}"`,
    `"${e.pulse || ''}"`,
    `"${e.unit || ''}"`,
    `"${e.categoryName || ''}"`,
    `"${e.mealTiming === 'pre' ? 'Pre pasto (mela intera 🍎)' : e.mealTiming === 'post' ? 'Post pasto (torsolo mela 🍏)' : ''}"`,
    `"${e.eventNoteIcon || ''}"`,
    `"${(e.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const periodLabel = period === 'all' ? 'TUTTO' : period === 'custom' ? `${startDate}_al_${endDate}` : `${period}gg`;
  triggerCsvDownload(csvContent, `Logbook_Export_${periodLabel}_${new Date().toISOString().slice(0, 10)}.csv`);

  return { success: true, count: filtered.length };
};

// Clear all logged entries
export const clearAllEntries = (): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify([]));
  } catch (e) {
    console.error('Error clearing entries:', e);
  }
};

// ============================================================================
// BLOOD TESTS (ESAMI DEL SANGUE) STORAGE & HELPERS
// ============================================================================

export const saveBloodTestParams = (params: BloodTestParameter[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.BLOOD_TEST_PARAMS, JSON.stringify(params));
  } catch (e) {
    console.error('Error saving blood test parameters:', e);
  }
};

export const loadBloodTestParams = (): BloodTestParameter[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BLOOD_TEST_PARAMS);
    if (!raw) {
      saveBloodTestParams(defaultBloodTestParameters);
      return defaultBloodTestParameters;
    }
    const parsed: BloodTestParameter[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Migrate any microalbuminuria id/name to ACR
      let changed = false;
      const updated = parsed.map(p => {
        if (p.id === 'microalbuminuria' || p.name.toLowerCase() === 'microalbuminuria') {
          changed = true;
          return {
            ...p,
            id: 'acr',
            name: 'ACR',
            unit: 'mg/g',
            conditionType: 'max_only' as const,
            max: 20
          };
        }
        return p;
      });
      // Ensure RAC exists if missing
      if (!updated.some(p => p.id === 'rac' || p.name.toLowerCase() === 'rac')) {
        updated.splice(11, 0, { id: 'rac', name: 'RAC', unit: 'g/g', conditionType: 'max_only', max: 0.030, order: 12 });
        updated.forEach((p, idx) => { p.order = idx + 1; });
        changed = true;
      }
      if (changed) {
        saveBloodTestParams(updated);
      }
      return updated;
    }
    return defaultBloodTestParameters;
  } catch (e) {
    return defaultBloodTestParameters;
  }
};

export const loadBloodTestRecords = (): BloodTestRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BLOOD_TEST_RECORDS);
    if (raw === null) {
      saveBloodTestRecords(defaultBloodTestRecords);
      return defaultBloodTestRecords;
    }
    const parsed: BloodTestRecord[] = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [];
      // Migrate microalbuminuria field to acr inside records values
      let changed = false;
      const updated = parsed.map(r => {
        if (r.values && ('microalbuminuria' in r.values) && !('acr' in r.values)) {
          changed = true;
          const { microalbuminuria, ...rest } = r.values;
          return {
            ...r,
            values: {
              ...rest,
              acr: microalbuminuria
            }
          };
        }
        return r;
      });
      if (changed) {
        saveBloodTestRecords(updated);
      }
      return updated;
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const saveBloodTestRecords = (records: BloodTestRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.BLOOD_TEST_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving blood test records:', e);
  }
};

export const clearAllBloodTestRecords = (): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.BLOOD_TEST_RECORDS, JSON.stringify([]));
  } catch (e) {
    console.error('Error clearing blood test records:', e);
  }
};

/**
 * Evaluates whether a numeric value is within reference range.
 * Returns status: 'in_range' (green) | 'high' (red) | 'low' (red)
 */
export function evaluateBloodParam(
  val: number | null | undefined,
  param: BloodTestParameter
): { status: 'in_range' | 'high' | 'low' | 'none'; isGreen: boolean; isRed: boolean } {
  if (val === null || val === undefined || isNaN(val)) {
    return { status: 'none', isGreen: false, isRed: false };
  }

  if (param.conditionType === 'range') {
    if (param.min !== undefined && val < param.min) {
      return { status: 'low', isGreen: false, isRed: true };
    }
    if (param.max !== undefined && val > param.max) {
      return { status: 'high', isGreen: false, isRed: true };
    }
    return { status: 'in_range', isGreen: true, isRed: false };
  }

  if (param.conditionType === 'max_only') {
    if (param.max !== undefined && val > param.max) {
      return { status: 'high', isGreen: false, isRed: true };
    }
    return { status: 'in_range', isGreen: true, isRed: false };
  }

  if (param.conditionType === 'min_only') {
    if (param.min !== undefined && val < param.min) {
      return { status: 'low', isGreen: false, isRed: true };
    }
    return { status: 'in_range', isGreen: true, isRed: false };
  }

  return { status: 'in_range', isGreen: true, isRed: false };
}

/**
 * Format range for table header display, e.g. "(74-110)", "(<220)", "(>40)"
 */
export function formatParamRangeLabel(param: BloodTestParameter): string {
  if (param.conditionType === 'range') {
    const minStr = param.min !== undefined ? String(param.min).replace('.', ',') : '';
    const maxStr = param.max !== undefined ? String(param.max).replace('.', ',') : '';
    return `(${minStr}-${maxStr})`;
  }
  if (param.conditionType === 'max_only') {
    const maxStr = param.max !== undefined ? String(param.max).replace('.', ',') : '';
    return `(<${maxStr})`;
  }
  if (param.conditionType === 'min_only') {
    const minStr = param.min !== undefined ? String(param.min).replace('.', ',') : '';
    return `(>${minStr})`;
  }
  return '';
}

/**
 * Export Blood Test records to CSV
 */
export const downloadBloodTestsCSV = (
  records: BloodTestRecord[],
  params: BloodTestParameter[],
  patientName: string = 'Utente'
): void => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');

  // Headers: Data, [Param1 (Range)], [Param2 (Range)], ..., Note
  const headers = [
    'Data',
    ...params.map(p => `"${p.name} ${formatParamRangeLabel(p)} [${p.unit}]"`),
    'Note'
  ];

  const rows = records.map(rec => {
    const rowVals = params.map(p => {
      const val = rec.values[p.id] ??
        (p.id === 'acr' ? rec.values['microalbuminuria'] : undefined) ??
        rec.values[p.name.toLowerCase()] ??
        null;
      return val !== null && val !== undefined ? `"${String(val).replace('.', ',')}"` : '""';
    });
    return [`"${rec.date}"`, ...rowVals, `"${(rec.notes || '').replace(/"/g, '""')}"`];
  });

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `Storico_Esami_Sangue_${cleanPatient}_${new Date().toISOString().slice(0, 10)}.csv`);
};

/**
 * Generate CSV template ready to be opened in Excel/Sheets and filled in
 */
export const downloadBloodTestCsvTemplate = (params: BloodTestParameter[]): void => {
  const headers = ['Data (AAAAMM o GG/MM/AAAA)', ...params.map(p => `${p.name} ${formatParamRangeLabel(p)}`), 'Note'];

  const sampleRow1 = ['201810', '138', '', '0,76', '', '', '179', '36', '235', '6,9', '52', '74', '', '', 'Prelievo di controllo'];
  const sampleRow2 = ['201901', '243', '', '0,72', '', '', '181', '35', '224', '9,2', '77', '102', '', '', ''];
  const sampleRow3 = ['201905', '95', '', '0,56', '5', '83', '126', '32', '139', '7,2', '55', '108', '', '', ''];

  const csvContent = [
    headers.join(';'),
    sampleRow1.join(';'),
    sampleRow2.join(';'),
    sampleRow3.join(';')
  ].join('\r\n');

  triggerCsvDownload(csvContent, `Template_Import_Esami_Sangue.csv`);
};

export const loadDailyNotes = (): DailyNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_NOTES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading daily notes from localStorage:', e);
    return [];
  }
};

export const saveDailyNotes = (notes: DailyNote[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_NOTES, JSON.stringify(notes));
  } catch (e) {
    console.error('Error saving daily notes to localStorage:', e);
  }
};

export const loadMedications = (): MedicationItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEDICATIONS);
    if (!raw) {
      saveMedications(defaultMedications);
      return defaultMedications;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveMedications(defaultMedications);
      return defaultMedications;
    }
    return parsed;
  } catch (e) {
    console.error('Error loading medications from localStorage:', e);
    return defaultMedications;
  }
};

export const saveMedications = (meds: MedicationItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(meds));
  } catch (e) {
    console.error('Error saving medications to localStorage:', e);
  }
};

export const getDefaultActiveFasting = (): ActiveFastingSession => {
  // Default to a realistic active fast started 14 hours ago
  const now = new Date();
  const startTime = new Date(now.getTime() - 14.5 * 3600 * 1000).toISOString();
  return {
    isActive: true,
    startTime,
    protocol: '16:8',
    targetHours: 16,
    startingGlucose: 135,
    note: 'Iniziato dopo la cena di ieri. Acqua e tisane al finocchio assunte con regolarità.'
  };
};

export const loadActiveFasting = (): ActiveFastingSession => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_FASTING);
    if (!raw) {
      const def = getDefaultActiveFasting();
      saveActiveFasting(def);
      return def;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'startTime' in parsed) {
      return parsed;
    }
    const def = getDefaultActiveFasting();
    saveActiveFasting(def);
    return def;
  } catch (e) {
    return getDefaultActiveFasting();
  }
};

export const saveActiveFasting = (fasting: ActiveFastingSession): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_FASTING, JSON.stringify(fasting));
  } catch (e) {
    console.error('Error saving active fasting session:', e);
  }
};

export const loadSavedFastings = (): SavedFastingRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_FASTINGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading saved fastings:', e);
    return [];
  }
};

export const saveSavedFastings = (records: SavedFastingRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_FASTINGS, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving fastings:', e);
  }
};

export const addSavedFastingRecord = (record: SavedFastingRecord): void => {
  const existing = loadSavedFastings();
  const updated = [record, ...existing.filter(r => r.id !== record.id)];
  saveSavedFastings(updated);
};

// ============================================================================
// MEDICATIONS IMPORT / EXPORT HELPERS
// ============================================================================

export const downloadMedicationsCSV = async (
  medications: MedicationItem[],
  patientName: string = 'Utente'
): Promise<{ success: boolean; message: string }> => {
  const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const headers = ['Nome Farmaco', 'Dosaggio', 'Orario / Frequenza', 'Istruzioni', 'Attivo', 'Note'];

  const rows = medications.map(m => [
    `"${(m.name || '').replace(/"/g, '""')}"`,
    `"${(m.dosage || '').replace(/"/g, '""')}"`,
    `"${(m.schedule || '').replace(/"/g, '""')}"`,
    `"${(m.instructions || '').replace(/"/g, '""')}"`,
    `"${m.active !== false ? 'Sì' : 'No'}"`,
    `"${(m.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  return triggerCsvDownload(csvContent, `Farmaci_${cleanPatient}_${new Date().toISOString().slice(0, 10)}.csv`);
};

export const downloadMedicationsJSON = async (
  medications: MedicationItem[],
  patientName: string = 'Utente'
): Promise<{ success: boolean; message: string }> => {
  try {
    const cleanPatient = (patientName || 'Utente').replace(/[^a-zA-Z0-9_-]/g, '_');
    const data = {
      appName: 'FireTrack',
      type: 'medications_backup',
      exportDate: new Date().toISOString(),
      patientName,
      count: medications.length,
      medications
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const filename = `Farmaci_${cleanPatient}_${new Date().toISOString().slice(0, 10)}.json`;

    const res = await saveOrShareFile({
      filename,
      blob,
      mimeType: 'application/json',
      dialogTitle: `Salva o Condividi ${filename}`
    });

    return {
      success: res.success,
      message: res.message || 'Backup Farmaci JSON esportato con successo!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Errore durante l'esportazione JSON: ${err?.message || 'errore'}`
    };
  }
};

export const downloadMedicationCsvTemplate = (): void => {
  const headers = ['Nome Farmaco', 'Dosaggio', 'Orario / Frequenza', 'Istruzioni', 'Attivo', 'Note'];
  const sampleRows = [
    ['Metformina', '500 mg', 'Colazione, Cena', 'A stomaco pieno', 'Sì', 'Terapia diabete'],
    ['Ramipril', '5 mg', 'Mattina', 'Appena sveglio', 'Sì', 'Pressione arteriosa'],
    ['Cardioaspirina', '100 mg', 'Pranzo', 'Dopo pranzo', 'Sì', 'Cardioprotezione']
  ];

  const csvContent = [
    headers.join(';'),
    ...sampleRows.map(r => r.map(c => `"${c}"`).join(';'))
  ].join('\r\n');

  triggerCsvDownload(csvContent, 'Template_Farmaci.csv');
};

export const parseMedicationsJSON = (jsonStr: string): { items: MedicationItem[]; count: number } => {
  try {
    const parsed = JSON.parse(jsonStr);
    const rawList: any[] = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed.medications) ? parsed.medications : []);

    const items: MedicationItem[] = [];
    rawList.forEach((raw, idx) => {
      if (raw && typeof raw === 'object' && (raw.name || raw.nome || raw.farmaco)) {
        items.push({
          id: raw.id || `med_imported_${Date.now()}_${idx}`,
          name: String(raw.name || raw.nome || raw.farmaco || '').trim(),
          dosage: String(raw.dosage || raw.dosaggio || raw.dose || '').trim(),
          schedule: String(raw.schedule || raw.orario || raw.frequenza || '').trim(),
          instructions: String(raw.instructions || raw.istruzioni || raw.posologia || '').trim(),
          active: raw.active !== false && raw.attivo !== false && raw.attivo !== 'No',
          notes: String(raw.notes || raw.note || '').trim()
        });
      }
    });

    return { items, count: items.length };
  } catch (e) {
    console.error('Error parsing medications JSON:', e);
    return { items: [], count: 0 };
  }
};

export const parseMedicationsCSV = (csvStr: string): { items: MedicationItem[]; count: number } => {
  try {
    const lines = csvStr
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return { items: [], count: 0 };

    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let insideQuote = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (insideQuote && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            insideQuote = !insideQuote;
          }
        } else if (char === separator && !insideQuote) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headerCols = parseCsvLine(lines[0]).map(c => c.toLowerCase().replace(/["']/g, '').trim());
    const nameIdx = headerCols.findIndex(c => c.includes('nome') || c.includes('farmaco') || c.includes('name') || c.includes('medication'));
    const dosageIdx = headerCols.findIndex(c => c.includes('dosaggio') || c.includes('dose') || c.includes('dosage'));
    const schedIdx = headerCols.findIndex(c => c.includes('orario') || c.includes('frequenza') || c.includes('schedule') || c.includes('tempo'));
    const instrIdx = headerCols.findIndex(c => c.includes('istruzion') || c.includes('posologia') || c.includes('instruction'));
    const activeIdx = headerCols.findIndex(c => c.includes('attiv') || c.includes('active') || c.includes('abilitato'));
    const notesIdx = headerCols.findIndex(c => c.includes('note') || c.includes('comment'));

    const items: MedicationItem[] = [];
    const startIndex = (nameIdx !== -1) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length === 0) continue;

      const rawName = (nameIdx !== -1 ? cols[nameIdx] : cols[0]) || '';
      const cleanName = rawName.replace(/^["']|["']$/g, '').trim();
      if (!cleanName) continue;

      const rawDosage = (dosageIdx !== -1 ? cols[dosageIdx] : (cols[1] || '')) || '';
      const rawSchedule = (schedIdx !== -1 ? cols[schedIdx] : (cols[2] || '')) || '';
      const rawInstr = (instrIdx !== -1 ? cols[instrIdx] : (cols[3] || '')) || '';
      const rawActive = (activeIdx !== -1 ? cols[activeIdx] : (cols[4] || '')) || '';
      const rawNotes = (notesIdx !== -1 ? cols[notesIdx] : (cols[5] || '')) || '';

      const isActive = !rawActive || ['sì', 'si', 'yes', 'true', '1', 'attivo'].includes(rawActive.toLowerCase().trim());

      items.push({
        id: `med_imported_${Date.now()}_${i}`,
        name: cleanName,
        dosage: rawDosage.replace(/^["']|["']$/g, '').trim(),
        schedule: rawSchedule.replace(/^["']|["']$/g, '').trim(),
        instructions: rawInstr.replace(/^["']|["']$/g, '').trim(),
        active: isActive,
        notes: rawNotes.replace(/^["']|["']$/g, '').trim()
      });
    }

    return { items, count: items.length };
  } catch (e) {
    console.error('Error parsing medications CSV:', e);
    return { items: [], count: 0 };
  }
};




