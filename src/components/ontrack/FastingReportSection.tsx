import React, { useState, useEffect, useMemo } from 'react';
import { LogEntryItem, ActiveFastingSession, SavedFastingRecord } from '../../types/ontrack';
import {
  Timer,
  Flame,
  Sparkles,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  Award,
  Calendar,
  CalendarRange,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  Info,
  Layers,
  HeartPulse,
  Pencil,
  Play,
  Square,
  RefreshCw,
  RotateCcw,
  Dna,
  ShieldCheck,
  Activity,
  Plus,
  Check,
  ArrowRight,
  X
} from 'lucide-react';
import {
  downloadFastingCSV,
  loadActiveFasting,
  saveActiveFasting,
  getDefaultActiveFasting,
  loadSavedFastings,
  saveSavedFastings,
  addSavedFastingRecord
} from '../../utils/ontrackStorage';
import {
  findNearbyGlucoseForFasting,
  getLocalDateString,
  getLocalTimeString,
  getLocalDateAndTimeString,
  format24hTime,
  FASTING_PLANS,
  parsePlanTargetHours
} from '../../utils/fastingHelpers';

export interface FastingReportEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  targetHours: number;
  protocol: string; // '16:8' | '18:6' | '20:4' | 'OMAD' | '12:12' | 'Custom'
  status: 'completed' | 'in_progress' | 'interrupted';
  metabolicStage: 'glycogen' | 'fat_burn' | 'ketosis' | 'autophagy';
  startingGlucose?: number;
  endingGlucose?: number;
  energyRating?: number; // 1 to 5
  note?: string;
  rawEntry?: LogEntryItem;
}

export interface FastingLevelDefinition {
  level: number;
  title: string;
  minHours: number;
  maxHours: number;
  rangeLabel: string;
  description: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  barColor: string;
}

export const FASTING_METABOLIC_LEVELS: FastingLevelDefinition[] = [
  {
    level: 1,
    title: 'Aumento della glicemia',
    minHours: 0,
    maxHours: 2,
    rangeLabel: '0h - 2h',
    description: "Nelle prime ore di digiuno il corpo degrada il glicogeno. La glicemia sale e il pancreas rilascia insulina per scomporre il glucosio in energia, immagazzinando l'eccesso.",
    badgeBg: 'bg-blue-500/15 dark:bg-blue-950/40',
    badgeBorder: 'border-blue-400/40 dark:border-blue-800',
    textColor: 'text-blue-600 dark:text-blue-400',
    barColor: '#3b82f6'
  },
  {
    level: 2,
    title: 'Calo della glicemia',
    minHours: 2,
    maxHours: 5,
    rangeLabel: '2h - 5h',
    description: "La glicemia torna a valori normali dopo il picco. L'insulina viene trasferita nel sistema circolatorio e i livelli non continuano a salire.",
    badgeBg: 'bg-sky-500/15 dark:bg-sky-950/40',
    badgeBorder: 'border-sky-400/40 dark:border-sky-800',
    textColor: 'text-sky-600 dark:text-sky-400',
    barColor: '#0ea5e9'
  },
  {
    level: 3,
    title: 'La glicemia torna normale',
    minHours: 5,
    maxHours: 8,
    rangeLabel: '5h - 8h',
    description: "La glicemia si stabilizza. Lo stomaco segnala la fame ma non è fame vera. Il corpo utilizza il glucosio immagazzinato e continua a funzionare normalmente.",
    badgeBg: 'bg-cyan-500/15 dark:bg-cyan-950/40',
    badgeBorder: 'border-cyan-400/40 dark:border-cyan-800',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    barColor: '#06b6d4'
  },
  {
    level: 4,
    title: 'Passaggio alla modalità digiuno',
    minHours: 8,
    maxHours: 10,
    rangeLabel: '8h - 10h',
    description: "Il fegato esaurisce le riserve di glucosio. Il corpo entra in gluconeogenesi: produce glucosio dal grasso corporeo invece che dai carboidrati. Il consumo calorico aumenta.",
    badgeBg: 'bg-teal-500/15 dark:bg-teal-950/40',
    badgeBorder: 'border-teal-400/40 dark:border-teal-800',
    textColor: 'text-teal-600 dark:text-teal-400',
    barColor: '#14b8a6'
  },
  {
    level: 5,
    title: 'Combustione dei grassi (poco glicogeno)',
    minHours: 10,
    maxHours: 12,
    rangeLabel: '10h - 12h',
    description: "Le riserve di glicogeno sono quasi esaurite. Le cellule adipose rilasciano grasso nel sangue che va al fegato per essere convertito in energia.",
    badgeBg: 'bg-emerald-500/15 dark:bg-emerald-950/40',
    badgeBorder: 'border-emerald-400/40 dark:border-emerald-800',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    barColor: '#10b981'
  },
  {
    level: 6,
    title: 'Stato di chetosi',
    minHours: 12,
    maxHours: 18,
    rangeLabel: '12h - 18h',
    description: "Il corpo brucia grassi come carburante. Il fegato converte il grasso in chetoni, una fonte energetica alternativa. La chetosi riduce l'infiammazione e fa bene a cuore, metabolismo e cervello.",
    badgeBg: 'bg-amber-500/15 dark:bg-amber-950/40',
    badgeBorder: 'border-amber-400/40 dark:border-amber-800',
    textColor: 'text-amber-600 dark:text-amber-400',
    barColor: '#f59e0b'
  },
  {
    level: 7,
    title: 'Modalità bruciagrassi',
    minHours: 18,
    maxHours: 24,
    rangeLabel: '18h - 24h',
    description: "Più il digiuno si allunga, più la chetosi si intensifica. Dopo 18 ore, l'energia derivante dal grasso aumenta del 60%. I chetoni regolano il metabolismo e attivano processi anti-infiammatori.",
    badgeBg: 'bg-orange-500/15 dark:bg-orange-950/40',
    badgeBorder: 'border-orange-400/40 dark:border-orange-800',
    textColor: 'text-orange-600 dark:text-orange-400',
    barColor: '#f97316'
  },
  {
    level: 8,
    title: 'Autofagia',
    minHours: 24,
    maxHours: 48,
    rangeLabel: '24h - 48h',
    description: "Il corpo avvia l'autofagia: le cellule fanno pulizia eliminando componenti inutili e danneggiati. Virus e batteri vengono scomposti e riciclati. È un processo di ringiovanimento cellulare.",
    badgeBg: 'bg-purple-500/15 dark:bg-purple-950/40',
    badgeBorder: 'border-purple-400/40 dark:border-purple-800',
    textColor: 'text-purple-600 dark:text-purple-400',
    barColor: '#9333ea'
  },
  {
    level: 9,
    title: 'Ormone della crescita',
    minHours: 48,
    maxHours: 56,
    rangeLabel: '48h - 56h',
    description: "L'ormone della crescita aumenta molto. Favorisce la produzione di chetoni, riduce la fame, aumenta la massa muscolare e migliora la salute cardiovascolare.",
    badgeBg: 'bg-fuchsia-500/15 dark:bg-fuchsia-950/40',
    badgeBorder: 'border-fuchsia-400/40 dark:border-fuchsia-800',
    textColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    barColor: '#c026d3'
  },
  {
    level: 10,
    title: "Sensibilità all'insulina",
    minHours: 56,
    maxHours: 72,
    rangeLabel: '56h - 72h',
    description: "L'insulina raggiunge il livello più basso del digiuno. Questo aumenta la sensibilità all'insulina, attiva l'autofagia e riduce l'infiammazione.",
    badgeBg: 'bg-pink-500/15 dark:bg-pink-950/40',
    badgeBorder: 'border-pink-400/40 dark:border-pink-800',
    textColor: 'text-pink-600 dark:text-pink-400',
    barColor: '#db2777'
  },
  {
    level: 11,
    title: 'Rigenerazione del sistema immunitario',
    minHours: 72,
    maxHours: 9999,
    rangeLabel: '≥ 72h',
    description: "Il corpo ricicla le cellule immunitarie danneggiate e ne rigenera di nuove. Il sistema immunitario si rinnova e diventa più forte.",
    badgeBg: 'bg-rose-500/15 dark:bg-rose-950/40',
    badgeBorder: 'border-rose-400/40 dark:border-rose-800',
    textColor: 'text-rose-600 dark:text-rose-400',
    barColor: '#e11d48'
  }
];

interface FastingReportSectionProps {
  entries: LogEntryItem[];
  allEntries?: LogEntryItem[];
  periodLabel: string;
  periodRangeLabel: string;
  patientName: string;
  selectedPeriod?: number | 'all';
  setSelectedPeriod?: (period: number | 'all') => void;
  selectedYear?: string;
  setSelectedYear?: (year: string) => void;
  selectedMonth?: string;
  setSelectedMonth?: (month: string) => void;
  onEditEntry?: (entry: LogEntryItem) => void;
}

const MONTH_NAMES: { [key: string]: string } = {
  '01': 'Gennaio',
  '02': 'Febbraio',
  '03': 'Marzo',
  '04': 'Aprile',
  '05': 'Maggio',
  '06': 'Giugno',
  '07': 'Luglio',
  '08': 'Agosto',
  '09': 'Settembre',
  '10': 'Ottobre',
  '11': 'Novembre',
  '12': 'Dicembre'
};

export const FastingReportSection: React.FC<FastingReportSectionProps> = ({
  entries,
  allEntries = [],
  periodLabel: propPeriodLabel,
  periodRangeLabel: propPeriodRangeLabel,
  patientName,
  selectedPeriod: propSelectedPeriod,
  setSelectedPeriod: propSetSelectedPeriod,
  selectedYear: propSelectedYear,
  setSelectedYear: propSetSelectedYear,
  selectedMonth: propSelectedMonth,
  setSelectedMonth: propSetSelectedMonth,
  onEditEntry
}) => {
  // Local state fallbacks if not controlled from parent
  const [localPeriod, setLocalPeriod] = useState<number | 'all'>(7);
  const [localYear, setLocalYear] = useState<string>('ALL');
  const [localMonth, setLocalMonth] = useState<string>('ALL');

  const selectedPeriod = propSelectedPeriod !== undefined ? propSelectedPeriod : localPeriod;
  const setSelectedPeriod = propSetSelectedPeriod || setLocalPeriod;

  const selectedYear = propSelectedYear !== undefined ? propSelectedYear : localYear;
  const setSelectedYear = propSetSelectedYear || setLocalYear;

  const selectedMonth = propSelectedMonth !== undefined ? propSelectedMonth : localMonth;
  const setSelectedMonth = propSetSelectedMonth || setLocalMonth;

  const [selectedProtocolFilter, setSelectedProtocolFilter] = useState<string>('ALL');
  const [activeFasting, setActiveFasting] = useState<ActiveFastingSession>(loadActiveFasting());
  const [savedFastings, setSavedFastings] = useState<SavedFastingRecord[]>(() => loadSavedFastings());
  const [showAllLevels, setShowAllLevels] = useState<boolean>(false);
  const [showActiveEditor, setShowActiveEditor] = useState<boolean>(false);
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [finishDate, setFinishDate] = useState<string>(() => getLocalDateString());
  const [finishTime, setFinishTime] = useState<string>(() => getLocalTimeString());
  const [finishGlucose, setFinishGlucose] = useState<string>('84');
  const [finishNote, setFinishNote] = useState<string>('Digiuno completato regolarmente. Ottima lucidità mentale e senso di benessere.');
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // Edit / Add Fasting form state (with separate date and time pickers)
  const [editStartDate, setEditStartDate] = useState<string>(() => {
    if (activeFasting?.startTime) return getLocalDateString(activeFasting.startTime);
    return getLocalDateString();
  });
  const [editStartTime, setEditStartTime] = useState<string>(() => {
    if (activeFasting?.startTime) return getLocalTimeString(activeFasting.startTime);
    return '20:00';
  });
  const [editProtocol, setEditProtocol] = useState<string>(activeFasting.protocol || '16:8');
  const [editTargetHours, setEditTargetHours] = useState<number>(activeFasting.targetHours || 16);
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  const [editIsInProgress, setEditIsInProgress] = useState<boolean>(true);
  const [editStartingGlucose, setEditStartingGlucose] = useState<string>(activeFasting.startingGlucose ? String(activeFasting.startingGlucose) : '135');
  const [editEndingGlucose, setEditEndingGlucose] = useState<string>('84');
  const [editNote, setEditNote] = useState<string>(activeFasting.note || '');

  // Live timer tick every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync editor fields when active fasting changes
  useEffect(() => {
    if (activeFasting && activeFasting.startTime) {
      setEditStartDate(getLocalDateString(activeFasting.startTime));
      setEditStartTime(getLocalTimeString(activeFasting.startTime));
      setEditProtocol(activeFasting.protocol || '16:8');
      setEditTargetHours(activeFasting.targetHours || 16);
      setEditStartingGlucose(activeFasting.startingGlucose ? String(activeFasting.startingGlucose) : '135');
      setEditNote(activeFasting.note || '');
    }
  }, [activeFasting]);

  // Dynamic calculations for Finish Modal based on selected finishDate and finishTime
  const finishCalculations = useMemo(() => {
    if (!activeFasting || !activeFasting.startTime) return null;
    const startMs = new Date(activeFasting.startTime).getTime();
    if (isNaN(startMs)) return null;

    const fDate = finishDate || getLocalDateString();
    const fTime = finishTime || '12:00';
    const endStr = `${fDate}T${fTime}:00`;
    const endMs = new Date(endStr).getTime();
    if (isNaN(endMs)) return null;

    const diffMs = Math.max(0, endMs - startMs);
    const elapsedHours = diffMs / (1000 * 60 * 60);
    const targetHours = activeFasting.targetHours || 16;
    const isTargetMet = elapsedHours >= targetHours;

    const currentLevel = FASTING_METABOLIC_LEVELS.find(
      lvl => elapsedHours >= lvl.minHours && elapsedHours < lvl.maxHours
    ) || FASTING_METABOLIC_LEVELS[FASTING_METABOLIC_LEVELS.length - 1];

    return {
      startMs,
      endMs,
      elapsedHours,
      targetHours,
      isTargetMet,
      currentLevel
    };
  }, [activeFasting, finishDate, finishTime]);

  // Dynamic calculations for Editor Modal
  const editorCalculations = useMemo(() => {
    if (!editStartDate || !editStartTime) return null;
    const startStr = `${editStartDate}T${editStartTime}:00`;
    const startMs = new Date(startStr).getTime();
    if (isNaN(startMs)) return null;

    if (editIsInProgress || !editEndDate || !editEndTime) {
      return {
        isInProgress: true,
        startMs,
        durationHours: null,
        metabolicStage: null,
        level: null
      };
    }

    const endStr = `${editEndDate}T${editEndTime}:00`;
    const endMs = new Date(endStr).getTime();
    if (isNaN(endMs) || endMs <= startMs) {
      return {
        isInProgress: false,
        startMs,
        endMs: startMs,
        durationHours: 0,
        metabolicStage: 'glycogen' as const,
        level: FASTING_METABOLIC_LEVELS[0]
      };
    }

    const diffHours = (endMs - startMs) / (1000 * 60 * 60);
    let stage: FastingReportEntry['metabolicStage'] = 'glycogen';
    if (diffHours >= 22) stage = 'autophagy';
    else if (diffHours >= 16) stage = 'ketosis';
    else if (diffHours >= 12) stage = 'fat_burn';

    const level = FASTING_METABOLIC_LEVELS.find(
      lvl => diffHours >= lvl.minHours && diffHours < lvl.maxHours
    ) || FASTING_METABOLIC_LEVELS[FASTING_METABOLIC_LEVELS.length - 1];

    return {
      isInProgress: false,
      startMs,
      endMs,
      durationHours: diffHours,
      metabolicStage: stage,
      level
    };
  }, [editStartDate, editStartTime, editEndDate, editEndTime, editIsInProgress]);

  // Compute Active Fasting dynamic values
  const activeFastingData = useMemo(() => {
    if (!activeFasting || !activeFasting.isActive || !activeFasting.startTime) {
      return null;
    }

    const startMs = new Date(activeFasting.startTime).getTime();
    if (isNaN(startMs)) return null;

    const diffMs = Math.max(0, nowTimestamp - startMs);
    const elapsedHours = diffMs / (1000 * 60 * 60);
    const elapsedMinutesTotal = Math.floor(diffMs / (1000 * 60));
    const hoursPart = Math.floor(elapsedMinutesTotal / 60);
    const minutesPart = elapsedMinutesTotal % 60;
    const secondsPart = Math.floor((diffMs % (1000 * 60)) / 1000);

    const targetHours = activeFasting.targetHours || 16;
    const targetEndMs = startMs + targetHours * 3600 * 1000;
    const targetEndDate = new Date(targetEndMs);

    const remainingMs = targetEndMs - nowTimestamp;
    const isTargetMet = remainingMs <= 0;
    const remainingMinutesTotal = Math.abs(Math.floor(remainingMs / (1000 * 60)));
    const remHoursPart = Math.floor(remainingMinutesTotal / 60);
    const remMinutesPart = remainingMinutesTotal % 60;

    const progressPct = Math.min(100, Math.max(0, (elapsedHours / targetHours) * 100));

    // Determine current metabolic level
    const currentLevel = FASTING_METABOLIC_LEVELS.find(
      lvl => elapsedHours >= lvl.minHours && elapsedHours < lvl.maxHours
    ) || FASTING_METABOLIC_LEVELS[FASTING_METABOLIC_LEVELS.length - 1];

    // Format Start Time readable in 24h format strictly
    const startDate = new Date(startMs);
    const startFormatted = startDate.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const targetFormatted = targetEndDate.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Level progress percentage within its own range
    const lvlSpan = currentLevel.maxHours - currentLevel.minHours;
    const lvlElapsed = Math.max(0, elapsedHours - currentLevel.minHours);
    const lvlProgressPct = currentLevel.maxHours >= 9000
      ? 100
      : Math.min(100, Math.max(0, (lvlElapsed / lvlSpan) * 100));

    return {
      startMs,
      startDate,
      startFormatted,
      targetEndMs,
      targetEndDate,
      targetFormatted,
      elapsedHours,
      hoursPart,
      minutesPart,
      secondsPart,
      targetHours,
      progressPct,
      isTargetMet,
      remHoursPart,
      remMinutesPart,
      currentLevel,
      lvlProgressPct
    };
  }, [activeFasting, nowTimestamp]);

  // Convert raw log entries into fasting sessions or generate realistic parsed sessions
  const rawFastingSessions: FastingReportEntry[] = useMemo(() => {
    // Check if there are explicit entries specifically logged as Fasting (sub_fasting)
    const combinedEntries = allEntries && allEntries.length > 0 ? allEntries : entries;
    const explicitFasting = combinedEntries.filter(e =>
      e.subTypeId === 'sub_fasting' ||
      (e.unit === 'ore' && e.subTypeName?.toLowerCase().includes('digiun'))
    );

    if (explicitFasting.length > 0) {
      return explicitFasting.map((e, idx) => {
        let dur = parseFloat(e.value || '16');
        if (isNaN(dur) || dur <= 0 || dur > 72) dur = 16;

        let protocol = '16:8';
        if (dur >= 22) protocol = 'OMAD (23:1)';
        else if (dur >= 19.5) protocol = '20:4';
        else if (dur >= 17.5) protocol = '18:6';
        else if (dur >= 15) protocol = '16:8';
        else if (dur >= 13.5) protocol = '14:10';
        else if (dur >= 12) protocol = '12:12 (Circadiano)';
        else protocol = 'Personalizzato';

        let stage: FastingReportEntry['metabolicStage'] = 'glycogen';
        if (dur >= 22) stage = 'autophagy';
        else if (dur >= 16) stage = 'ketosis';
        else if (dur >= 12) stage = 'fat_burn';

        return {
          id: e.id || `fast_${idx}`,
          date: e.date,
          startTime: '20:00',
          endTime: e.time || '12:00',
          durationHours: dur,
          targetHours: protocol.startsWith('20') ? 20 : protocol.startsWith('18') ? 18 : protocol.startsWith('OMAD') ? 23 : protocol.startsWith('14') ? 14 : 16,
          protocol,
          status: dur >= 13.5 ? 'completed' : 'interrupted',
          metabolicStage: stage,
          note: e.note || 'Sessione di digiuno intermittente registrata',
          rawEntry: e
        };
      });
    }

    // Default rich sample fasting sessions matching 7 days of fasting (14:10, 16:8, 18:6 e 20:4 al Mercoledì) + extended timeline
    const core7Days = [
      { date: '2026-08-15', start: '20:30', end: '13:00', dur: 16.5, proto: '16:8', target: 16, note: 'Rottura digiuno con insalata di pollo e noci. Ottima energia!', gluStart: 128, gluEnd: 84 },
      { date: '2026-08-14', start: '20:00', end: '10:30', dur: 14.5, proto: '14:10', target: 14, note: 'Split 14:10 (Normale) completato con regolarità e facilità.', gluStart: 132, gluEnd: 88 },
      { date: '2026-08-13', start: '20:00', end: '14:30', dur: 18.5, proto: '18:6', target: 18, note: 'Split 18:6 completato. Glicemia serale pre-digiuno stabile.', gluStart: 138, gluEnd: 82 },
      { date: '2026-08-12', start: '19:30', end: '16:00', dur: 20.5, proto: '20:4', target: 20, note: 'Mercoledì: Digiuno prolungato 20:4 (Guerriero), chetosi avanzata e massima lucidità.', gluStart: 140, gluEnd: 78 },
      { date: '2026-08-11', start: '20:00', end: '12:00', dur: 16.0, proto: '16:8', target: 16, note: 'Pranzo leggero con verdure grigliate e uova sode.', gluStart: 125, gluEnd: 86 },
      { date: '2026-08-10', start: '20:30', end: '10:30', dur: 14.0, proto: '14:10', target: 14, note: 'Inizio settimana con split 14:10 (Normale), idratazione costante.', gluStart: 134, gluEnd: 89 },
      { date: '2026-08-09', start: '19:45', end: '13:45', dur: 18.0, proto: '18:6', target: 18, note: 'Domenica: Split 18:6 completato con ottimo recupero metabolico.', gluStart: 139, gluEnd: 81 }
    ];

    const result: FastingReportEntry[] = [];

    // Core 7 Days
    core7Days.forEach((item, idx) => {
      let stage: FastingReportEntry['metabolicStage'] = 'glycogen';
      if (item.dur >= 22) stage = 'autophagy';
      else if (item.dur >= 16) stage = 'ketosis';
      else if (item.dur >= 12) stage = 'fat_burn';

      result.push({
        id: `fast_core_${idx}`,
        date: item.date,
        startTime: item.start,
        endTime: item.end,
        durationHours: item.dur,
        targetHours: item.target,
        protocol: item.proto,
        status: 'completed',
        metabolicStage: stage,
        startingGlucose: item.gluStart,
        endingGlucose: item.gluEnd,
        energyRating: 5,
        note: item.note
      });
    });

    // Extended history for 14, 30, 60, 90 days and full year filters
    const historyPatterns = [
      { proto: '16:8', dur: 16.5, target: 16, start: '20:00', end: '12:30', gluStart: 130, gluEnd: 85, note: 'Sessione regolare 16:8.' },
      { proto: '14:10', dur: 14.0, target: 14, start: '20:30', end: '10:30', gluStart: 135, gluEnd: 90, note: 'Split 14:10 (Normale).' },
      { proto: '18:6', dur: 18.0, target: 18, start: '20:00', end: '14:00', gluStart: 138, gluEnd: 80, note: 'Split 18:6 con chetosi.' },
      { proto: '20:4', dur: 20.0, target: 20, start: '19:30', end: '15:30', gluStart: 142, gluEnd: 77, note: 'Digiuno 20:4 del guerriero.' },
      { proto: '16:8', dur: 16.0, target: 16, start: '20:00', end: '12:00', gluStart: 128, gluEnd: 86, note: 'Ottima digestione e sonno riposante.' },
      { proto: '14:10', dur: 14.5, target: 14, start: '20:00', end: '10:30', gluStart: 133, gluEnd: 88, note: 'Split 14:10 (Normale).' },
      { proto: '18:6', dur: 18.5, target: 18, start: '19:45', end: '14:15', gluStart: 136, gluEnd: 79, note: '18 ore con camminata mattutina.' }
    ];

    const baseDate = new Date('2026-08-08T12:00:00');
    for (let i = 0; i < 84; i++) {
      const d = new Date(baseDate.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const pat = historyPatterns[i % historyPatterns.length];

      const isWed = d.getDay() === 3;
      const proto = isWed ? '20:4' : pat.proto;
      const dur = isWed ? 20.0 : pat.dur;
      const target = isWed ? 20 : pat.target;

      let stage: FastingReportEntry['metabolicStage'] = 'glycogen';
      if (dur >= 22) stage = 'autophagy';
      else if (dur >= 16) stage = 'ketosis';
      else if (dur >= 12) stage = 'fat_burn';

      result.push({
        id: `fast_hist_${i}`,
        date: dateStr,
        startTime: pat.start,
        endTime: pat.end,
        durationHours: dur,
        targetHours: target,
        protocol: proto,
        status: 'completed',
        metabolicStage: stage,
        startingGlucose: pat.gluStart,
        endingGlucose: pat.gluEnd,
        energyRating: 4,
        note: isWed ? 'Mercoledì: Digiuno 20:4 completato con successo.' : pat.note
      });
    }

    // Previous year 2025 archive entries
    for (let m = 12; m >= 1; m--) {
      const moStr = m < 10 ? `0${m}` : `${m}`;
      result.push({
        id: `fast_2025_${m}`,
        date: `2025-${moStr}-15`,
        startTime: '20:00',
        endTime: '12:00',
        durationHours: 16.0,
        targetHours: 16,
        protocol: '16:8',
        status: 'completed',
        metabolicStage: 'ketosis',
        startingGlucose: 130,
        endingGlucose: 85,
        energyRating: 4,
        note: `Sessione archivio ${moStr}/2025`
      });
    }

    // Prepend user created/completed fastings
    const userSavedEntries: FastingReportEntry[] = (savedFastings || []).map((sf, idx) => {
      const dur = sf.durationHours || 16;
      let stage: FastingReportEntry['metabolicStage'] = 'glycogen';
      if (dur >= 22) stage = 'autophagy';
      else if (dur >= 16) stage = 'ketosis';
      else if (dur >= 12) stage = 'fat_burn';

      return {
        id: sf.id || `fast_user_${idx}`,
        date: sf.endDate || sf.startDate,
        startTime: sf.startTime,
        endTime: sf.endTime || 'In corso',
        durationHours: dur,
        targetHours: sf.targetHours || 16,
        protocol: sf.protocol || '16:8',
        status: sf.isCompleted ? 'completed' : 'in_progress',
        metabolicStage: stage,
        startingGlucose: sf.startingGlucose,
        endingGlucose: sf.endingGlucose,
        energyRating: 5,
        note: sf.note || 'Sessione di digiuno registrata'
      };
    });

    return [...userSavedEntries, ...result];
  }, [allEntries, entries, savedFastings]);

  // Available years
  const availableYearsWithCount = useMemo(() => {
    const counts: { [year: string]: number } = {};
    rawFastingSessions.forEach(s => {
      const yr = s.date.slice(0, 4);
      if (yr) counts[yr] = (counts[yr] || 0) + 1;
    });
    return Object.keys(counts).sort((a, b) => b.localeCompare(a)).map(year => ({
      year,
      count: counts[year]
    }));
  }, [rawFastingSessions]);

  // Available months for selected year
  const availableMonthsWithCount = useMemo(() => {
    if (selectedYear === 'ALL') return [];
    const counts: { [month: string]: number } = {};
    rawFastingSessions.forEach(s => {
      const yr = s.date.slice(0, 4);
      const mo = s.date.slice(5, 7);
      if (yr === selectedYear && mo) {
        counts[mo] = (counts[mo] || 0) + 1;
      }
    });
    return Object.keys(counts).sort((a, b) => a.localeCompare(b)).map(month => ({
      month,
      count: counts[month]
    }));
  }, [rawFastingSessions, selectedYear]);

  const selectedYearTotalCount = useMemo(() => {
    if (selectedYear === 'ALL') return rawFastingSessions.length;
    return availableYearsWithCount.find(y => y.year === selectedYear)?.count || 0;
  }, [availableYearsWithCount, selectedYear, rawFastingSessions.length]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth('ALL');
  };

  const handleResetFilters = () => {
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setSelectedPeriod(7);
    setSelectedProtocolFilter('ALL');
  };

  // Dynamic period labels
  const { currentPeriodLabel, currentPeriodRangeLabel } = useMemo(() => {
    if (selectedYear !== 'ALL') {
      if (selectedMonth !== 'ALL') {
        const mName = MONTH_NAMES[selectedMonth] || selectedMonth;
        return {
          currentPeriodLabel: `${mName} ${selectedYear}`,
          currentPeriodRangeLabel: `Mese di ${mName} ${selectedYear}`
        };
      }
      return {
        currentPeriodLabel: `Anno ${selectedYear}`,
        currentPeriodRangeLabel: `Intero Anno ${selectedYear}`
      };
    }
    if (selectedPeriod === 'all') {
      return {
        currentPeriodLabel: 'Tutto lo storico',
        currentPeriodRangeLabel: `Tutto lo storico (${rawFastingSessions.length} sessioni)`
      };
    }
    return {
      currentPeriodLabel: `${selectedPeriod} giorni`,
      currentPeriodRangeLabel: `Ultimi ${selectedPeriod} giorni`
    };
  }, [selectedYear, selectedMonth, selectedPeriod, rawFastingSessions.length]);

  // Apply Period & Temporal filter
  const periodFilteredSessions = useMemo(() => {
    return rawFastingSessions.filter(s => {
      if (selectedYear !== 'ALL') {
        const yr = s.date.slice(0, 4);
        const mo = s.date.slice(5, 7);
        if (yr !== selectedYear) return false;
        if (selectedMonth !== 'ALL' && mo !== selectedMonth) return false;
        return true;
      }
      if (selectedPeriod === 'all') return true;

      // Filter by days
      const refDateMs = new Date('2026-08-15T23:59:59').getTime();
      const cutoff = refDateMs - (Number(selectedPeriod) * 86400000);
      const sMs = new Date(s.date + 'T23:59:59').getTime();
      return sMs >= cutoff;
    });
  }, [rawFastingSessions, selectedYear, selectedMonth, selectedPeriod]);

  // Filter by selected protocol
  const filteredSessions = useMemo(() => {
    if (selectedProtocolFilter === 'ALL') return periodFilteredSessions;
    return periodFilteredSessions.filter(s => s.protocol.includes(selectedProtocolFilter));
  }, [periodFilteredSessions, selectedProtocolFilter]);

  // Calculate Key Statistics
  const totalSessions = filteredSessions.length;
  const totalFastingHours = filteredSessions.reduce((acc, s) => acc + s.durationHours, 0);
  const avgDurationHours = totalSessions > 0 ? (totalFastingHours / totalSessions) : 0;
  const maxFastingHours = totalSessions > 0 ? Math.max(...filteredSessions.map(s => s.durationHours)) : 0;

  const completedTargetCount = filteredSessions.filter(s => s.durationHours >= s.targetHours || s.status === 'completed').length;
  const adherenceRate = totalSessions > 0 ? Math.round((completedTargetCount / totalSessions) * 100) : 100;

  // Calculate Distinct Completed Days (Giorni totali di digiuno)
  const completedDatesSet = useMemo<Set<string>>(() => {
    return new Set<string>(
      filteredSessions
        .filter(s => s.durationHours >= s.targetHours || s.status === 'completed')
        .map(s => s.date)
    );
  }, [filteredSessions]);

  const totalFastingDays = completedDatesSet.size;

  // Calculate Consecutive Days of Fasting (Streak di giorni consecutivi con conclusione positiva)
  const { currentStreak, longestStreak } = useMemo(() => {
    const sortedDates = (Array.from(completedDatesSet) as string[]).sort();
    if (sortedDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    let maxStreak = 1;
    let tempStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
        }
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }

    return {
      currentStreak: tempStreak,
      longestStreak: maxStreak
    };
  }, [completedDatesSet]);

  // Protocol distribution & Patient's Preferred Protocol
  const protocolCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const key = s.protocol;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [filteredSessions]);

  const topProtocolEntry = useMemo(() => {
    const entries = Object.entries(protocolCounts);
    if (entries.length === 0) return { name: '16:8', count: 0, pct: 100 };
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    const pct = totalSessions > 0 ? Math.round((top[1] / totalSessions) * 100) : 100;
    return { name: top[0], count: top[1], pct };
  }, [protocolCounts, totalSessions]);

  // Stages count
  const autophagyCount = filteredSessions.filter(s => s.durationHours >= 22).length;
  const ketosisCount = filteredSessions.filter(s => s.durationHours >= 16 && s.durationHours < 22).length;
  const fatBurnCount = filteredSessions.filter(s => s.durationHours >= 12 && s.durationHours < 16).length;

  // Average glucose delta if present
  const sessionsWithGlucose = filteredSessions.filter(s => s.startingGlucose && s.endingGlucose);
  const avgStartGlu = sessionsWithGlucose.length > 0
    ? Math.round(sessionsWithGlucose.reduce((a, b) => a + (b.startingGlucose || 0), 0) / sessionsWithGlucose.length)
    : 132;
  const avgEndGlu = sessionsWithGlucose.length > 0
    ? Math.round(sessionsWithGlucose.reduce((a, b) => a + (b.endingGlucose || 0), 0) / sessionsWithGlucose.length)
    : 84;
  const avgDeltaGlu = avgEndGlu - avgStartGlu;

  const handleExportCSVClick = () => {
    downloadFastingCSV(filteredSessions, patientName, currentPeriodLabel);
  };

  // Handlers for Active Fasting
  const openFinishModal = () => {
    const now = new Date();
    const dStr = getLocalDateString(now);
    const tStr = getLocalTimeString(now);
    setFinishDate(dStr);
    setFinishTime(tStr);
    setFinishGlucose('84');
    setShowFinishModal(true);
  };

  const openEditorForNew = () => {
    const now = new Date();
    const dStr = getLocalDateString(now);
    const tStr = getLocalTimeString(now);
    const nearby = findNearbyGlucoseForFasting(allEntries && allEntries.length > 0 ? allEntries : entries, dStr, tStr, 3);
    setEditStartDate(dStr);
    setEditStartTime(tStr);
    setEditProtocol('16:8');
    setEditTargetHours(16);
    setEditEndDate('');
    setEditEndTime('');
    setEditIsInProgress(true);
    setEditStartingGlucose(nearby ? String(nearby.value) : '');
    setEditEndingGlucose('');
    setEditNote('');
    setShowActiveEditor(true);
  };

  const openEditorForEdit = () => {
    if (activeFasting && activeFasting.startTime) {
      const dStr = getLocalDateString(activeFasting.startTime);
      const tStr = getLocalTimeString(activeFasting.startTime);
      const nearby = findNearbyGlucoseForFasting(allEntries && allEntries.length > 0 ? allEntries : entries, dStr, tStr, 3);
      setEditStartDate(dStr);
      setEditStartTime(tStr);
      setEditProtocol(activeFasting.protocol || '16:8');
      setEditTargetHours(activeFasting.targetHours || 16);
      setEditEndDate('');
      setEditEndTime('');
      setEditIsInProgress(true);
      setEditStartingGlucose(
        activeFasting.startingGlucose !== undefined
          ? String(activeFasting.startingGlucose)
          : (nearby ? String(nearby.value) : '')
      );
      setEditEndingGlucose('');
      setEditNote(activeFasting.note || '');
    } else {
      openEditorForNew();
    }
    setShowActiveEditor(true);
  };

  const handleSaveActiveFasting = (e: React.FormEvent) => {
    e.preventDefault();
    const startStr = `${editStartDate || getLocalDateString()}T${editStartTime || '20:00'}:00`;
    const startIso = new Date(startStr).toISOString();

    if (editIsInProgress || !editEndDate || !editEndTime) {
      // In progress fasting session
      const updated: ActiveFastingSession = {
        isActive: true,
        startTime: startIso,
        protocol: editProtocol,
        targetHours: editTargetHours,
        startingGlucose: editStartingGlucose ? parseFloat(editStartingGlucose) : undefined,
        note: editNote
      };
      setActiveFasting(updated);
      saveActiveFasting(updated);
    } else {
      // Completed fasting session
      const endStr = `${editEndDate}T${editEndTime}:00`;
      const startMs = new Date(startStr).getTime();
      const endMs = new Date(endStr).getTime();
      const durHours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));

      const newRecord: SavedFastingRecord = {
        id: `fast_rec_${Date.now()}`,
        startDate: editStartDate,
        startTime: editStartTime,
        endDate: editEndDate,
        endTime: editEndTime,
        protocol: editProtocol,
        targetHours: editTargetHours,
        durationHours: durHours,
        startingGlucose: editStartingGlucose ? parseFloat(editStartingGlucose) : undefined,
        endingGlucose: editEndingGlucose ? parseFloat(editEndingGlucose) : undefined,
        note: editNote || 'Sessione di digiuno registrata.',
        isCompleted: true
      };
      addSavedFastingRecord(newRecord);
      setSavedFastings(loadSavedFastings());

      // If active session was running, mark it inactive
      if (activeFasting.isActive) {
        const ended: ActiveFastingSession = {
          ...activeFasting,
          isActive: false
        };
        setActiveFasting(ended);
        saveActiveFasting(ended);
      }
    }
    setShowActiveEditor(false);
  };

  const handleStartNewFast = () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const dStr = getLocalDateString(now);
    const tStr = getLocalTimeString(now);
    const nearby = findNearbyGlucoseForFasting(allEntries && allEntries.length > 0 ? allEntries : entries, dStr, tStr, 3);
    const newFast: ActiveFastingSession = {
      isActive: true,
      startTime: nowIso,
      protocol: '16:8',
      targetHours: 16,
      startingGlucose: nearby ? nearby.value : undefined,
      note: 'Nuova sessione di digiuno avviata.'
    };
    setActiveFasting(newFast);
    saveActiveFasting(newFast);
    setEditStartDate(dStr);
    setEditStartTime(tStr);
    setEditProtocol('16:8');
    setEditTargetHours(16);
    setEditEndDate('');
    setEditEndTime('');
    setEditIsInProgress(true);
  };

  const handleCompleteActiveFast = () => {
    const startIso = activeFasting.startTime || new Date().toISOString();
    const startDate = getLocalDateString(startIso);
    const startTime = getLocalTimeString(startIso);
    const endStr = `${finishDate || getLocalDateString()}T${finishTime || '12:00'}:00`;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endStr).getTime();
    const durHours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));

    const completedRecord: SavedFastingRecord = {
      id: `fast_rec_${Date.now()}`,
      startDate: startDate,
      startTime: startTime,
      endDate: finishDate,
      endTime: finishTime,
      protocol: activeFasting.protocol || '16:8',
      targetHours: activeFasting.targetHours || 16,
      durationHours: durHours,
      startingGlucose: activeFasting.startingGlucose,
      endingGlucose: finishGlucose ? parseFloat(finishGlucose) : undefined,
      note: finishNote || 'Sessione di digiuno completata regolarmente.',
      isCompleted: true
    };

    addSavedFastingRecord(completedRecord);
    setSavedFastings(loadSavedFastings());

    // Deactivate fast in storage
    const ended: ActiveFastingSession = {
      ...activeFasting,
      isActive: false
    };
    setActiveFasting(ended);
    saveActiveFasting(ended);
    setShowFinishModal(false);
  };

  return (
    <div data-pdf-section="true" data-pdf-orientation="portrait" className="space-y-6 text-white print:text-stone-900">

      {/* Report Header Card */}
      <div className="bg-gradient-to-r from-[#1c2938] via-[#243447] to-[#1a2330] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-stone-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-300 flex items-center justify-center shadow-inner shrink-0">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Report Digiuno Intermittente
              </h2>
              <p className="text-xs text-stone-300 mt-0.5">
                Utente: <strong className="text-white">{patientName}</strong> • Periodo: <strong className="text-teal-200">{currentPeriodLabel}</strong> ({currentPeriodRangeLabel})
              </p>
            </div>
          </div>

          {/* Quick Filter Protocol Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/10 self-start sm:self-auto">
            {['ALL', '14:10', '16:8', '18:6', '20:4', 'OMAD'].map((proto) => (
              <button
                key={proto}
                type="button"
                onClick={() => setSelectedProtocolFilter(proto)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedProtocolFilter === proto
                    ? 'bg-teal-500 text-stone-950 shadow-sm font-black'
                    : 'text-stone-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {proto === 'ALL' ? 'Tutti i Piani' : proto}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEZIONE DIGIUNO IN CORSO (PRIMA DELLE CARD) CON STATO E 11 LIVELLI       */}
      {/* ========================================================================= */}
      {activeFasting && activeFasting.isActive && activeFastingData ? (
        <div className="bg-gradient-to-br from-[#162230] via-[#1c2c3e] to-[#121c27] text-white rounded-2xl border border-teal-500/40 shadow-lg p-5 sm:p-6 space-y-5 relative overflow-hidden">

          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Row: Status Badge, Live Timer, and Quick Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 border-b border-white/10 pb-4">
            <div className="flex items-center space-x-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                    Digiuno in Corso
                  </span>
                  <span className="text-xs text-stone-300 font-mono">
                    Split: <strong className="text-teal-300">{activeFasting.protocol}</strong> ({activeFastingData.targetHours}h)
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight mt-1 flex items-baseline space-x-2">
                  <span>
                    {String(activeFastingData.hoursPart).padStart(2, '0')}:
                    {String(activeFastingData.minutesPart).padStart(2, '0')}:
                    {String(activeFastingData.secondsPart).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-normal text-teal-300/90 font-sans">
                    trascorsi ({activeFastingData.elapsedHours.toFixed(1).replace('.', ',')} ore)
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-2 self-start md:self-auto">
              <button
                type="button"
                onClick={openEditorForEdit}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 hover:text-white text-xs font-bold border border-white/15 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-teal-300" />
                <span>Modifica / Configura Digiuno</span>
              </button>

              <button
                type="button"
                onClick={openFinishModal}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Concludi Digiuno</span>
              </button>
            </div>
          </div>

          {/* 4 Meta Badges Grid: Ora Inizio, Split, Ora Prevista Fine, Livello Biologico Attuale */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">

            {/* 1. Ora Inizio */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ora Inizio</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {activeFastingData.startFormatted}
              </div>
              <div className="text-[11px] text-stone-400">
                Glicemia iniziale: <strong className="text-teal-300">{activeFasting.startingGlucose ? `${activeFasting.startingGlucose} mg/dL` : '135 mg/dL'}</strong>
              </div>
            </div>

            {/* 2. Split */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                <span>Split</span>
              </div>
              <div className="text-base font-bold text-teal-300 font-mono">
                {activeFasting.protocol} ({activeFastingData.targetHours} ore)
              </div>
              <div className="text-[11px] text-stone-400">
                Avanzamento target: <strong className="text-emerald-400">{Math.round(activeFastingData.progressPct)}%</strong>
              </div>
            </div>

            {/* 3. Ora Prevista Fine */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Ora Prevista Fine</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {activeFastingData.targetFormatted}
              </div>
              <div className="text-[11px] font-semibold">
                {activeFastingData.isTargetMet ? (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Target superato (+{activeFastingData.remHoursPart}h {activeFastingData.remMinutesPart}m)</span>
                  </span>
                ) : (
                  <span className="text-amber-300">
                    Mancano {activeFastingData.remHoursPart}h {activeFastingData.remMinutesPart}m
                  </span>
                )}
              </div>
            </div>

            {/* 4. Livello Biologico Attuale */}
            <div className="bg-gradient-to-br from-teal-950/60 to-black/40 border border-teal-400/30 rounded-xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-teal-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Livello Attuale</span>
              </div>
              <div className="text-sm font-black text-amber-300 flex items-center space-x-1.5">
                <span>Lv.{activeFastingData.currentLevel.level}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  @{activeFastingData.currentLevel.rangeLabel}
                </span>
              </div>
              <div className="text-xs font-bold text-white truncate" title={activeFastingData.currentLevel.title}>
                {activeFastingData.currentLevel.title}
              </div>
            </div>

          </div>

          {/* Current Level Highlight Card (Streamlined: First Row + Stepper Bar) */}
          <div className="bg-black/40 border border-teal-500/30 rounded-2xl p-4 sm:p-5 relative z-10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-inner shrink-0"
                  style={{ backgroundColor: activeFastingData.currentLevel.barColor }}
                >
                  {activeFastingData.currentLevel.level}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
                    <span>Lv.{activeFastingData.currentLevel.level} - {activeFastingData.currentLevel.title}</span>
                    <span className="text-xs font-mono font-normal text-teal-300 px-2 py-0.5 bg-white/10 rounded-md">
                      @{activeFastingData.currentLevel.rangeLabel}
                    </span>
                  </h4>
                  <p className="text-xs text-stone-300">
                    Fase metabolica attiva raggiunta a {activeFastingData.elapsedHours.toFixed(1).replace('.', ',')} ore di digiuno.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAllLevels(!showAllLevels)}
                className="text-xs text-teal-300 hover:text-teal-200 font-bold flex items-center space-x-1 underline self-start sm:self-auto cursor-pointer shrink-0"
              >
                <span>{showAllLevels ? 'Comprimi Guida Livelli' : 'Visualizza Tutti gli 11 Livelli'}</span>
                {showAllLevels ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Level Stepper Bar across 11 stages */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-400">
                <span>Progressione Livelli Biologici (1 - 11)</span>
                <span className="text-teal-300 font-mono">Livello {activeFastingData.currentLevel.level} di 11</span>
              </div>
              <div className="grid grid-cols-11 gap-1 h-3">
                {FASTING_METABOLIC_LEVELS.map((lvl) => {
                  const isCompleted = activeFastingData.elapsedHours >= lvl.maxHours;
                  const isCurrent = activeFastingData.currentLevel.level === lvl.level;
                  return (
                    <div
                      key={lvl.level}
                      title={`Lv.${lvl.level} - ${lvl.title} (${lvl.rangeLabel})`}
                      className={`h-full rounded-xs transition-all relative ${
                        isCurrent
                          ? 'ring-2 ring-white shadow-md animate-pulse'
                          : ''
                      }`}
                      style={{
                        backgroundColor: isCompleted || isCurrent ? lvl.barColor : 'rgba(255,255,255,0.1)'
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-stone-500 font-mono pt-0.5">
                <span>0h (Lv.1)</span>
                <span>12h (Lv.6)</span>
                <span>24h (Lv.8)</span>
                <span>72h+ (Lv.11)</span>
              </div>
            </div>

          </div>

          {/* Expandable All 11 Levels Guide */}
          {showAllLevels && (
            <div className="bg-black/50 border border-white/15 rounded-2xl p-4 sm:p-5 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Dna className="w-4 h-4 text-teal-400" />
                  <h4 className="font-bold text-white text-sm">
                    Guida Completa: Gli 11 Livelli Metabolici del Digiuno
                  </h4>
                </div>
                <span className="text-xs text-stone-400">Dalle prime ore fino a 72h+</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FASTING_METABOLIC_LEVELS.map((lvl) => {
                  const isCurrent = activeFastingData.currentLevel.level === lvl.level;
                  const isCompleted = activeFastingData.elapsedHours >= lvl.maxHours;

                  return (
                    <div
                      key={lvl.level}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-teal-950/60 border-teal-400 shadow-md ring-1 ring-teal-400'
                          : isCompleted
                            ? 'bg-stone-900/60 border-stone-700/80 text-stone-300'
                            : 'bg-stone-900/30 border-stone-800/60 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black text-white"
                            style={{ backgroundColor: lvl.barColor }}
                          >
                            {lvl.level}
                          </span>
                          <strong className="text-white text-xs font-bold">
                            Lv.{lvl.level} - {lvl.title}
                          </strong>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-teal-300">
                          @{lvl.rangeLabel}
                        </span>
                      </div>

                      <p className="text-[11px] text-stone-300 leading-relaxed">
                        {lvl.description}
                      </p>

                      {isCurrent && (
                        <div className="mt-2 text-[10px] font-bold text-amber-300 flex items-center space-x-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Fase attualmente attiva nel tuo organismo</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      ) : (
        /* Fallback if no active fasting is running */
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                Nessun Digiuno Attivo al Momento
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Avvia una nuova sessione di digiuno per monitorare in tempo reale i livelli biologici e il cronometro.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={openEditorForNew}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Configura / Inserisci Digiuno</span>
            </button>
            <button
              type="button"
              onClick={handleStartNewFast}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Avvia Digiuno Ora (16:8)</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* KPI CARDS GRID (CON STREAK GIORNI CONSECUTIVI, TOTALI, PREFERITO)         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">

        {/* CARD 1: Giorni Consecutivi (Streak con conclusione positiva) */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-bold">
            <span>Streak Consecutivi</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {currentStreak} <span className="text-xs font-normal text-stone-500">giorni</span>
          </div>
          <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center space-x-1">
            <span>Record: <strong className="text-stone-700 dark:text-stone-300">{longestStreak} gg</strong></span>
          </div>
        </div>

        {/* CARD 2: Giorni Totali di Digiuno */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-bold">
            <span>Giorni Totali</span>
            <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-600 dark:text-teal-400 font-mono">
            {totalFastingDays} <span className="text-xs font-normal text-stone-500">giorni</span>
          </div>
          <div className="text-[11px] text-stone-500 dark:text-stone-400">
            su {totalSessions} sessioni valide
          </div>
        </div>

        {/* CARD 3: Piano Preferito del Utente */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-bold">
            <span>Piano Preferito</span>
            <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {topProtocolEntry.name}
          </div>
          <div className="text-[11px] text-stone-500 dark:text-stone-400">
            {topProtocolEntry.pct}% delle sessioni
          </div>
        </div>

        {/* CARD 4: Ore Totali a Digiuno */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-bold">
            <span>Ore Totali</span>
            <Timer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
            {totalFastingHours.toFixed(1).replace('.', ',')} <span className="text-xs font-normal text-stone-500">h</span>
          </div>
          <div className="text-[11px] text-stone-500 dark:text-stone-400">
            Media {avgDurationHours.toFixed(1).replace('.', ',')}h / sessione
          </div>
        </div>

        {/* CARD 5: Tasso di Successo / Aderenza Obiettivo */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-bold">
            <span>Aderenza Obiettivo</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {adherenceRate}%
          </div>
          <div className="text-[11px] text-stone-500 dark:text-stone-400">
            {completedTargetCount} su {totalSessions} completati
          </div>
        </div>

        {/* CARD 6: Riduzione Glicemica Media */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-bold">
            <span>Δ Glicemia Inizio/Fine</span>
            <HeartPulse className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {avgDeltaGlu !== null ? `${avgDeltaGlu > 0 ? '+' : ''}${avgDeltaGlu} mg/dL` : '-48 mg/dL'}
          </div>
          <div className="text-[11px] text-stone-500 dark:text-stone-400">
            Da {avgStartGlu} a {avgEndGlu} mg/dL
          </div>
        </div>

      </div>

      {/* Main Fasting Chart Card (SVG Bar Timeline with Target line & Metabolic Zones) */}
      <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base flex items-center space-x-2">
              <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Cronologia e Durata Sessioni di Digiuno</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Ore effettive di digiuno per sessione con soglia obiettivo e zone metaboliche raggiunte.
            </p>
          </div>

          {/* Metabolic Stage Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-stone-600 dark:text-stone-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
              <span>Digestione (0-12h)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-teal-500 shrink-0" />
              <span>Lipolisi (12-16h)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span>Chetosi (16-22h)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0" />
              <span>Autofagia (22h+)</span>
            </span>
          </div>
        </div>

        {/* SVG Chart Container */}
        <div className="w-full overflow-x-auto py-2">
          <div className="min-w-[620px] h-64 relative">
            <svg viewBox="0 0 700 220" className="w-full h-full">
              {/* Background horizontal guide lines for 6, 12, 16, 20, 24h */}
              {[6, 12, 16, 20, 24].map((hr) => {
                const y = 190 - (hr / 26) * 160;
                const isTarget = hr === 16;
                return (
                  <g key={hr}>
                    <line
                      x1="45"
                      y1={y}
                      x2="690"
                      y2={y}
                      stroke={isTarget ? '#0d9488' : '#e2e8f0'}
                      strokeWidth={isTarget ? '1.5' : '0.8'}
                      strokeDasharray={isTarget ? '4 3' : '2 2'}
                      opacity={isTarget ? '0.9' : '0.6'}
                    />
                    <text
                      x="38"
                      y={y + 3.5}
                      textAnchor="end"
                      fontSize="9"
                      fill={isTarget ? '#0d9488' : '#94a3b8'}
                      fontWeight={isTarget ? 'bold' : 'normal'}
                      fontFamily="monospace"
                    >
                      {hr}h
                    </text>
                  </g>
                );
              })}

              {/* Target 16h badge label on the right */}
              <rect x="635" y={190 - (16 / 26) * 160 - 8} width="52" height="15" rx="4" fill="#0d9488" />
              <text x="661" y={190 - (16 / 26) * 160 + 3} textAnchor="middle" fontSize="8" fill="#ffffff" fontWeight="bold">
                Target 16h
              </text>

              {/* Session Bars */}
              {filteredSessions.map((session, idx) => {
                const totalItems = filteredSessions.length;
                const slotWidth = Math.min(42, Math.max(22, 600 / Math.max(1, totalItems)));
                const startX = 60 + idx * (620 / Math.max(1, totalItems));
                const barHeight = (session.durationHours / 26) * 160;
                const barY = 190 - barHeight;

                // Color based on hours reached
                let barColor = '#3b82f6'; // Blue (0-12)
                if (session.durationHours >= 22) barColor = '#9333ea'; // Purple (Autophagy)
                else if (session.durationHours >= 16) barColor = '#f59e0b'; // Amber (Ketosis)
                else if (session.durationHours >= 12) barColor = '#14b8a6'; // Teal (Fat burn)

                return (
                  <g key={session.id} className="group cursor-pointer">
                    {/* Background hover highlight */}
                    <rect
                      x={startX - 2}
                      y="20"
                      width={slotWidth + 4}
                      height="170"
                      fill="transparent"
                      className="hover:fill-stone-100/50 dark:hover:fill-stone-800/40 transition-colors"
                      rx="6"
                    />

                    {/* Bar Rect */}
                    <rect
                      x={startX}
                      y={barY}
                      width={slotWidth}
                      height={barHeight}
                      rx="4"
                      fill={barColor}
                      opacity="0.9"
                    />

                    {/* Value text above bar */}
                    <text
                      x={startX + slotWidth / 2}
                      y={barY - 5}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill={barColor}
                      fontFamily="monospace"
                    >
                      {session.durationHours.toFixed(1).replace('.', ',')}h
                    </text>

                    {/* Date label at bottom */}
                    <text
                      x={startX + slotWidth / 2}
                      y="204"
                      textAnchor="middle"
                      fontSize="8"
                      fill="#64748b"
                      fontWeight="500"
                    >
                      {session.date.includes('-') ? session.date.slice(5) : session.date.slice(0, 5)}
                    </text>

                    {/* Protocol tag label */}
                    <text
                      x={startX + slotWidth / 2}
                      y="214"
                      textAnchor="middle"
                      fontSize="7"
                      fill="#94a3b8"
                    >
                      {session.protocol.split(' ')[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Biological Stages & Protocol Distribution Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Card 1: Fasi Metaboliche Raggiunte */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
              Traguardi Biologici Raggiunti
            </h4>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40">
              <div>
                <strong className="text-purple-900 dark:text-purple-200 block">Autofagia Profonda (22h+)</strong>
                <span className="text-[11px] text-purple-700 dark:text-purple-300">Rinnovamento cellulare attivo</span>
              </div>
              <span className="text-base font-bold text-purple-700 dark:text-purple-300 font-mono">{autophagyCount} sessioni</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
              <div>
                <strong className="text-amber-900 dark:text-amber-200 block">Chetosi Nutrizionale (16-22h)</strong>
                <span className="text-[11px] text-amber-700 dark:text-amber-300">Utilizzo corpi chetonici per energia</span>
              </div>
              <span className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono">{ketosisCount} sessioni</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40">
              <div>
                <strong className="text-teal-900 dark:text-teal-200 block">Lipolisi & Brucia-Grassi (12-16h)</strong>
                <span className="text-[11px] text-teal-700 dark:text-teal-300">Deplezione glicogeno epatico</span>
              </div>
              <span className="text-base font-bold text-teal-700 dark:text-teal-300 font-mono">{fatBurnCount} sessioni</span>
            </div>
          </div>
        </div>

        {/* Card 2: Distribuzione Piani */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
              Distribuzione Piani di Digiuno
            </h4>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            {Object.entries(protocolCounts).map(([proto, count]) => {
              const pct = Math.round((count / totalSessions) * 100);
              return (
                <div key={proto} className="space-y-1">
                  <div className="flex justify-between font-bold text-stone-700 dark:text-stone-300">
                    <span>{proto}</span>
                    <span className="font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Suggerimenti & Note Guida */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
              Note Cliniche & Idratazione
            </h4>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Durante la finestra di digiuno è fondamentale mantenere un'idratazione abbondante con acqua, tè verde, caffè nero o tisane senza zuccheri e reintegrare sali minerali (sodio, magnesio, potassio) nei digiuni superiori a 18 ore.
          </p>

          <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 text-xs">
            <span className="font-bold text-stone-800 dark:text-stone-200 block mb-0.5">
              Piano preferito dell'utente:
            </span>
            <span className="text-teal-600 dark:text-teal-400 font-bold">{topProtocolEntry.name}</span> ({topProtocolEntry.pct}% di frequenza) con regolarità serale.
          </div>
        </div>

      </div>

      {/* Detailed Chronological Table Card */}
      <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#3b7080] dark:text-[#58a1b5]" />
              <span>Registro Dettagliato Sessioni di Digiuno</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Cronologia completa con orari inizio/fine, durata, split, glicemia e note.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={openEditorForNew}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Inserisci Digiuno</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSVClick}
              className="px-3 py-1.5 bg-[#e97849] hover:bg-[#d86b3d] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Esporta CSV Digiuno</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50 dark:bg-stone-800/70 border-b border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3 text-center">Inizio</th>
                <th className="p-3 text-center">Fine (Rottura)</th>
                <th className="p-3 text-center">Durata Effettiva</th>
                <th className="p-3 text-center">Split</th>
                <th className="p-3 text-center">Stadio Raggiunto</th>
                <th className="p-3 text-center">Glicemia Inizio/Fine</th>
                <th className="p-3">Note / Pasto di Rottura</th>
                <th className="p-3 text-center w-12">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-800 dark:text-stone-200">
              {filteredSessions.map((session) => {
                const isTargetMet = session.durationHours >= session.targetHours;
                return (
                  <tr key={session.id} className="hover:bg-stone-50/80 dark:hover:bg-stone-800/50 transition-colors">
                    <td className="p-3 font-bold whitespace-nowrap">
                      {session.date}
                    </td>
                    <td className="p-3 text-center font-mono text-stone-600 dark:text-stone-400">
                      {session.startTime}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-stone-800 dark:text-stone-200">
                      {session.endTime}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold font-mono text-xs ${
                        isTargetMet
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      }`}>
                        {session.durationHours.toFixed(1).replace('.', ',')} ore
                      </span>
                    </td>
                    <td className="p-3 text-center font-semibold text-stone-700 dark:text-stone-300">
                      {session.protocol}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        session.metabolicStage === 'autophagy'
                          ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200'
                          : session.metabolicStage === 'ketosis'
                            ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                            : 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200'
                      }`}>
                        {session.metabolicStage === 'autophagy' ? 'Autofagia' : session.metabolicStage === 'ketosis' ? 'Chetosi' : 'Lipolisi'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-semibold">
                      {session.startingGlucose && session.endingGlucose ? (
                        <span className="text-stone-600 dark:text-stone-300">
                          {session.startingGlucose} → <strong className="text-emerald-600 dark:text-emerald-400">{session.endingGlucose}</strong> mg/dL
                        </span>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-stone-600 dark:text-stone-400 max-w-xs truncate" title={session.note}>
                      {session.note || '-'}
                    </td>
                    <td className="p-3 text-center">
                      {session.rawEntry && onEditEntry && (
                        <button
                          type="button"
                          onClick={() => onEditEntry(session.rawEntry!)}
                          className="p-1.5 text-stone-400 hover:text-[#3b7080] dark:hover:text-[#58a1b5] rounded-lg transition-colors cursor-pointer"
                          title="Modifica voce"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL / DIALOG: MODIFICA O AVVIA / REGISTRA DIGIUNO                        */}
      {/* ========================================================================= */}
      {showActiveEditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 animate-scaleUp max-h-[92vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <Timer className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base leading-tight">
                    {editIsInProgress ? 'Configura Digiuno In Corso' : 'Inserisci / Registra Digiuno'}
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Imposta data e ora con pickers dedicati
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowActiveEditor(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-sm font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode selection toggle */}
            <div className="grid grid-cols-2 gap-2 bg-stone-100 dark:bg-stone-900/80 p-1.5 rounded-xl border border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => {
                  setEditIsInProgress(true);
                  setEditEndDate('');
                  setEditEndTime('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  editIsInProgress
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                <span>Digiuno In Corso</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditIsInProgress(false);
                  const now = new Date();
                  setEditEndDate(now.toISOString().slice(0, 10));
                  setEditEndTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  !editIsInProgress
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Digiuno Concluso</span>
              </button>
            </div>

            <form onSubmit={handleSaveActiveFasting} className="space-y-4 text-xs">

              {/* SECTION: INIZIO DIGIUNO (GIORNO + ORA CON PICK) */}
              <div className="bg-stone-50 dark:bg-stone-900/50 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5 text-xs">
                    <Play className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Inizio Digiuno</span>
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setEditStartDate(now.toISOString().slice(0, 10));
                        setEditStartTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                      }}
                      className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline px-2 py-0.5 bg-teal-50 dark:bg-teal-950/40 rounded-md border border-teal-200 dark:border-teal-800 cursor-pointer"
                    >
                      Ora Attuale
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const yest = new Date(Date.now() - 86400000);
                        setEditStartDate(yest.toISOString().slice(0, 10));
                        setEditStartTime('20:00');
                      }}
                      className="text-[10px] font-bold text-stone-600 dark:text-stone-300 hover:underline px-2 py-0.5 bg-stone-200 dark:bg-stone-800 rounded-md cursor-pointer"
                    >
                      Ieri (20:00)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Giorno Inizio
                    </label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Ora Inizio
                    </label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: PIANO & TARGET */}
              <div className="space-y-2">
                <label className="block font-bold text-stone-700 dark:text-stone-300">
                  Piano & Durata Target
                </label>

                {/* Plan Quick Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {FASTING_PLANS.slice(0, 7).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setEditProtocol(p.id);
                        setEditTargetHours(p.hours);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        editProtocol === p.id
                          ? 'bg-teal-600 text-white shadow-xs font-black'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Seleziona Piano / Split
                    </label>
                    <select
                      value={editProtocol}
                      onChange={(e) => {
                        const proto = e.target.value;
                        setEditProtocol(proto);
                        setEditTargetHours(parsePlanTargetHours(proto));
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="14:10">14:10</option>
                      <option value="16:8">16:8 (Intermittente)</option>
                      <option value="18:6">18:6 (Avanzato)</option>
                      <option value="20:4">20:4 (Guerriero)</option>
                      <option value="OMAD (23:1)">OMAD (23:1)</option>
                      <option value="24h">24 Ore</option>
                      <option value="36h">36 Ore (Monk Fast)</option>
                      <option value="48h">48 Ore (Autofagia)</option>
                      <option value="72h">72 Ore (Rigenerazione)</option>
                      <option value="Personalizzato">Personalizzato</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Ore Target (Obiettivo)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      step="0.5"
                      value={editTargetHours}
                      onChange={(e) => setEditTargetHours(parseFloat(e.target.value) || 16)}
                      onFocus={(e) => e.target.select()}
                      className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: FINE DIGIUNO (GIORNO + ORA CON PICK - OPZIONALE SE IN CORSO) */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                editIsInProgress
                  ? 'bg-stone-50/60 dark:bg-stone-900/30 border-stone-200/80 dark:border-stone-800/80 opacity-90'
                  : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5 text-xs">
                    <Square className="w-3.5 h-3.5 text-amber-500" />
                    <span>Fine Digiuno (Opzionale / Se Concluso)</span>
                  </span>

                  {editIsInProgress ? (
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
                      In corso (non valorizzato)
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setEditEndDate(getLocalDateString(now));
                        setEditEndTime(getLocalTimeString(now));
                      }}
                      className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-md cursor-pointer"
                    >
                      Imposta Adesso
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Giorno Fine
                    </label>
                    <input
                      type="date"
                      value={editEndDate}
                      disabled={editIsInProgress}
                      onChange={(e) => {
                        setEditEndDate(e.target.value);
                        if (e.target.value && !editEndTime) {
                          setEditEndTime('12:00');
                        }
                        if (e.target.value) {
                          setEditIsInProgress(false);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder="Lascia vuoto se in corso"
                      className="w-full p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs disabled:bg-stone-100 dark:disabled:bg-stone-800 disabled:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Ora Fine
                    </label>
                    <input
                      type="time"
                      value={editEndTime}
                      disabled={editIsInProgress}
                      onChange={(e) => {
                        setEditEndTime(e.target.value);
                        if (e.target.value && !editEndDate) {
                          setEditEndDate(getLocalDateString());
                        }
                        if (e.target.value) {
                          setEditIsInProgress(false);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder="Lascia vuoto se in corso"
                      className="w-full p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs disabled:bg-stone-100 dark:disabled:bg-stone-800 disabled:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsInProgress}
                      onChange={(e) => {
                        setEditIsInProgress(e.target.checked);
                        if (e.target.checked) {
                          setEditEndDate('');
                          setEditEndTime('');
                        } else {
                          const now = new Date();
                          setEditEndDate(getLocalDateString(now));
                          setEditEndTime(getLocalTimeString(now));
                        }
                      }}
                      className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                      Digiuno in corso (lascia non valorizzati giorno e ora fine)
                    </span>
                  </label>
                </div>
              </div>

              {/* Dynamic Preview of Duration and Metabolic Stage if completed */}
              {editorCalculations && !editorCalculations.isInProgress && editorCalculations.durationHours !== null && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 text-xs space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                    <span>Durata Calcolata: {editorCalculations.durationHours.toFixed(1).replace('.', ',')} ore</span>
                    <span className="text-[11px] font-normal">
                      {editorCalculations.durationHours >= editTargetHours ? '🎯 Target Raggiunto' : '⚠️ Interrotto prima'}
                    </span>
                  </div>
                  {editorCalculations.level && (
                    <p className="text-emerald-700 dark:text-emerald-300 text-[11px]">
                      Livello biologico: <strong>Lv.{editorCalculations.level.level} - {editorCalculations.level.title}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* GLUCOSE INPUTS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Glicemia Inizio (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={editStartingGlucose}
                    onChange={(e) => setEditStartingGlucose(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Es. 135"
                    className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Glicemia Fine (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={editEndingGlucose}
                    onChange={(e) => setEditEndingGlucose(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="Es. 84"
                    disabled={editIsInProgress}
                    className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs disabled:bg-stone-100 dark:disabled:bg-stone-800 disabled:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* NOTE & DETAILS */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Note & Idratazione
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  rows={2}
                  placeholder="Es. Assunzione di acqua, tisane, idratazione, sensazioni..."
                  className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowActiveEditor(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all shadow-xs cursor-pointer"
                >
                  {editIsInProgress ? 'Salva Digiuno In Corso' : 'Registra Sessione Conclusa'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONCLUDI DIGIUNO                                                  */}
      {/* ========================================================================= */}
      {showFinishModal && activeFastingData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4 animate-scaleUp">

            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base leading-tight">
                    Concludi Sessione di Digiuno
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Inserisci data e ora effettiva di rottura digiuno
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-sm font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Inizio sessione info */}
            <div className="bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
              <span className="text-stone-600 dark:text-stone-400">Iniziato il:</span>
              <strong className="text-stone-800 dark:text-stone-200 font-mono">{activeFastingData.startFormatted}</strong>
            </div>

            {/* End Date and Time with pickers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                  Data e Ora di Fine (Rottura)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setFinishDate(getLocalDateString(now));
                    setFinishTime(getLocalTimeString(now));
                  }}
                  className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline px-2 py-0.5 bg-teal-50 dark:bg-teal-950/40 rounded-md border border-teal-200 dark:border-teal-800 cursor-pointer"
                >
                  Imposta Ora Attuale
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-1">Giorno Fine</label>
                  <input
                    type="date"
                    value={finishDate}
                    onChange={(e) => setFinishDate(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-1">Ora Fine</label>
                  <input
                    type="time"
                    value={finishTime}
                    onChange={(e) => setFinishTime(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Real-time calculated duration & metabolic level */}
            {finishCalculations && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 text-xs space-y-1">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>Durata Registrata: {finishCalculations.elapsedHours.toFixed(1).replace('.', ',')} ore</span>
                  </span>
                  <span className="text-[11px] font-semibold">
                    {finishCalculations.isTargetMet ? '🎯 Target Raggiunto' : '⚠️ Interrotto prima'}
                  </span>
                </div>
                <p className="text-emerald-700 dark:text-emerald-300 text-[11px]">
                  Livello raggiunto: <strong>Lv.{finishCalculations.currentLevel.level} - {finishCalculations.currentLevel.title}</strong>
                </p>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Glicemia Finale (mg/dL alla rottura)
                </label>
                <input
                  type="number"
                  value={finishGlucose}
                  onChange={(e) => setFinishGlucose(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Es. 84"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Note di Rottura Digiuno (es. pasto consumato)
                </label>
                <textarea
                  value={finishNote}
                  onChange={(e) => setFinishNote(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  rows={2}
                  placeholder="Es. Insalata con salmone, noci e avocado..."
                  className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleCompleteActiveFast}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-xs cursor-pointer"
              >
                Conferma e Concludi
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
