import React, { useState, useEffect } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { CategoryModal } from './CategoryModal';
import { EventNoteIcon, defaultEventNotes } from './EventNoteIcon';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { NumericKeypadModal } from './NumericKeypadModal';
import { TimePickerModal } from './TimePickerModal';
import { HealthCategory, HealthSubType, LogEntryItem, ActiveFastingSession, MedicationItem } from '../../types/ontrack';
import { findCategoryForTime } from '../../utils/timeCategoryMatcher';
import { saveActiveFasting, addSavedFastingRecord, loadActiveFasting, loadMedications } from '../../utils/ontrackStorage';
import {
  FASTING_METABOLIC_LEVELS,
  getFastingStageByHours,
  FASTING_PROTOCOLS,
  FASTING_PLANS,
  parseProtocolTargetHours,
  parsePlanTargetHours,
  formatDateToISO,
  formatDateToItalian,
  findNearbyGlucoseForFasting,
  getLocalDateString,
  getLocalTimeString
} from '../../utils/fastingHelpers';
import {
  Plus,
  Trash2,
  Pencil,
  Calendar,
  Clock,
  Activity,
  Tag,
  Calculator,
  Timer,
  Flame,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Zap,
  Info,
  Pill,
  Utensils,
  Apple
} from 'lucide-react';

interface AddEntryScreenProps {
  categories: HealthCategory[];
  subTypes: HealthSubType[];
  entries?: LogEntryItem[];
  onSaveEntries: (newEntries: LogEntryItem[]) => void;
  onBack: () => void;
  onOpenTools: () => void;
  onNavigate?: (screen: string) => void;
}

interface FormBlock {
  id: string;
  subTypeId: string;
  subTypeName: string;
  value: string;
  systolic?: string;
  diastolic?: string;
  pulse?: string;
  distance?: string;
  duration?: string;
  speed?: string;
  unit: string;
  date: string;
  time: string;
  categoryId: string;
  categoryName: string;
  reminder: boolean;
  note: string;
  mealTiming?: 'pre' | 'post';
  eventNoteIcon?: string;
  // Food / Nutrition specific fields
  calories?: string;
  gda?: string;
  fat?: string;
  protein?: string;
  carbs?: string;
  exerciseCal?: string;
  netCal?: string;
  // Fasting specific fields
  fastingMode?: 'active' | 'completed';
  fastingStartDate?: string;
  fastingStartTime?: string;
  fastingEndDate?: string;
  fastingEndTime?: string;
  fastingProtocol?: string;
  fastingTargetHours?: number;
  fastingStartGlucose?: string;
  fastingEndGlucose?: string;
  fastingIsInProgress?: boolean;
  // Medication specific fields
  medicationId?: string;
  medicationName?: string;
  medicationDosage?: string;
  isCustomMedication?: boolean;
}

export const AddEntryScreen: React.FC<AddEntryScreenProps> = ({
  categories,
  subTypes,
  entries = [],
  onSaveEntries,
  onBack,
  onOpenTools,
  onNavigate
}) => {
  const defaultSubType = subTypes[0] || { id: 'sub_glucose', name: 'Glucose', unit: 'mg/dL' };

  // Check active fasting on mount/render
  const [activeFast, setActiveFast] = useState<ActiveFastingSession>(() => loadActiveFasting());

  // Medications List from Storage
  const [medicationsList, setMedicationsList] = useState<MedicationItem[]>(() => loadMedications());

  // Time Picker Modal State
  const [timePickerTarget, setTimePickerTarget] = useState<{
    blockId: string;
    field: 'time' | 'fastingStartTime' | 'fastingEndTime';
    initialValue: string;
    title?: string;
  } | null>(null);

  useEffect(() => {
    setActiveFast(loadActiveFasting());
    setMedicationsList(loadMedications());
  }, []);

  const getTodayDateStr = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

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

  // Helper to find nearby glucose within 3 hours for fasting
  const getNearbyGlucoseForFasting = (startDate: string, startTime: string) => {
    return findNearbyGlucoseForFasting(entries, startDate, startTime, 3);
  };

  const createNewBlock = (forceSubTypeId?: string): FormBlock => {
    const currentTime = getCurrentTimeStr();
    const targetSubType = forceSubTypeId
      ? (subTypes.find(s => s.id === forceSubTypeId) || defaultSubType)
      : defaultSubType;
    const autoCategory = findCategoryForTime(categories, currentTime);

    // Check initial glucose for default fasting dates
    const initStartDate = getISODateYesterday();
    const initStartTime = '20:00';
    const nearby = getNearbyGlucoseForFasting(initStartDate, initStartTime);

    return {
      id: 'block_' + Math.random().toString(36).substring(2, 9),
      subTypeId: targetSubType.id,
      subTypeName: targetSubType.name,
      value: '',
      systolic: '120',
      diastolic: '80',
      pulse: '75',
      distance: '',
      duration: '',
      speed: '',
      unit: targetSubType.unit,
      date: getTodayDateStr(),
      time: currentTime,
      categoryId: autoCategory.id,
      categoryName: autoCategory.name,
      reminder: false,
      note: '',
      // Fasting defaults
      fastingMode: 'active',
      fastingStartDate: initStartDate,
      fastingStartTime: initStartTime,
      fastingEndDate: getISODateToday(),
      fastingEndTime: currentTime,
      fastingProtocol: '16:8',
      fastingTargetHours: 16,
      fastingStartGlucose: nearby ? String(nearby.value) : '',
      fastingEndGlucose: '',
      fastingIsInProgress: true
    };
  };

  const [blocks, setBlocks] = useState<FormBlock[]>([createNewBlock()]);
  const [activeCategoryModalBlockId, setActiveCategoryModalBlockId] = useState<string | null>(null);

  // Numeric Keypad State
  const [activeKeypad, setActiveKeypad] = useState<{
    blockId: string;
    field: 'value' | 'systolic' | 'diastolic' | 'pulse' | 'distance' | 'duration' | 'calories' | 'gda' | 'fat' | 'protein' | 'carbs' | 'exerciseCal' | 'netCal';
    label: string;
    subLabel?: string;
    unit: string;
    allowDecimal: boolean;
    quickIncrements?: number[];
    quickPresets?: number[];
  } | null>(null);

  const handleUpdateBlock = (id: string, updates: Partial<FormBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleFoodMacroChange = (
    blockId: string,
    macros: { fat?: string; protein?: string; carbs?: string; calories?: string; gda?: string; exerciseCal?: string; netCal?: string }
  ) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const f = macros.fat !== undefined ? macros.fat : (block.fat || '');
    const p = macros.protein !== undefined ? macros.protein : (block.protein || '');
    const c = macros.carbs !== undefined ? macros.carbs : (block.carbs || '');
    let cal = macros.calories !== undefined ? macros.calories : (block.calories || '');
    let gdaVal = macros.gda !== undefined ? macros.gda : (block.gda || '');
    const exer = macros.exerciseCal !== undefined ? macros.exerciseCal : (block.exerciseCal || '');
    let net = macros.netCal !== undefined ? macros.netCal : (block.netCal || '');

    const fNum = parseFloat(f.replace(',', '.')) || 0;
    const pNum = parseFloat(p.replace(',', '.')) || 0;
    const cNum = parseFloat(c.replace(',', '.')) || 0;
    const exerNum = parseFloat(exer.replace(',', '.')) || 0;

    // Auto-calculate calories if empty or macro updated
    if (macros.fat !== undefined || macros.protein !== undefined || macros.carbs !== undefined) {
      if (!cal || cal === '0' || cal === '-') {
        const calculatedKcal = Math.round((fNum * 9) + (pNum * 4) + (cNum * 4));
        if (calculatedKcal > 0) {
          cal = String(calculatedKcal);
          gdaVal = String(Math.round((calculatedKcal / 1800) * 100));
        }
      }
    }

    const calNum = parseFloat(cal.replace(',', '.')) || 0;
    if (macros.calories !== undefined && (!gdaVal || gdaVal === '0') && calNum > 0) {
      gdaVal = String(Math.round((calNum / 1800) * 100));
    }

    if (!net || net === '-' || macros.calories !== undefined || macros.exerciseCal !== undefined) {
      if (calNum > 0) {
        net = String(Math.max(0, Math.round(calNum - exerNum)));
      }
    }

    handleUpdateBlock(blockId, {
      fat: f,
      protein: p,
      carbs: c,
      calories: cal,
      gda: gdaVal,
      exerciseCal: exer,
      netCal: net,
      value: c || cal || '0'
    });
  };

  const handleFastingDateOrTimeChange = (blockId: string, newStartDate?: string, newStartTime?: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const startDate = newStartDate !== undefined ? newStartDate : (block.fastingStartDate || getISODateYesterday());
    const startTime = newStartTime !== undefined ? newStartTime : (block.fastingStartTime || '20:00');

    const nearby = getNearbyGlucoseForFasting(startDate, startTime);
    const updates: Partial<FormBlock> = {
      ...(newStartDate !== undefined ? { fastingStartDate: newStartDate } : {}),
      ...(newStartTime !== undefined ? { fastingStartTime: newStartTime } : {}),
    };

    // If start glucose is empty or we are changing the date/time, auto-populate if a nearby reading is found
    if (!block.fastingStartGlucose) {
      updates.fastingStartGlucose = nearby ? String(nearby.value) : '';
    }

    handleUpdateBlock(blockId, updates);
  };

  const handleKeypadChange = (newVal: string) => {
    if (!activeKeypad) return;
    if (activeKeypad.field === 'distance' || activeKeypad.field === 'duration') {
      const block = blocks.find(b => b.id === activeKeypad.blockId);
      if (block) {
        const dist = activeKeypad.field === 'distance' ? newVal : (block.distance || '');
        const dur = activeKeypad.field === 'duration' ? newVal : (block.duration || '');
        handleExerciseChange(activeKeypad.blockId, dist, dur);
      }
    } else if (['fat', 'protein', 'carbs', 'calories', 'gda', 'exerciseCal', 'netCal'].includes(activeKeypad.field)) {
      handleFoodMacroChange(activeKeypad.blockId, { [activeKeypad.field]: newVal });
    } else {
      handleUpdateBlock(activeKeypad.blockId, { [activeKeypad.field]: newVal });
    }
  };

  const handleKeypadNext = () => {
    if (!activeKeypad) return;
    if (activeKeypad.field === 'systolic') {
      setActiveKeypad({
        blockId: activeKeypad.blockId,
        field: 'diastolic',
        label: 'Pressione Diastolica (Min)',
        unit: 'mmHg',
        allowDecimal: false,
        quickIncrements: [-10, -1, 1, 10],
        quickPresets: [70, 75, 80, 85, 90]
      });
    } else if (activeKeypad.field === 'diastolic') {
      setActiveKeypad({
        blockId: activeKeypad.blockId,
        field: 'pulse',
        label: 'Pulsazioni / Frequenza Cardiaca',
        unit: 'bpm',
        allowDecimal: false,
        quickIncrements: [-10, -1, 1, 10],
        quickPresets: [60, 65, 70, 75, 80, 85]
      });
    } else if (activeKeypad.field === 'distance') {
      setActiveKeypad({
        blockId: activeKeypad.blockId,
        field: 'duration',
        label: 'Durata Esercizio',
        unit: 'min',
        allowDecimal: false,
        quickIncrements: [-10, -5, 5, 10],
        quickPresets: [15, 20, 30, 45, 60]
      });
    } else if (activeKeypad.field === 'fat') {
      setActiveKeypad({
        blockId: activeKeypad.blockId,
        field: 'protein',
        label: 'Proteine (g)',
        unit: 'g',
        allowDecimal: true,
        quickIncrements: [-5, -1, 1, 5],
        quickPresets: [10, 15, 20, 25, 30]
      });
    } else if (activeKeypad.field === 'protein') {
      setActiveKeypad({
        blockId: activeKeypad.blockId,
        field: 'carbs',
        label: 'Carboidrati (g)',
        unit: 'g',
        allowDecimal: true,
        quickIncrements: [-10, -1, 1, 10],
        quickPresets: [15, 25, 35, 50, 75]
      });
    } else if (activeKeypad.field === 'carbs') {
      setActiveKeypad({
        blockId: activeKeypad.blockId,
        field: 'calories',
        label: 'Alimenti (Cal)',
        unit: 'Cal',
        allowDecimal: false,
        quickIncrements: [-50, -10, 10, 50],
        quickPresets: [150, 250, 350, 500, 700]
      });
    } else if (activeKeypad.field === 'calories') {
      setActiveKeypad({
        blockId: activeKeypad.blockId,
        field: 'gda',
        label: '% GDA (Assunzione Giornaliera)',
        unit: '%',
        allowDecimal: false,
        quickIncrements: [-5, -1, 1, 5],
        quickPresets: [10, 15, 20, 25, 30]
      });
    } else {
      setActiveKeypad(null);
    }
  };

  const getActiveKeypadValue = () => {
    if (!activeKeypad) return '';
    const block = blocks.find(b => b.id === activeKeypad.blockId);
    if (!block) return '';
    if (activeKeypad.field === 'value') return block.value || '';
    if (activeKeypad.field === 'systolic') return block.systolic || '';
    if (activeKeypad.field === 'diastolic') return block.diastolic || '';
    if (activeKeypad.field === 'pulse') return block.pulse || '';
    if (activeKeypad.field === 'distance') return block.distance || '';
    if (activeKeypad.field === 'duration') return block.duration || '';
    if (activeKeypad.field === 'fat') return block.fat || '';
    if (activeKeypad.field === 'protein') return block.protein || '';
    if (activeKeypad.field === 'carbs') return block.carbs || '';
    if (activeKeypad.field === 'calories') return block.calories || '';
    if (activeKeypad.field === 'gda') return block.gda || '';
    if (activeKeypad.field === 'exerciseCal') return block.exerciseCal || '';
    if (activeKeypad.field === 'netCal') return block.netCal || '';
    return '';
  };

  const handleSelectMedicationForBlock = (blockId: string, med: MedicationItem) => {
    const matchedCat = med.schedule
      ? categories.find(c => med.schedule?.toLowerCase().includes(c.name.toLowerCase()))
      : undefined;

    handleUpdateBlock(blockId, {
      medicationId: med.id,
      medicationName: med.name,
      medicationDosage: med.dosage,
      value: med.name,
      isCustomMedication: false,
      note: med.dosage ? `${med.dosage}${med.instructions ? ` • ${med.instructions}` : ''}` : '',
      ...(matchedCat ? { categoryId: matchedCat.id, categoryName: matchedCat.name } : {})
    });
  };

  const handleSubTypeChange = (blockId: string, subTypeId: string) => {
    const st = subTypes.find(s => s.id === subTypeId);
    if (st) {
      const isFasting = st.name.toLowerCase().includes('digiun') || st.name.toLowerCase().includes('fasting') || st.id.includes('fasting');
      const isMedication = st.name.toLowerCase().includes('farmac') || st.name.toLowerCase().includes('med') || st.name.toLowerCase().includes('insulina') || st.id.includes('med');

      const updates: Partial<FormBlock> = {
        subTypeId: st.id,
        subTypeName: st.name,
        unit: st.unit
      };

      if (isFasting) {
        const block = blocks.find(b => b.id === blockId);
        const sDate = block?.fastingStartDate || getISODateYesterday();
        const sTime = block?.fastingStartTime || '20:00';
        const nearby = getNearbyGlucoseForFasting(sDate, sTime);
        if (!block?.fastingStartGlucose) {
          updates.fastingStartGlucose = nearby ? String(nearby.value) : '';
        }
      } else if (isMedication) {
        const activeMeds = medicationsList.filter(m => m.active !== false);
        if (activeMeds.length > 0) {
          const firstMed = activeMeds[0];
          const matchedCat = firstMed.schedule
            ? categories.find(c => firstMed.schedule?.toLowerCase().includes(c.name.toLowerCase()))
            : undefined;

          updates.medicationId = firstMed.id;
          updates.medicationName = firstMed.name;
          updates.medicationDosage = firstMed.dosage;
          updates.value = firstMed.name;
          updates.isCustomMedication = false;
          updates.note = firstMed.dosage ? `${firstMed.dosage}${firstMed.instructions ? ` • ${firstMed.instructions}` : ''}` : '';
          if (matchedCat) {
            updates.categoryId = matchedCat.id;
            updates.categoryName = matchedCat.name;
          }
        }
      }

      handleUpdateBlock(blockId, updates);
    }
  };

  const handleExerciseChange = (blockId: string, distanceVal?: string, durationVal?: string) => {
    const distNum = parseFloat((distanceVal ?? '').replace(',', '.'));
    const durNum = parseFloat((durationVal ?? '').replace(',', '.'));

    let calculatedSpeed = '';
    if (!isNaN(distNum) && !isNaN(durNum) && durNum > 0) {
      const speedKmH = distNum / (durNum / 60);
      calculatedSpeed = speedKmH.toFixed(1).replace('.', ',');
    }

    handleUpdateBlock(blockId, {
      distance: distanceVal,
      duration: durationVal,
      speed: calculatedSpeed
    });
  };

  const handleAddAnother = () => {
    setBlocks(prev => [...prev, createNewBlock()]);
  };

  const handleClearBlock = (id: string) => {
    if (blocks.length > 1) {
      setBlocks(prev => prev.filter(b => b.id !== id));
    } else {
      if (onNavigate) {
        onNavigate('home');
      } else {
        onBack();
      }
    }
  };

  const handleSaveAll = () => {
    const validEntries: LogEntryItem[] = blocks.map(b => {
      const isBP = b.subTypeName.toLowerCase().includes('blood pressure') || b.subTypeName.toLowerCase().includes('pressione') || b.subTypeName.toLowerCase().includes('pulsazion') || b.subTypeName.toLowerCase().includes('battiti') || b.subTypeId.includes('bp') || b.subTypeId.includes('pulse');
      const isExercise = b.subTypeName.toLowerCase().includes('exercise') || b.subTypeName.toLowerCase().includes('esercizio') || b.subTypeName.toLowerCase().includes('camminata');
      const isFasting = b.subTypeName.toLowerCase().includes('digiun') || b.subTypeName.toLowerCase().includes('fasting') || b.subTypeId.includes('fasting');
      const isFood = b.subTypeName.toLowerCase().includes('cibo') ||
                     b.subTypeName.toLowerCase().includes('alimenti') ||
                     b.subTypeName.toLowerCase().includes('carboidrat') ||
                     b.subTypeName.toLowerCase().includes('food') ||
                     b.subTypeName.toLowerCase().includes('nutri') ||
                     b.subTypeId === 'sub_food' ||
                     b.subTypeId.includes('food');

      let finalValue = b.value || '0';
      let entryDate = b.date;
      let entryTime = b.time;
      let finalNote = b.note || '';

      if (isBP) {
        finalValue = `${b.systolic || '120'}/${b.diastolic || '80'}${b.pulse ? ` - ${b.pulse}` : ''}`;
      } else if (isExercise) {
        if (b.distance || b.duration) {
          finalValue = `${b.distance || '0'} km in ${b.duration || '0'} min (${b.speed || '0'} km/h)`;
        } else {
          finalValue = b.value || '30 min';
        }
      } else if (isFood) {
        finalValue = b.calories ? `${b.calories} Cal` : (b.carbs ? `${b.carbs}g` : (b.value || '0'));
        const parts: string[] = [];
        if (b.calories && b.calories !== '-') parts.push(`Calorie: ${b.calories} Cal`);
        if (b.gda && b.gda !== '-') parts.push(`% GDA: ${b.gda}%`);
        if (b.fat && b.fat !== '-') parts.push(`Grassi: ${b.fat}g`);
        if (b.protein && b.protein !== '-') parts.push(`Proteine: ${b.protein}g`);
        if (b.carbs && b.carbs !== '-') parts.push(`Carboidrati: ${b.carbs}g`);
        if (b.exerciseCal && b.exerciseCal !== '-') parts.push(`Esercizio: ${b.exerciseCal}`);
        if (b.netCal && b.netCal !== '-') parts.push(`Netto: ${b.netCal}`);
        if (b.note && b.note !== '-' && !b.note.includes('Calorie:') && !b.note.includes('Carboidrati:')) {
          parts.push(b.note);
        }
        finalNote = parts.length > 0 ? parts.join(' | ') : (b.note || '');
      } else if (isFasting) {
        const startISO = `${b.fastingStartDate || getISODateYesterday()}T${b.fastingStartTime || '20:00'}:00`;
        const proto = b.fastingProtocol || '16:8';
        const targetH = b.fastingTargetHours || parseProtocolTargetHours(proto);
        const startGluc = b.fastingStartGlucose ? parseFloat(b.fastingStartGlucose.replace(',', '.')) : undefined;
        const endGluc = b.fastingEndGlucose ? parseFloat(b.fastingEndGlucose.replace(',', '.')) : undefined;

        if (b.fastingMode === 'active' || b.fastingIsInProgress) {
          // Save active fasting session
          saveActiveFasting({
            isActive: true,
            startTime: startISO,
            protocol: proto,
            targetHours: targetH,
            startingGlucose: startGluc,
            note: b.note
          });
          finalValue = `In corso (${proto})`;
          // Formatted date & time from start
          const dObj = new Date(startISO);
          if (!isNaN(dObj.getTime())) {
            const day = String(dObj.getDate()).padStart(2, '0');
            const month = String(dObj.getMonth() + 1).padStart(2, '0');
            const year = String(dObj.getFullYear()).slice(-2);
            entryDate = `${day}/${month}/${year}`;
            entryTime = `${String(dObj.getHours()).padStart(2, '0')}:${String(dObj.getMinutes()).padStart(2, '0')}`;
          }
        } else {
          // Completed fasting session
          const endISO = `${b.fastingEndDate || getISODateToday()}T${b.fastingEndTime || getCurrentTimeStr()}:00`;
          const durHours = Math.max(0.1, (new Date(endISO).getTime() - new Date(startISO).getTime()) / 3600000);

          addSavedFastingRecord({
            id: 'fast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            startDate: b.fastingStartDate || getISODateYesterday(),
            startTime: b.fastingStartTime || '20:00',
            endDate: b.fastingEndDate || getISODateToday(),
            endTime: b.fastingEndTime || getCurrentTimeStr(),
            protocol: proto,
            targetHours: targetH,
            durationHours: parseFloat(durHours.toFixed(2)),
            startingGlucose: startGluc,
            endingGlucose: endGluc,
            note: b.note,
            isCompleted: true
          });
          finalValue = `${durHours.toFixed(1)} ore`;
          // Formatted date & time from end date
          const endObj = new Date(endISO);
          if (!isNaN(endObj.getTime())) {
            const day = String(endObj.getDate()).padStart(2, '0');
            const month = String(endObj.getMonth() + 1).padStart(2, '0');
            const year = String(endObj.getFullYear()).slice(-2);
            entryDate = `${day}/${month}/${year}`;
            entryTime = `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`;
          }
        }
      }

      return {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        subTypeId: b.subTypeId,
        subTypeName: b.subTypeName,
        value: finalValue,
        systolic: b.systolic,
        diastolic: b.diastolic,
        pulse: b.pulse,
        distance: b.distance,
        duration: b.duration,
        speed: b.speed,
        calories: isFood ? b.calories : undefined,
        gda: isFood ? b.gda : undefined,
        fat: isFood ? b.fat : undefined,
        protein: isFood ? b.protein : undefined,
        carbs: isFood ? b.carbs : undefined,
        exerciseCal: isFood ? b.exerciseCal : undefined,
        netCal: isFood ? b.netCal : undefined,
        unit: b.unit,
        date: entryDate,
        time: entryTime,
        categoryId: b.categoryId,
        categoryName: b.categoryName,
        reminder: b.reminder,
        note: finalNote,
        mealTiming: b.mealTiming,
        eventNoteIcon: b.eventNoteIcon,
        timestamp: Date.now()
      };
    });

    onSaveEntries(validEntries);
    onBack();
  };

  const currentActiveBlock = blocks.find(b => b.id === activeCategoryModalBlockId);

  return (
    <div className="flex flex-col min-h-full bg-[#e8ecee] dark:bg-[#121418] text-stone-900 dark:text-stone-100 transition-colors">

      {/* Header Bar */}
      <OnTrackHeader
        title="Aggiungi"
        showBack={true}
        onBack={onBack}
        showSave={true}
        onSave={handleSaveAll}
        showToolsMenu={true}
        onOpenTools={onOpenTools}
        onNavigate={onNavigate}
      />

      {/* Main Container */}
      <div className="flex-1 p-3 sm:p-6 max-w-2xl mx-auto w-full space-y-4 pb-12">

        {/* ========================================================================= */}
        {/* LIST OF ENTRY FORM BLOCKS                                                */}
        {/* ========================================================================= */}
        {blocks.map((block, index) => {
          const isBP = block.subTypeName.toLowerCase().includes('blood pressure') || block.subTypeName.toLowerCase().includes('pressione') || block.subTypeName.toLowerCase().includes('pulsazion') || block.subTypeName.toLowerCase().includes('battiti') || block.subTypeId.includes('bp') || block.subTypeId.includes('pulse');
          const isExercise = block.subTypeName.toLowerCase().includes('exercise') || block.subTypeName.toLowerCase().includes('esercizio') || block.subTypeName.toLowerCase().includes('camminata');
          const isFasting = block.subTypeName.toLowerCase().includes('digiun') || block.subTypeName.toLowerCase().includes('fasting') || block.subTypeId.includes('fasting');
          const isMedication = block.subTypeName.toLowerCase().includes('farmac') || block.subTypeName.toLowerCase().includes('medication') || block.subTypeName.toLowerCase().includes('medic') || block.subTypeId.includes('med');
          const isFood = block.subTypeName.toLowerCase().includes('cibo') ||
                         block.subTypeName.toLowerCase().includes('alimenti') ||
                         block.subTypeName.toLowerCase().includes('carboidrat') ||
                         block.subTypeName.toLowerCase().includes('food') ||
                         block.subTypeName.toLowerCase().includes('nutri') ||
                         block.subTypeId === 'sub_food' ||
                         block.subTypeId.includes('food');

          // Live calculation for Fasting block
          const fastingStartISO = `${block.fastingStartDate || getISODateYesterday()}T${block.fastingStartTime || '20:00'}:00`;
          const fastingEndISO = (block.fastingEndDate && block.fastingEndTime) ? `${block.fastingEndDate}T${block.fastingEndTime}:00` : undefined;

          let fastingElapsedHours = 0;
          if (block.fastingMode === 'active' || block.fastingIsInProgress || !fastingEndISO) {
            const startMs = new Date(fastingStartISO).getTime();
            if (!isNaN(startMs)) {
              fastingElapsedHours = Math.max(0, (Date.now() - startMs) / 3600000);
            }
          } else {
            const startMs = new Date(fastingStartISO).getTime();
            const endMs = new Date(fastingEndISO).getTime();
            if (!isNaN(startMs) && !isNaN(endMs)) {
              fastingElapsedHours = Math.max(0, (endMs - startMs) / 3600000);
            }
          }

          const fastingTargetHours = block.fastingTargetHours || 16;
          const fastingStage = getFastingStageByHours(fastingElapsedHours);
          const fastingTargetPct = Math.min(100, Math.round((fastingElapsedHours / fastingTargetHours) * 100));
          const fastingIsTargetReached = fastingElapsedHours >= fastingTargetHours;

          // Nearby glucose lookup for this fasting block
          const nearbyGlucose = isFasting ? getNearbyGlucoseForFasting(block.fastingStartDate || getISODateYesterday(), block.fastingStartTime || '20:00') : null;

          return (
            <div
              key={block.id}
              className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm relative transition-all"
            >

              {/* Header: SubType Selector and Badges */}
              <div className="border-b border-stone-200 dark:border-stone-700/80 pb-3 flex items-center justify-between gap-2">
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block mb-0.5">
                    Tipo di Misurazione {blocks.length > 1 ? `#${index + 1}` : ''}
                  </span>
                  <select
                    value={block.subTypeId}
                    onChange={(e) => handleSubTypeChange(block.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full text-stone-900 dark:text-stone-100 font-extrabold text-base sm:text-lg bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer p-0"
                  >
                    {subTypes.map((st) => (
                      <option key={st.id} value={st.id} className="bg-white dark:bg-[#1a1d24] text-stone-800 dark:text-stone-100">
                        {st.name} {st.unit ? `(${st.unit})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {isFasting ? (
                  <span className="text-[11px] font-black uppercase tracking-wider bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30 px-3 py-1 rounded-full shrink-0 flex items-center space-x-1">
                    <Timer className="w-3.5 h-3.5" />
                    <span>Digiuno</span>
                  </span>
                ) : isBP ? (
                  <span className="text-[11px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full shrink-0 flex items-center space-x-1">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Pressione</span>
                  </span>
                ) : isMedication ? (
                  <span className="text-[11px] font-black uppercase tracking-wider bg-[#3b7080]/15 text-[#3b7080] dark:text-[#5aa1b5] border border-[#3b7080]/30 px-3 py-1 rounded-full shrink-0 flex items-center space-x-1">
                    <Pill className="w-3.5 h-3.5" />
                    <span>Farmaci</span>
                  </span>
                ) : isFood ? (
                  <span className="text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full shrink-0 flex items-center space-x-1">
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Cibo / Nutrizione</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 font-mono">
                    {block.unit}
                  </span>
                )}
              </div>

              {/* ========================================================================= */}
              {/* VALUE & PARAMETERS INPUT SECTION                                         */}
              {/* ========================================================================= */}
              {isFasting ? (
                /* FASTING FORM SECTION */
                <div className="space-y-3.5 pt-0.5">

                  {/* Mode Toggle: In Corso vs Concluso */}
                  <div className="grid grid-cols-2 gap-2 bg-stone-100 dark:bg-stone-800/90 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
                    <button
                      type="button"
                      onClick={() => handleUpdateBlock(block.id, {
                        fastingMode: 'active',
                        fastingIsInProgress: true,
                        fastingEndDate: '',
                        fastingEndTime: ''
                      })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        block.fastingMode === 'active' || block.fastingIsInProgress
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-700/60'
                      }`}
                    >
                      <Timer className="w-3.5 h-3.5" />
                      <span>Digiuno in corso</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateBlock(block.id, {
                        fastingMode: 'completed',
                        fastingIsInProgress: false,
                        fastingEndDate: block.fastingEndDate || getISODateToday(),
                        fastingEndTime: block.fastingEndTime || getCurrentTimeStr()
                      })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        block.fastingMode === 'completed' && !block.fastingIsInProgress
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-700/60'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sessione conclusa</span>
                    </button>
                  </div>

                  {/* 1. Inizio Digiuno (Giorno e Ora con Calendar e Time Pick) */}
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Inizio Digiuno:</span>
                      </label>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleFastingDateOrTimeChange(block.id, getISODateYesterday(), '20:00')}
                          className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 hover:underline px-2 py-0.5 bg-teal-50 dark:bg-teal-950/40 rounded border border-teal-200 dark:border-teal-800 cursor-pointer"
                        >
                          Ieri sera (20:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFastingDateOrTimeChange(block.id, getISODateToday(), getCurrentTimeStr())}
                          className="text-[10px] font-semibold text-stone-600 dark:text-stone-300 hover:underline px-2 py-0.5 bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 cursor-pointer"
                        >
                          Adesso
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Giorno Inizio </span>
                        <input
                          type="date"
                          value={block.fastingStartDate || getISODateYesterday()}
                          onChange={(e) => handleFastingDateOrTimeChange(block.id, e.target.value, undefined)}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">Ora Inizio </span>
                          <button
                            type="button"
                            onClick={() => setTimePickerTarget({
                              blockId: block.id,
                              field: 'fastingStartTime',
                              initialValue: block.fastingStartTime || '20:00',
                              title: 'Seleziona Ora Inizio Digiuno'
                            })}
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
                            value={block.fastingStartTime || '20:00'}
                            onChange={(e) => handleFastingDateOrTimeChange(block.id, undefined, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setTimePickerTarget({
                              blockId: block.id,
                              field: 'fastingStartTime',
                              initialValue: block.fastingStartTime || '20:00',
                              title: 'Seleziona Ora Inizio Digiuno'
                            })}
                            className="p-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg cursor-pointer shrink-0"
                            title="Apri Selettore Orario 24h"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Piano e Obiettivo */}
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Piano Digiuno</span>
                        <select
                          value={block.fastingProtocol || '16:8'}
                          onChange={(e) => {
                            const proto = e.target.value;
                            const targetH = parsePlanTargetHours(proto);
                            handleUpdateBlock(block.id, {
                              fastingProtocol: proto,
                              fastingTargetHours: targetH
                            });
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                        >
                          {FASTING_PLANS.map(p => (
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
                          value={block.fastingTargetHours || 16}
                          onChange={(e) => handleUpdateBlock(block.id, { fastingTargetHours: parseInt(e.target.value) || 16 })}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#1d8998] dark:text-[#38bdf8] focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Fine Digiuno (Giorno e Ora con Pick, oppure In Corso) */}
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Fine Digiuno:</span>
                      </label>
                      {!block.fastingIsInProgress && (
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateBlock(block.id, {
                              fastingEndDate: getISODateToday(),
                              fastingEndTime: getCurrentTimeStr()
                            });
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
                        checked={block.fastingIsInProgress || block.fastingMode === 'active'}
                        onChange={(e) => {
                          const isProg = e.target.checked;
                          handleUpdateBlock(block.id, {
                            fastingIsInProgress: isProg,
                            fastingMode: isProg ? 'active' : 'completed',
                            fastingEndDate: isProg ? '' : (block.fastingEndDate || getISODateToday()),
                            fastingEndTime: isProg ? '' : (block.fastingEndTime || getCurrentTimeStr())
                          });
                        }}
                        className="rounded text-teal-600 focus:ring-0"
                      />
                      <span>Digiuno in corso (lascia non valorizzati giorno e ora fine)</span>
                    </label>

                    {!block.fastingIsInProgress && block.fastingMode === 'completed' && (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Giorno Fine </span>
                          <input
                            type="date"
                            value={block.fastingEndDate || getISODateToday()}
                            onChange={(e) => handleUpdateBlock(block.id, { fastingEndDate: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">Ora Fine </span>
                            <button
                              type="button"
                              onClick={() => setTimePickerTarget({
                                blockId: block.id,
                                field: 'fastingEndTime',
                                initialValue: block.fastingEndTime || getCurrentTimeStr(),
                                title: 'Seleziona Ora Fine Digiuno'
                              })}
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
                              value={block.fastingEndTime || getCurrentTimeStr()}
                              onChange={(e) => handleUpdateBlock(block.id, { fastingEndTime: e.target.value })}
                              onFocus={(e) => e.target.select()}
                              className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => setTimePickerTarget({
                                blockId: block.id,
                                field: 'fastingEndTime',
                                initialValue: block.fastingEndTime || getCurrentTimeStr(),
                                title: 'Seleziona Ora Fine Digiuno'
                              })}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-pointer shrink-0"
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
                  <div className="bg-gradient-to-br from-teal-950/40 via-stone-900/60 to-stone-950/80 text-white p-3.5 rounded-xl border border-teal-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span className="text-xs font-bold text-teal-200">
                          {block.fastingIsInProgress ? 'Durata Attuale Calcolata:' : 'Durata Totale Registrata:'}
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
                          Obiettivo: <strong>{fastingTargetHours} ore</strong> ({block.fastingProtocol || '16:8'})
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

                    {/* Metabolic Stage Badge & Brief Explanation */}
                    <div className="bg-white/10 p-2.5 rounded-lg border border-white/10 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-500 text-stone-950">
                          Lv.{fastingStage.level}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {fastingStage.title}
                        </span>
                        <span className="text-[10px] text-stone-300 font-mono ml-auto">
                          ({fastingStage.rangeLabel})
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-200 leading-snug line-clamp-2">
                        {fastingStage.description}
                      </p>
                    </div>
                  </div>

                  {/* 5. Glicemia Inizio (Auto ±3h se presente) & Fine (mg/dL) */}
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
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
                          value={block.fastingStartGlucose || ''}
                          onChange={(e) => handleUpdateBlock(block.id, { fastingStartGlucose: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#1d8998] dark:text-[#38bdf8] focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Glicemia Fine (mg/dL)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="es. 84"
                          value={block.fastingEndGlucose || ''}
                          onChange={(e) => handleUpdateBlock(block.id, { fastingEndGlucose: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#1d8998] dark:text-[#38bdf8] focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    {/* Auto-detected glucose feedback indicator */}
                    {nearbyGlucose ? (
                      <div className="flex items-center justify-between text-[11px] text-teal-700 dark:text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1.5 rounded-lg">
                        <div className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                          <span>
                            Lettura trovata entro 3h: <strong>{nearbyGlucose.value} mg/dL</strong> ({nearbyGlucose.time})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateBlock(block.id, { fastingStartGlucose: String(nearbyGlucose.value) })}
                          className="text-[10px] underline font-bold hover:text-teal-900 dark:hover:text-white cursor-pointer"
                        >
                          Ricarica
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-stone-400 dark:text-stone-500 italic px-1">
                        Nessuna lettura glicemica registrata entro 3 ore dall'inizio: campo lasciato in bianco. Modificabile liberamente.
                      </div>
                    )}
                  </div>

                </div>
              ) : isBP ? (
                /* BLOOD PRESSURE SECTION */
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-2 bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Sistolica (Max)</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={block.systolic || '120'}
                          onChange={(e) => handleUpdateBlock(block.id, { systolic: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveKeypad({
                            blockId: block.id,
                            field: 'systolic',
                            label: 'Pressione Sistolica (Massima)',
                            unit: 'mmHg',
                            allowDecimal: false,
                            quickIncrements: [-10, -1, 1, 10],
                            quickPresets: [110, 120, 130, 140, 150]
                          })}
                          className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Diastolica (Min)</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={block.diastolic || '80'}
                          onChange={(e) => handleUpdateBlock(block.id, { diastolic: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveKeypad({
                            blockId: block.id,
                            field: 'diastolic',
                            label: 'Pressione Diastolica (Minima)',
                            unit: 'mmHg',
                            allowDecimal: false,
                            quickIncrements: [-10, -1, 1, 10],
                            quickPresets: [70, 75, 80, 85, 90]
                          })}
                          className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Pulsazioni (bpm)</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={block.pulse || '75'}
                          onChange={(e) => handleUpdateBlock(block.id, { pulse: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-stone-800 dark:text-stone-100 text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveKeypad({
                            blockId: block.id,
                            field: 'pulse',
                            label: 'Pulsazioni / Frequenza Cardiaca',
                            unit: 'bpm',
                            allowDecimal: false,
                            quickIncrements: [-10, -1, 1, 10],
                            quickPresets: [60, 65, 70, 75, 80, 85]
                          })}
                          className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : isExercise ? (
                /* EXERCISE SECTION */
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-2 bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Distanza (km)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="es. 4.5"
                        value={block.distance || ''}
                        onChange={(e) => handleExerciseChange(block.id, e.target.value, block.duration)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-teal-600 dark:text-teal-400 text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Durata (min)</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="es. 30"
                        value={block.duration || ''}
                        onChange={(e) => handleExerciseChange(block.id, block.distance, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-teal-600 dark:text-teal-400 text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Velocità Media</span>
                      <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-stone-700 dark:text-stone-200 text-center border border-stone-200 dark:border-stone-700">
                        {block.speed ? `${block.speed} km/h` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : isMedication ? (
                /* ========================================================================= */
                /* DEDICATED MEDICATION SECTION (SELECTION FROM REGISTERED MEDICATIONS)     */
                /* ========================================================================= */
                <div className="space-y-3 pt-1">
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                        <Pill className="w-4 h-4 text-[#3b7080] dark:text-[#5aa1b5]" />
                        <span>Farmaco da Assumere:</span>
                      </label>
                      <span className="text-[10px] text-stone-400 font-medium">
                        {medicationsList.filter(m => m.active !== false).length} disponibili
                      </span>
                    </div>

                    {/* Registered Medications Selection Chips / Cards */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Seleziona dai Farmaci Registrati:
                      </span>

                      {medicationsList.filter(m => m.active !== false).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {medicationsList.filter(m => m.active !== false).map((med) => {
                            const isSelected = block.medicationId === med.id || (!block.isCustomMedication && (block.medicationName === med.name || block.value === med.name));
                            return (
                              <button
                                key={med.id}
                                type="button"
                                onClick={() => handleSelectMedicationForBlock(block.id, med)}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-[#3b7080]/15 dark:bg-[#3b7080]/30 border-[#3b7080] ring-1 ring-[#3b7080] text-stone-900 dark:text-white shadow-xs'
                                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="font-bold text-xs truncate">{med.name}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3b7080]/10 text-[#3b7080] dark:bg-[#3b7080]/20 dark:text-[#5aa1b5] shrink-0">
                                      {med.dosage}
                                    </span>
                                  </div>
                                  {med.schedule && (
                                    <span className="text-[10px] text-stone-400 dark:text-stone-500 block truncate mt-0.5">
                                      ⏰ {med.schedule}
                                    </span>
                                  )}
                                </div>
                                {isSelected && (
                                  <CheckCircle2 className="w-4 h-4 text-[#3b7080] dark:text-[#5aa1b5] shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 text-center bg-white dark:bg-stone-900 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-xs text-stone-500">
                          Nessun farmaco registrato nelle impostazioni. Puoi digitare il nome qui sotto.
                        </div>
                      )}

                      {/* Custom Medication Toggle */}
                      <div className="pt-1 flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateBlock(block.id, {
                            isCustomMedication: true,
                            medicationId: undefined,
                            medicationName: '',
                            medicationDosage: '',
                            value: '',
                            note: ''
                          })}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            block.isCustomMedication
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-400'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          + Inserisci Altro Farmaco (Non in elenco)
                        </button>
                      </div>
                    </div>

                    {/* Name and Dosage inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block mb-1">
                          Nome Farmaco
                        </label>
                        <input
                          type="text"
                          value={block.medicationName || block.value || ''}
                          placeholder="Es. Metformina..."
                          onChange={(e) => {
                            const val = e.target.value;
                            handleUpdateBlock(block.id, {
                              medicationName: val,
                              value: val
                            });
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#3b7080]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block mb-1">
                          Dosaggio / Quantità Somministrata
                        </label>
                        <input
                          type="text"
                          value={block.medicationDosage || ''}
                          placeholder="Es. 500 mg, 1 cpr, 2 unità..."
                          onChange={(e) => {
                            const val = e.target.value;
                            handleUpdateBlock(block.id, {
                              medicationDosage: val
                            });
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#3b7080] dark:text-[#5aa1b5] focus:outline-none focus:ring-2 focus:ring-[#3b7080]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : isFood ? (
                /* FOOD / NUTRITION FORM SECTION */
                <div className="space-y-3 pt-0.5">
                  {/* Energy & GDA Badges Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-amber-900/10 rounded-xl border border-amber-500/20">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Utensils className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                          <span>Dati Nutrizionali</span>
                          {block.calories && (
                            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                              {block.calories} Cal
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400">
                          {block.gda ? `% GDA: ${block.gda}%` : 'Standard CSV: Alimenti, GDA, Grassi, Proteine, Carboidrati'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const f = parseFloat((block.fat || '').replace(',', '.')) || 0;
                        const p = parseFloat((block.protein || '').replace(',', '.')) || 0;
                        const c = parseFloat((block.carbs || '').replace(',', '.')) || 0;
                        const calcCal = Math.round((f * 9) + (p * 4) + (c * 4));
                        const calcGda = Math.round((calcCal / 1800) * 100);
                        const exer = parseFloat((block.exerciseCal || '').replace(',', '.')) || 0;
                        const net = Math.max(0, Math.round(calcCal - exer));
                        handleUpdateBlock(block.id, {
                          calories: String(calcCal),
                          gda: String(calcGda),
                          netCal: String(net),
                          value: String(c || calcCal)
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 transition-colors flex items-center space-x-1 cursor-pointer"
                      title="Calcola automaticamente Calorie e % GDA dai Macronutrienti (Grassi x 9 + Prot x 4 + Carb x 4)"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Calcola da Macro</span>
                    </button>
                  </div>

                  {/* 1. Macronutrienti principali (g): Grassi, Proteine, Carboidrati */}
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block uppercase tracking-wider">
                      Macronutrienti (grammi)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Grassi */}
                      <div className="bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                            Grassi (g)
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveKeypad({
                              blockId: block.id,
                              field: 'fat',
                              label: 'Grassi (g)',
                              unit: 'g',
                              allowDecimal: true,
                              quickIncrements: [-5, -1, 1, 5],
                              quickPresets: [5, 10, 15, 20, 25]
                            })}
                            className="p-0.5 text-stone-400 hover:text-orange-500 rounded cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={block.fat || ''}
                          placeholder="es. 17.61"
                          onChange={(e) => handleFoodMacroChange(block.id, { fat: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-sm font-bold font-mono text-stone-900 dark:text-stone-100 bg-transparent focus:outline-none"
                        />
                      </div>

                      {/* Proteine */}
                      <div className="bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            Proteine (g)
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveKeypad({
                              blockId: block.id,
                              field: 'protein',
                              label: 'Proteine (g)',
                              unit: 'g',
                              allowDecimal: true,
                              quickIncrements: [-5, -1, 1, 5],
                              quickPresets: [10, 15, 20, 25, 30]
                            })}
                            className="p-0.5 text-stone-400 hover:text-indigo-500 rounded cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={block.protein || ''}
                          placeholder="es. 18.46"
                          onChange={(e) => handleFoodMacroChange(block.id, { protein: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-sm font-bold font-mono text-stone-900 dark:text-stone-100 bg-transparent focus:outline-none"
                        />
                      </div>

                      {/* Carboidrati */}
                      <div className="bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                            Carboidrati (g)
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveKeypad({
                              blockId: block.id,
                              field: 'carbs',
                              label: 'Carboidrati (g)',
                              unit: 'g',
                              allowDecimal: true,
                              quickIncrements: [-10, -1, 1, 10],
                              quickPresets: [15, 25, 35, 50, 75]
                            })}
                            className="p-0.5 text-stone-400 hover:text-teal-500 rounded cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={block.carbs || ''}
                          placeholder="es. 27.81"
                          onChange={(e) => handleFoodMacroChange(block.id, { carbs: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-sm font-bold font-mono text-stone-900 dark:text-stone-100 bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Energia & Bilancio: Alimenti (Cal), % GDA, Esercizio (Cal), Netto (Cal) */}
                  <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block uppercase tracking-wider">
                      Bilancio Energetico & GDA
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Alimenti (Cal) */}
                      <div className="bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 truncate">
                            Alimenti (Cal)
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveKeypad({
                              blockId: block.id,
                              field: 'calories',
                              label: 'Alimenti (Cal)',
                              unit: 'Cal',
                              allowDecimal: false,
                              quickIncrements: [-50, -10, 10, 50],
                              quickPresets: [150, 250, 350, 500, 700]
                            })}
                            className="p-0.5 text-stone-400 hover:text-amber-500 rounded cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={block.calories || ''}
                          placeholder="es. 337"
                          onChange={(e) => handleFoodMacroChange(block.id, { calories: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-sm font-bold font-mono text-stone-900 dark:text-stone-100 bg-transparent focus:outline-none"
                        />
                      </div>

                      {/* % GDA */}
                      <div className="bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-stone-600 dark:text-stone-300 truncate">
                            % GDA
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveKeypad({
                              blockId: block.id,
                              field: 'gda',
                              label: '% GDA (Assunzione Giornaliera)',
                              unit: '%',
                              allowDecimal: false,
                              quickIncrements: [-5, -1, 1, 5],
                              quickPresets: [10, 15, 20, 25, 30]
                            })}
                            className="p-0.5 text-stone-400 hover:text-stone-600 rounded cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={block.gda || ''}
                          placeholder="es. 19"
                          onChange={(e) => handleFoodMacroChange(block.id, { gda: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-sm font-bold font-mono text-stone-900 dark:text-stone-100 bg-transparent focus:outline-none"
                        />
                      </div>

                      {/* Esercizio (Cal) */}
                      <div className="bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                            Esercizio (Cal)
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveKeypad({
                              blockId: block.id,
                              field: 'exerciseCal',
                              label: 'Esercizio Bruciato (Cal)',
                              unit: 'Cal',
                              allowDecimal: false,
                              quickIncrements: [-50, -10, 10, 50],
                              quickPresets: [50, 100, 200, 300]
                            })}
                            className="p-0.5 text-stone-400 hover:text-emerald-500 rounded cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={block.exerciseCal || ''}
                          placeholder="es. -"
                          onChange={(e) => handleFoodMacroChange(block.id, { exerciseCal: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-sm font-bold font-mono text-stone-900 dark:text-stone-100 bg-transparent focus:outline-none"
                        />
                      </div>

                      {/* Netto (Cal) */}
                      <div className="bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 truncate">
                            Netto (Cal)
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveKeypad({
                              blockId: block.id,
                              field: 'netCal',
                              label: 'Netto Calorie',
                              unit: 'Cal',
                              allowDecimal: false,
                              quickIncrements: [-50, -10, 10, 50],
                              quickPresets: [150, 250, 350, 500]
                            })}
                            className="p-0.5 text-stone-400 hover:text-sky-500 rounded cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={block.netCal || ''}
                          placeholder="es. -"
                          onChange={(e) => handleFoodMacroChange(block.id, { netCal: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-sm font-bold font-mono text-stone-900 dark:text-stone-100 bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD MEASUREMENT (GLUCOSE, ETC.) */
                <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                      Valore Misurazione:
                    </label>
                    <span className="text-[11px] text-stone-400">Inserisci il valore numerico registrato</span>
                  </div>

                  <div className="flex items-center space-x-2 bg-white dark:bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 shadow-2xs">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={block.value}
                      placeholder="0.0"
                      onChange={(e) => handleUpdateBlock(block.id, { value: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      className="w-24 text-right text-xl font-extrabold text-[#1d8998] dark:text-[#38bdf8] bg-transparent focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setActiveKeypad({
                        blockId: block.id,
                        field: 'value',
                        label: block.subTypeName || 'Valore Misurazione',
                        unit: block.unit,
                        allowDecimal: true,
                        quickIncrements: [-10, -1, 1, 10],
                        quickPresets: [80, 100, 120, 140, 160]
                      })}
                      className="p-1.5 text-stone-400 hover:text-[#1d8998] dark:hover:text-[#38bdf8] hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                      title="Apri tastierino numerico"
                    >
                      <Calculator className="w-4 h-4" />
                    </button>
                    <span className="text-stone-500 dark:text-stone-400 text-xs font-bold font-mono">
                      {block.unit}
                    </span>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* UNIFIED DATE AND TIME PICKER ROW (HARMONIOUS CALENDAR & TIME PICK)       */}
              {/* Only shown for non-fasting blocks as Fasting has dedicated pickers above */}
              {/* ========================================================================= */}
              {!isFasting && (
                <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 dark:text-stone-300">
                    <span className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Data e Ora di Registrazione</span>
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateBlock(block.id, { date: getTodayDateStr() })}
                        className="text-[10px] font-semibold text-stone-700 dark:text-stone-200 hover:underline px-2 py-0.5 bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 cursor-pointer"
                      >
                        Oggi
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = getCurrentTimeStr();
                          const matched = findCategoryForTime(categories, curr);
                          handleUpdateBlock(block.id, {
                            time: curr,
                            categoryId: matched.id,
                            categoryName: matched.name
                          });
                        }}
                        className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 hover:underline px-2 py-0.5 bg-teal-50 dark:bg-teal-950/40 rounded border border-teal-200 dark:border-teal-800 cursor-pointer"
                      >
                        Adesso
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Calendar Date Picker */}
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block mb-0.5 font-medium">Giorno </span>
                      <input
                        type="date"
                        value={formatDateToISO(block.date)}
                        onChange={(e) => {
                          const isoVal = e.target.value;
                          const itVal = formatDateToItalian(isoVal);
                          handleUpdateBlock(block.id, { date: itVal });
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      />
                    </div>

                    {/* Time Picker with Modal Trigger */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">Ora (Pick 24h)</span>
                        <button
                          type="button"
                          onClick={() => setTimePickerTarget({
                            blockId: block.id,
                            field: 'time',
                            initialValue: block.time || getCurrentTimeStr(),
                            title: 'Seleziona Ora Registrazione'
                          })}
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
                          value={block.time}
                          onChange={(e) => {
                            const newTime = e.target.value;
                            const matchedCat = findCategoryForTime(categories, newTime);
                            handleUpdateBlock(block.id, {
                              time: newTime,
                              categoryId: matchedCat.id,
                              categoryName: matchedCat.name
                            });
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => setTimePickerTarget({
                            blockId: block.id,
                            field: 'time',
                            initialValue: block.time || getCurrentTimeStr(),
                            title: 'Seleziona Ora Registrazione'
                          })}
                          className="p-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg cursor-pointer shrink-0"
                          title="Apri Selettore Orario 24h"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Field (Triggers Modal) */}
              <div
                onClick={() => setActiveCategoryModalBlockId(block.id)}
                className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:bg-stone-100/80 dark:hover:bg-stone-800 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-bold">
                    Fascia Oraria / Categoria
                  </span>
                  <span className="text-stone-900 dark:text-stone-100 font-bold text-sm">
                    {block.categoryName || (isFasting ? 'Digiuno' : 'Generale')}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-teal-600 dark:text-teal-400 text-xs font-bold">
                  <span>Cambia</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Pre / Post Pasto Selector Row - Only if not Fasting */}
              {!isFasting && (
                <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-1.5">
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-bold block">
                    Momento del Pasto
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newTiming = block.mealTiming === 'pre' ? undefined : 'pre';
                        handleUpdateBlock(block.id, { mealTiming: newTiming });
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        block.mealTiming === 'pre'
                          ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-200 shadow-xs'
                          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <WholeAppleIcon className={`w-4 h-4 ${block.mealTiming === 'pre' ? 'text-amber-900 dark:text-amber-300' : 'text-stone-700 dark:text-stone-400'}`} />
                      <span>Pre pasto</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const newTiming = block.mealTiming === 'post' ? undefined : 'post';
                        handleUpdateBlock(block.id, { mealTiming: newTiming });
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        block.mealTiming === 'post'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-xs'
                          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <AppleCoreIcon className={`w-4 h-4 ${block.mealTiming === 'post' ? 'text-emerald-900 dark:text-emerald-300' : 'text-stone-700 dark:text-stone-400'}`} />
                      <span>Post pasto</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Note Evento Icon Selection Row */}
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1">
                    <Tag className="w-3.5 h-3.5 text-[#b48342]" />
                    <span>Note Evento (Icona):</span>
                  </span>
                  {block.eventNoteIcon && (
                    <button
                      type="button"
                      onClick={() => handleUpdateBlock(block.id, { eventNoteIcon: undefined })}
                      className="text-[10px] text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 underline cursor-pointer"
                    >
                      Rimuovi icona
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2 overflow-x-auto py-1">
                  {defaultEventNotes.map((note) => (
                    <EventNoteIcon
                      key={note.id}
                      id={note.id}
                      size="sm"
                      selected={block.eventNoteIcon === note.id}
                      onClick={() => {
                        const newIcon = block.eventNoteIcon === note.id ? undefined : note.id;
                        handleUpdateBlock(block.id, { eventNoteIcon: newIcon });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Add Note & Promemoria Row */}
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 text-sm">
                  <Pencil className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0" />
                  <input
                    type="text"
                    placeholder={isFasting ? "Note sul digiuno (es. Tisane, idratazione, sensazioni...)" : "Aggiungi Nota"}
                    value={block.note}
                    onChange={(e) => handleUpdateBlock(block.id, { note: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 text-xs sm:text-sm font-medium"
                  />
                </div>

                <div className="pt-2 border-t border-stone-200 dark:border-stone-700/80 flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs text-stone-600 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={block.reminder}
                      onChange={(e) => handleUpdateBlock(block.id, { reminder: e.target.checked })}
                      className="rounded text-teal-600 focus:ring-0"
                    />
                    <span className="font-medium">Promemoria notifica</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleClearBlock(block.id)}
                    className="text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold uppercase tracking-wider flex items-center space-x-1 py-1 px-2 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{blocks.length > 1 ? 'Rimuovi Blocco' : 'Annulla'}</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}

        {/* Add Another Block Button */}
        <button
          type="button"
          onClick={handleAddAnother}
          className="w-full py-3.5 bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold text-sm rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 shadow-2xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <span>Aggiungi Un'Altra Lettura Contemporanea</span>
        </button>

      </div>

      {/* Category Modal Selection */}
      {activeCategoryModalBlockId && currentActiveBlock && (
        <CategoryModal
          isOpen={!!activeCategoryModalBlockId}
          categories={categories}
          selectedCategoryId={currentActiveBlock.categoryId}
          onSelectCategory={(cat) => {
            handleUpdateBlock(currentActiveBlock.id, {
              categoryId: cat.id,
              categoryName: cat.name
            });
          }}
          onClose={() => setActiveCategoryModalBlockId(null)}
        />
      )}

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
      {timePickerTarget && (
        <TimePickerModal
          isOpen={!!timePickerTarget}
          onClose={() => setTimePickerTarget(null)}
          title={timePickerTarget.title || 'Seleziona Ora (24h)'}
          initialValue={timePickerTarget.initialValue || '12:00'}
          onConfirm={(selectedTime) => {
            const target = timePickerTarget;
            const block = blocks.find(b => b.id === target.blockId);
            if (block) {
              if (target.field === 'fastingStartTime') {
                handleFastingDateOrTimeChange(block.id, undefined, selectedTime);
              } else if (target.field === 'fastingEndTime') {
                handleUpdateBlock(block.id, { fastingEndTime: selectedTime });
              } else if (target.field === 'time') {
                const matched = findCategoryForTime(categories, selectedTime);
                handleUpdateBlock(block.id, {
                  time: selectedTime,
                  categoryId: matched.id,
                  categoryName: matched.name
                });
              } else {
                handleUpdateBlock(block.id, { [target.field]: selectedTime });
              }
            }
            setTimePickerTarget(null);
          }}
        />
      )}

    </div>
  );
};
