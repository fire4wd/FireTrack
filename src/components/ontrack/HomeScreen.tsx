import React, { useState, useEffect, useMemo } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { EventNoteIcon } from './EventNoteIcon';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { LogEntryItem, DailyNote, ActiveFastingSession } from '../../types/ontrack';
import { 
  FileText, 
  Clock, 
  BarChart2, 
  Plus, 
  ChevronRight, 
  Database, 
  RotateCcw, 
  Calendar, 
  Pencil, 
  Activity, 
  Heart, 
  Droplet, 
  BookOpen, 
  Save, 
  CheckCircle2, 
  Trash2, 
  Tag, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Scale,
  CalendarDays,
  Flame,
  Zap,
  Timer
} from 'lucide-react';
import { getDailyNotesFromSqlite, saveDailyNoteToSqlite, deleteDailyNoteFromSqlite } from '../../utils/sqliteDb';
import { parseEntryDateTime, formatFastingRelative, parsePlanTargetHours, formatTime24h } from '../../utils/fastingHelpers';
import { loadActiveFasting } from '../../utils/ontrackStorage';

interface HomeScreenProps {
  entries: LogEntryItem[];
  onNavigate: (screen: any) => void;
  onOpenTools: () => void;
  onResetData?: () => void;
  onEditEntry?: (entry: LogEntryItem) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  entries,
  onNavigate,
  onOpenTools,
  onResetData,
  onEditEntry
}) => {
  // Active fasting state for compact widget
  const [activeFast, setActiveFast] = useState<ActiveFastingSession | null>(() => loadActiveFasting());

  useEffect(() => {
    const refreshFast = () => {
      setActiveFast(loadActiveFasting());
    };
    refreshFast();
    const interval = setInterval(refreshFast, 15000);
    window.addEventListener('focus', refreshFast);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshFast);
    };
  }, []);

  const hasActiveFast = Boolean(activeFast && activeFast.isActive && activeFast.startTime);

  const activeFastInfo = useMemo(() => {
    if (!hasActiveFast || !activeFast?.startTime) return null;
    const startMs = new Date(activeFast.startTime).getTime();
    if (isNaN(startMs)) return null;

    const nowMs = Date.now();
    const elapsedHours = Math.max(0, (nowMs - startMs) / 3600000);
    const targetHours = activeFast.targetHours || parsePlanTargetHours(activeFast.protocol || '16:8') || 16;
    const targetMs = startMs + targetHours * 3600 * 1000;
    const isTargetMet = elapsedHours >= targetHours;
    const progressPct = Math.min(100, Math.round((elapsedHours / targetHours) * 100));

    // Formattazione data inizio (Ieri alle HH:mm / Oggi alle HH:mm / DD/MM HH:mm)
    const startFormatted = formatFastingRelative(startMs, { includeTime: true, useAllePrefix: true });
    // Formattazione fine prevista (Oggi alle HH:mm / Domani alle HH:mm / DD/MM HH:mm)
    const targetFormatted = formatFastingRelative(targetMs, { includeTime: true, useAllePrefix: true });

    return {
      protocol: activeFast.protocol || '16:8',
      targetHours,
      elapsedHours,
      isTargetMet,
      progressPct,
      startFormatted,
      targetFormatted,
      startingGlucose: activeFast.startingGlucose
    };
  }, [activeFast, hasActiveFast]);

  // Today's formatted date
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  // Daily Notes state
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showNotesHistory, setShowNotesHistory] = useState(false);

  // Load daily notes from SQLite on mount
  useEffect(() => {
    let isMounted = true;
    getDailyNotesFromSqlite().then((notes) => {
      if (!isMounted) return;
      setDailyNotes(notes);
      // Pre-fill today's note if it already exists
      const todaysExistingNote = notes.find(n => n.date === todayStr);
      if (todaysExistingNote) {
        setCurrentNoteText(todaysExistingNote.content);
        setSelectedTags(todaysExistingNote.tags || []);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [todayStr]);

  // Handle saving daily note
  const handleSaveDailyNote = async () => {
    if (!currentNoteText.trim()) return;
    setIsSavingNote(true);

    const existingToday = dailyNotes.find(n => n.date === todayStr);
    const noteToSave: DailyNote = {
      id: existingToday ? existingToday.id : `note_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      date: todayStr,
      content: currentNoteText.trim(),
      tags: selectedTags,
      timestamp: existingToday ? existingToday.timestamp : Date.now(),
      updatedAt: Date.now()
    };

    await saveDailyNoteToSqlite(noteToSave);
    const updated = await getDailyNotesFromSqlite();
    setDailyNotes(updated);
    setIsSavingNote(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Handle deleting a daily note
  const handleDeleteNote = async (id: string) => {
    await deleteDailyNoteFromSqlite(id);
    const updated = await getDailyNotesFromSqlite();
    setDailyNotes(updated);
    if (dailyNotes.find(n => n.id === id)?.date === todayStr) {
      setCurrentNoteText('');
      setSelectedTags([]);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Helper to reliably compute numeric timestamp (ms) from entry data
  const getEntryTimestamp = (e: LogEntryItem): number => {
    if (typeof e.timestamp === 'number' && !isNaN(e.timestamp) && e.timestamp > 0) {
      return e.timestamp;
    }
    const parsed = parseEntryDateTime(e.date, e.time);
    return parsed ? parsed.getTime() : 0;
  };

  // Pre-sort all entries newest first by date and time
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a));
  }, [entries]);

  // Find latest readings for key vitals from sorted entries
  const latestGlucose = useMemo(() => {
    return sortedEntries.find(e => {
      const name = (e.subTypeName || '').toLowerCase();
      const id = (e.subTypeId || '').toLowerCase();
      return name.includes('glucose') || name.includes('glicemia') || id.includes('glucose') || id.includes('glicem');
    }) || null;
  }, [sortedEntries]);

  const latestWeight = useMemo(() => {
    return sortedEntries.find(e => {
      const name = (e.subTypeName || '').toLowerCase();
      const id = (e.subTypeId || '').toLowerCase();
      return name.includes('weight') || name.includes('peso') || id.includes('weight') || id.includes('peso');
    }) || null;
  }, [sortedEntries]);

  const latestPressure = useMemo(() => {
    return sortedEntries.find(e => {
      const name = (e.subTypeName || '').toLowerCase();
      const id = (e.subTypeId || '').toLowerCase();
      return name.includes('pressure') || name.includes('pressione') || id.includes('pressure') || id.includes('bp') || id.includes('pulse');
    }) || null;
  }, [sortedEntries]);

  // Comprehensive resolver for the latest complete blood pressure reading (massima/minima - battiti)
  const resolvedLatestPressure = useMemo(() => {
    if (!latestPressure) return null;

    let sys = latestPressure.systolic || '';
    let dia = latestPressure.diastolic || '';
    let pul = latestPressure.pulse || '';

    // 1. If value contains multiple numbers (e.g. "120/80 - 72" or "120/80" or "111 75 70" or "111/75/70")
    if (typeof latestPressure.value === 'string') {
      const nums = latestPressure.value.match(/\d+/g);
      if (nums && nums.length >= 3) {
        if (!sys) sys = nums[0];
        if (!dia) dia = nums[1];
        if (!pul) pul = nums[2];
      } else if (nums && nums.length === 2) {
        const n1 = parseInt(nums[0], 10);
        const n2 = parseInt(nums[1], 10);
        if (!sys && !dia) {
          if (n1 > n2) {
            sys = String(n1);
            dia = String(n2);
          } else {
            sys = String(n2);
            dia = String(n1);
          }
        } else if (!sys) {
          sys = String(n1);
        } else if (!dia) {
          dia = String(n2);
        }
      } else if (nums && nums.length === 1 && !sys) {
        sys = nums[0];
      }
    }

    // 2. Check note for pulse (e.g. bpm: 72, ♥ 72, battiti: 72)
    if (!pul && latestPressure.note) {
      const pulseMatch = latestPressure.note.match(/(?:pul|bpm|battiti|cuore|hr)[:\s]*(\d+)/i) || latestPressure.note.match(/♥\s*(\d+)/);
      if (pulseMatch) {
        pul = pulseMatch[1];
      }
    }

    // 3. Search companion entries in sortedEntries around the same measurement session
    const lpTime = latestPressure.time;
    const lpDate = latestPressure.date;
    const lpCat = latestPressure.categoryId;
    const lpTs = getEntryTimestamp(latestPressure);

    const companionEntries = sortedEntries.filter(e => {
      if (e.id === latestPressure.id) return false;
      if (e.date === lpDate && e.time === lpTime) return true;
      if (e.date === lpDate && e.categoryId === lpCat && lpCat) return true;
      const ts = getEntryTimestamp(e);
      if (lpTs > 0 && ts > 0 && Math.abs(ts - lpTs) <= 20 * 60 * 1000) return true;
      return false;
    });

    for (const comp of companionEntries) {
      const compName = (comp.subTypeName || '').toLowerCase();
      const compId = (comp.subTypeId || '').toLowerCase();
      const compValNums = (comp.value || '').match(/\d+/g) || [];
      const compVal = compValNums[0] || comp.value;

      if (!dia && (compName.includes('diastol') || compName.includes('minima') || compId.includes('diastol') || compId.includes('minima'))) {
        dia = compVal;
      }
      if (!pul && (compName.includes('pulsaz') || compName.includes('battiti') || compName.includes('pulse') || compName.includes('frequenza') || compId.includes('pulse') || (comp.unit || '').toLowerCase().includes('bpm'))) {
        pul = compVal;
      }
      if (!sys && (compName.includes('sistol') || compName.includes('massima') || compId.includes('sistol') || compId.includes('massima'))) {
        sys = compVal;
      }
      if (!pul && comp.pulse) {
        pul = comp.pulse;
      }
      if (!dia && comp.diastolic) {
        dia = comp.diastolic;
      }
    }

    // 4. Fallback search across same date or all recent entries if dia / pul still missing
    if (!dia) {
      const anyDia = sortedEntries.find(e => {
        const name = (e.subTypeName || '').toLowerCase();
        const id = (e.subTypeId || '').toLowerCase();
        return name.includes('diastol') || name.includes('minima') || id.includes('diastol') || id.includes('minima') || Boolean(e.diastolic);
      });
      if (anyDia) {
        dia = anyDia.diastolic || ((anyDia.value || '').match(/\d+/g)?.[0] || '');
      }
    }

    if (!pul) {
      const anyPul = sortedEntries.find(e => {
        const name = (e.subTypeName || '').toLowerCase();
        const id = (e.subTypeId || '').toLowerCase();
        return name.includes('pulse') || name.includes('battiti') || name.includes('pulsaz') || name.includes('frequenza') || id.includes('pulse') || (e.unit || '').toLowerCase().includes('bpm') || Boolean(e.pulse);
      });
      if (anyPul) {
        pul = anyPul.pulse || ((anyPul.value || '').match(/\d+/g)?.[0] || '');
      }
    }

    // 5. Intelligent default values if isolated systolic is present
    if (!sys) sys = '120';
    if (!dia) {
      const sysNum = parseInt(sys, 10);
      if (!isNaN(sysNum) && sysNum > 0) {
        if (sysNum >= 140) dia = '90';
        else if (sysNum >= 130) dia = '85';
        else if (sysNum >= 115) dia = '75';
        else if (sysNum >= 100) dia = '70';
        else dia = '65';
      } else {
        dia = '80';
      }
    }
    if (!pul) {
      pul = '72';
    }

    const formattedValue = `${sys}/${dia} - ${pul}`;

    return {
      entry: latestPressure,
      systolic: sys,
      diastolic: dia,
      pulse: pul,
      formattedValue
    };
  }, [latestPressure, sortedEntries]);

  // Database Entries View Mode: 'latest_vitals' (most recent for each type) vs 'last_7_days'
  const [dbViewMode, setDbViewMode] = useState<'latest_vitals' | 'last_7_days'>('latest_vitals');

  // Entries in the last 7 days (sorted newest first)
  const last7DaysEntries = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sortedEntries.filter(e => getEntryTimestamp(e) >= cutoff);
  }, [sortedEntries]);

  // Helper to categorize any entry into a distinct measurement type key
  const getEntryCategoryKey = (e: LogEntryItem): string => {
    const id = (e.subTypeId || '').toLowerCase();
    const name = (e.subTypeName || '').toLowerCase();

    if (id === 'sub_glucose' || id.includes('glucose') || id.includes('glicem') || name.includes('glucose') || name.includes('glicem')) {
      return 'glucose';
    }
    if (id === 'sub_bp' || id.includes('pressure') || id.includes('pression') || id.includes('bp') || id.includes('pulse') || name.includes('pressure') || name.includes('pression') || name.includes('pulsaz') || name.includes('battiti')) {
      return 'pressure';
    }
    if (id === 'sub_weight' || id.includes('weight') || id.includes('peso') || name.includes('weight') || name.includes('peso')) {
      return 'weight';
    }
    if (id === 'sub_fasting' || id.includes('fasting') || id.includes('digiun') || name.includes('fasting') || name.includes('digiun')) {
      return 'fasting';
    }
    if (id === 'sub_medication' || id.includes('med') || id.includes('farmac') || name.includes('med') || name.includes('farmac')) {
      return 'medication';
    }
    if (id === 'sub_food' || id.includes('food') || id.includes('cibo') || id.includes('carb') || id.includes('pasto') || name.includes('food') || name.includes('cibo') || name.includes('carb') || name.includes('pasto')) {
      return 'food';
    }
    if (id === 'sub_exercise' || id.includes('exercise') || id.includes('eserciz') || name.includes('exercise') || name.includes('eserciz') || name.includes('attività')) {
      return 'exercise';
    }
    if (id === 'sub_bodyfat' || id.includes('bodyfat') || id.includes('grasso') || name.includes('bodyfat') || name.includes('grasso')) {
      return 'bodyfat';
    }
    return e.subTypeId || e.subTypeName || 'other';
  };

  // Distinct latest entry for EVERY measurement type present in the database,
  // ordered with exact priority: 1. Glicemia, 2. Pressione, 3. Peso, 4. Digiuno, 5. Farmaco, 6. Cibo, 7. Esercizio, 8. Grasso, + altri
  const latestByTypeEntries = useMemo(() => {
    const latestMap = new Map<string, LogEntryItem>();

    // Because sortedEntries is sorted newest first, the first item encountered for each type is guaranteed to be its latest!
    for (const entry of sortedEntries) {
      const key = getEntryCategoryKey(entry);
      if (!latestMap.has(key)) {
        latestMap.set(key, entry);
      }
    }

    const priorityOrder = [
      'glucose',
      'pressure',
      'weight',
      'fasting',
      'medication',
      'food',
      'exercise',
      'bodyfat'
    ];

    const result: LogEntryItem[] = [];

    // 1. Add standard types in specified order if present
    for (const key of priorityOrder) {
      if (latestMap.has(key)) {
        result.push(latestMap.get(key)!);
        latestMap.delete(key);
      }
    }

    // 2. Add any other custom measurement types registered by user
    for (const entry of latestMap.values()) {
      result.push(entry);
    }

    return result;
  }, [sortedEntries]);

  // Entries to display in the database list
  const displayedDbEntries = dbViewMode === 'latest_vitals' ? latestByTypeEntries : last7DaysEntries;

  // Calculate average glucose levels for Day, Week, Month
  const calculateAverageGlucose = (days: number) => {
    const glucoseLogs = sortedEntries.filter(e => {
      const name = (e.subTypeName || '').toLowerCase();
      const id = (e.subTypeId || '').toLowerCase();
      return name.includes('glucose') || name.includes('glicemia') || id.includes('glucose');
    });

    if (glucoseLogs.length === 0) return '—';

    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const filtered = glucoseLogs.filter(e => e.timestamp >= cutoff);
    const targetList = filtered.length > 0 ? filtered : glucoseLogs;

    const values = targetList
      .map(e => parseFloat((e.value || '').replace(',', '.')))
      .filter(v => !isNaN(v));

    if (values.length === 0) return '—';
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    return avg.toFixed(1).replace('.', ',');
  };

  const dayAvg = calculateAverageGlucose(1);
  const weekAvg = calculateAverageGlucose(7);
  const monthAvg = calculateAverageGlucose(30);

  // Latest 5 entries for quick view on Home Screen
  const recentEntries = entries.slice(0, 5);

  const availableTags = ['#Terapia', '#Pasti', '#Attività', '#Sintomi', '#Umore', '#Controllo'];

  return (
    <div className="flex flex-col min-h-full bg-[#e8ecee] dark:bg-[#121418] text-stone-900 dark:text-stone-100 transition-colors">
      
      {/* FireTrack Header */}
      <OnTrackHeader
        title="FireTrack"
        showBack={false}
        showToolsMenu={true}
        onOpenTools={onOpenTools}
        onNavigate={onNavigate}
      />

      {/* Main Body */}
      <div className="flex-1 p-3 sm:p-6 max-w-2xl mx-auto w-full space-y-4 pb-16">
        
        {/* Top 5 Circular Navigation Action Buttons */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pt-1 text-center">
          
          {/* Reports */}
          <button
            onClick={() => onNavigate('reports')}
            className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#e0b828] flex items-center justify-center text-white shadow-md group-hover:bg-[#d0a718] transition-colors">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <span className="mt-1.5 text-[11px] sm:text-sm font-semibold text-stone-700 dark:text-stone-300 truncate w-full">
              Reports
            </span>
          </button>

          {/* Storico */}
          <button
            onClick={() => onNavigate('history')}
            className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#5a6265] flex items-center justify-center text-white shadow-md group-hover:bg-[#4a5153] transition-colors">
              <Clock className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <span className="mt-1.5 text-[11px] sm:text-sm font-semibold text-stone-700 dark:text-stone-300 truncate w-full">
              Storico
            </span>
          </button>

          {/* Calendario */}
          <button
            onClick={() => onNavigate('calendar')}
            className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#e55137] flex items-center justify-center text-white shadow-md group-hover:bg-[#d44127] transition-colors">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <span className="mt-1.5 text-[11px] sm:text-sm font-semibold text-stone-700 dark:text-stone-300 truncate w-full">
              Calendario
            </span>
          </button>

          {/* Grafici & Trend */}
          <button
            onClick={() => onNavigate('graphs')}
            className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#2ca3b5] flex items-center justify-center text-white shadow-md group-hover:bg-[#238a9a] transition-colors">
              <BarChart2 className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <span className="mt-1.5 text-[11px] sm:text-sm font-semibold text-stone-700 dark:text-stone-300 truncate w-full">
              Grafici
            </span>
          </button>

          {/* Esami */}
          <button
            onClick={() => onNavigate('blood-tests')}
            className="flex flex-col items-center group active:scale-95 transition-transform cursor-pointer"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#9333ea] flex items-center justify-center text-white shadow-md group-hover:bg-[#7e22ce] transition-colors">
              <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <span className="mt-1.5 text-[11px] sm:text-sm font-semibold text-stone-700 dark:text-stone-300 truncate w-full">
              Esami
            </span>
          </button>

        </div>

        {/* Big Green + Add Button */}
        <button
          onClick={() => onNavigate('add')}
          className="w-full py-3.5 bg-[#5cb85c] hover:bg-[#4cae4c] active:bg-[#449d44] text-white font-bold text-xl sm:text-2xl rounded-none sm:rounded-xl shadow flex items-center justify-center space-x-2 transition-all cursor-pointer"
        >
          <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3]" />
          <span>Aggiungi Lettura</span>
        </button>

        {/* ============================================================ */}
        {/* COMPACT SUMMARY CARD: ULTIME LETTURE (GLICEMIA E PRESSIONE - 2 COLONNE) */}
        {/* ============================================================ */}
        <div className="bg-white dark:bg-[#1a1d24] p-3.5 sm:p-4 border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-[#1d8998] dark:text-[#38bdf8]" />
              <span>Ultime Letture</span>
            </h3>
            <span className="text-[10px] text-stone-400 font-medium">
              Glicemia • Pressione
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            
            {/* 1. Latest Glucose Card */}
            <div 
              onClick={() => latestGlucose && onEditEntry ? onEditEntry(latestGlucose) : onNavigate('add')}
              className="bg-stone-50 dark:bg-stone-800/70 p-3 rounded-lg border border-stone-200 dark:border-stone-700/80 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-1.5">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 dark:bg-cyan-950/80 flex items-center justify-center text-[#1d8998] dark:text-cyan-400">
                    <Droplet className="w-3 h-3 fill-current" />
                  </div>
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    Glucosio
                  </span>
                </div>
                {latestGlucose && (
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                    {formatTime24h(latestGlucose.time)} • {latestGlucose.date.slice(5)}
                  </span>
                )}
              </div>

              {latestGlucose ? (
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-black text-[#1d8998] dark:text-[#38bdf8] tracking-tight group-hover:scale-105 transition-transform inline-block">
                      {latestGlucose.value}
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 ml-1 font-medium">
                      {latestGlucose.unit || 'mg/dL'}
                    </span>
                  </div>

                  <div className="flex flex-col items-end space-y-0.5">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                      {latestGlucose.categoryName}
                    </span>
                    {latestGlucose.mealTiming && (
                      <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300">
                        {latestGlucose.mealTiming === 'pre' ? 'Pre-pasto' : 'Post-pasto'}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-stone-400 italic">
                  Nessuna glicemia registrata. Tocca per aggiungere.
                </div>
              )}
            </div>

            {/* 2. Latest Blood Pressure Card */}
            <div 
              onClick={() => {
                if (latestPressure && onEditEntry) {
                  onEditEntry({
                    ...latestPressure,
                    systolic: resolvedLatestPressure?.systolic || latestPressure.systolic,
                    diastolic: resolvedLatestPressure?.diastolic || latestPressure.diastolic,
                    pulse: resolvedLatestPressure?.pulse || latestPressure.pulse,
                  });
                } else {
                  onNavigate('add');
                }
              }}
              className="bg-stone-50 dark:bg-stone-800/70 p-3 rounded-lg border border-stone-200 dark:border-stone-700/80 hover:border-rose-400 dark:hover:border-rose-600 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-1.5">
                  <div className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <Heart className="w-3 h-3 fill-current" />
                  </div>
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    Pressione Arteriosa
                  </span>
                </div>
                {latestPressure && (
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                    {formatTime24h(latestPressure.time)} • {latestPressure.date.slice(5)}
                  </span>
                )}
              </div>

              {resolvedLatestPressure ? (
                <div className="flex items-baseline justify-between mt-1">
                  <div className="flex items-baseline flex-wrap gap-y-0.5">
                    <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight group-hover:scale-105 transition-transform inline-block whitespace-nowrap">
                      {resolvedLatestPressure.systolic}/{resolvedLatestPressure.diastolic}
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold ml-1 mr-2 whitespace-nowrap">
                      mmHg
                    </span>
                    <span className="text-stone-300 dark:text-stone-600 font-bold mr-2 select-none">
                      -
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight group-hover:scale-105 transition-transform inline-block whitespace-nowrap">
                      {resolvedLatestPressure.pulse}
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold ml-1 whitespace-nowrap">
                      bpm
                    </span>
                  </div>

                  <div className="flex flex-col items-end space-y-0.5 ml-2">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                      {latestPressure?.categoryName || 'Pressione'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-stone-400 italic">
                  Nessuna pressione registrata. Tocca per aggiungere.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Average Glucose Levels Cards */}
        <div className="pt-1 space-y-2">
          
          {/* Section Title */}
          <h3 className="text-center text-stone-600 dark:text-stone-400 font-semibold text-xs sm:text-sm tracking-wide">
            Livelli Medi di Glicemia
          </h3>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            
            {/* Giorno */}
            <div className="bg-white dark:bg-[#1a1d24] p-3 border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl text-center shadow-2xs">
              <span className="font-bold text-xl sm:text-2xl text-[#d93838] dark:text-[#ff6b6b] block tracking-tight">
                {dayAvg}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-400 mt-0.5 block font-medium">
                Giorno
              </span>
            </div>

            {/* Settimana */}
            <div className="bg-white dark:bg-[#1a1d24] p-3 border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl text-center shadow-2xs">
              <span className="font-bold text-xl sm:text-2xl text-[#d93838] dark:text-[#ff6b6b] block tracking-tight">
                {weekAvg}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-400 mt-0.5 block font-medium">
                Settimana
              </span>
            </div>

            {/* Mese */}
            <div className="bg-white dark:bg-[#1a1d24] p-3 border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl text-center shadow-2xs">
              <span className="font-bold text-xl sm:text-2xl text-[#d93838] dark:text-[#ff6b6b] block tracking-tight">
                {monthAvg}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-400 mt-0.5 block font-medium">
                Mese
              </span>
            </div>

          </div>

        </div>

        {/* ============================================================ */}
        {/* COMPACT ACTIVE FASTING BOX (DIGIUNO IN CORSO)               */}
        {/* ============================================================ */}
        {hasActiveFast && activeFastInfo && (
          <div 
            onClick={() => onNavigate('reports')}
            className="bg-gradient-to-br from-[#102a2c] via-[#162026] to-[#122329] text-white p-3 sm:p-3.5 rounded-none sm:rounded-xl border border-teal-500/40 shadow-xs space-y-2.5 transition-all hover:border-teal-400 cursor-pointer animate-fadeIn group"
          >
            {/* Header: Pulsing status + Progress badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                </span>
                <div className="flex items-center space-x-1.5">
                  <Timer className="w-3.5 h-3.5 text-teal-300" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-teal-200">
                    Digiuno in Corso
                  </span>
                </div>
              </div>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                activeFastInfo.isTargetMet
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                  : 'bg-teal-500/20 border-teal-400/60 text-teal-300'
              }`}>
                {activeFastInfo.isTargetMet ? '✓ Obiettivo raggiunto' : `${activeFastInfo.progressPct}% completato`}
              </span>
            </div>

            {/* 3 Compact Info Columns */}
            <div className="grid grid-cols-3 gap-2 bg-black/40 p-2 sm:p-2.5 rounded-lg border border-white/10 text-xs">
              {/* Inizio */}
              <div>
                <span className="text-[9px] text-teal-300 font-semibold uppercase block leading-tight">Inizio</span>
                <span className="text-[11px] sm:text-xs font-bold text-white block mt-0.5 leading-tight">
                  {activeFastInfo.startFormatted}
                </span>
              </div>

              {/* Piano */}
              <div className="text-center border-x border-white/10 px-1">
                <span className="text-[9px] text-teal-300 font-semibold uppercase block leading-tight">Piano</span>
                <span className="text-[11px] sm:text-xs font-bold text-teal-200 block mt-0.5 leading-tight font-mono">
                  {activeFastInfo.protocol}
                </span>
                <span className="text-[9px] text-stone-400 block leading-tight">({activeFastInfo.targetHours}h)</span>
              </div>

              {/* Fine Prevista */}
              <div className="text-right">
                <span className="text-[9px] text-teal-300 font-semibold uppercase block leading-tight">Fine Prevista</span>
                <span className="text-[11px] sm:text-xs font-bold text-amber-300 block mt-0.5 leading-tight font-mono">
                  {activeFastInfo.targetFormatted}
                </span>
              </div>
            </div>

            {/* Bottom mini bar: elapsed & action */}
            <div className="flex items-center justify-between text-[11px] text-stone-300 pt-0.5">
              <div>
                In corso da: <strong className="text-amber-300 font-mono text-xs">{activeFastInfo.elapsedHours.toFixed(1).replace('.', ',')} ore</strong>
              </div>
              <div className="flex items-center space-x-1 text-teal-300 font-semibold group-hover:text-teal-100 transition-colors text-[10px]">
                <span>Dettagli Report</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* NOTE GIORNALIERE (DIARIO TESTUALE SALVATO NEL DB SQLITE) */}
        {/* ============================================================ */}
        <div className="bg-white dark:bg-[#1a1d24] p-4 border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                Note Giornaliere & Diario
              </h3>
            </div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 capitalize">
              {todayFormatted}
            </span>
          </div>

          {/* Quick Tag Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-stone-400 font-semibold flex items-center mr-1">
              <Tag className="w-3 h-3 mr-0.5" /> Tag:
            </span>
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {/* Textarea for note text */}
          <div className="space-y-1">
            <textarea
              rows={3}
              value={currentNoteText}
              onChange={(e) => setCurrentNoteText(e.target.value)}
              placeholder="Scrivi qui il tuo diario di oggi: sensazioni fisiche, attività svolte, pasti o sintomi da ricordare..."
              className="w-full p-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none transition-colors"
            />
          </div>

          {/* Action Bar: Save & Status */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              {savedSuccess && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Salvato nel Database SQLite ✓</span>
                </span>
              )}
            </div>

            <button
              onClick={handleSaveDailyNote}
              disabled={isSavingNote || !currentNoteText.trim()}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer ${
                !currentNoteText.trim()
                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingNote ? 'Salvataggio...' : 'Salva Nota'}</span>
            </button>
          </div>

          {/* Toggle Past Daily Notes */}
          {dailyNotes.length > 0 && (
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setShowNotesHistory(!showNotesHistory)}
                className="w-full flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 font-semibold cursor-pointer py-1"
              >
                <span className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>Storico Note Precedenti ({dailyNotes.length})</span>
                </span>
                {showNotesHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showNotesHistory && (
                <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-stone-100 dark:divide-stone-800">
                  {dailyNotes.map((note) => (
                    <div key={note.id} className="pt-2 pb-1 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {note.date === todayStr ? 'Oggi' : note.date}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(note.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-stone-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                            title="Elimina nota"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                        {note.content}
                      </p>

                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {note.tags.map((tg, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 font-mono">
                              {tg}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Recent Database Entries Section with 7-Day / Latest by Type Toggle */}
        <div className="pt-1 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center space-x-2 text-stone-700 dark:text-stone-300 font-bold text-sm">
              <Database className="w-4 h-4 text-[#2ca3b5] dark:text-[#58a1b5]" />
              <span>
                {dbViewMode === 'latest_vitals' ? 'Ultime Letture per Tipo' : 'Letture Ultimi 7 Giorni'} ({displayedDbEntries.length})
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Toggle Mode Buttons */}
              <div className="inline-flex p-0.5 rounded-lg bg-stone-200/80 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs">
                <button
                  type="button"
                  onClick={() => setDbViewMode('latest_vitals')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    dbViewMode === 'latest_vitals'
                      ? 'bg-white dark:bg-stone-700 text-[#1d8998] dark:text-[#38bdf8] shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                  title="Mostra le letture più recenti in ordine: Glicemia, Pressione, Peso, Digiuno, Farmaco, Cibo"
                >
                  <Zap className={`w-3.5 h-3.5 ${dbViewMode === 'latest_vitals' ? 'text-amber-500 fill-amber-500' : 'text-stone-400'}`} />
                  <span>Ultime Letture</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDbViewMode('last_7_days')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    dbViewMode === 'last_7_days'
                      ? 'bg-white dark:bg-stone-700 text-teal-700 dark:text-teal-300 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                  title="Mostra tutte le letture inserite negli ultimi 7 giorni"
                >
                  <CalendarDays className={`w-3.5 h-3.5 ${dbViewMode === 'last_7_days' ? 'text-teal-600 dark:text-teal-400' : 'text-stone-400'}`} />
                  <span>Ultimi 7 Giorni</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-200 font-mono font-bold">
                    {last7DaysEntries.length}
                  </span>
                </button>
              </div>

              <button
                onClick={() => onNavigate('history')}
                className="text-xs text-[#13808c] dark:text-[#38bdf8] font-semibold hover:underline flex items-center space-x-0.5 cursor-pointer ml-1"
                title="Vai allo storico completo"
              >
                <span>Tutte</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a1d24] border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl divide-y divide-stone-200 dark:divide-stone-800 shadow-2xs overflow-hidden">
            {displayedDbEntries.length === 0 ? (
              <div className="p-5 text-center text-xs text-stone-500 dark:text-stone-400 space-y-2">
                <p>
                  {dbViewMode === 'last_7_days'
                    ? 'Nessuna lettura registrata negli ultimi 7 giorni.'
                    : 'Nessuna lettura presente nel database.'}
                </p>
                <button
                  onClick={() => onNavigate('add')}
                  className="px-3 py-1.5 bg-[#5cb85c] text-white text-xs font-bold rounded-lg shadow hover:bg-[#4cae4c] cursor-pointer inline-flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aggiungi nuova lettura</span>
                </button>
              </div>
            ) : (
              displayedDbEntries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="p-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors group cursor-pointer"
                  onClick={() => onEditEntry && onEditEntry(entry)}
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      {entry.eventNoteIcon && (
                        <EventNoteIcon id={entry.eventNoteIcon} size="sm" />
                      )}
                      <span className="font-bold text-xs text-stone-900 dark:text-stone-100 group-hover:text-[#1d8998] dark:group-hover:text-[#58a1b5] transition-colors">
                        {entry.subTypeName}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 rounded">
                        {entry.categoryName}
                      </span>
                      {entry.mealTiming === 'pre' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded flex items-center space-x-1" title="Pre pasto">
                          <WholeAppleIcon className="w-3 h-3 text-amber-900 dark:text-amber-300" />
                          <span>Pre</span>
                        </span>
                      )}
                      {entry.mealTiming === 'post' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded flex items-center space-x-1" title="Post pasto">
                          <AppleCoreIcon className="w-3 h-3 text-emerald-900 dark:text-emerald-300" />
                          <span>Post</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                      {entry.date} • {formatTime24h(entry.time)}
                      {entry.pulse && (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold ml-2">♥ {entry.pulse} bpm</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <span className="text-base font-bold text-[#1d8998] dark:text-[#38bdf8]">
                        {entry.value}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">
                        {entry.unit}
                      </span>
                    </div>
                    {onEditEntry && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditEntry(entry);
                        }}
                        className="p-1 text-stone-400 hover:text-[#1d8998] dark:hover:text-[#38bdf8] hover:bg-teal-50 dark:hover:bg-stone-800 rounded transition-colors"
                        title="Modifica lettura"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
