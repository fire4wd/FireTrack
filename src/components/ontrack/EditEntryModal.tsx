import React, { useState, useEffect } from 'react';
import { HealthCategory, HealthSubType, LogEntryItem } from '../../types/ontrack';
import { EventNoteIcon, defaultEventNotes } from './EventNoteIcon';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { CategoryModal } from './CategoryModal';
import { NumericKeypadModal } from './NumericKeypadModal';
import { TimePickerModal } from './TimePickerModal';
import { 
  FASTING_PROTOCOLS, 
  FASTING_PLANS,
  getFastingStageByHours, 
  parseProtocolTargetHours, 
  findNearbyGlucoseForFasting, 
  formatDateToISO, 
  formatDateToItalian,
  parseEntryDateTime,
  calculateFastingEndDateTime,
  getLocalDateString,
  getLocalTimeString
} from '../../utils/fastingHelpers';
import { 
  loadActiveFasting, 
  saveActiveFasting, 
  addSavedFastingRecord, 
  loadEntries
} from '../../utils/ontrackStorage';
import { findCategoryForTime } from '../../utils/timeCategoryMatcher';
import { 
  X, 
  Calendar, 
  Clock, 
  Trash2, 
  Check, 
  Tag, 
  Activity, 
  Edit3, 
  Calculator, 
  Heart, 
  Scale, 
  Timer, 
  Pill, 
  Bell, 
  CheckCircle2, 
  Flame
} from 'lucide-react';

interface EditEntryModalProps {
  isOpen: boolean;
  entry: LogEntryItem | null;
  categories: HealthCategory[];
  subTypes: HealthSubType[];
  onClose: () => void;
  onSave: (updatedEntry: LogEntryItem) => void;
  onDelete?: (id: string) => void;
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  isOpen,
  entry,
  categories,
  subTypes,
  onClose,
  onSave,
  onDelete
}) => {
  const [subTypeId, setSubTypeId] = useState('');
  const [subTypeName, setSubTypeName] = useState('');
  const [unit, setUnit] = useState('');
  const [value, setValue] = useState('');
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [pulse, setPulse] = useState('75');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [speed, setSpeed] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [mealTiming, setMealTiming] = useState<'pre' | 'post' | undefined>(undefined);
  const [eventNoteIcon, setEventNoteIcon] = useState<string | undefined>(undefined);
  const [reminder, setReminder] = useState(false);
  const [note, setNote] = useState('');

  // Fasting Specific State
  const [fastingMode, setFastingMode] = useState<'active' | 'completed'>('active');
  const [fastingStartDate, setFastingStartDate] = useState('');
  const [fastingStartTime, setFastingStartTime] = useState('20:00');
  const [fastingEndDate, setFastingEndDate] = useState('');
  const [fastingEndTime, setFastingEndTime] = useState('12:00');
  const [fastingProtocol, setFastingProtocol] = useState('16:8');
  const [fastingTargetHours, setFastingTargetHours] = useState(16);
  const [fastingStartGlucose, setFastingStartGlucose] = useState('');
  const [fastingEndGlucose, setFastingEndGlucose] = useState('');
  const [fastingIsInProgress, setFastingIsInProgress] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<'time' | 'fastingStartTime' | 'fastingEndTime' | null>(null);
  const [isEventIconPickerOpen, setIsEventIconPickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const availableTags = ['#Terapia', '#Pasti', '#Attività', '#Sintomi', '#Umore', '#Controllo', '#Digiuno'];

  // Numeric Keypad State
  const [activeKeypad, setActiveKeypad] = useState<{
    field: 'value' | 'systolic' | 'diastolic' | 'pulse' | 'distance' | 'duration';
    label: string;
    subLabel?: string;
    unit: string;
    allowDecimal: boolean;
    quickIncrements?: number[];
    quickPresets?: number[];
  } | null>(null);

  const handleKeypadChange = (newVal: string) => {
    if (!activeKeypad) return;
    if (activeKeypad.field === 'value') setValue(newVal);
    else if (activeKeypad.field === 'systolic') setSystolic(newVal);
    else if (activeKeypad.field === 'diastolic') setDiastolic(newVal);
    else if (activeKeypad.field === 'pulse') setPulse(newVal);
    else if (activeKeypad.field === 'distance') {
      setDistance(newVal);
      calculateExerciseSpeed(newVal, duration);
    } else if (activeKeypad.field === 'duration') {
      setDuration(newVal);
      calculateExerciseSpeed(distance, newVal);
    }
  };

  const calculateExerciseSpeed = (distVal: string, durVal: string) => {
    const d = parseFloat(distVal.replace(',', '.') || '0');
    const t = parseFloat(durVal.replace(',', '.') || '0');
    if (d > 0 && t > 0) {
      const calculatedSpeed = ((d / t) * 60).toFixed(1);
      setSpeed(calculatedSpeed.replace('.', ','));
    } else {
      setSpeed('');
    }
  };

  const handleKeypadNext = () => {
    if (!activeKeypad) return;
    if (activeKeypad.field === 'systolic') {
      setActiveKeypad({
        field: 'diastolic',
        label: 'Pressione Diastolica (Min)',
        unit: 'mmHg',
        allowDecimal: false,
        quickIncrements: [-10, -1, 1, 10],
        quickPresets: [70, 75, 80, 85, 90]
      });
    } else if (activeKeypad.field === 'diastolic') {
      setActiveKeypad({
        field: 'pulse',
        label: 'Pulsazioni / Battiti',
        unit: 'bpm',
        allowDecimal: false,
        quickIncrements: [-10, -1, 1, 10],
        quickPresets: [60, 65, 70, 75, 80, 85]
      });
    } else if (activeKeypad.field === 'distance') {
      setActiveKeypad({
        field: 'duration',
        label: 'Durata Esercizio',
        unit: 'min',
        allowDecimal: false,
        quickIncrements: [-10, -5, 5, 10],
        quickPresets: [15, 20, 30, 45, 60]
      });
    } else {
      setActiveKeypad(null);
    }
  };

  const getActiveKeypadValue = () => {
    if (!activeKeypad) return '';
    if (activeKeypad.field === 'value') return value;
    if (activeKeypad.field === 'systolic') return systolic;
    if (activeKeypad.field === 'diastolic') return diastolic;
    if (activeKeypad.field === 'pulse') return pulse;
    if (activeKeypad.field === 'distance') return distance;
    if (activeKeypad.field === 'duration') return duration;
    return '';
  };

  // Helper date generators
  const getISODateToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getISODateYesterday = () => {
    const d = new Date(Date.now() - 86400000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getCurrentTimeStr = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  };

  // Sync state when entry changes
  useEffect(() => {
    if (entry) {
      setSubTypeId(entry.subTypeId || 'sub_glucose');
      setSubTypeName(entry.subTypeName || 'Glucose');
      setUnit(entry.unit || 'mg/dL');
      setValue(entry.value || '');
      setSystolic(entry.systolic || (entry.value.includes('/') ? entry.value.split('/')[0] : '120'));
      setDiastolic(entry.diastolic || (entry.value.includes('/') ? entry.value.split('/')[1] : '80'));
      setPulse(entry.pulse || '75');
      setDistance(entry.distance || '');
      setDuration(entry.duration || '');
      setSpeed(entry.speed || '');
      setDate(entry.date || '');
      setTime(entry.time || '12:00');
      setCategoryId(entry.categoryId || (categories[0]?.id || 'cat_1'));
      setCategoryName(entry.categoryName || (categories[0]?.name || 'Colazione'));
      setMealTiming(entry.mealTiming);
      setEventNoteIcon(entry.eventNoteIcon);
      setReminder(!!entry.reminder);
      setNote(entry.note || '');
      setShowDeleteConfirm(false);

      // Check if entry is fasting
      const entryIsFasting = (entry.subTypeName || '').toLowerCase().includes('digiun') ||
                             (entry.subTypeName || '').toLowerCase().includes('fasting') ||
                             (entry.subTypeId || '').includes('fasting');

      if (entryIsFasting) {
        const activeFast = loadActiveFasting();
        const isInProgress = entry.fastingIsInProgress ?? (entry.value || '').toLowerCase().includes('in corso');
        const mode = isInProgress ? 'active' : 'completed';
        setFastingMode(mode);
        setFastingIsInProgress(isInProgress);

        let proto = entry.fastingProtocol;
        if (!proto) {
          if (entry.value.includes('14:10')) proto = '14:10';
          else if (entry.value.includes('16:8')) proto = '16:8';
          else if (entry.value.includes('18:6')) proto = '18:6';
          else if (entry.value.includes('20:4')) proto = '20:4';
          else if (entry.value.includes('OMAD')) proto = 'OMAD (23:1)';
          else if (entry.value.includes('24h') || entry.value.includes('24')) proto = '24h';
          else if (entry.value.includes('36h') || entry.value.includes('36')) proto = '36h';
          else proto = '16:8';
        }
        const targetH = entry.fastingTargetHours || parseProtocolTargetHours(proto);
        setFastingProtocol(proto);
        setFastingTargetHours(targetH);

        // Start Date/Time
        let sDate = entry.fastingStartDate || '';
        let sTime = entry.fastingStartTime || '';

        if (isInProgress && activeFast.isActive && activeFast.startTime) {
          sDate = getLocalDateString(activeFast.startTime);
          sTime = getLocalTimeString(activeFast.startTime);
        } else {
          if (!sDate && entry.date) {
            sDate = formatDateToISO(entry.date);
          }
          if (!sTime) {
            sTime = entry.time || '20:00';
          }
        }
        if (!sDate) {
          sDate = getISODateYesterday();
        }
        if (!sTime) {
          sTime = '20:00';
        }
        setFastingStartDate(sDate);
        setFastingStartTime(sTime);

        // End Date/Time (Calculate automatically if not set or provided)
        const calcEnd = calculateFastingEndDateTime(sDate, sTime, targetH);
        let eDate = entry.fastingEndDate || (isInProgress ? calcEnd.endDate : (entry.date ? formatDateToISO(entry.date) : calcEnd.endDate));
        let eTime = entry.fastingEndTime || (isInProgress ? calcEnd.endTime : (entry.time || calcEnd.endTime));
        setFastingEndDate(eDate);
        setFastingEndTime(eTime);

        // Glucose values
        setFastingStartGlucose(
          entry.fastingStartGlucose !== undefined
            ? String(entry.fastingStartGlucose)
            : (activeFast.startingGlucose !== undefined ? String(activeFast.startingGlucose) : '')
        );
        setFastingEndGlucose(entry.fastingEndGlucose !== undefined ? String(entry.fastingEndGlucose) : '');
      }
    }
  }, [entry, categories]);

  // Handle speed calculation for exercise
  useEffect(() => {
    const d = parseFloat((distance || '0').replace(',', '.'));
    const t = parseFloat((duration || '0').replace(',', '.'));
    if (d > 0 && t > 0) {
      const calculatedSpeed = ((d / t) * 60).toFixed(1);
      setSpeed(calculatedSpeed.replace('.', ','));
    } else {
      setSpeed('');
    }
  }, [distance, duration]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !entry) return null;

  const isBP = subTypeName.toLowerCase().includes('blood pressure') ||
               subTypeName.toLowerCase().includes('pressione') ||
               subTypeName.toLowerCase().includes('pulsazion') ||
               subTypeName.toLowerCase().includes('battiti') ||
               subTypeId.includes('bp') ||
               subTypeId.includes('pulse');

  const isExercise = subTypeName.toLowerCase().includes('exercise') ||
                     subTypeName.toLowerCase().includes('esercizio') ||
                     subTypeName.toLowerCase().includes('camminata');

  const isFasting = subTypeName.toLowerCase().includes('digiun') ||
                    subTypeName.toLowerCase().includes('fasting') ||
                    subTypeId.includes('fasting');

  const isMedication = subTypeName.toLowerCase().includes('farmac') ||
                       subTypeName.toLowerCase().includes('medication') ||
                       subTypeName.toLowerCase().includes('medic') ||
                       subTypeId.includes('med');

  const isWeight = subTypeName.toLowerCase().includes('peso') ||
                   subTypeName.toLowerCase().includes('weight') ||
                   subTypeId.includes('weight');

  // Fasting calculations
  const allSavedEntries = loadEntries();
  const fastingStartDateTime = parseEntryDateTime(fastingStartDate || getISODateYesterday(), fastingStartTime || '20:00');
  const fastingEndDateTime = (fastingIsInProgress || fastingMode === 'active')
    ? new Date()
    : parseEntryDateTime(fastingEndDate || getISODateToday(), fastingEndTime || getCurrentTimeStr());

  const fastingElapsedHours = (fastingStartDateTime && fastingEndDateTime)
    ? Math.max(0, (fastingEndDateTime.getTime() - fastingStartDateTime.getTime()) / (1000 * 60 * 60))
    : 0;

  const tHours = fastingTargetHours || parseProtocolTargetHours(fastingProtocol);
  const fastingTargetPct = Math.min(100, Math.max(0, Math.round((fastingElapsedHours / tHours) * 100)));
  const fastingIsTargetReached = fastingElapsedHours >= tHours;
  const fastingStage = getFastingStageByHours(fastingElapsedHours);

  // Nearby glucose lookup for fasting start
  const nearbyGlucose = findNearbyGlucoseForFasting(
    allSavedEntries,
    fastingStartDate || getISODateYesterday(),
    fastingStartTime || '20:00',
    3
  );

  const updateFastingEndDateTime = (startDate: string, startTime: string, targetHours: number) => {
    const sDate = formatDateToISO(startDate);
    const calc = calculateFastingEndDateTime(sDate, startTime, targetHours);
    setFastingEndDate(calc.endDate);
    setFastingEndTime(calc.endTime);
  };

  const handleFastingDateOrTimeChange = (newStartDate?: string, newStartTime?: string) => {
    const sDate = newStartDate !== undefined ? formatDateToISO(newStartDate) : formatDateToISO(fastingStartDate || getISODateYesterday());
    const sTime = newStartTime !== undefined ? newStartTime : (fastingStartTime || '20:00');
    if (newStartDate !== undefined) setFastingStartDate(sDate);
    if (newStartTime !== undefined) setFastingStartTime(sTime);

    // Auto calculate and update end date and time
    const targetH = fastingTargetHours || parseProtocolTargetHours(fastingProtocol || '16:8');
    updateFastingEndDateTime(sDate, sTime, targetH);

    // Auto lookup nearby glucose if field is empty
    const nearby = findNearbyGlucoseForFasting(allSavedEntries, sDate, sTime, 3);
    if (!fastingStartGlucose && nearby) {
      setFastingStartGlucose(String(nearby.value));
    }
  };

  const handleFastingPlanChange = (newProtocol: string, newTargetHours?: number) => {
    const targetH = newTargetHours !== undefined ? newTargetHours : parseProtocolTargetHours(newProtocol);
    setFastingProtocol(newProtocol);
    setFastingTargetHours(targetH);

    const sDate = formatDateToISO(fastingStartDate || getISODateYesterday());
    const sTime = fastingStartTime || '20:00';
    updateFastingEndDateTime(sDate, sTime, targetH);
  };

  const handleTargetHoursChange = (newHours: number) => {
    const validHours = Math.max(1, Math.min(168, newHours || 16));
    setFastingTargetHours(validHours);
    const sDate = formatDateToISO(fastingStartDate || getISODateYesterday());
    const sTime = fastingStartTime || '20:00';
    updateFastingEndDateTime(sDate, sTime, validHours);
  };

  const handleSubTypeChange = (newSubTypeId: string) => {
    const found = subTypes.find(st => st.id === newSubTypeId);
    if (found) {
      setSubTypeId(found.id);
      setSubTypeName(found.name);
      setUnit(found.unit);
    }
  };

  const handleAddTag = (tag: string) => {
    if (!note.includes(tag)) {
      setNote(prev => prev ? `${prev} ${tag}` : tag);
    }
  };

  const handleSave = () => {
    let finalValue = value;
    let finalDate = date;
    let finalTime = time;

    if (isFasting) {
      const proto = fastingProtocol || '16:8';
      const targetH = fastingTargetHours || parseProtocolTargetHours(proto);
      const startISO = `${fastingStartDate || getISODateYesterday()}T${fastingStartTime || '20:00'}:00`;
      const startGluc = fastingStartGlucose ? parseFloat(fastingStartGlucose.replace(',', '.')) : undefined;
      const endGluc = fastingEndGlucose ? parseFloat(fastingEndGlucose.replace(',', '.')) : undefined;

      if (fastingMode === 'active' || fastingIsInProgress) {
        // In Progress Active Fast
        saveActiveFasting({
          isActive: true,
          startTime: startISO,
          protocol: proto,
          targetHours: targetH,
          startingGlucose: startGluc,
          note: note
        });
        finalValue = `In corso (${proto})`;

        const dObj = new Date(startISO);
        if (!isNaN(dObj.getTime())) {
          const day = String(dObj.getDate()).padStart(2, '0');
          const month = String(dObj.getMonth() + 1).padStart(2, '0');
          const year = String(dObj.getFullYear()).slice(-2);
          finalDate = `${day}/${month}/${year}`;
          finalTime = `${String(dObj.getHours()).padStart(2, '0')}:${String(dObj.getMinutes()).padStart(2, '0')}`;
        }
      } else {
        // Completed Fast
        const endISO = `${fastingEndDate || getISODateToday()}T${fastingEndTime || getCurrentTimeStr()}:00`;
        const durHours = Math.max(0.1, (new Date(endISO).getTime() - new Date(startISO).getTime()) / 3600000);

        addSavedFastingRecord({
          id: 'fast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          startDate: fastingStartDate || getISODateYesterday(),
          startTime: fastingStartTime || '20:00',
          endDate: fastingEndDate || getISODateToday(),
          endTime: fastingEndTime || getCurrentTimeStr(),
          protocol: proto,
          targetHours: targetH,
          durationHours: parseFloat(durHours.toFixed(2)),
          startingGlucose: startGluc,
          endingGlucose: endGluc,
          note: note,
          isCompleted: true
        });

        // Mark any current active fast as completed/inactive
        const currentActive = loadActiveFasting();
        if (currentActive.isActive) {
          saveActiveFasting({ ...currentActive, isActive: false });
        }

        finalValue = `${durHours.toFixed(1)} ore`;
        const endObj = new Date(endISO);
        if (!isNaN(endObj.getTime())) {
          const day = String(endObj.getDate()).padStart(2, '0');
          const month = String(endObj.getMonth() + 1).padStart(2, '0');
          const year = String(endObj.getFullYear()).slice(-2);
          finalDate = `${day}/${month}/${year}`;
          finalTime = `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`;
        }
      }
    } else if (isBP) {
      finalValue = `${systolic || '120'}/${diastolic || '80'}`;
    } else if (isExercise) {
      finalValue = distance ? `${distance} km in ${duration || '0'} min` : (duration ? `${duration} min` : (value || '0'));
    }

    const updated: LogEntryItem = {
      ...entry,
      subTypeId,
      subTypeName,
      value: finalValue,
      systolic: isBP ? systolic : undefined,
      diastolic: isBP ? diastolic : undefined,
      pulse: isBP ? pulse : undefined,
      distance: isExercise ? distance : undefined,
      duration: isExercise ? duration : undefined,
      speed: isExercise ? speed : undefined,
      unit,
      date: finalDate,
      time: finalTime,
      categoryId,
      categoryName,
      mealTiming,
      eventNoteIcon,
      reminder,
      note,
      fastingStartDate: isFasting ? (fastingStartDate || getISODateYesterday()) : undefined,
      fastingStartTime: isFasting ? (fastingStartTime || '20:00') : undefined,
      fastingEndDate: isFasting ? (fastingIsInProgress ? undefined : (fastingEndDate || getISODateToday())) : undefined,
      fastingEndTime: isFasting ? (fastingIsInProgress ? undefined : (fastingEndTime || getCurrentTimeStr())) : undefined,
      fastingProtocol: isFasting ? (fastingProtocol || '16:8') : undefined,
      fastingTargetHours: isFasting ? (fastingTargetHours || 16) : undefined,
      fastingStartGlucose: isFasting ? fastingStartGlucose : undefined,
      fastingEndGlucose: isFasting ? fastingEndGlucose : undefined,
      fastingIsInProgress: isFasting ? (fastingIsInProgress || fastingMode === 'active') : undefined,
    };

    onSave(updated);
    onClose();
  };

  const confirmDelete = () => {
    if (onDelete && entry?.id) {
      onDelete(entry.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-[#1a1d24] w-full max-w-lg rounded-2xl shadow-2xl border border-stone-300 dark:border-stone-800 overflow-hidden text-stone-900 dark:text-stone-100 animate-in fade-in zoom-in-95 my-6 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-[#1d8998] text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Modifica Lettura</h3>
              <p className="text-[11px] text-teal-100 font-mono">ID: {entry.id.slice(0, 8)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs sm:text-sm">

          {/* 1. Header: SubType Selector and Badges */}
          <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700/80 space-y-2">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-700/60 pb-2">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Tipo di Misurazione
              </span>
              {isFasting ? (
                <span className="text-[11px] font-black uppercase tracking-wider bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30 px-2.5 py-0.5 rounded-full shrink-0 flex items-center space-x-1">
                  <Timer className="w-3 h-3" />
                  <span>Digiuno</span>
                </span>
              ) : isBP ? (
                <span className="text-[11px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full shrink-0 flex items-center space-x-1">
                  <Activity className="w-3 h-3" />
                  <span>Pressione</span>
                </span>
              ) : isWeight ? (
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full shrink-0 flex items-center space-x-1">
                  <Scale className="w-3 h-3" />
                  <span>Peso</span>
                </span>
              ) : isMedication ? (
                <span className="text-[11px] font-black uppercase tracking-wider bg-[#3b7080]/15 text-[#3b7080] dark:text-[#5aa1b5] border border-[#3b7080]/30 px-2.5 py-0.5 rounded-full shrink-0 flex items-center space-x-1">
                  <Pill className="w-3 h-3" />
                  <span>Farmaci</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 px-2.5 py-0.5 rounded-lg border border-stone-200 dark:border-stone-700 font-mono">
                  {unit}
                </span>
              )}
            </div>

            <select
              value={subTypeId}
              onChange={(e) => handleSubTypeChange(e.target.value)}
              className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#1d8998] cursor-pointer"
            >
              {subTypes.map((st) => (
                <option key={st.id} value={st.id} className="bg-white dark:bg-[#1a1d24] text-stone-800 dark:text-stone-100">
                  {st.name} ({st.unit})
                </option>
              ))}
            </select>
          </div>

          {/* ========================================================================= */}
          {/* SPECIALIZED INPUT PANELS                                                  */}
          {/* ========================================================================= */}

          {isFasting ? (
            /* ========================================================================= */
            /* COMPLETE FASTING EDITOR (Mirroring Fasting Report Section & AddEntry)      */
            /* ========================================================================= */
            <div className="space-y-3">
              {/* Mode Toggle: In Corso vs Concluso */}
              <div className="bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl grid grid-cols-2 gap-1 border border-stone-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => {
                    setFastingMode('active');
                    setFastingIsInProgress(true);
                    setFastingEndDate('');
                    setFastingEndTime('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    fastingMode === 'active' || fastingIsInProgress
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-700/60'
                  }`}
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>Digiuno in corso</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFastingMode('completed');
                    setFastingIsInProgress(false);
                    setFastingEndDate(fastingEndDate || getISODateToday());
                    setFastingEndTime(fastingEndTime || getCurrentTimeStr());
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    fastingMode === 'completed' && !fastingIsInProgress
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-700/60'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sessione conclusa</span>
                </button>
              </div>

              {/* 1. Inizio Digiuno (Giorno e Ora con Calendar e Time Pick) */}
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Inizio Digiuno:</span>
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleFastingDateOrTimeChange(getISODateYesterday(), '20:00')}
                      className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 hover:underline px-2 py-0.5 bg-teal-50 dark:bg-teal-950/40 rounded border border-teal-200 dark:border-teal-800 cursor-pointer"
                    >
                      Ieri sera (20:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFastingDateOrTimeChange(getISODateToday(), getCurrentTimeStr())}
                      className="text-[10px] font-semibold text-stone-600 dark:text-stone-300 hover:underline px-2 py-0.5 bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 cursor-pointer"
                    >
                      Adesso
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Giorno Inizio</span>
                    <input
                      type="date"
                      value={formatDateToISO(fastingStartDate || getISODateYesterday())}
                      onChange={(e) => handleFastingDateOrTimeChange(e.target.value, undefined)}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">Ora Inizio</span>
                      <button
                        type="button"
                        onClick={() => setTimePickerTarget('fastingStartTime')}
                        className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-0.5 cursor-pointer"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Pick 24h</span>
                      </button>
                    </div>
                    <div className="flex items-center space-x-1">
                      <input
                        type="time"
                        step="60"
                        value={fastingStartTime || '20:00'}
                        onChange={(e) => handleFastingDateOrTimeChange(undefined, e.target.value)}
                        onFocus={(e) => (e.target as HTMLInputElement).select()}
                        className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setTimePickerTarget('fastingStartTime')}
                        className="p-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-xl cursor-pointer shrink-0"
                        title="Apri Selettore Orario 24h"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Piano & Obiettivo */}
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">
                    Scelta Rapida Piano
                  </span>
                </div>
                {/* Quick Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: '14:10', label: '14:10', hours: 14 },
                    { id: '16:8', label: '16:8', hours: 16 },
                    { id: '18:6', label: '18:6', hours: 18 },
                    { id: '20:4', label: '20:4', hours: 20 },
                    { id: 'OMAD (23:1)', label: 'OMAD (23:1)', hours: 23 },
                    { id: '24h', label: '24h', hours: 24 },
                    { id: '36h', label: '36h', hours: 36 }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleFastingPlanChange(p.id, p.hours)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        (fastingProtocol || '16:8') === p.id
                          ? 'bg-teal-600 text-white shadow-xs font-black'
                          : 'bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Tutti i Piani</span>
                    <select
                      value={fastingProtocol || '16:8'}
                      onChange={(e) => {
                        const proto = e.target.value;
                        const targetH = parseProtocolTargetHours(proto);
                        handleFastingPlanChange(proto, targetH);
                      }}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    >
                      {FASTING_PROTOCOLS.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({p.hours} ore)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Obiettivo Ore</span>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={fastingTargetHours || 16}
                      onChange={(e) => handleTargetHoursChange(parseInt(e.target.value) || 16)}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#1d8998] dark:text-[#38bdf8] focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Fine Digiuno (Giorno e Ora con Pick, oppure In Corso) */}
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Fine Digiuno:</span>
                  </label>
                  {!fastingIsInProgress && (
                    <button
                      type="button"
                      onClick={() => {
                        setFastingEndDate(getISODateToday());
                        setFastingEndTime(getCurrentTimeStr());
                      }}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer bg-white dark:bg-stone-800 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"
                    >
                      Imposta Adesso
                    </button>
                  )}
                </div>

                <label className="flex items-center space-x-2 text-xs text-stone-600 dark:text-stone-300 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={fastingIsInProgress || fastingMode === 'active'}
                    onChange={(e) => {
                      const isProg = e.target.checked;
                      setFastingIsInProgress(isProg);
                      setFastingMode(isProg ? 'active' : 'completed');
                      if (isProg) {
                        setFastingEndDate('');
                        setFastingEndTime('');
                      } else {
                        setFastingEndDate(fastingEndDate || getISODateToday());
                        setFastingEndTime(fastingEndTime || getCurrentTimeStr());
                      }
                    }}
                    className="rounded text-teal-600 focus:ring-0"
                  />
                  <span>Digiuno in corso (lascia non valorizzati giorno e ora fine)</span>
                </label>

                {!fastingIsInProgress && fastingMode === 'completed' && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Giorno Fine</span>
                      <input
                        type="date"
                        value={formatDateToISO(fastingEndDate || getISODateToday())}
                        onChange={(e) => setFastingEndDate(e.target.value)}
                        onFocus={(e) => (e.target as HTMLInputElement).select()}
                        className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">Ora Fine</span>
                        <button
                          type="button"
                          onClick={() => setTimePickerTarget('fastingEndTime')}
                          className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-0.5 cursor-pointer"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Pick 24h</span>
                        </button>
                      </div>
                      <div className="flex items-center space-x-1">
                        <input
                          type="time"
                          step="60"
                          value={fastingEndTime || getCurrentTimeStr()}
                          onChange={(e) => setFastingEndTime(e.target.value)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setTimePickerTarget('fastingEndTime')}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl cursor-pointer shrink-0"
                          title="Apri Selettore Orario 24h"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Real-Time Dynamic Duration & Biological Level Card */}
              <div className="bg-gradient-to-br from-teal-950/40 via-stone-900/60 to-stone-950/80 text-white p-3.5 rounded-2xl border border-teal-500/30 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-xs font-bold text-teal-200">
                      {fastingIsInProgress ? 'Durata Attuale Calcolata:' : 'Durata Totale Registrata:'}
                    </span>
                  </div>
                  <span className="text-base font-black font-mono text-white">
                    {fastingElapsedHours.toFixed(1).replace('.', ',')} ore
                  </span>
                </div>

                {/* Progress to Target */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-300">
                      Obiettivo: <strong>{tHours} ore</strong> ({fastingProtocol || '16:8'})
                    </span>
                    <span className={`font-bold ${fastingIsTargetReached ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {fastingIsTargetReached ? '✓ Target Raggiunto' : `${fastingTargetPct}%`}
                    </span>
                  </div>
                  <div className="w-full bg-stone-700/60 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        fastingIsTargetReached
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-amber-500 to-teal-400'
                      }`}
                      style={{ width: `${Math.min(100, fastingTargetPct)}%` }}
                    />
                  </div>
                </div>

                {/* Metabolic Level */}
                {fastingStage && (
                  <div className="pt-1 border-t border-stone-800/80 flex items-start space-x-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-black shrink-0 border"
                      style={{
                        backgroundColor: `${fastingStage.barColor}20`,
                        borderColor: `${fastingStage.barColor}60`,
                        color: fastingStage.barColor
                      }}
                    >
                      Livello {fastingStage.level}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-stone-100 truncate">{fastingStage.title}</p>
                      <p className="text-[10px] text-stone-300 leading-snug line-clamp-2">{fastingStage.description}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Glicemia Inizio & Fine */}
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">
                        Glicemia Inizio (mg/dL)
                      </span>
                      {nearbyGlucose && (
                        <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1 rounded">
                          ±3h rilevata
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={nearbyGlucose ? `Auto: ${nearbyGlucose.value}` : "Non rilevata (vuoto)"}
                      value={fastingStartGlucose || ''}
                      onChange={(e) => setFastingStartGlucose(e.target.value)}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#1d8998] dark:text-[#38bdf8] focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Glicemia Fine (mg/dL)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="es. 84"
                      value={fastingEndGlucose || ''}
                      onChange={(e) => setFastingEndGlucose(e.target.value)}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#1d8998] dark:text-[#38bdf8] focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {nearbyGlucose && (
                  <div className="flex items-center justify-between text-[11px] text-teal-700 dark:text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1.5 rounded-lg">
                    <div className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                      <span>
                        Lettura trovata entro 3h: <strong>{nearbyGlucose.value} mg/dL</strong> ({nearbyGlucose.time})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFastingStartGlucose(String(nearbyGlucose.value))}
                      className="text-[10px] font-bold underline hover:opacity-80 cursor-pointer ml-2"
                    >
                      Usa
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : isBP ? (
            /* Blood Pressure Card */
            <div className="bg-stone-50 dark:bg-stone-800/60 rounded-2xl p-4 border border-stone-200 dark:border-stone-700 space-y-3">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Valori Pressione & Pulsazioni:</span>
              </span>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold">Sistolica (Max)</span>
                    <button
                      type="button"
                      onClick={() => setActiveKeypad({
                        field: 'systolic',
                        label: 'Pressione Sistolica (Max)',
                        unit: 'mmHg',
                        allowDecimal: false,
                        quickIncrements: [-10, -1, 1, 10],
                        quickPresets: [110, 120, 130, 140, 150]
                      })}
                      className="p-0.5 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Apri tastierino"
                    >
                      <Calculator className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={systolic}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).select();
                      setActiveKeypad({
                        field: 'systolic',
                        label: 'Pressione Sistolica (Max)',
                        unit: 'mmHg',
                        allowDecimal: false,
                        quickIncrements: [-10, -1, 1, 10],
                        quickPresets: [110, 120, 130, 140, 150]
                      });
                    }}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                    onChange={(e) => setSystolic(e.target.value)}
                    className="w-full text-stone-800 dark:text-stone-100 text-base font-bold bg-transparent focus:outline-none font-mono cursor-pointer"
                  />
                  <span className="text-stone-400 text-[10px]">mmHg</span>
                </div>

                <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold">Diastolica (Min)</span>
                    <button
                      type="button"
                      onClick={() => setActiveKeypad({
                        field: 'diastolic',
                        label: 'Pressione Diastolica (Min)',
                        unit: 'mmHg',
                        allowDecimal: false,
                        quickIncrements: [-10, -1, 1, 10],
                        quickPresets: [70, 75, 80, 85, 90]
                      })}
                      className="p-0.5 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Apri tastierino"
                    >
                      <Calculator className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={diastolic}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).select();
                      setActiveKeypad({
                        field: 'diastolic',
                        label: 'Pressione Diastolica (Min)',
                        unit: 'mmHg',
                        allowDecimal: false,
                        quickIncrements: [-10, -1, 1, 10],
                        quickPresets: [70, 75, 80, 85, 90]
                      });
                    }}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                    onChange={(e) => setDiastolic(e.target.value)}
                    className="w-full text-stone-800 dark:text-stone-100 text-base font-bold bg-transparent focus:outline-none font-mono cursor-pointer"
                  />
                  <span className="text-stone-400 text-[10px]">mmHg</span>
                </div>

                <div className="bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60 shadow-2xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Battiti</span>
                    <button
                      type="button"
                      onClick={() => setActiveKeypad({
                        field: 'pulse',
                        label: 'Pulsazioni / Battiti',
                        unit: 'bpm',
                        allowDecimal: false,
                        quickIncrements: [-10, -1, 1, 10],
                        quickPresets: [60, 65, 70, 75, 80, 85]
                      })}
                      className="p-0.5 text-rose-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Apri tastierino"
                    >
                      <Calculator className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pulse}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                        setActiveKeypad({
                          field: 'pulse',
                          label: 'Pulsazioni / Battiti',
                          unit: 'bpm',
                          allowDecimal: false,
                          quickIncrements: [-10, -1, 1, 10],
                          quickPresets: [60, 65, 70, 75, 80, 85]
                        });
                      }}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(e) => setPulse(e.target.value)}
                      className="w-full text-rose-700 dark:text-rose-400 text-base font-bold bg-transparent focus:outline-none font-mono cursor-pointer"
                    />
                  </div>
                  <span className="text-rose-500 text-[11px] font-semibold flex-shrink-0">bpm</span>
                </div>
              </div>
            </div>
          ) : isExercise ? (
            /* Exercise Card */
            <div className="bg-stone-50 dark:bg-stone-800/60 rounded-2xl p-4 border border-stone-200 dark:border-stone-700 space-y-3">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Parametri Esercizio:</span>
              </span>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold">Distanza</span>
                    <button
                      type="button"
                      onClick={() => setActiveKeypad({
                        field: 'distance',
                        label: 'Distanza Percorsa',
                        unit: 'km',
                        allowDecimal: true,
                        quickIncrements: [-1, -0.5, 0.5, 1],
                        quickPresets: [1, 2, 3, 5, 10]
                      })}
                      className="p-0.5 text-stone-400 hover:text-[#1d8998] transition-colors cursor-pointer"
                      title="Apri tastierino"
                    >
                      <Calculator className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={distance}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                        setActiveKeypad({
                          field: 'distance',
                          label: 'Distanza Percorsa',
                          unit: 'km',
                          allowDecimal: true,
                          quickIncrements: [-1, -0.5, 0.5, 1],
                          quickPresets: [1, 2, 3, 5, 10]
                        });
                      }}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(e) => setDistance(e.target.value)}
                      className="w-full text-[#1d8998] dark:text-[#38bdf8] text-sm font-bold bg-transparent focus:outline-none font-mono cursor-pointer"
                    />
                    <span className="text-stone-400 text-[10px]">km</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold">Durata</span>
                    <button
                      type="button"
                      onClick={() => setActiveKeypad({
                        field: 'duration',
                        label: 'Durata Esercizio',
                        unit: 'min',
                        allowDecimal: false,
                        quickIncrements: [-10, -5, 5, 10],
                        quickPresets: [15, 20, 30, 45, 60]
                      })}
                      className="p-0.5 text-stone-400 hover:text-[#1d8998] transition-colors cursor-pointer"
                      title="Apri tastierino"
                    >
                      <Calculator className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      value={duration}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                        setActiveKeypad({
                          field: 'duration',
                          label: 'Durata Esercizio',
                          unit: 'min',
                          allowDecimal: false,
                          quickIncrements: [-10, -5, 5, 10],
                          quickPresets: [15, 20, 30, 45, 60]
                        });
                      }}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full text-[#1d8998] dark:text-[#38bdf8] text-sm font-bold bg-transparent focus:outline-none font-mono cursor-pointer"
                    />
                    <span className="text-stone-400 text-[10px]">min</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold block mb-0.5">Velocità</span>
                  <div className="text-[#1d8998] dark:text-[#38bdf8] text-sm font-bold font-mono pt-0.5">
                    {speed || '0.0'} <span className="text-stone-400 text-[10px] font-normal">km/h</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Value Card (Glucosio, Peso, ecc.) */
            <div className="bg-stone-50 dark:bg-stone-800/60 rounded-2xl p-4 border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-3 shadow-2xs">
              <div>
                <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                  Valore Misurazione:
                </label>
                <span className="text-[11px] text-stone-400">
                  {subTypeName} in {unit}
                </span>
              </div>

              <div className="flex items-center space-x-2 bg-white dark:bg-stone-900 px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 shadow-2xs">
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).select();
                    setActiveKeypad({
                      field: 'value',
                      label: subTypeName || 'Valore Misurazione',
                      unit: unit,
                      allowDecimal: true,
                      quickIncrements: [-10, -1, 1, 10],
                      quickPresets: [80, 100, 120, 140, 160]
                    });
                  }}
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0.0"
                  className="w-24 text-right text-2xl font-black text-[#1d8998] dark:text-[#38bdf8] bg-transparent focus:outline-none font-mono cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setActiveKeypad({
                    field: 'value',
                    label: subTypeName || 'Valore Misurazione',
                    unit: unit,
                    allowDecimal: true,
                    quickIncrements: [-10, -1, 1, 10],
                    quickPresets: [80, 100, 120, 140, 160]
                  })}
                  className="p-1 text-stone-400 hover:text-[#1d8998] dark:hover:text-[#38bdf8] rounded transition-colors cursor-pointer"
                  title="Apri tastierino"
                >
                  <Calculator className="w-4 h-4" />
                </button>
                <span className="text-stone-500 dark:text-stone-400 font-bold text-xs">{unit}</span>
              </div>
            </div>
          )}

          {/* 3. Date & Time Card (Only for non-fasting entries, since fasting has its own Start/End Date/Time) */}
          {!isFasting && (
            <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 dark:text-stone-300">
                <span className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Data e Ora di Registrazione</span>
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const day = String(now.getDate()).padStart(2, '0');
                      const month = String(now.getMonth() + 1).padStart(2, '0');
                      const year = String(now.getFullYear()).slice(-2);
                      setDate(`${day}/${month}/${year}`);
                    }}
                    className="text-[10px] font-semibold text-stone-700 dark:text-stone-200 hover:underline px-2 py-0.5 bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 cursor-pointer"
                  >
                    Oggi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const curr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                      const matched = findCategoryForTime(categories, curr);
                      setTime(curr);
                      setCategoryId(matched.id);
                      setCategoryName(matched.name);
                    }}
                    className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 hover:underline px-2 py-0.5 bg-teal-50 dark:bg-teal-950/40 rounded border border-teal-200 dark:border-teal-800 cursor-pointer"
                  >
                    Adesso
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Giorno</span>
                  <input
                    type="date"
                    value={formatDateToISO(date)}
                    onChange={(e) => {
                      const itDate = formatDateToItalian(e.target.value);
                      setDate(itDate);
                    }}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">Ora (Pick 24h)</span>
                    <button
                      type="button"
                      onClick={() => setTimePickerTarget('time')}
                      className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-0.5 cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Pick 24h</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1">
                    <input
                      type="time"
                      step="60"
                      value={time}
                      onChange={(e) => {
                        const newTime = e.target.value;
                        const matchedCat = findCategoryForTime(categories, newTime);
                        setTime(newTime);
                        setCategoryId(matchedCat.id);
                        setCategoryName(matchedCat.name);
                      }}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setTimePickerTarget('time')}
                      className="p-2 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-xl cursor-pointer shrink-0"
                      title="Apri Selettore Orario 24h"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Category Selector Card */}
          <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Fascia Oraria / Categoria:</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="text-[11px] text-[#1d8998] dark:text-[#38bdf8] font-bold hover:underline cursor-pointer"
              >
                Scegli da lista
              </button>
            </div>
            <select
              value={categoryId}
              onChange={(e) => {
                const found = categories.find(c => c.id === e.target.value);
                if (found) {
                  setCategoryId(found.id);
                  setCategoryName(found.name);
                }
              }}
              className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#1d8998] cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-[#1a1d24] text-stone-800 dark:text-stone-100">
                  {c.name} ({c.startTime} - {c.endTime})
                </option>
              ))}
            </select>
          </div>

          {/* 5. Pre / Post Pasto Selector Card */}
          {!isFasting && (
            <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block">
                Relazione con il pasto:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMealTiming(mealTiming === 'pre' ? undefined : 'pre')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    mealTiming === 'pre'
                      ? 'bg-amber-100/90 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/40 shadow-xs'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <WholeAppleIcon className="w-4 h-4 text-amber-900 dark:text-amber-300 shrink-0" />
                  <span>Pre pasto</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMealTiming(mealTiming === 'post' ? undefined : 'post')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    mealTiming === 'post'
                      ? 'bg-emerald-100/90 dark:bg-emerald-950/70 border-emerald-400 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-400/40 shadow-xs'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <AppleCoreIcon className="w-4 h-4 text-emerald-900 dark:text-emerald-300 shrink-0" />
                  <span>Post pasto</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMealTiming(undefined)}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    mealTiming === undefined
                      ? 'bg-stone-200 dark:bg-stone-700 border-stone-400 dark:border-stone-600 text-stone-800 dark:text-stone-100 font-bold'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <span>Nessuno</span>
                </button>
              </div>
            </div>
          )}

          {/* 6. Event Note Icon Picker Card */}
          <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300">
                Icona Evento / Contesto:
              </span>
              <button
                type="button"
                onClick={() => setIsEventIconPickerOpen(!isEventIconPickerOpen)}
                className="text-[11px] text-[#1d8998] dark:text-[#38bdf8] font-bold hover:underline cursor-pointer"
              >
                {isEventIconPickerOpen ? 'Chiudi icone' : 'Seleziona icona'}
              </button>
            </div>

            {eventNoteIcon && (
              <div className="flex items-center space-x-2 bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
                <EventNoteIcon id={eventNoteIcon} size="md" />
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  {defaultEventNotes.find(e => e.id === eventNoteIcon)?.label || 'Icona personalizzata'}
                </span>
                <button
                  type="button"
                  onClick={() => setEventNoteIcon(undefined)}
                  className="text-stone-400 hover:text-red-500 ml-auto p-1 cursor-pointer"
                  title="Rimuovi icona"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isEventIconPickerOpen && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 bg-white dark:bg-stone-900 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
                {defaultEventNotes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setEventNoteIcon(item.id);
                      setIsEventIconPickerOpen(false);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center space-y-1 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer ${
                      eventNoteIcon === item.id 
                        ? 'border-[#1d8998] bg-teal-50/70 dark:bg-teal-950/60 ring-2 ring-[#1d8998]/30' 
                        : 'border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <EventNoteIcon id={item.id} size="md" />
                    <span className="text-[9px] text-stone-600 dark:text-stone-400 text-center truncate w-full">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 7. Note & Tag Rapidi */}
          <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block">
                Note & Tag Rapidi:
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminder}
                  onChange={(e) => setReminder(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-[11px] text-stone-600 dark:text-stone-300 font-medium flex items-center space-x-1">
                  <Bell className="w-3 h-3 text-amber-500" />
                  <span>Promemoria</span>
                </span>
              </label>
            </div>

            {/* Quick Tag Chips */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-300 transition-colors cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
              placeholder="Inserisci eventuali note, dosaggi o sintomi..."
              className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl p-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#1d8998]"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-stone-100 dark:bg-stone-800/80 px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
          {onDelete ? (
            showDeleteConfirm ? (
              <div className="flex items-center space-x-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-xl animate-in fade-in">
                <span className="text-xs font-bold text-red-700 dark:text-red-300">Eliminare definitivamente?</span>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sì, elimina</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 active:bg-red-100 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-transparent hover:border-red-200 dark:hover:border-red-900"
              >
                <Trash2 className="w-4 h-4" />
                <span>Elimina Lettura</span>
              </button>
            )
          ) : <div />}

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Annulla
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-[#1d8998] hover:bg-[#17727e] text-white text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Salva Modifiche</span>
            </button>
          </div>
        </div>

      </div>

      {/* Category Modal for quick selection */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onSelectCategory={(cat) => {
          setCategoryId(cat.id);
          setCategoryName(cat.name);
          setIsCategoryModalOpen(false);
        }}
      />

      {/* Numeric Keypad Modal */}
      {activeKeypad && (
        <NumericKeypadModal
          isOpen={!!activeKeypad}
          onClose={() => setActiveKeypad(null)}
          title={activeKeypad.label}
          label={activeKeypad.label}
          subLabel={activeKeypad.subLabel}
          unit={activeKeypad.unit}
          value={getActiveKeypadValue()}
          onChange={handleKeypadChange}
          onConfirm={() => setActiveKeypad(null)}
          onNext={handleKeypadNext}
          hasNext={['systolic', 'diastolic', 'distance'].includes(activeKeypad.field)}
          allowDecimal={activeKeypad.allowDecimal}
          quickIncrements={activeKeypad.quickIncrements}
          quickPresets={activeKeypad.quickPresets}
        />
      )}

      {/* Unified Time Picker Modal */}
      <TimePickerModal
        isOpen={timePickerTarget !== null}
        onClose={() => setTimePickerTarget(null)}
        title={
          timePickerTarget === 'fastingStartTime' 
            ? 'Seleziona Ora Inizio Digiuno' 
            : timePickerTarget === 'fastingEndTime' 
            ? 'Seleziona Ora Fine Digiuno' 
            : 'Seleziona Ora Registrazione'
        }
        initialValue={
          timePickerTarget === 'fastingStartTime' 
            ? (fastingStartTime || '20:00') 
            : timePickerTarget === 'fastingEndTime' 
            ? (fastingEndTime || getCurrentTimeStr()) 
            : (time || '12:00')
        }
        onConfirm={(selectedTime) => {
          if (timePickerTarget === 'fastingStartTime') {
            handleFastingDateOrTimeChange(undefined, selectedTime);
          } else if (timePickerTarget === 'fastingEndTime') {
            setFastingEndTime(selectedTime);
          } else {
            const matchedCat = findCategoryForTime(categories, selectedTime);
            setTime(selectedTime);
            setCategoryId(matchedCat.id);
            setCategoryName(matchedCat.name);
          }
          setTimePickerTarget(null);
        }}
      />
    </div>
  );
};
