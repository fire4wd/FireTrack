import React, { useState, useEffect } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { EventNoteIcon, defaultEventNotes } from './EventNoteIcon';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import {
  Info,
  ArrowLeft,
  ArrowRight,
  Check,
  Tag,
  FileSpreadsheet,
  Download,
  Calendar,
  Edit2,
  Save,
  AlertTriangle,
  Upload,
  Trash2,
  Clock,
  Moon,
  Sun,
  Palette,
  Bell,
  BellRing,
  BellOff,
  Volume2,
  VolumeX,
  Send,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  RotateCcw,
  Sliders,
  Layers,
  Settings,
  Plus,
  ChevronRight,
  Flame,
  Activity,
  Heart,
  Scale,
  Utensils,
  Timer,
  Pill,
  Cloud
} from 'lucide-react';
import {
  MealSlotConfig,
  UserSettings,
  ReminderNotificationSettings,
  HealthCategory,
  HealthSubType,
  MedicationItem
} from '../../types/ontrack';
import { TimePickerModal } from './TimePickerModal';
import {
  loadEntries,
  loadMealSlots,
  saveMealSlots,
  loadEventNotes,
  saveEventNotes,
  loadUserSettings,
  saveUserSettings,
  loadMedications,
  saveMedications,
  defaultMealSlots,
  defaultUserSettings,
  defaultReminderSettings
} from '../../utils/ontrackStorage';
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerPushNotification,
  playReminderChime,
  isNotificationSupported,
  NotificationPermissionStatus
} from '../../utils/notifications';
import { clearSqliteCacheAndReload } from '../../utils/sqliteDb';

export type SettingsTab = 'user' | 'categories_types' | 'system' | 'medications';

const getSlotEmoji = (slot: MealSlotConfig): string => {
  if (slot.emoji) return slot.emoji;
  const name = (slot.name || '').toLowerCase();
  const id = (slot.id || '').toLowerCase();
  if (id.includes('night') || name.includes('nott') || name.includes('digiun')) return '🌙';
  if (id.includes('bf') || name.includes('colazion')) return '🌅';
  if (id.includes('lunch') || name.includes('pranz')) return '☀️';
  if (id.includes('dinner') || name.includes('cena')) return '🍽️';
  if (id.includes('bed') || name.includes('coricar') || name.includes('dorm')) return '🛏️';
  return '⏰';
};

interface SystemSettingsScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  eventNotesList?: typeof defaultEventNotes;
  onUpdateEventNotesList?: (newList: typeof defaultEventNotes) => void;
  mealSlots?: MealSlotConfig[];
  onUpdateMealSlots?: (newSlots: MealSlotConfig[]) => void;
  onOpenCsvImport?: () => void;
  onClearAllEntries?: () => void;
  onClearAllBloodRecords?: () => void;
  userSettings?: UserSettings;
  onUpdateUserSettings?: (settings: UserSettings) => void;
  categories?: HealthCategory[];
  onUpdateCategories?: (updated: HealthCategory[]) => void;
  onEditCategory?: (cat: HealthCategory | null) => void;
  subTypes?: HealthSubType[];
  onUpdateSubTypes?: (updated: HealthSubType[]) => void;
  entriesCount?: number;
  bloodRecordsCount?: number;
}

export const SystemSettingsScreen: React.FC<SystemSettingsScreenProps> = ({
  onBack,
  onNavigate,
  eventNotesList,
  onUpdateEventNotesList,
  mealSlots,
  onUpdateMealSlots,
  onOpenCsvImport,
  onClearAllEntries,
  onClearAllBloodRecords,
  userSettings: initialUserSettings,
  onUpdateUserSettings,
  categories = [],
  onUpdateCategories,
  onEditCategory,
  subTypes = [],
  onUpdateSubTypes,
  entriesCount = 0,
  bloodRecordsCount = 0
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('user');

  // Local state initialized from storage or props
  const [localEventNotes, setLocalEventNotes] = useState(() => eventNotesList || loadEventNotes());
  const [localMealSlots, setLocalMealSlots] = useState<MealSlotConfig[]>(() => mealSlots || loadMealSlots());
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // User Settings State
  const [userSettings, setUserSettingsState] = useState<UserSettings>(() => initialUserSettings || loadUserSettings());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>(() => getNotificationPermission());
  const [testNotificationFeedback, setTestNotificationFeedback] = useState<string | null>(null);

  // Categories & Subtypes Management State inside Tab
  const [subTypeSubTab, setSubTypeSubTab] = useState<'categories' | 'subtypes'>('categories');
  const [newSubTypeName, setNewSubTypeName] = useState('');
  const [newSubTypeUnit, setNewSubTypeUnit] = useState('');
  const [showAddSubTypeForm, setShowAddSubTypeForm] = useState(false);
  const [customizationFeedback, setCustomizationFeedback] = useState<string | null>(null);

  // Danger Zone Modals State
  const [confirmClearEntriesModal, setConfirmClearEntriesModal] = useState(false);
  const [confirmClearBloodModal, setConfirmClearBloodModal] = useState(false);
  const [confirmClearCacheModal, setConfirmClearCacheModal] = useState(false);

  useEffect(() => {
    if (initialUserSettings) {
      setUserSettingsState(initialUserSettings);
    }
  }, [initialUserSettings]);

  // Sync notification permission check on tab change or mount
  useEffect(() => {
    setPermissionStatus(getNotificationPermission());
  }, [activeTab]);

  const activeReminder: ReminderNotificationSettings = userSettings.reminder || defaultReminderSettings;

  const updateReminderSetting = <K extends keyof ReminderNotificationSettings>(key: K, value: ReminderNotificationSettings[K]) => {
    const current = userSettings.reminder || defaultReminderSettings;
    const updatedReminder = { ...current, [key]: value };
    const updatedSettings = { ...userSettings, reminder: updatedReminder };
    setUserSettingsState(updatedSettings);
  };

  const handleToggleReminder = async () => {
    const nextState = !activeReminder.enabled;
    if (nextState) {
      const currentPerm = getNotificationPermission();
      if (currentPerm === 'default') {
        const granted = await requestNotificationPermission();
        setPermissionStatus(getNotificationPermission());
        if (!granted) {
          setTestNotificationFeedback('⚠️ Attenzione: per ricevere gli avvisi è necessario consentire le notifiche nel browser.');
          setTimeout(() => setTestNotificationFeedback(null), 5000);
        }
      }
    }
    updateReminderSetting('enabled', nextState);
  };

  const handleRequestPermissionClick = async () => {
    const granted = await requestNotificationPermission();
    setPermissionStatus(getNotificationPermission());
    if (granted) {
      setTestNotificationFeedback('✅ Permesso notifiche concesso con successo!');
    } else {
      setTestNotificationFeedback('⚠️ Permesso notifiche non concesso. Verifica le autorizzazioni del browser.');
    }
    setTimeout(() => setTestNotificationFeedback(null), 4500);
  };

  const handleToggleDay = (dayIndex: number) => {
    const currentDays = activeReminder.daysOfWeek || [1, 2, 3, 4, 5, 6, 0];
    let newDays: number[];
    if (currentDays.includes(dayIndex)) {
      if (currentDays.length > 1) {
        newDays = currentDays.filter(d => d !== dayIndex);
      } else {
        newDays = currentDays;
      }
    } else {
      newDays = [...currentDays, dayIndex];
    }
    updateReminderSetting('daysOfWeek', newDays);
  };

  const handleSetAllDays = () => {
    updateReminderSetting('daysOfWeek', [1, 2, 3, 4, 5, 6, 0]);
  };

  const handleSetWorkdays = () => {
    updateReminderSetting('daysOfWeek', [1, 2, 3, 4, 5]); // Lun-Ven
  };

  const handleSetWeekends = () => {
    updateReminderSetting('daysOfWeek', [6, 0]); // Sab-Dom
  };

  const handleSendTestNotification = async () => {
    const perm = getNotificationPermission();
    if (perm === 'default') {
      const granted = await requestNotificationPermission();
      setPermissionStatus(getNotificationPermission());
      if (!granted) {
        setTestNotificationFeedback('⚠️ Permesso non concesso: la notifica di prova non può essere mostrata.');
        setTimeout(() => setTestNotificationFeedback(null), 4000);
        return;
      }
    } else if (perm === 'denied') {
      setTestNotificationFeedback('❌ Notifiche bloccate nelle impostazioni del browser. Sbloccale dall\'icona del lucchetto per ricevere i promemoria.');
      setTimeout(() => setTestNotificationFeedback(null), 5000);
      return;
    }

    const title = `⏰ OnTrack • Promemoria Sanitario (${userSettings.patientName || 'Angelo'})`;
    const body = activeReminder.message || 'Ricordati di registrare la glicemia e i tuoi parametri sanitari in OnTrack!';
    const sent = triggerPushNotification(title, body, activeReminder.soundEnabled);

    if (sent) {
      setTestNotificationFeedback('🔔 Notifica push di prova inviata con successo!');
    } else {
      setTestNotificationFeedback('🔔 Segnale acustico riprodotto. (Notifiche di sistema inviate)');
    }
    setTimeout(() => setTestNotificationFeedback(null), 4500);
  };

  const handlePlaySoundTest = () => {
    playReminderChime();
    setTestNotificationFeedback('🎵 Suono promemoria riprodotto in anteprima.');
    setTimeout(() => setTestNotificationFeedback(null), 3000);
  };

  // Messages / Alerts
  const [systemSaveSuccess, setSystemSaveSuccess] = useState<string | null>(null);
  const [systemSaveError, setSystemSaveError] = useState<string | null>(null);
  const [userSaveSuccess, setUserSaveSuccess] = useState<string | null>(null);

  // Medications Management State
  const [medicationsList, setMedicationsList] = useState<MedicationItem[]>(() => loadMedications());
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedSchedule, setNewMedSchedule] = useState('');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [isCustomScheduleActive, setIsCustomScheduleActive] = useState(false);
  const [customTimeSchedule, setCustomTimeSchedule] = useState('08:00');
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medFeedback, setMedFeedback] = useState<string | null>(null);

  // Time Picker Modal State for SystemSettings
  const [timePickerModal, setTimePickerModal] = useState<{
    isOpen: boolean;
    value: string;
    onSelect: (time: string) => void;
    title?: string;
  }>({
    isOpen: false,
    value: '08:00',
    onSelect: () => {},
    title: 'Seleziona Orario'
  });

  const handleToggleScheduleSlot = (slotLabel: string) => {
    let currentSlots = newMedSchedule
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s !== 'Al bisogno');

    if (slotLabel === 'Al bisogno') {
      setNewMedSchedule('Al bisogno');
      return;
    }

    if (currentSlots.includes(slotLabel)) {
      currentSlots = currentSlots.filter(s => s !== slotLabel);
    } else {
      currentSlots.push(slotLabel);
    }

    setNewMedSchedule(currentSlots.join(', '));
  };

  const handleAddCustomTimeSchedule = (timeStr: string) => {
    const formatted = `Ore ${timeStr}`;
    let currentSlots = newMedSchedule
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s !== 'Al bisogno');

    if (!currentSlots.includes(formatted)) {
      currentSlots.push(formatted);
    }
    setNewMedSchedule(currentSlots.join(', '));
  };

  const handleAddOrUpdateMedication = () => {
    if (!newMedName.trim()) return;
    if (editingMedId) {
      const updated = medicationsList.map(m => m.id === editingMedId ? {
        ...m,
        name: newMedName.trim(),
        dosage: newMedDosage.trim(),
        schedule: newMedSchedule.trim(),
        instructions: newMedInstructions.trim(),
      } : m);
      setMedicationsList(updated);
      saveMedications(updated);
      setEditingMedId(null);
      setMedFeedback('Farmaco aggiornato con successo.');
    } else {
      const newMed: MedicationItem = {
        id: 'med_' + Date.now(),
        name: newMedName.trim(),
        dosage: newMedDosage.trim() || '1 cpr',
        schedule: newMedSchedule.trim() || 'Al bisogno',
        instructions: newMedInstructions.trim(),
        active: true,
      };
      const updated = [...medicationsList, newMed];
      setMedicationsList(updated);
      saveMedications(updated);
      setMedFeedback('Nuovo farmaco aggiunto con successo.');
    }
    setNewMedName('');
    setNewMedDosage('');
    setNewMedSchedule('');
    setNewMedInstructions('');
    setTimeout(() => setMedFeedback(null), 3500);
  };

  const handleToggleMedActive = (id: string) => {
    const updated = medicationsList.map(m => m.id === id ? { ...m, active: !m.active } : m);
    setMedicationsList(updated);
    saveMedications(updated);
  };

  const handleDeleteMedication = (id: string) => {
    const updated = medicationsList.filter(m => m.id !== id);
    setMedicationsList(updated);
    saveMedications(updated);
    setMedFeedback('Farmaco rimosso.');
    setTimeout(() => setMedFeedback(null), 3000);
  };

  const handleStartEditMed = (med: MedicationItem) => {
    setEditingMedId(med.id);
    setNewMedName(med.name);
    setNewMedDosage(med.dosage);
    setNewMedSchedule(med.schedule || '');
    setNewMedInstructions(med.instructions || '');
  };

  const handleMoveNote = (fromIdx: number, direction: 'left' | 'right') => {
    const toIdx = direction === 'left' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= localEventNotes.length) return;

    const updated = [...localEventNotes];
    const temp = updated[fromIdx];
    updated[fromIdx] = updated[toIdx];
    updated[toIdx] = temp;

    setLocalEventNotes(updated);
    setSelectedNoteIndex(toIdx);
  };

  const handleUpdateNoteLabel = (id: string, newLabel: string) => {
    const updated = localEventNotes.map(n => n.id === id ? { ...n, label: newLabel } : n);
    setLocalEventNotes(updated);
  };

  const handleMealSlotNameChange = (id: string, newName: string) => {
    const updated = localMealSlots.map(s => s.id === id ? { ...s, name: newName } : s);
    setLocalMealSlots(updated);
  };

  const handleMealSlotTimeChange = (id: string, field: 'startTime' | 'endTime', value: string) => {
    const updated = localMealSlots.map(s => s.id === id ? { ...s, [field]: value } : s);
    setLocalMealSlots(updated);
    setSystemSaveError(null);
  };

  // Helper function to convert time string HH:MM or H:MM into minutes from 00:00
  const parseTimeToMinutes = (timeStr: string, isEnd = false): number => {
    if (!timeStr) return 0;
    const clean = timeStr.trim();
    const parts = clean.split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    let mins = h * 60 + m;
    if (isEnd && (clean === '24:00' || clean === '23:59' || clean === '0:00' || clean === '00:00' || mins === 0 || mins >= 1439)) {
      mins = 1440; // midnight / end of day boundary
    }
    return mins;
  };

  // Helper to generate SVG sector path on a 24-hour clock dial (00:00 at top)
  const getSectorPath = (startTimeStr: string, endTimeStr: string, rIn = 58, rOut = 98, cx = 160, cy = 160) => {
    const sMin = parseTimeToMinutes(startTimeStr, false);
    const eMin = parseTimeToMinutes(endTimeStr, true);

    let spanMin = eMin - sMin;
    if (spanMin <= 0) spanMin += 1440;

    // 00:00 is at top (-90 degrees)
    const startDeg = -90 + (sMin / 1440) * 360;
    const endDeg = startDeg + (spanMin / 1440) * 360;

    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;

    const largeArc = spanMin > 720 ? 1 : 0;

    const x1_out = cx + rOut * Math.cos(startRad);
    const y1_out = cy + rOut * Math.sin(startRad);
    const x2_out = cx + rOut * Math.cos(endRad);
    const y2_out = cy + rOut * Math.sin(endRad);

    const x1_in = cx + rIn * Math.cos(startRad);
    const y1_in = cy + rIn * Math.sin(startRad);
    const x2_in = cx + rIn * Math.cos(endRad);
    const y2_in = cy + rIn * Math.sin(endRad);

    return `M ${x1_out.toFixed(2)} ${y1_out.toFixed(2)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2_out.toFixed(2)} ${y2_out.toFixed(2)} L ${x2_in.toFixed(2)} ${y2_in.toFixed(2)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x1_in.toFixed(2)} ${y1_in.toFixed(2)} Z`;
  };

  // Validate meal slots overlap
  const validateMealSlots = (slots: MealSlotConfig[]): { valid: boolean; error?: string } => {
    const intervals: { name: string; start: number; end: number }[] = [];

    for (const slot of slots) {
      if (!slot.startTime || !slot.endTime) {
        return { valid: false, error: `Inserire orario di inizio e fine per "${slot.name}".` };
      }

      const start = parseTimeToMinutes(slot.startTime, false);
      const end = parseTimeToMinutes(slot.endTime, true);

      if (isNaN(start) || isNaN(end)) {
        return { valid: false, error: `Formato orario non valido per "${slot.name}". Usa il formato HH:MM (es. 11:30).` };
      }

      if (end <= start && end !== 1440) {
        // Notturno a cavallo di mezzanotte
        intervals.push({ name: `${slot.name} (notturno p.1)`, start, end: 1440 });
        intervals.push({ name: `${slot.name} (notturno p.2)`, start: 0, end });
      } else {
        intervals.push({ name: slot.name, start, end });
      }
    }

    // Check every pair for overlaps
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i];
        const b = intervals[j];
        const overlapStart = Math.max(a.start, b.start);
        const overlapEnd = Math.min(a.end, b.end);

        if (overlapStart < overlapEnd) {
          return {
            valid: false,
            error: `Sovrapposizione oraria rilevata tra "${a.name}" e "${b.name}". Correggi gli orari prima di salvare.`
          };
        }
      }
    }

    return { valid: true };
  };

  // Reset Meal Slots to Default Button
  const handleResetMealSlotsToDefault = () => {
    setLocalMealSlots(defaultMealSlots);
    setSelectedSlotId(null);
    setHoveredSlotId(null);
    setSystemSaveSuccess('Orari ripristinati ai valori di default (00:00-05:00, 05:00-11:00, 11:00-14:30, 17:00-20:00, 22:00-23:59). Clicca su "Salva Impostazioni di Sistema" per confermare.');
    setTimeout(() => setSystemSaveSuccess(null), 5000);
  };

  // Save System Settings Button
  const handleSaveSystemSettings = () => {
    setSystemSaveError(null);
    setSystemSaveSuccess(null);

    // Check overlap
    const validation = validateMealSlots(localMealSlots);
    if (!validation.valid) {
      setSystemSaveError(validation.error || 'Errore nella configurazione degli orari.');
      return;
    }

    // Save to localStorage
    saveMealSlots(localMealSlots);
    saveEventNotes(localEventNotes);

    if (onUpdateMealSlots) onUpdateMealSlots(localMealSlots);
    if (onUpdateEventNotesList) onUpdateEventNotesList(localEventNotes);

    setSystemSaveSuccess('Impostazioni di sistema salvate con successo!');
    setTimeout(() => setSystemSaveSuccess(null), 4000);
  };

  const handleSelectTheme = (newTheme: 'dark' | 'light') => {
    const updated = { ...userSettings, theme: newTheme };
    setUserSettingsState(updated);
    saveUserSettings(updated);
    if (onUpdateUserSettings) {
      onUpdateUserSettings(updated);
    }
  };

  // Save User Settings Button
  const handleSaveUserSettings = () => {
    setUserSaveSuccess(null);
    saveUserSettings(userSettings);
    if (onUpdateUserSettings) {
      onUpdateUserSettings(userSettings);
    }
    setUserSaveSuccess('Impostazioni utente salvate con successo!');
    setTimeout(() => setUserSaveSuccess(null), 4000);
  };

  // Categories & SubTypes Handlers
  const handleDeleteCategory = (id: string) => {
    if (onUpdateCategories) {
      const updated = categories.filter(c => c.id !== id);
      onUpdateCategories(updated);
      setCustomizationFeedback('Categoria rimossa con successo.');
      setTimeout(() => setCustomizationFeedback(null), 3000);
    }
  };

  const handleAddSubType = () => {
    if (!newSubTypeName.trim()) return;
    const newSt: HealthSubType = {
      id: 'sub_' + Date.now(),
      name: newSubTypeName.trim(),
      unit: newSubTypeUnit.trim() || 'unità',
      isCustom: true
    };
    if (onUpdateSubTypes) {
      const updated = [...subTypes, newSt];
      onUpdateSubTypes(updated);
      setNewSubTypeName('');
      setNewSubTypeUnit('');
      setShowAddSubTypeForm(false);
      setCustomizationFeedback(`Tipo di misurazione "${newSt.name}" aggiunto con successo.`);
      setTimeout(() => setCustomizationFeedback(null), 3500);
    }
  };

  const handleDeleteSubType = (id: string) => {
    if (onUpdateSubTypes) {
      const updated = subTypes.filter(s => s.id !== id);
      onUpdateSubTypes(updated);
      setCustomizationFeedback('Tipo di misurazione rimosso.');
      setTimeout(() => setCustomizationFeedback(null), 3000);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-[#f1f5f9] dark:bg-[#121418] text-stone-900 dark:text-stone-100 transition-colors">

      {/* Header Bar */}
      <OnTrackHeader
        title="Le mie impostazioni"
        showBack={true}
        onBack={onBack}
        showToolsMenu={false}
        onNavigate={onNavigate}
      />

      {/* Main Container */}
      <div className="flex-1 max-w-3xl mx-auto w-full p-3 sm:p-6 space-y-5 pb-16">

        {/* Top 4-Tab Pill Navigation */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 bg-stone-200/90 dark:bg-stone-800/90 p-1.5 rounded-2xl shadow-inner border border-stone-300/40 dark:border-stone-700/50">

          <button
            type="button"
            onClick={() => setActiveTab('user')}
            className={`py-2 px-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'user'
                ? 'bg-[#3b7080] text-white shadow-md'
                : 'bg-white/80 dark:bg-stone-700/60 text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Profilo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories_types')}
            className={`py-2 px-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'categories_types'
                ? 'bg-[#3b7080] text-white shadow-md'
                : 'bg-white/80 dark:bg-stone-700/60 text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Categoria e tipi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`py-2 px-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'system'
                ? 'bg-[#3b7080] text-white shadow-md'
                : 'bg-white/80 dark:bg-stone-700/60 text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Fasce e note</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('medications')}
            className={`py-2 px-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'medications'
                ? 'bg-[#3b7080] text-white shadow-md'
                : 'bg-white/80 dark:bg-stone-700/60 text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-700'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Farmaci</span>
          </button>

        </div>

        {/* ========================================================================= */}
        {/* TAB 1: IMPOSTAZIONI UTENTE & PROMEMORIA                                  */}
        {/* ========================================================================= */}
        {activeTab === 'user' && (
          <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-5 sm:p-6 space-y-6">

            <div className="border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Profilo Utente, Aspetto & Target
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Configura i tuoi dati anagrafici, tema visivo, unità glicemica e limiti di riferimento clinici.
                </p>
              </div>
            </div>

            {userSaveSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 p-3.5 rounded-2xl text-xs font-bold flex items-center space-x-2.5 shadow-sm animate-fadeIn">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{userSaveSuccess}</span>
              </div>
            )}

            {/* SEZIONE TEMA (SCURO DEFAULT / CHIARO) */}
            <div className="bg-stone-50 dark:bg-[#222730] border border-stone-200 dark:border-stone-700/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Palette className="w-4 h-4 text-[#3b7080] dark:text-[#58a1b5]" />
                <label className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Tema dell'Applicazione
                </label>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Scegli la modalità visiva preferita. Il tema scuro è attivo di default per ridurre l'affaticamento visivo.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Opzione Tema Scuro (Default) */}
                <button
                  type="button"
                  onClick={() => handleSelectTheme('dark')}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all cursor-pointer ${
                    userSettings.theme !== 'light'
                      ? 'border-[#3b7080] dark:border-[#58a1b5] bg-[#3b7080]/10 dark:bg-[#3b7080]/20 text-[#244f5c] dark:text-[#78c9df] shadow-xs'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1d24] text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <Moon className="w-4 h-4 text-[#3b7080] dark:text-[#78c9df]" />
                    <span className="font-bold text-xs sm:text-sm">Tema Scuro</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                    Predefinito
                  </span>
                </button>

                {/* Opzione Tema Chiaro */}
                <button
                  type="button"
                  onClick={() => handleSelectTheme('light')}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all cursor-pointer ${
                    userSettings.theme === 'light'
                      ? 'border-[#3b7080] bg-[#3b7080]/10 text-[#244f5c] shadow-xs'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1d24] text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-xs sm:text-sm">Tema Chiaro</span>
                  </div>
                  <span className="text-[10px] text-stone-400">
                    Classico
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Nome Utente</label>
                <input
                  type="text"
                  value={userSettings.patientName}
                  onChange={(e) => setUserSettingsState({ ...userSettings, patientName: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 dark:bg-[#222730] border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-100 font-medium focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Data di Nascita</label>
                <input
                  type="date"
                  value={userSettings.birthDate}
                  onChange={(e) => setUserSettingsState({ ...userSettings, birthDate: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 dark:bg-[#222730] border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-100 font-medium focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">Unità di Misura Glicemia</label>
                <select
                  value={userSettings.unit}
                  onChange={(e) => setUserSettingsState({ ...userSettings, unit: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 dark:bg-[#222730] border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-100 font-medium focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
                >
                  <option value="mg/dL">mg/dL (Standard)</option>
                  <option value="mmol/L">mmol/L</option>
                </select>
              </div>

              {/* Target Intervalli Glicemici */}
              <div className="bg-stone-50 dark:bg-[#222730] border border-stone-200 dark:border-stone-700/80 rounded-2xl p-4 space-y-4">
                <h4 className="font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Obiettivi Glicemici Clinici (Target Ranges)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Pre Pasto */}
                  <div className="space-y-2 bg-white dark:bg-[#1a1d24] p-3 rounded-xl border border-stone-200 dark:border-stone-700">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <WholeAppleIcon size={16} />
                      <span>Pre Pasto (A Digiuno)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-500 block">Minimo (mg/dL)</label>
                        <input
                          type="number"
                          value={userSettings.targetPreMin}
                          onChange={(e) => setUserSettingsState({ ...userSettings, targetPreMin: Number(e.target.value) })}
                          className="w-full p-2 border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 rounded font-mono font-bold text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block">Massimo (mg/dL)</label>
                        <input
                          type="number"
                          value={userSettings.targetPreMax}
                          onChange={(e) => setUserSettingsState({ ...userSettings, targetPreMax: Number(e.target.value) })}
                          className="w-full p-2 border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 rounded font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Post Pasto */}
                  <div className="space-y-2 bg-white dark:bg-[#1a1d24] p-3 rounded-xl border border-stone-200 dark:border-stone-700">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <AppleCoreIcon size={16} />
                      <span>Post Pasto (2h dopo)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-500 block">Minimo (mg/dL)</label>
                        <input
                          type="number"
                          value={userSettings.targetPostMin}
                          onChange={(e) => setUserSettingsState({ ...userSettings, targetPostMin: Number(e.target.value) })}
                          className="w-full p-2 border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 rounded font-mono font-bold text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block">Massimo (mg/dL)</label>
                        <input
                          type="number"
                          value={userSettings.targetPostMax}
                          onChange={(e) => setUserSettingsState({ ...userSettings, targetPostMax: Number(e.target.value) })}
                          className="w-full p-2 border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 rounded font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEZIONE PROMEMORIA & NOTIFICHE PUSH */}
              <div className="bg-stone-50 dark:bg-[#222730] border border-stone-200 dark:border-stone-700/80 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-[#3b7080] dark:text-[#58a1b5]" />
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                      Promemoria Giornaliero & Notifiche
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleReminder}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      activeReminder.enabled
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {activeReminder.enabled ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    <span>{activeReminder.enabled ? 'Attivo' : 'Disattivato'}</span>
                  </button>
                </div>

                {testNotificationFeedback && (
                  <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-700 rounded-xl text-xs font-semibold text-teal-900 dark:text-teal-200">
                    {testNotificationFeedback}
                  </div>
                )}

                {activeReminder.enabled && (
                  <div className="space-y-4 pt-2 border-t border-stone-200 dark:border-stone-700/60">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                          Orario Notifica
                        </label>
                        <input
                          type="time"
                          value={activeReminder.time || '20:00'}
                          onChange={(e) => updateReminderSetting('time', e.target.value)}
                          className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                          Suono & Chime
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => updateReminderSetting('soundEnabled', !activeReminder.soundEnabled)}
                            className={`flex-1 p-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                              activeReminder.soundEnabled
                                ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-400 text-teal-800 dark:text-teal-200'
                                : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-500'
                            }`}
                          >
                            {activeReminder.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                            <span>{activeReminder.soundEnabled ? 'Suono Attivo' : 'Muto'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handlePlaySoundTest}
                            className="p-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 rounded-lg text-xs font-bold text-stone-700 dark:text-stone-200 cursor-pointer"
                            title="Ascolta suono"
                          >
                            Prova 🎵
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Test Notifica Button */}
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSendTestNotification}
                        className="px-3.5 py-2 bg-[#3b7080] hover:bg-[#2e5865] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Invia Notifica Push di Prova</span>
                      </button>

                      {permissionStatus !== 'granted' && (
                        <button
                          type="button"
                          onClick={handleRequestPermissionClick}
                          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                        >
                          Richiedi Permesso Browser
                        </button>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* SEZIONE NEXTCLOUD WEBDAV */}
              <div className="bg-stone-50 dark:bg-[#222730] border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                      Parametri Server Nextcloud (WebDAV)
                    </h4>
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('backup')}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      Vai a Backup →
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
                      Indirizzo Server Nextcloud
                    </label>
                    <input
                      type="text"
                      value={userSettings.nextcloud?.serverUrl || 'https://nc.fire4wd.uk'}
                      onChange={(e) => setUserSettingsState({
                        ...userSettings,
                        nextcloud: {
                          serverUrl: e.target.value,
                          username: userSettings.nextcloud?.username || 'admin',
                          folder: userSettings.nextcloud?.folder || 'FireTrack',
                          autoSyncOnBackup: userSettings.nextcloud?.autoSyncOnBackup || false
                        }
                      })}
                      className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
                      Nome Utente
                    </label>
                    <input
                      type="text"
                      value={userSettings.nextcloud?.username || 'admin'}
                      onChange={(e) => setUserSettingsState({
                        ...userSettings,
                        nextcloud: {
                          serverUrl: userSettings.nextcloud?.serverUrl || 'https://nc.fire4wd.uk',
                          username: e.target.value,
                          folder: userSettings.nextcloud?.folder || 'FireTrack',
                          autoSyncOnBackup: userSettings.nextcloud?.autoSyncOnBackup || false
                        }
                      })}
                      className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
                      Cartella Remota
                    </label>
                    <input
                      type="text"
                      value={userSettings.nextcloud?.folder || 'FireTrack'}
                      onChange={(e) => setUserSettingsState({
                        ...userSettings,
                        nextcloud: {
                          serverUrl: userSettings.nextcloud?.serverUrl || 'https://nc.fire4wd.uk',
                          username: userSettings.nextcloud?.username || 'admin',
                          folder: e.target.value,
                          autoSyncOnBackup: userSettings.nextcloud?.autoSyncOnBackup || false
                        }
                      })}
                      className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400">
                  Nota: la password viene richiesta di volta in volta nella schermata Backup & Ripristino per garantire la massima sicurezza.
                </p>
              </div>

            </div>

            {/* SAVE BUTTON */}
            <button
              type="button"
              onClick={handleSaveUserSettings}
              className="w-full py-3.5 bg-[#3b7080] hover:bg-[#2e5865] text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salva Impostazioni Utente</span>
            </button>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PERSONALIZZA CATEGORIE & TIPI (INTEGRATED SUB-VIEW)               */}
        {/* ========================================================================= */}
        {activeTab === 'categories_types' && (
          <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-5 sm:p-6 space-y-6">

            <div className="border-b border-stone-100 dark:border-stone-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-[#3b7080] dark:text-[#58a1b5]" />
                  <span>Personalizzazione Categorie & Tipi Misurazione</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Gestisci le categorie per i momenti della giornata e i sottotipi di misurazione sanitaria (Glicemia, Peso, Digiuno, ecc.).
                </p>
              </div>

              {/* Sub-Switch Pills */}
              <div className="flex items-center space-x-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSubTypeSubTab('categories')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    subTypeSubTab === 'categories'
                      ? 'bg-[#3b7080] text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  Categorie Pasti ({categories.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTypeSubTab('subtypes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    subTypeSubTab === 'subtypes'
                      ? 'bg-[#3b7080] text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  Tipi Misurazione ({subTypes.length})
                </button>
              </div>
            </div>

            {customizationFeedback && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 text-emerald-900 dark:text-emerald-200 p-3 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{customizationFeedback}</span>
              </div>
            )}

            {/* SEZIONE 1: CATEGORIE PASTI */}
            {subTypeSubTab === 'categories' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-medium">Elenco categorie attive per la catalogazione dei dati:</span>
                  {onEditCategory && (
                    <button
                      type="button"
                      onClick={() => onEditCategory(null)}
                      className="px-3 py-1.5 bg-[#3b7080] hover:bg-[#2e5865] text-white font-bold rounded-xl flex items-center space-x-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nuova Categoria</span>
                    </button>
                  )}
                </div>

                <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-bold flex items-center justify-center">
                          {cat.order || '•'}
                        </span>
                        <div>
                          <strong className="text-sm font-bold text-stone-800 dark:text-stone-100 block">
                            {cat.name}
                          </strong>
                          {cat.startTimeEnabled && (
                            <span className="text-[11px] text-stone-400 font-mono">
                              Finestra: {cat.startTime || '00:00'} - {cat.endTime || '23:59'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {onEditCategory && (
                          <button
                            type="button"
                            onClick={() => onEditCategory(cat)}
                            className="p-1.5 text-stone-400 hover:text-[#3b7080] dark:hover:text-[#58a1b5] rounded-lg transition-colors cursor-pointer"
                            title="Modifica Categoria"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {!cat.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                            title="Elimina Categoria"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEZIONE 2: TIPI DI MISURAZIONE (SUBTYPES) */}
            {subTypeSubTab === 'subtypes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-medium">Tipi di misurazione registrabili nel diario:</span>
                  <button
                    type="button"
                    onClick={() => setShowAddSubTypeForm(!showAddSubTypeForm)}
                    className="px-3 py-1.5 bg-[#3b7080] hover:bg-[#2e5865] text-white font-bold rounded-xl flex items-center space-x-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi Tipo Personalizzato</span>
                  </button>
                </div>

                {showAddSubTypeForm && (
                  <div className="p-4 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 rounded-2xl space-y-3 animate-fadeIn">
                    <h4 className="font-bold text-xs text-teal-900 dark:text-teal-200">
                      Nuovo Tipo di Misurazione
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
                          Nome Misurazione
                        </label>
                        <input
                          type="text"
                          placeholder="es. Digiuno Intermittente, Saturazione O2"
                          value={newSubTypeName}
                          onChange={(e) => setNewSubTypeName(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
                          Unità di Misura
                        </label>
                        <input
                          type="text"
                          placeholder="es. ore, %, bpm, ml"
                          value={newSubTypeUnit}
                          onChange={(e) => setNewSubTypeUnit(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddSubTypeForm(false)}
                        className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-400 font-semibold cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={handleAddSubType}
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                      >
                        Salva Tipo
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                  {subTypes.map((st) => {
                    // Choose icon by type name
                    let TypeIcon = Tag;
                    if (st.name.toLowerCase().includes('glicem')) TypeIcon = Activity;
                    else if (st.name.toLowerCase().includes('pression') || st.name.toLowerCase().includes('battit')) TypeIcon = Heart;
                    else if (st.name.toLowerCase().includes('peso')) TypeIcon = Scale;
                    else if (st.name.toLowerCase().includes('cibo') || st.name.toLowerCase().includes('carboidrat')) TypeIcon = Utensils;
                    else if (st.name.toLowerCase().includes('digiun')) TypeIcon = Timer;

                    return (
                      <div
                        key={st.id}
                        className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300">
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <strong className="text-sm font-bold text-stone-800 dark:text-stone-100 block">
                              {st.name}
                            </strong>
                            <span className="text-[11px] text-stone-400 font-mono">
                              Unità predefinita: <strong>{st.unit}</strong>
                            </span>
                          </div>
                        </div>

                        <div>
                          {st.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSubType(st.id)}
                              className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                              title="Elimina Tipo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: FASCE PASTI & NOTE EVENTO (SYSTEM SETTINGS)                       */}
        {/* ========================================================================= */}
        {activeTab === 'system' && (
          <div className="space-y-6">

            {/* Feedback Messages */}
            {systemSaveSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 text-emerald-900 dark:text-emerald-200 p-3.5 rounded-2xl text-xs font-bold flex items-center space-x-2.5 shadow-sm animate-fadeIn">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{systemSaveSuccess}</span>
              </div>
            )}

            {systemSaveError && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-400 text-red-900 dark:text-red-200 p-3.5 rounded-2xl text-xs font-bold flex items-center space-x-2.5 shadow-sm animate-fadeIn">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <span>{systemSaveError}</span>
              </div>
            )}

            {/* CARD 1: FASCE ORARIE & OROLOGIO 24 ORE */}
            <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 sm:p-6 space-y-6">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                      Fasce Orarie Pasti (Quadrante 24 Ore)
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Ripartizione delle 24 ore nelle fasce orarie per diario, report e statistiche.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetMealSlotsToDefault}
                  className="px-3 py-1.5 text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-teal-600 bg-stone-100 dark:bg-stone-800 rounded-xl transition-all self-start sm:self-auto cursor-pointer"
                >
                  Ripristina Orari Standard
                </button>
              </div>

              {/* Layout 24h Clock SVG + Editor Table Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">

                {/* SVG 24H Clock Dial Visualizer (Left Column) */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-3 sm:p-4 bg-[#12141a] rounded-3xl border border-[#222632] shadow-inner">
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                    <svg viewBox="0 0 320 320" className="w-full h-full select-none">
                      {/* Outer border circle */}
                      <circle cx="160" cy="160" r="112" fill="none" stroke="#252a38" strokeWidth="1" />

                      {/* 24 Hour Ticks */}
                      {Array.from({ length: 24 }).map((_, h) => {
                        const angle = -90 + (h / 24) * 360;
                        const rad = (angle * Math.PI) / 180;
                        const isMajor = h % 3 === 0;
                        const rOuter = 112;
                        const rInner = isMajor ? 98 : 105;
                        const x1 = 160 + rOuter * Math.cos(rad);
                        const y1 = 160 + rOuter * Math.sin(rad);
                        const x2 = 160 + rInner * Math.cos(rad);
                        const y2 = 160 + rInner * Math.sin(rad);
                        return (
                          <line
                            key={`tick-${h}`}
                            x1={x1.toFixed(2)}
                            y1={y1.toFixed(2)}
                            x2={x2.toFixed(2)}
                            y2={y2.toFixed(2)}
                            stroke={isMajor ? '#94a3b8' : '#475569'}
                            strokeWidth={isMajor ? '1.5' : '1'}
                            strokeLinecap="round"
                          />
                        );
                      })}

                      {/* Unallocated Dark Background Track Donut */}
                      <path
                        d="M 160 62 A 98 98 0 1 1 159.99 62 L 159.99 102 A 58 58 0 1 0 160 102 Z"
                        fill="#25262c"
                        stroke="#1a1c22"
                        strokeWidth="1.5"
                      />

                      {/* Render Colored Sectors */}
                      {localMealSlots.map((slot) => {
                        const isHovered = hoveredSlotId === slot.id || selectedSlotId === slot.id;
                        return (
                          <path
                            key={slot.id}
                            d={getSectorPath(slot.startTime, slot.endTime, 58, 98, 160, 160)}
                            fill={slot.color}
                            fillOpacity={isHovered ? 1 : 0.95}
                            stroke="#12141a"
                            strokeWidth={isHovered ? '2.5' : '1.5'}
                            className="cursor-pointer transition-all hover:brightness-115"
                            onMouseEnter={() => setHoveredSlotId(slot.id)}
                            onMouseLeave={() => setHoveredSlotId(null)}
                            onClick={() => setSelectedSlotId(selectedSlotId === slot.id ? null : slot.id)}
                          />
                        );
                      })}

                      {/* Center Circle */}
                      <circle cx="160" cy="160" r="54" fill="#12141a" stroke="#2a303e" strokeWidth="2" />
                      <text x="160" y="155" textAnchor="middle" fill="#f8fafc" fontFamily="monospace" fontSize="13" fontWeight="bold" letterSpacing="0.5">
                        24 Ore
                      </text>
                      <text x="160" y="171" textAnchor="middle" fill="#8e99a8" fontFamily="monospace" fontSize="9">
                        Orari Pasti
                      </text>

                      {/* 8 Perimeter Badge Boxes */}
                      {/* 00:00 (Notte) */}
                      <g>
                        <line x1="160" y1="32" x2="160" y2="48" stroke="#cbd5e1" strokeWidth="1.5" />
                        <rect x="114" y="10" width="92" height="22" rx="4" fill="#181a22" stroke="#373d4d" strokeWidth="1" />
                        <text x="160" y="25" textAnchor="middle" fill="#d1d5db" fontFamily="monospace" fontSize="8.5" fontWeight="bold">00:00 (Notte)</text>
                      </g>

                      {/* 03:00 */}
                      <g>
                        <line x1="240" y1="84" x2="228" y2="92" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="240" y="70" width="48" height="20" rx="4" fill="#181a22" stroke="#373d4d" strokeWidth="1" />
                        <text x="264" y="84" textAnchor="middle" fill="#d1d5db" fontFamily="monospace" fontSize="8" fontWeight="bold">03:00</text>
                      </g>

                      {/* 06:00 */}
                      <g>
                        <line x1="250" y1="160" x2="236" y2="160" stroke="#cbd5e1" strokeWidth="1.5" />
                        <rect x="250" y="149" width="48" height="22" rx="4" fill="#181a22" stroke="#373d4d" strokeWidth="1" />
                        <text x="274" y="164" textAnchor="middle" fill="#d1d5db" fontFamily="monospace" fontSize="8.5" fontWeight="bold">06:00</text>
                      </g>

                      {/* 09:00 */}
                      <g>
                        <line x1="240" y1="236" x2="228" y2="228" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="240" y="230" width="48" height="20" rx="4" fill="#181a22" stroke="#373d4d" strokeWidth="1" />
                        <text x="264" y="244" textAnchor="middle" fill="#d1d5db" fontFamily="monospace" fontSize="8" fontWeight="bold">09:00</text>
                      </g>

                      {/* 12:00 (Pranzo) */}
                      <g>
                        <line x1="160" y1="288" x2="160" y2="272" stroke="#cbd5e1" strokeWidth="1.5" />
                        <rect x="108" y="288" width="104" height="22" rx="4" fill="#181a22" stroke="#373d4d" strokeWidth="1" />
                        <text x="160" y="303" textAnchor="middle" fill="#d1d5db" fontFamily="monospace" fontSize="8.5" fontWeight="bold">12:00 (Pranzo)</text>
                      </g>

                      {/* 15:00 */}
                      <g>
                        <line x1="80" y1="236" x2="92" y2="228" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="32" y="230" width="48" height="20" rx="4" fill="#181a22" stroke="#373d4d" strokeWidth="1" />
                        <text x="56" y="244" textAnchor="middle" fill="#d1d5db" fontFamily="monospace" fontSize="8" fontWeight="bold">15:00</text>
                      </g>

                      {/* 18:00 (Cena) */}
                      <g>
                        <line x1="104" y1="160" x2="120" y2="160" stroke="#cbd5e1" strokeWidth="1.5" />
                        <rect x="22" y="149" width="82" height="22" rx="4" fill="#181a22" stroke="#373d4d" strokeWidth="1" />
                        <text x="63" y="164" textAnchor="middle" fill="#d1d5db" fontFamily="monospace" fontSize="8.5" fontWeight="bold">18:00 (Cena)</text>
                      </g>

                      {/* 21:00 */}
                      <g>
                        <line x1="80" y1="84" x2="92" y2="92" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="32" y="70" width="48" height="20" rx="4" fill="#181a22" stroke="#373d4d" strokeWidth="1" />
                        <text x="56" y="84" textAnchor="middle" fill="#d1d5db" fontFamily="monospace" fontSize="8.5" fontWeight="bold">21:00</text>
                      </g>
                    </svg>
                  </div>
                  <span className="text-[11px] text-stone-400 text-center mt-1">
                    Passa sopra una fascia o un orario per evidenziare il quadrante
                  </span>
                </div>

                {/* Fasce Pasti Table Form (Right Column) */}
                <div className="md:col-span-7 space-y-2.5">
                  {localMealSlots.map((slot) => {
                    const isSelected = selectedSlotId === slot.id || hoveredSlotId === slot.id;
                    const emoji = getSlotEmoji(slot);
                    return (
                      <div
                        key={slot.id}
                        onMouseEnter={() => setHoveredSlotId(slot.id)}
                        onMouseLeave={() => setHoveredSlotId(null)}
                        className={`p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-400 dark:border-teal-700 shadow-xs'
                            : 'bg-stone-50 dark:bg-[#222730] border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: slot.color }}
                          />
                          <span className="text-sm select-none">{emoji}</span>
                          <input
                            type="text"
                            value={slot.name}
                            onChange={(e) => handleMealSlotNameChange(slot.id, e.target.value)}
                            className="flex-1 font-bold text-xs bg-transparent border-b border-transparent hover:border-stone-300 focus:border-teal-500 focus:outline-none text-stone-800 dark:text-stone-100"
                          />
                          <div className="flex items-center space-x-1.5 font-mono text-xs">
                            <input
                              type="text"
                              value={slot.startTime}
                              onChange={(e) => handleMealSlotTimeChange(slot.id, 'startTime', e.target.value)}
                              className="w-14 px-1.5 py-1 text-center bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded text-xs font-bold text-stone-800 dark:text-stone-100"
                            />
                            <span className="text-stone-400">-</span>
                            <input
                              type="text"
                              value={slot.endTime}
                              onChange={(e) => handleMealSlotTimeChange(slot.id, 'endTime', e.target.value)}
                              className="w-14 px-1.5 py-1 text-center bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded text-xs font-bold text-stone-800 dark:text-stone-100"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

            </div>

            {/* CARD 2: NOTE EVENTO & REORDER */}
            <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 sm:p-6 space-y-4">
              <div className="flex items-center space-x-2.5 border-b border-stone-100 dark:border-stone-800 pb-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                    Note Evento (Icone e Ordinamento)
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Modifica le etichette delle note evento ed il loro ordine di visualizzazione.
                  </p>
                </div>
              </div>

              {/* Note Evento List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {localEventNotes.map((note, idx) => (
                  <div
                    key={note.id}
                    className="p-3 bg-stone-50 dark:bg-[#222730] border border-stone-200 dark:border-stone-700 rounded-xl flex items-center justify-between space-x-3"
                  >
                    <div className="flex items-center space-x-2.5 flex-1">
                      <EventNoteIcon id={note.id} size="sm" />
                      <input
                        type="text"
                        value={note.label}
                        onChange={(e) => handleUpdateNoteLabel(note.id, e.target.value)}
                        className="flex-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded px-2 py-1 text-xs font-bold text-stone-800 dark:text-stone-100"
                      />
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveNote(idx, 'left')}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === localEventNotes.length - 1}
                        onClick={() => handleMoveNote(idx, 'right')}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SAVE SYSTEM SETTINGS BUTTON */}
            <button
              type="button"
              onClick={handleSaveSystemSettings}
              className="w-full py-3.5 bg-[#3b7080] hover:bg-[#2e5865] text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salva Impostazioni Fasce & Note</span>
            </button>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: GESTIONE FARMACI                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'medications' && (
          <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-5 sm:p-6 space-y-6">

            <div className="border-b border-stone-100 dark:border-stone-800 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                  <Pill className="w-5 h-5 text-[#3b7080]" />
                  <span>Gestione Farmaci e Terapie</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Aggiungi, modifica o disattiva i farmaci e le posologie da utilizzare durante la registrazione nel diario.
                </p>
              </div>
            </div>

            {medFeedback && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{medFeedback}</span>
              </div>
            )}

            {/* Add / Edit Medication Form */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60 space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-stone-700 dark:text-stone-300">
                {editingMedId ? 'Modifica Farmaco' : 'Aggiungi Nuovo Farmaco'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">Nome Farmaco</label>
                  <input
                    type="text"
                    value={newMedName}
                    onChange={(e) => setNewMedName(e.target.value)}
                    placeholder="Es. Metformina, Cardioaspirina..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#3b7080]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">Dosaggio</label>
                  <input
                    type="text"
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    placeholder="Es. 500 mg, 1 cpr..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#3b7080]"
                  />
                </div>
                {/* Orario / Frequenza basato sulle fasce presenti + personalizzato */}
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400">
                      Orario / Frequenza di Assunzione
                    </label>
                    <span className="text-[10px] text-stone-400">Seleziona tra le fasce presenti o personalizza</span>
                  </div>

                  {/* Fasce presenti in app */}
                  <div className="space-y-1.5 bg-white dark:bg-stone-900 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                      Fasce Giornaliere Registrate:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(categories && categories.length > 0 ? categories : localMealSlots).map((cat) => {
                        const isSelected = newMedSchedule.includes(cat.name);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleToggleScheduleSlot(cat.name)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                              isSelected
                                ? 'bg-[#3b7080] text-white shadow-xs'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700'
                            }`}
                          >
                            <span>{cat.name}</span>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        );
                      })}

                      {/* Common Quick Chips */}
                      {['Mattina', 'Sera', 'Al bisogno'].map((quick) => {
                        const isSelected = newMedSchedule.includes(quick);
                        return (
                          <button
                            key={quick}
                            type="button"
                            onClick={() => handleToggleScheduleSlot(quick)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                              isSelected
                                ? 'bg-[#3b7080] text-white shadow-xs'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700'
                            }`}
                          >
                            <span>{quick}</span>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        );
                      })}

                      {/* Personalizzato Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setTimePickerModal({
                            isOpen: true,
                            value: '08:00',
                            title: 'Seleziona Orario Personalizzato',
                            onSelect: (selectedTime) => {
                              handleAddCustomTimeSchedule(selectedTime);
                            }
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>+ Orario Personalizzato </span>
                      </button>
                    </div>

                    {/* Resulting Schedule display and manual edit field */}
                    <div className="pt-2 flex items-center space-x-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={newMedSchedule}
                          onChange={(e) => setNewMedSchedule(e.target.value)}
                          placeholder="Es. Colazione, Pranzo oppure Ore 08:00..."
                          className="w-full px-3 py-2 text-xs rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#3b7080]"
                        />
                      </div>
                      {newMedSchedule && (
                        <button
                          type="button"
                          onClick={() => setNewMedSchedule('')}
                          className="text-[11px] font-bold text-stone-400 hover:text-stone-600 px-2 py-1"
                          title="Svuota selezione"
                        >
                          Azzera
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">Istruzioni (Opzionale)</label>
                  <input
                    type="text"
                    value={newMedInstructions}
                    onChange={(e) => setNewMedInstructions(e.target.value)}
                    placeholder="Es. Durante i pasti, A stomaco pieno, Con acqua..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#3b7080]"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddOrUpdateMedication}
                  className="px-4 py-2.5 bg-[#3b7080] hover:bg-[#2e5865] text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingMedId ? 'Aggiorna Farmaco' : 'Salva Nuovo Farmaco'}</span>
                </button>
                {editingMedId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMedId(null);
                      setNewMedName('');
                      setNewMedDosage('');
                      setNewMedSchedule('');
                      setNewMedInstructions('');
                    }}
                    className="px-4 py-2.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Annulla
                  </button>
                )}
              </div>
            </div>

            {/* List of Medications */}
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Farmaci Registrati ({medicationsList.length})
              </h4>

              {medicationsList.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  Nessun farmaco registrato. Aggiungine uno qui sopra.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {medicationsList.map((med) => (
                    <div
                      key={med.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        med.active !== false
                          ? 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700'
                          : 'bg-stone-100/50 dark:bg-stone-900/30 border-stone-200/60 dark:border-stone-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className={`p-2.5 rounded-xl ${med.active !== false ? 'bg-[#3b7080]/10 text-[#3b7080]' : 'bg-stone-300 dark:bg-stone-700 text-stone-500'}`}>
                          <Pill className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <strong className="text-sm font-bold text-stone-900 dark:text-stone-100">
                              {med.name}
                            </strong>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#3b7080]/10 text-[#3b7080] dark:bg-[#3b7080]/20 dark:text-[#5aa1b5]">
                              {med.dosage}
                            </span>
                            {med.active === false && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-200 dark:bg-stone-800 text-stone-500">
                                Disattivato
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                            {med.schedule && <span>⏰ {med.schedule}</span>}
                            {med.instructions && <span className="ml-2">ℹ️ {med.instructions}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleMedActive(med.id)}
                          title={med.active !== false ? 'Disattiva' : 'Attiva'}
                          className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            med.active !== false
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-400'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400'
                          }`}
                        >
                          {med.active !== false ? 'Disattiva' : 'Attiva'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditMed(med)}
                          className="p-2 rounded-xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-700 dark:text-stone-200 cursor-pointer transition-all"
                          title="Modifica"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMedication(med.id)}
                          className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-200 cursor-pointer transition-all"
                          title="Elimina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Time Picker Modal */}
        <TimePickerModal
          isOpen={timePickerModal.isOpen}
          value={timePickerModal.value}
          title={timePickerModal.title}
          onClose={() => setTimePickerModal(prev => ({ ...prev, isOpen: false }))}
          onChange={(newTime) => {
            timePickerModal.onSelect(newTime);
          }}
        />

      </div>

    </div>
  );
};
