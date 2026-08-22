import React, { useState, useMemo } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { LogEntryItem, HealthCategory, HealthSubType } from '../../types/ontrack';
import { exportElementToPdf } from '../../utils/pdfExport';
import { loadUserSettings } from '../../utils/ontrackStorage';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Info,
  Calendar as CalendarIcon,
  MessageSquare,
  X,
  Clock,
  Activity,
  Utensils,
  Pill,
  Heart,
  Pencil,
  Trash2,
  CalendarRange,
  FileText,
  Loader2,
  RotateCcw,
  Check
} from 'lucide-react';

interface CalendarScreenProps {
  entries: LogEntryItem[];
  categories: HealthCategory[];
  subTypes: HealthSubType[];
  onBack: () => void;
  onOpenTools: () => void;
  onNavigate: (screen: string) => void;
  onEditEntry?: (entry: LogEntryItem) => void;
  onDeleteEntry?: (id: string) => void;
}

type CalendarTab = 'gior' | 'sett' | 'classica';
type PeriodType = 7 | 14 | 30 | 60 | 90 | 'all';

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

const getYearMonth = (dateStr: string) => {
  if (!dateStr) return { year: '', month: '' };
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      let year = parts[0];
      if (year.length === 2) year = '20' + year;
      const month = parts[1].padStart(2, '0');
      return { year, month };
    }
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      const month = parts[1].padStart(2, '0');
      return { year, month };
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const year = String(d.getFullYear());
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return { year, month };
    }
  } catch (e) {}
  return { year: '', month: '' };
};

export const CalendarScreen: React.FC<CalendarScreenProps> = ({
  entries,
  categories,
  subTypes,
  onBack,
  onOpenTools,
  onNavigate,
  onEditEntry,
  onDeleteEntry
}) => {
  const [activeTab, setActiveTab] = useState<CalendarTab>('classica');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LogEntryItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filters for Classic Tab
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('all');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  const userSettings = loadUserSettings();
  const patientName = userSettings?.patientName || 'Angelo F';

  const notifyExport = (msg: string) => {
    setExportNotification(msg);
    setTimeout(() => setExportNotification(null), 4000);
  };

  // Available years from entries with counts
  const availableYearsWithCount = useMemo(() => {
    const counts: { [year: string]: number } = {};
    entries.forEach(e => {
      const { year } = getYearMonth(e.date);
      if (year && year.length === 4) {
        counts[year] = (counts[year] || 0) + 1;
      }
    });
    const sortedYears = Object.keys(counts).sort((a, b) => b.localeCompare(a));
    return sortedYears.map(yr => ({ year: yr, count: counts[yr] }));
  }, [entries]);

  // Available months for selected year with counts
  const availableMonthsWithCount = useMemo(() => {
    if (selectedYear === 'ALL') return [];
    const counts: { [month: string]: number } = {};
    entries.forEach(e => {
      const { year, month } = getYearMonth(e.date);
      if (year === selectedYear && month) {
        counts[month] = (counts[month] || 0) + 1;
      }
    });
    const sortedMonths = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return sortedMonths.map(mo => ({ month: mo, count: counts[mo] }));
  }, [entries, selectedYear]);

  // Total count of entries in the currently selected year (all months)
  const selectedYearTotalCount = useMemo(() => {
    if (selectedYear === 'ALL') return entries.length;
    return availableYearsWithCount.find(y => y.year === selectedYear)?.count || 0;
  }, [availableYearsWithCount, selectedYear, entries.length]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    if (year === 'ALL') {
      setSelectedMonth('ALL');
    } else {
      const monthsForNewYear = new Set<string>();
      entries.forEach(e => {
        const ym = getYearMonth(e.date);
        if (ym.year === year && ym.month) {
          monthsForNewYear.add(ym.month);
        }
      });
      if (selectedMonth !== 'ALL' && !monthsForNewYear.has(selectedMonth)) {
        setSelectedMonth('ALL');
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedPeriod('all');
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
  };

  const hasActiveClassicFilters = selectedPeriod !== 'all' || selectedYear !== 'ALL' || selectedMonth !== 'ALL';

  // Period label computation
  let classicPeriodRangeLabel = selectedPeriod === 'all' ? 'Tutto lo storico' : `Ultimi ${selectedPeriod} giorni`;
  if (selectedYear !== 'ALL') {
    if (selectedMonth !== 'ALL') {
      classicPeriodRangeLabel = `${MONTH_NAMES[selectedMonth] || selectedMonth} ${selectedYear}`;
    } else {
      classicPeriodRangeLabel = `Anno ${selectedYear}`;
    }
  }

  // Helper: parse string float safely
  const parseVal = (val: string | number | undefined): number => {
    if (!val) return 0;
    const str = String(val).trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Helper to extract glucose entries
  const glucoseEntries = useMemo(() => {
    return entries.filter(e => {
      const name = (e.subTypeName || '').toLowerCase();
      const id = (e.subTypeId || '').toLowerCase();
      return name.includes('glucose') || name.includes('glicemia') || id.includes('glucose');
    });
  }, [entries]);

  // Carbs and Exercise entries
  const carbsEntries = useMemo(() => {
    return entries.filter(e => {
      const name = (e.subTypeName || '').toLowerCase();
      const id = (e.subTypeId || '').toLowerCase();
      return name.includes('cibo') || name.includes('carb') || name.includes('food') || id.includes('food');
    });
  }, [entries]);

  const exerciseEntries = useMemo(() => {
    return entries.filter(e => {
      const name = (e.subTypeName || '').toLowerCase();
      const id = (e.subTypeId || '').toLowerCase();
      return name.includes('esercizio') || name.includes('camminata') || name.includes('exercise') || id.includes('exercise');
    });
  }, [entries]);

  // Latest glucose reading for top banner
  const latestGlucose = useMemo(() => {
    if (glucoseEntries.length === 0) return null;
    const sorted = [...glucoseEntries].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return sorted[0];
  }, [glucoseEntries]);

  // Format date helper: YYYY-MM-DD
  const formatYMD = (d: any): string => {
    if (!d) return '';
    try {
      const dateObj = d instanceof Date ? d : new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      const yearNum = dateObj.getFullYear();
      const monthNum = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dayNum = String(dateObj.getDate()).padStart(2, '0');
      return `${yearNum}-${monthNum}-${dayNum}`;
    } catch {
      return '';
    }
  };

  // Parse any entry date string to YYYY-MM-DD
  const normalizeEntryDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      // YYYY-MM-DD
      const parts = dateStr.split('-');
      if (parts[0].length === 4) return dateStr;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (dateStr.includes('/')) {
      // DD/MM/YY or DD/MM/YYYY
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        let yr = parts[2];
        if (yr.length === 2) yr = '20' + yr;
        return `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  // Short month Italian names
  const italianMonths = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const italianDaysShort = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  // Color helper for glucose value
  const getGlucoseColor = (valNum: number) => {
    if (valNum <= 0) return 'text-stone-700';
    if (valNum < 70) return 'text-[#0288d1]'; // Blue (Hypo)
    if (valNum <= 140) return 'text-[#2e7d32]'; // Green (Optimal)
    if (valNum <= 180) return 'text-[#827717]'; // Olive/amber (Acceptable post-meal)
    if (valNum <= 250) return 'text-[#c2185b]'; // Pink/Magenta (High)
    return 'text-[#880e4f]'; // Dark Magenta / Very High
  };

  const getGlucoseBgPill = (valNum: number) => {
    if (valNum <= 0) return 'bg-stone-100 text-stone-700';
    if (valNum < 70) return 'bg-blue-50 text-[#0288d1] border-blue-200';
    if (valNum <= 140) return 'bg-emerald-50 text-[#2e7d32] border-emerald-200';
    if (valNum <= 180) return 'bg-lime-50 text-[#827717] border-lime-200';
    if (valNum <= 250) return 'bg-pink-50 text-[#c2185b] border-pink-200';
    return 'bg-purple-50 text-[#880e4f] border-purple-200';
  };

  // Navigation handlers for date picker
  const handlePrevPeriod = () => {
    const d = new Date(selectedDate);
    if (activeTab === 'gior') {
      d.setDate(d.getDate() - 1);
    } else if (activeTab === 'sett') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 30);
    }
    setSelectedDate(d);
  };

  const handleNextPeriod = () => {
    const d = new Date(selectedDate);
    if (activeTab === 'gior') {
      d.setDate(d.getDate() + 1);
    } else if (activeTab === 'sett') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 30);
    }
    setSelectedDate(d);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date());
  };

  // Format label for sub-header date range
  const getDateRangeLabel = () => {
    const todayYMD = formatYMD(new Date());
    const selYMD = formatYMD(selectedDate);

    if (activeTab === 'gior') {
      if (selYMD === todayYMD) return 'Oggi';
      const dObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
      const d = dObj.getDate();
      const m = italianMonths[dObj.getMonth()] || '';
      const yearNum = dObj.getFullYear();
      return `${d} ${m} ${yearNum}`;
    }

    if (activeTab === 'sett') {
      const start = new Date(selectedDate);
      start.setDate(start.getDate() - 6);
      const isEndToday = selYMD === todayYMD;
      const startStr = `${start.getDate()} ${italianMonths[start.getMonth()]}`;
      const endStr = isEndToday ? 'Oggi' : `${selectedDate.getDate()} ${italianMonths[selectedDate.getMonth()]}`;
      return `${startStr}-${endStr}`;
    }

    // Classic view: date range label from active filter
    return classicPeriodRangeLabel;
  };

  // Helper to categorize entry into one of the 8 classic logbook columns
  // Columns: 'notte' | 'colaz_pre' | 'colaz_post' | 'pranzo_pre' | 'pranzo_post' | 'cena_pre' | 'cena_post' | 'bedtime'
  const mapEntryToClassicColumn = (e: LogEntryItem): string => {
    const catName = (e.categoryName || '').toLowerCase();
    const catId = (e.categoryId || '').toLowerCase();
    const timing = e.mealTiming;
    const time = e.time || '12:00';
    const [h, m] = time.split(':').map(Number);
    const hour = (h || 0) + (m || 0) / 60;

    // 1. Check direct category name keywords
    if (catName.includes('dormire') || catName.includes('bedtime') || catName.includes('coricarsi') || catId === 'cat_6' || catId === 'cat_bedtime') {
      return 'bedtime';
    }
    if (catName.includes('notte') || catName.includes('digiuno') || catName.includes('notturn') || (hour >= 0 && hour < 5 && !timing) || catId === 'cat_night') {
      return 'notte';
    }

    // 2. Colazione (05:00 - 11:00)
    if (catName.includes('colazione') || catId === 'cat_1' || catId === 'cat_2' || catId === 'cat_breakfast') {
      if (timing === 'post' || catName.includes('dopo')) return 'colaz_post';
      return 'colaz_pre';
    }

    // 3. Pranzo (11:00 - 14:30)
    if (catName.includes('pranzo') || catId === 'cat_3' || catId === 'cat_4' || catId === 'cat_lunch') {
      if (timing === 'post' || catName.includes('dopo')) return 'pranzo_post';
      return 'pranzo_pre';
    }

    // 4. Cena (17:00 - 20:00)
    if (catName.includes('cena') || catId === 'cat_5' || catId === 'cat_dinner') {
      if (timing === 'post' || catName.includes('dopo')) return 'cena_post';
      return 'cena_pre';
    }

    // 5. Fallback based on time of day (matching 24h meal settings)
    if (hour < 5) return 'notte';
    if (hour < 11) return timing === 'post' ? 'colaz_post' : 'colaz_pre';
    if (hour < 14.5) return timing === 'post' ? 'pranzo_post' : 'pranzo_pre';
    if (hour < 17) return 'pranzo_post';
    if (hour < 20) return timing === 'post' ? 'cena_post' : 'cena_pre';
    if (hour < 22) return 'cena_post';
    return 'bedtime';
  };

  // Collect unique dates in the database for Classic view respecting filters (7, 14, 30, 60, 90, Tutto, Anno, Mese)
  const classicDates = useMemo(() => {
    const datesMap = new Map<string, { dateYMD: string; label: string; dateObj: Date }>();
    const today = new Date();

    if (selectedYear !== 'ALL') {
      // Filter by Year and optional Month
      entries.forEach(e => {
        const ym = getYearMonth(e.date);
        if (ym.year === selectedYear) {
          if (selectedMonth === 'ALL' || ym.month === selectedMonth) {
            const ymd = normalizeEntryDate(e.date);
            if (ymd && !datesMap.has(ymd)) {
              const parts = ymd.split('-');
              if (parts.length === 3) {
                const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                datesMap.set(ymd, {
                  dateYMD: ymd,
                  label: `${dObj.getDate()}/${dObj.getMonth() + 1}`,
                  dateObj: dObj
                });
              }
            }
          }
        }
      });

      // If specific month has entries, fill consecutive dates in that month between min and max date
      const list = Array.from(datesMap.values()).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      if (list.length > 1) {
        const newest = list[0].dateObj.getTime();
        const oldest = list[list.length - 1].dateObj.getTime();
        const diffDays = Math.min(31, Math.ceil((newest - oldest) / 86400000));
        for (let i = 0; i <= diffDays; i++) {
          const d = new Date(newest - i * 86400000);
          const ymd = formatYMD(d);
          if (!datesMap.has(ymd)) {
            datesMap.set(ymd, {
              dateYMD: ymd,
              label: `${d.getDate()}/${d.getMonth() + 1}`,
              dateObj: d
            });
          }
        }
      }
    } else if (selectedPeriod !== 'all') {
      // Preset period (7, 14, 30, 60, 90 days)
      const numDays = typeof selectedPeriod === 'number' ? selectedPeriod : 30;
      for (let i = 0; i < numDays; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ymd = formatYMD(d);
        datesMap.set(ymd, {
          dateYMD: ymd,
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          dateObj: d
        });
      }

      // Also include any entry dates within this timeframe
      const cutoff = today.getTime() - numDays * 24 * 60 * 60 * 1000;
      entries.forEach(e => {
        if (e.timestamp && e.timestamp >= cutoff) {
          const ymd = normalizeEntryDate(e.date);
          if (ymd && !datesMap.has(ymd)) {
            const parts = ymd.split('-');
            if (parts.length === 3) {
              const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              datesMap.set(ymd, {
                dateYMD: ymd,
                label: `${dObj.getDate()}/${dObj.getMonth() + 1}`,
                dateObj: dObj
              });
            }
          }
        }
      });
    } else {
      // 'all' lo storico: start with today and all recorded dates
      const todayYMD = formatYMD(today);
      datesMap.set(todayYMD, {
        dateYMD: todayYMD,
        label: `${today.getDate()}/${today.getMonth() + 1}`,
        dateObj: today
      });

      entries.forEach(e => {
        const ymd = normalizeEntryDate(e.date);
        if (ymd && !datesMap.has(ymd)) {
          const parts = ymd.split('-');
          if (parts.length === 3) {
            const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            datesMap.set(ymd, {
              dateYMD: ymd,
              label: `${dObj.getDate()}/${dObj.getMonth() + 1}`,
              dateObj: dObj
            });
          }
        }
      });

      // Fill in intermediate dates
      const datesList = Array.from(datesMap.values()).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      if (datesList.length > 1) {
        const newest = datesList[0].dateObj.getTime();
        const oldest = datesList[datesList.length - 1].dateObj.getTime();
        const diffDays = Math.min(180, Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24)));

        for (let i = 0; i <= diffDays; i++) {
          const d = new Date(newest - i * 86400000);
          const ymd = formatYMD(d);
          if (!datesMap.has(ymd)) {
            datesMap.set(ymd, {
              dateYMD: ymd,
              label: `${d.getDate()}/${d.getMonth() + 1}`,
              dateObj: d
            });
          }
        }
      }
    }

    return Array.from(datesMap.values()).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [entries, selectedPeriod, selectedYear, selectedMonth]);

  // PDF Export Handler for Tabella Classica
  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);
    const cleanName = (patientName || 'Angelo F').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const tagPeriod = selectedYear !== 'ALL'
      ? (selectedMonth !== 'ALL' ? `${selectedYear}_${selectedMonth}` : `${selectedYear}`)
      : (selectedPeriod === 'all' ? 'Tutto' : `${selectedPeriod}gg`);

    const fileName = `Diario_Glicemico_Classico_${tagPeriod}_${cleanName}_${dateStr}.pdf`;

    try {
      await exportElementToPdf('printable-classic-calendar-area', fileName);
      notifyExport('✅ Diario Classico esportato in PDF con successo!');
    } catch (e) {
      console.warn('PDF export error, using print fallback:', e);
      try {
        window.print();
        notifyExport('📄 Finestra di stampa/PDF aperta.');
      } catch (err) {
        alert('Impossibile generare il PDF. Prova a premere Ctrl+P per stampare.');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Group entries by Date and Classic Column
  const classicGridData = useMemo(() => {
    const grid: Record<string, Record<string, LogEntryItem[]>> = {};

    classicDates.forEach(d => {
      grid[d.dateYMD] = {
        notte: [],
        colaz_pre: [],
        colaz_post: [],
        pranzo_pre: [],
        pranzo_post: [],
        cena_pre: [],
        cena_post: [],
        bedtime: []
      };
    });

    glucoseEntries.forEach(e => {
      const ymd = normalizeEntryDate(e.date);
      if (grid[ymd]) {
        const col = mapEntryToClassicColumn(e);
        if (grid[ymd][col]) {
          grid[ymd][col].push(e);
        }
      }
    });

    return grid;
  }, [classicDates, glucoseEntries]);

  // Day View Computations (24h)
  const dayYMD = formatYMD(selectedDate);
  const dayGlucoseEntries = useMemo(() => {
    return glucoseEntries.filter(e => normalizeEntryDate(e.date) === dayYMD);
  }, [glucoseEntries, dayYMD]);

  const dayCarbsTotal = useMemo(() => {
    const list = carbsEntries.filter(e => normalizeEntryDate(e.date) === dayYMD);
    return list.reduce((sum, e) => sum + parseVal(e.value), 0);
  }, [carbsEntries, dayYMD]);

  const dayExerciseTotal = useMemo(() => {
    const list = exerciseEntries.filter(e => normalizeEntryDate(e.date) === dayYMD);
    return list.reduce((sum, e) => sum + parseVal(e.duration || e.value), 0);
  }, [exerciseEntries, dayYMD]);

  // Week View Computations (7 Days)
  const weekDays = useMemo(() => {
    const list = [];
    const end = new Date(selectedDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const ymd = formatYMD(d);
      const isToday = ymd === formatYMD(new Date());
      const dayName = isToday ? 'Oggi' : italianDaysShort[d.getDay()];
      const dayNum = d.getDate();

      // Glucose in that day
      const dayEntries = glucoseEntries.filter(e => normalizeEntryDate(e.date) === ymd);

      // Carbs in that day
      const dayCarbs = carbsEntries
        .filter(e => normalizeEntryDate(e.date) === ymd)
        .reduce((s, e) => s + parseVal(e.value), 0);

      // Exercise in that day
      const dayEx = exerciseEntries
        .filter(e => normalizeEntryDate(e.date) === ymd)
        .reduce((s, e) => s + parseVal(e.duration || e.value), 0);

      list.push({
        date: d,
        dateYMD: ymd,
        dayName,
        dayNum,
        dayEntries,
        carbsTotal: dayCarbs,
        exerciseTotal: dayEx
      });
    }
    return list;
  }, [selectedDate, glucoseEntries, carbsEntries, exerciseEntries]);

  // Top banner display string for latest reading
  const bannerLatest = latestGlucose || (entries[0] ? entries[0] : null);
  const bannerTimeStr = bannerLatest ? `${normalizeEntryDate(bannerLatest.date) === formatYMD(new Date()) ? 'Oggi' : bannerLatest.date}, ${bannerLatest.time}` : 'Oggi, --:--';
  const bannerValueStr = bannerLatest ? bannerLatest.value : '--';
  const bannerValNum = parseVal(bannerValueStr);

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f5f7] dark:bg-[#121418] text-stone-900 dark:text-stone-100 select-none">

      {/* Standard App Header */}
      <OnTrackHeader
        title="FireTrack"
        showBack={true}
        onBack={onBack}
        showToolsMenu={true}
        onOpenTools={onOpenTools}
        onNavigate={onNavigate}
      />

      {/* Top Banner Card aligned with ReportsScreen & HistoryScreen */}
      <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 pt-3 space-y-3">
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            
            {/* Latest Reading Readout */}
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 rounded-xl shrink-0">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Calendario & Diario
                  </span>
                  <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-semibold px-2 py-0.5 rounded-md border border-stone-200/80 dark:border-stone-700">
                    {bannerTimeStr}
                  </span>
                </div>
                <div className="flex items-baseline space-x-2 mt-0.5">
                  <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${getGlucoseColor(bannerValNum)}`}>
                    {bannerValueStr}
                  </span>
                  <span className="text-xs font-bold text-stone-400 dark:text-stone-500">
                    mg/dL
                  </span>
                  {bannerLatest?.categoryName && (
                    <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                      • {bannerLatest.categoryName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 3 View Tabs: GIOR. | SETT. | CLASSICA */}
            <div className="inline-flex rounded-xl border border-stone-200 dark:border-stone-700 p-1 bg-stone-100 dark:bg-stone-800/90 shadow-2xs self-start sm:self-auto">
              <button
                onClick={() => setActiveTab('gior')}
                className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  activeTab === 'gior'
                    ? 'bg-[#3b677a] dark:bg-[#2c5364] text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/70 dark:hover:bg-stone-700/60'
                }`}
              >
                GIOR.
              </button>

              <button
                onClick={() => setActiveTab('sett')}
                className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  activeTab === 'sett'
                    ? 'bg-[#3b677a] dark:bg-[#2c5364] text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/70 dark:hover:bg-stone-700/60'
                }`}
              >
                SETT.
              </button>

              <button
                onClick={() => setActiveTab('classica')}
                className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  activeTab === 'classica'
                    ? 'bg-[#3b677a] dark:bg-[#2c5364] text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/70 dark:hover:bg-stone-700/60'
                }`}
              >
                CLASSICA
              </button>
            </div>

          </div>
        </div>

        {/* Sub-Header Navigation Bar matching design system ((i) < Date Range > (+)) */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl px-3 sm:px-4 py-2 flex items-center justify-between shadow-xs">

          {/* Left: Info Button (i) */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Legenda e Informazioni Target"
          >
            <Info className="w-4 h-4 stroke-[2.2]" />
          </button>

          {/* Center: Date Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevPeriod}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Periodo precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleSetToday}
              className="text-stone-800 dark:text-stone-200 font-bold text-xs sm:text-sm px-2.5 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Torna ad Oggi"
            >
              {getDateRangeLabel()}
            </button>

            <button
              onClick={handleNextPeriod}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Periodo successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Quick Add Button (+) */}
          <button
            onClick={() => onNavigate('add')}
            className="w-8 h-8 rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            title="Aggiungi Nuova Misurazione"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>

        </div>
      </div>

      {/* Main Viewport Content based on activeTab */}
      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-3 sm:p-4">

        {/* ======================================================== */}
        {/* TAB 1: GIOR. (Daily Timeline 0-24h with 3h markers)     */}
        {/* ======================================================== */}
        {activeTab === 'gior' && (
          <div className="space-y-3.5">

            {/* 24-Hour Graph Canvas Card */}
            <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs p-3.5 sm:p-4">

              {/* Hourly Ticks Header */}
              <div className="grid grid-cols-8 text-center text-xs font-bold text-stone-500 dark:text-stone-400 pb-2 border-b border-stone-200 dark:border-stone-800 pl-4 pr-4">
                <span>00</span>
                <span>03</span>
                <span>06</span>
                <span>09</span>
                <span>12</span>
                <span>15</span>
                <span>18</span>
                <span>21</span>
              </div>

              {/* Graph Plot Area with Side Target Bands */}
              <div className="relative h-64 sm:h-72 w-full my-2.5 bg-stone-50/50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden flex">

                {/* Left Side Target Range Stripe */}
                <div className="w-2.5 h-full flex flex-col shrink-0 border-r border-stone-200 dark:border-stone-800">
                  <div className="h-[30%] bg-[#c2185b]" title="Iperglicemia (> 180 mg/dL)" />
                  <div className="h-[50%] bg-[#8cc63f]" title="Target Normale (70 - 180 mg/dL)" />
                  <div className="h-[20%] bg-[#0288d1]" title="Ipoglicemia (< 70 mg/dL)" />
                </div>

                {/* Main 24-Hour Grid Canvas */}
                <div className="relative flex-1 h-full overflow-hidden">
                  {/* Vertical grid lines every 3 hours */}
                  <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="border-r border-stone-200/60 dark:border-stone-800/60 h-full" />
                    ))}
                  </div>

                  {/* Horizontal target guide lines */}
                  <div className="absolute top-[30%] left-0 right-0 border-b border-dashed border-stone-300 dark:border-stone-700 pointer-events-none" />
                  <div className="absolute top-[80%] left-0 right-0 border-b border-dashed border-stone-300 dark:border-stone-700 pointer-events-none" />

                  {/* Plotted Data Points */}
                  {dayGlucoseEntries.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-stone-400 dark:text-stone-500 text-xs font-medium">
                      Nessuna lettura di glicemia registrata per questo giorno.
                    </div>
                  ) : (
                    dayGlucoseEntries.map((e) => {
                      const valNum = parseVal(e.value);
                      const [h, m] = (e.time || '12:00').split(':').map(Number);
                      const totalMinutes = (h || 0) * 60 + (m || 0);
                      const leftPercent = Math.min(100, Math.max(0, (totalMinutes / 1440) * 100));

                      // Scale Y: 40 mg/dL (bottom) to 300 mg/dL (top)
                      const yPercent = Math.min(92, Math.max(8, 100 - ((valNum - 40) / 260) * 100));

                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEntry(e)}
                          style={{ left: `${leftPercent}%`, top: `${yPercent}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 cursor-pointer"
                          title={`${e.time} - ${e.value} mg/dL (${e.categoryName})`}
                        >
                          {/* Circle matching screenshot (magenta circle with white border / center dot) */}
                          <div className="w-5 h-5 rounded-full border-[3px] border-[#c2185b] bg-white dark:bg-stone-900 group-hover:scale-125 transition-transform shadow-md flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#c2185b]" />
                          </div>

                          {/* Tooltip on hover */}
                          <div className="hidden group-hover:block absolute bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-stone-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30">
                            {e.time}: {e.value} {e.unit}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Right Side Target Range Stripe */}
                <div className="w-2.5 h-full flex flex-col shrink-0 border-l border-stone-200 dark:border-stone-800">
                  <div className="h-[30%] bg-[#c2185b]" />
                  <div className="h-[50%] bg-[#8cc63f]" />
                  <div className="h-[20%] bg-[#0288d1]" />
                </div>

              </div>

            </div>

            {/* Bottom Summary Table 1: CARBOIDRATI */}
            <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-3.5 py-2.5 bg-amber-50/50 dark:bg-amber-950/20 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <div className="flex items-center space-x-1.5">
                  <Utensils className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>CARBOIDRATI</span>
                </div>
                <span className="text-amber-700 dark:text-amber-400 font-bold">
                  Totale giornaliero: {dayCarbsTotal} g
                </span>
              </div>

              {/* 8-Hour block values */}
              <div className="grid grid-cols-8 divide-x divide-stone-200 dark:divide-stone-800 text-center py-2.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                {Array.from({ length: 8 }).map((_, blockIdx) => {
                  const blockStartH = blockIdx * 3;
                  const blockEndH = blockStartH + 3;
                  const carbsInBlock = carbsEntries
                    .filter(e => {
                      if (normalizeEntryDate(e.date) !== dayYMD) return false;
                      const [h] = (e.time || '0:0').split(':').map(Number);
                      return h >= blockStartH && h < blockEndH;
                    })
                    .reduce((sum, e) => sum + parseVal(e.value), 0);

                  return (
                    <div key={blockIdx} className="p-1">
                      <span className={carbsInBlock > 0 ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-400 dark:text-stone-600'}>
                        {carbsInBlock > 0 ? `${carbsInBlock}g` : '0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Summary Table 2: ATTIVITÀ FISICA */}
            <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-3.5 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <div className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>ATTIVITÀ FISICA</span>
                </div>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  Totale giornaliero: {dayExerciseTotal} min
                </span>
              </div>

              {/* 8-Hour block values */}
              <div className="grid grid-cols-8 divide-x divide-stone-200 dark:divide-stone-800 text-center py-2.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                {Array.from({ length: 8 }).map((_, blockIdx) => {
                  const blockStartH = blockIdx * 3;
                  const blockEndH = blockStartH + 3;
                  const exInBlock = exerciseEntries
                    .filter(e => {
                      if (normalizeEntryDate(e.date) !== dayYMD) return false;
                      const [h] = (e.time || '0:0').split(':').map(Number);
                      return h >= blockStartH && h < blockEndH;
                    })
                    .reduce((sum, e) => sum + parseVal(e.duration || e.value), 0);

                  return (
                    <div key={blockIdx} className="p-1">
                      <span className={exInBlock > 0 ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-600'}>
                        {exInBlock > 0 ? `${exInBlock}m` : '0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: SETT. (7-Day Weekly Grid View)                   */}
        {/* ======================================================== */}
        {activeTab === 'sett' && (
          <div className="space-y-3.5">

            {/* 7-Day Graph Canvas Card */}
            <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs p-3.5 sm:p-4">

              {/* 7 Columns Day Names Header */}
              <div className="grid grid-cols-7 text-center text-xs font-bold text-stone-700 dark:text-stone-300 pb-2 border-b border-stone-200 dark:border-stone-800 pl-4 pr-4">
                {weekDays.map((d, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className={d.dayName === 'Oggi' ? 'text-teal-600 dark:text-teal-400 font-extrabold' : ''}>
                      {d.dayName}
                    </span>
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">
                      {d.dayNum}
                    </span>
                  </div>
                ))}
              </div>

              {/* Graph Plot Area with Side Target Bands */}
              <div className="relative h-64 sm:h-72 w-full my-2.5 bg-stone-50/50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden flex">

                {/* Left Side Target Range Stripe */}
                <div className="w-2.5 h-full flex flex-col shrink-0 border-r border-stone-200 dark:border-stone-800">
                  <div className="h-[30%] bg-[#c2185b]" />
                  <div className="h-[50%] bg-[#8cc63f]" />
                  <div className="h-[20%] bg-[#0288d1]" />
                </div>

                {/* Main 7-Day Grid Canvas */}
                <div className="relative flex-1 h-full overflow-hidden">
                  {/* Vertical grid lines for 7 days */}
                  <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="border-r border-stone-200/60 dark:border-stone-800/60 h-full" />
                    ))}
                  </div>

                  {/* Horizontal target guide lines */}
                  <div className="absolute top-[30%] left-0 right-0 border-b border-dashed border-stone-300 dark:border-stone-700 pointer-events-none" />
                  <div className="absolute top-[80%] left-0 right-0 border-b border-dashed border-stone-300 dark:border-stone-700 pointer-events-none" />

                  {/* Plotted Data Points across the 7 days */}
                  {weekDays.map((dayItem, dayIdx) => {
                    const colWidth = 100 / 7;
                    const colCenter = dayIdx * colWidth + colWidth / 2;

                    return dayItem.dayEntries.map((e) => {
                      const valNum = parseVal(e.value);
                      const [h, m] = (e.time || '12:00').split(':').map(Number);
                      const totalMinutes = (h || 0) * 60 + (m || 0);
                      // Slight jitter/offset horizontally within column based on hour of day
                      const offsetWithinCol = ((totalMinutes / 1440) - 0.5) * (colWidth * 0.7);
                      const leftPercent = colCenter + offsetWithinCol;

                      // Scale Y: 40 mg/dL (bottom) to 300 mg/dL (top)
                      const yPercent = Math.min(92, Math.max(8, 100 - ((valNum - 40) / 260) * 100));

                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEntry(e)}
                          style={{ left: `${leftPercent}%`, top: `${yPercent}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 cursor-pointer"
                          title={`${dayItem.dayName} ${e.time} - ${e.value} mg/dL (${e.categoryName})`}
                        >
                          <div className="w-5 h-5 rounded-full border-[3px] border-[#c2185b] bg-white dark:bg-stone-900 group-hover:scale-125 transition-transform shadow-md flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#c2185b]" />
                          </div>

                          <div className="hidden group-hover:block absolute bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-stone-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30">
                            {dayItem.dayName} {e.time}: {e.value} {e.unit}
                          </div>
                        </button>
                      );
                    });
                  })}
                </div>

                {/* Right Side Target Range Stripe */}
                <div className="w-2.5 h-full flex flex-col shrink-0 border-l border-stone-200 dark:border-stone-800">
                  <div className="h-[30%] bg-[#c2185b]" />
                  <div className="h-[50%] bg-[#8cc63f]" />
                  <div className="h-[20%] bg-[#0288d1]" />
                </div>

              </div>

            </div>

            {/* Bottom Summary Table 1: CARBOIDRATI Totali giornalieri */}
            <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-3.5 py-2.5 bg-amber-50/50 dark:bg-amber-950/20 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <div className="flex items-center space-x-1.5">
                  <Utensils className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>CARBOIDRATI</span>
                </div>
                <span className="text-stone-500 dark:text-stone-400 font-medium">
                  Totali giornalieri (grammi)
                </span>
              </div>

              {/* 7 Daily Values matching screenshot */}
              <div className="grid grid-cols-7 divide-x divide-stone-200 dark:divide-stone-800 text-center py-2.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                {weekDays.map((d, i) => (
                  <div key={i} className="p-1">
                    <span className={d.carbsTotal > 0 ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-400 dark:text-stone-600'}>
                      {d.carbsTotal > 0 ? d.carbsTotal : '0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Summary Table 2: ATTIVITÀ FISICA Totali giornalieri */}
            <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-3.5 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <div className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>ATTIVITÀ FISICA</span>
                </div>
                <span className="text-stone-500 dark:text-stone-400 font-medium">
                  Totali giornalieri (minuti)
                </span>
              </div>

              {/* 7 Daily Values matching screenshot */}
              <div className="grid grid-cols-7 divide-x divide-stone-200 dark:divide-stone-800 text-center py-2.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                {weekDays.map((d, i) => (
                  <div key={i} className="p-1">
                    <span className={d.exerciseTotal > 0 ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-600'}>
                      {d.exerciseTotal > 0 ? d.exerciseTotal : '0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: CLASSICA (Classic Tabular Medical Logbook Grid)   */}
        {/* ======================================================== */}
        {activeTab === 'classica' && (
          <div className="space-y-3.5">
            {/* Filter Toolbar aligned with ReportsScreen */}
            <div className="bg-white dark:bg-[#1a1d24] p-3.5 sm:p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">

              {/* Top Row: Temporal Presets + Export Button */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Preset Day Buttons (7, 14, 30, 60, 90, Tutto) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mr-1 uppercase tracking-wide flex items-center gap-1">
                    <CalendarRange className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Periodo:</span>
                  </span>
                  {([7, 14, 30, 60, 90] as PeriodType[]).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        setSelectedPeriod(period);
                        setSelectedYear('ALL');
                        setSelectedMonth('ALL');
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        selectedPeriod === period && selectedYear === 'ALL'
                          ? 'bg-[#3b677a] dark:bg-[#2c5364] text-white shadow-xs'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {period} gg
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPeriod('all');
                      setSelectedYear('ALL');
                      setSelectedMonth('ALL');
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedPeriod === 'all' && selectedYear === 'ALL'
                        ? 'bg-[#3b677a] dark:bg-[#2c5364] text-white shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    Tutto
                  </button>

                  {hasActiveClassicFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-2 py-1 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg flex items-center space-x-1 ml-1 transition-colors cursor-pointer"
                      title="Reimposta tutti i filtri"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* PDF Export Button */}
                <div className="flex items-center space-x-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    disabled={isGeneratingPdf || classicDates.length === 0}
                    className="px-3.5 py-1.5 bg-[#d93838] hover:bg-[#b82e2e] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Esporta il diario classico in documento PDF stampabile"
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    <span>{isGeneratingPdf ? 'Generazione...' : 'Esporta PDF'}</span>
                  </button>
                </div>
              </div>

              {/* Second Row: Year + Month Dropdowns + Active Period Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-stone-100 dark:border-stone-800/80 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-stone-600 dark:text-stone-400">Anno:</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-800 dark:text-stone-200 focus:ring-1 focus:ring-teal-600 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">Tutti gli anni ({entries.length})</option>
                      {availableYearsWithCount.map(({ year, count }) => (
                        <option key={year} value={year}>{year} ({count})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-stone-600 dark:text-stone-400">Mese:</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      disabled={selectedYear === 'ALL'}
                      className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-800 dark:text-stone-200 focus:ring-1 focus:ring-teal-600 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="ALL">
                        {selectedYear === 'ALL' ? 'Tutti i mesi' : `Tutti i mesi (${selectedYearTotalCount})`}
                      </option>
                      {selectedYear !== 'ALL' && availableMonthsWithCount.map(({ month, count }) => (
                        <option key={month} value={month}>{MONTH_NAMES[month] || month} ({count})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium bg-stone-50 dark:bg-stone-800/60 px-2.5 py-1 rounded-lg border border-stone-200/80 dark:border-stone-700">
                  <span>Periodo: <strong className="text-stone-800 dark:text-stone-200">{classicPeriodRangeLabel}</strong></span>
                  <span className="mx-1.5">•</span>
                  <span>{classicDates.length} giorni visualizzati</span>
                </div>
              </div>

            </div>

            {/* Classic Medical Table */}
            <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">

            {/* Scrollable Container */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center">

                {/* Table Column Headers */}
                <thead>
                  {/* Top Level Category Headers */}
                  <tr className="bg-stone-100/90 dark:bg-stone-800/90 text-[11px] font-bold text-stone-800 dark:text-stone-200 border-b border-stone-200 dark:border-stone-700">
                    <th className="w-14 p-2.5 border-r border-stone-200 dark:border-stone-700 font-bold text-stone-500 dark:text-stone-400">
                      Data
                    </th>
                    <th className="w-14 p-2.5 border-r border-stone-200 dark:border-stone-700">
                      Notte
                    </th>
                    <th colSpan={2} className="p-2.5 border-r border-stone-200 dark:border-stone-700 bg-stone-200/40 dark:bg-stone-800">
                      Prima colazione
                    </th>
                    <th colSpan={2} className="p-2.5 border-r border-stone-200 dark:border-stone-700">
                      Pranzo
                    </th>
                    <th colSpan={2} className="p-2.5 border-r border-stone-200 dark:border-stone-700 bg-stone-200/40 dark:bg-stone-800">
                      Cena
                    </th>
                    <th className="w-20 p-2.5">
                      Ora di coricarsi
                    </th>
                  </tr>

                  {/* Sub-Header Row with Apple Icons (Pre-meal / Post-meal) */}
                  <tr className="bg-white dark:bg-[#1a1d24] border-b-2 border-stone-300 dark:border-stone-700 text-xs">
                    <th className="p-1.5 border-r border-stone-200 dark:border-stone-700" />
                    <th className="p-1.5 border-r border-stone-200 dark:border-stone-700" />

                    {/* Colazione Pre & Post */}
                    <th className="p-1.5 border-r border-stone-100 dark:border-stone-800 w-12 text-center" title="Pre pasto">
                      <div className="flex justify-center">
                        <WholeAppleIcon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                      </div>
                    </th>
                    <th className="p-1.5 border-r border-stone-200 dark:border-stone-700 w-12 text-center" title="Post pasto">
                      <div className="flex justify-center">
                        <AppleCoreIcon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                      </div>
                    </th>

                    {/* Pranzo Pre & Post */}
                    <th className="p-1.5 border-r border-stone-100 dark:border-stone-800 w-12 text-center" title="Pre pasto">
                      <div className="flex justify-center">
                        <WholeAppleIcon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                      </div>
                    </th>
                    <th className="p-1.5 border-r border-stone-200 dark:border-stone-700 w-12 text-center" title="Post pasto">
                      <div className="flex justify-center">
                        <AppleCoreIcon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                      </div>
                    </th>

                    {/* Cena Pre & Post */}
                    <th className="p-1.5 border-r border-stone-100 dark:border-stone-800 w-12 text-center" title="Pre pasto">
                      <div className="flex justify-center">
                        <WholeAppleIcon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                      </div>
                    </th>
                    <th className="p-1.5 border-r border-stone-200 dark:border-stone-700 w-12 text-center" title="Post pasto">
                      <div className="flex justify-center">
                        <AppleCoreIcon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                      </div>
                    </th>

                    {/* Bedtime */}
                    <th className="p-1.5" />
                  </tr>
                </thead>

                {/* Table Body: Rows for all dates in the database scrolling down */}
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs font-semibold">
                  {classicDates.map((dObj) => {
                    const row = classicGridData[dObj.dateYMD] || {
                      notte: [],
                      colaz_pre: [],
                      colaz_post: [],
                      pranzo_pre: [],
                      pranzo_post: [],
                      cena_pre: [],
                      cena_post: [],
                      bedtime: []
                    };

                    const renderCell = (cellEntries: LogEntryItem[], colKey: string, borderRight = true) => {
                      return (
                        <td
                          className={`p-2 min-h-[44px] align-middle ${borderRight ? 'border-r border-stone-200 dark:border-stone-800' : ''} hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer`}
                          onClick={() => {
                            if (cellEntries.length > 0) {
                              setSelectedEntry(cellEntries[0]);
                            } else {
                              onNavigate('add');
                            }
                          }}
                        >
                          {cellEntries.length === 0 ? (
                            <span className="text-transparent select-none">-</span>
                          ) : (
                            <div className="flex flex-col items-center justify-center space-y-0.5">
                              {cellEntries.map(e => {
                                const valNum = parseVal(e.value);
                                return (
                                  <span
                                    key={e.id}
                                    className={`font-bold text-sm leading-tight block ${getGlucoseColor(valNum)}`}
                                    title={`${e.time} - ${e.categoryName}${e.note ? `: ${e.note}` : ''}`}
                                  >
                                    {Math.round(valNum) || e.value}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    };

                    return (
                      <tr key={dObj.dateYMD} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors">

                        {/* Date Column (e.g. 13/8, 12/8, 11/8) */}
                        <td className="p-2 border-r-2 border-stone-300 dark:border-stone-700 font-bold text-stone-700 dark:text-stone-300 bg-stone-50/80 dark:bg-stone-900/60 whitespace-nowrap text-center">
                          {dObj.label}
                        </td>

                        {/* 1. Notte */}
                        {renderCell(row.notte, 'notte')}

                        {/* 2. Colazione Pre (🍎) */}
                        {renderCell(row.colaz_pre, 'colaz_pre')}

                        {/* 3. Colazione Post (🍏) */}
                        {renderCell(row.colaz_post, 'colaz_post')}

                        {/* 4. Pranzo Pre (🍎) */}
                        {renderCell(row.pranzo_pre, 'pranzo_pre')}

                        {/* 5. Pranzo Post (🍏) */}
                        {renderCell(row.pranzo_post, 'pranzo_post')}

                        {/* 6. Cena Pre (🍎) */}
                        {renderCell(row.cena_pre, 'cena_pre')}

                        {/* 7. Cena Post (🍏) */}
                        {renderCell(row.cena_post, 'cena_post')}

                        {/* 8. Ora di coricarsi */}
                        {renderCell(row.bedtime, 'bedtime', false)}

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>

            {/* Bottom Status / Count Info */}
            <div className="p-3 bg-stone-50 dark:bg-stone-800/60 border-t border-stone-200 dark:border-stone-800 text-center text-xs text-stone-500 dark:text-stone-400">
              Visualizzazione di {classicDates.length} giorni registrati ({classicPeriodRangeLabel}).
            </div>

          </div>
        </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* Modal 1: Entry Details Popup when clicking on cell/dot    */}
      {/* ======================================================== */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  Dettaglio Misurazione
                </span>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 dark:text-stone-400 font-medium">Valore Glicemia:</span>
                <span className={`text-2xl font-extrabold ${getGlucoseColor(parseVal(selectedEntry.value))}`}>
                  {selectedEntry.value} <span className="text-xs font-semibold text-stone-400">{selectedEntry.unit}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-400 block font-medium">Data & Ora</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">{selectedEntry.date} • {selectedEntry.time}</span>
                </div>
                <div className="bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-400 block font-medium">Categoria</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">{selectedEntry.categoryName}</span>
                </div>
              </div>

              {selectedEntry.mealTiming && (
                <div className="flex items-center space-x-2 text-xs bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 font-bold">
                  {selectedEntry.mealTiming === 'pre' ? (
                    <>
                      <WholeAppleIcon className="w-4 h-4 text-amber-800 dark:text-amber-400" />
                      <span>Pre pasto</span>
                    </>
                  ) : (
                    <>
                      <AppleCoreIcon className="w-4 h-4 text-amber-800 dark:text-amber-400" />
                      <span>Post pasto</span>
                    </>
                  )}
                </div>
              )}

              {selectedEntry.note && (
                <div className="bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
                  <span className="text-stone-400 block font-medium">Note:</span>
                  <p className="text-stone-700 dark:text-stone-300 font-medium mt-0.5">{selectedEntry.note}</p>
                </div>
              )}
            </div>

            <div className="pt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 dark:border-stone-800">
              {onDeleteEntry && (
                showDeleteConfirm ? (
                  <div className="flex items-center space-x-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-2.5 py-1 rounded-lg">
                    <span className="text-[11px] font-bold text-red-700 dark:text-red-400">Confermi?</span>
                    <button
                      type="button"
                      onClick={() => {
                        const idToDelete = selectedEntry.id;
                        setSelectedEntry(null);
                        setShowDeleteConfirm(false);
                        onDeleteEntry(idToDelete);
                      }}
                      className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded cursor-pointer"
                    >
                      Sì, elimina
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 text-[11px] rounded cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                    title="Elimina questa lettura"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Elimina</span>
                  </button>
                )
              )}

              <div className="flex items-center space-x-2 ml-auto">
                {onEditEntry && (
                  <button
                    type="button"
                    onClick={() => {
                      const toEdit = selectedEntry;
                      setSelectedEntry(null);
                      setShowDeleteConfirm(false);
                      onEditEntry(toEdit);
                    }}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Modifica</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEntry(null);
                    setShowDeleteConfirm(false);
                  }}
                  className="px-3.5 py-1.5 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Modal 2: Info & Target Ranges Legend ((i) Button)         */}
      {/* ======================================================== */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  Guida Valori & Simboli
                </span>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-700 dark:text-stone-300">

              {/* Target Ranges */}
              <div>
                <h4 className="font-bold text-stone-900 dark:text-stone-100 mb-1.5">Zone di Glicemia:</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                    <span className="font-bold text-[#0288d1] flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0288d1]" />
                      <span>Ipoglicemia</span>
                    </span>
                    <span className="font-mono font-bold text-stone-700 dark:text-stone-300">&lt; 70 mg/dL</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl">
                    <span className="font-bold text-[#2e7d32] dark:text-emerald-400 flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2e7d32]" />
                      <span>Target Ideale (A digiuno / Pre-pasto)</span>
                    </span>
                    <span className="font-mono font-bold text-stone-700 dark:text-stone-300">70 - 130 mg/dL</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-lime-50 dark:bg-lime-950/30 border border-lime-200 dark:border-lime-900/50 rounded-xl">
                    <span className="font-bold text-[#827717] dark:text-lime-400 flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#8cc63f]" />
                      <span>Target Post-Prandiale</span>
                    </span>
                    <span className="font-mono font-bold text-stone-700 dark:text-stone-300">&lt; 180 mg/dL</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/50 rounded-xl">
                    <span className="font-bold text-[#c2185b] flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#c2185b]" />
                      <span>Iperglicemia</span>
                    </span>
                    <span className="font-mono font-bold text-stone-700 dark:text-stone-300">&gt; 180 mg/dL</span>
                  </div>
                </div>
              </div>

              {/* Simboli Pasti */}
              <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 mb-1.5">Simboli Momento Pasto:</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-xl flex items-center space-x-2">
                    <WholeAppleIcon className="w-4 h-4 text-stone-800 dark:text-stone-200" />
                    <div>
                      <span className="font-bold block text-stone-800 dark:text-stone-200">Pre pasto</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-xl flex items-center space-x-2">
                    <AppleCoreIcon className="w-4 h-4 text-stone-800 dark:text-stone-200" />
                    <div>
                      <span className="font-bold block text-stone-800 dark:text-stone-200">Post pasto</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 bg-[#3b677a] hover:bg-[#2f596b] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Ho Capito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Printable Area for PDF Export (Classic Tabular Diary)    */}
      {/* Hidden from screen, captured in Landscape A4 for PDF     */}
      {/* ======================================================== */}
      <div
        id="printable-classic-calendar-area"
        data-pdf-section="true"
        data-pdf-orientation="landscape"
        className="fixed -left-[9999px] top-0 bg-white text-stone-900 font-sans p-6 w-[1120px] space-y-4"
        style={{ zIndex: -100 }}
      >
        {/* Report Header */}
        <div className="flex items-start justify-between border-b-2 border-[#3b677a] pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black text-[#3b677a] tracking-tight">OnTrack / FireTrack</span>
              <span className="text-xs bg-[#3b677a] text-white font-bold px-2 py-0.5 rounded">DIARIO MEDICO</span>
            </div>
            <h1 className="text-lg font-bold text-stone-900 mt-1">
              Diario Glicemico Multicolonna (Visualizzazione Classica)
            </h1>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p><span className="text-stone-500">Utente:</span> <strong className="text-stone-900 font-bold">{patientName}</strong></p>
            <p><span className="text-stone-500">Periodo:</span> <strong className="text-[#3b677a]">{classicPeriodRangeLabel}</strong></p>
            <p><span className="text-stone-500">Data emissione:</span> {new Date().toLocaleDateString('it-IT')} {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        {/* Legend Summary Bar */}
        <div className="bg-stone-50 p-2.5 rounded border border-stone-200 flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-4">
            <span className="font-bold text-stone-700">Target Glicemia:</span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0288d1] inline-block" />
              <span className="text-stone-600">&lt;70 Ipo</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2e7d32] inline-block" />
              <span className="text-stone-600">70-130 Ideale</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8cc63f] inline-block" />
              <span className="text-stone-600">&lt;180 Post-prandiale</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c2185b] inline-block" />
              <span className="text-stone-600">&gt;180 Iper</span>
            </span>
          </div>

          <div className="flex items-center space-x-3 text-stone-700">
            <span className="flex items-center space-x-1">
              <WholeAppleIcon className="w-3.5 h-3.5 text-stone-800" />
              <span>Pre pasto</span>
            </span>
            <span className="flex items-center space-x-1">
              <AppleCoreIcon className="w-3.5 h-3.5 text-stone-800" />
              <span>Post pasto</span>
            </span>
          </div>
        </div>

        {/* Classic Printable Table */}
        <div className="border border-stone-300 rounded overflow-hidden">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="bg-[#3b677a] text-white font-bold text-[11px]">
                <th className="p-2 border-r border-stone-400 w-16">Data</th>
                <th className="p-2 border-r border-stone-400 w-24">Notte</th>
                <th colSpan={2} className="p-2 border-r border-stone-400 bg-[#2f596b]">Prima colazione</th>
                <th colSpan={2} className="p-2 border-r border-stone-400 bg-[#3b677a]">Pranzo</th>
                <th colSpan={2} className="p-2 border-r border-stone-400 bg-[#2f596b]">Cena</th>
                <th className="p-2 w-28">Ora di coricarsi</th>
              </tr>
              <tr className="bg-stone-100 border-b-2 border-stone-400 text-[10px] font-bold text-stone-700">
                <th className="p-1 border-r border-stone-300" />
                <th className="p-1 border-r border-stone-300">Glicemia</th>
                <th className="p-1 border-r border-stone-200 w-20 text-center">🍎 Pre</th>
                <th className="p-1 border-r border-stone-300 w-20 text-center">🍏 Post</th>
                <th className="p-1 border-r border-stone-200 w-20 text-center">🍎 Pre</th>
                <th className="p-1 border-r border-stone-300 w-20 text-center">🍏 Post</th>
                <th className="p-1 border-r border-stone-200 w-20 text-center">🍎 Pre</th>
                <th className="p-1 border-r border-stone-300 w-20 text-center">🍏 Post</th>
                <th className="p-1">Glicemia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-300 font-semibold">
              {classicDates.map((dObj, idx) => {
                const row = classicGridData[dObj.dateYMD] || {
                  notte: [],
                  colaz_pre: [],
                  colaz_post: [],
                  pranzo_pre: [],
                  pranzo_post: [],
                  cena_pre: [],
                  cena_post: [],
                  bedtime: []
                };

                const renderPrintCell = (cellEntries: LogEntryItem[], borderRight = true) => (
                  <td className={`p-1.5 align-middle ${borderRight ? 'border-r border-stone-300' : ''}`}>
                    {cellEntries.length === 0 ? (
                      <span className="text-stone-300">-</span>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-1">
                        {cellEntries.map(e => {
                          const valNum = parseVal(e.value);
                          let borderCol = 'border-[#2e7d32]'; // 70-130 Ideale (Verde scuro)
                          if (valNum < 70) {
                            borderCol = 'border-[#0288d1]'; // <70 Ipo (Azzurro)
                          } else if (valNum > 180) {
                            borderCol = 'border-[#c2185b]'; // >180 Iper (Rosso fucsia)
                          } else if (valNum > 130) {
                            borderCol = 'border-[#8cc63f]'; // <180 Post-prandiale (Lime)
                          }
                          return (
                            <span
                              key={e.id}
                              className={`font-black text-[12px] block bg-white text-stone-950 px-1.5 py-0.5 rounded-md border-2 ${borderCol} font-mono shadow-xs min-w-[34px] text-center`}
                            >
                              {Math.round(valNum) || e.value}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                );

                return (
                  <tr key={dObj.dateYMD} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                    <td className="p-1.5 border-r-2 border-stone-400 font-bold text-stone-800 bg-stone-100/60 whitespace-nowrap">
                      {dObj.label}
                    </td>
                    {renderPrintCell(row.notte)}
                    {renderPrintCell(row.colaz_pre)}
                    {renderPrintCell(row.colaz_post)}
                    {renderPrintCell(row.pranzo_pre)}
                    {renderPrintCell(row.pranzo_post)}
                    {renderPrintCell(row.cena_pre)}
                    {renderPrintCell(row.cena_post)}
                    {renderPrintCell(row.bedtime, false)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="flex items-center justify-between text-[10px] text-stone-500 pt-2 border-t border-stone-200">
          <span>OnTrack / FireTrack • Diario Medico Autocertificato</span>
          <span>{classicDates.length} giorni registrati • Totale letture visualizzate: {classicDates.reduce((acc, d) => {
            const row = classicGridData[d.dateYMD];
            if (!row) return acc;
            return acc + (Object.values(row) as LogEntryItem[][]).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
          }, 0)}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Toast Notification on PDF Export                          */}
      {/* ======================================================== */}
      {exportNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-bold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{exportNotification}</span>
        </div>
      )}

    </div>
  );
};
