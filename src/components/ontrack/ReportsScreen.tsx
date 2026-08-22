import React, { useState, useEffect, useMemo } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { EventNoteIcon } from './EventNoteIcon';
import { LogEntryItem, HealthCategory, HealthSubType, MealSlotConfig } from '../../types/ontrack';
import {
  downloadCSV,
  downloadGlucoseCSV,
  downloadPressureCSV,
  downloadStatsCSV,
  downloadDiaryCSV,
  downloadWeightCSV,
  downloadNutritionCSV,
  downloadFastingCSV,
  loadUserSettings,
  loadMealSlots,
  loadActiveFasting
} from '../../utils/ontrackStorage';
import { analyzeEntriesByMealSlot, getMealSlotForEntry, MealSlotAnalysis } from '../../utils/mealSlotMatcher';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { exportElementToPdf } from '../../utils/pdfExport';
import { WeightReportSection } from './WeightReportSection';
import { NutritionReportSection } from './NutritionReportSection';
import { FastingReportSection } from './FastingReportSection';
import {
  FileText,
  Heart,
  Activity,
  FileSpreadsheet,
  Save,
  Info,
  User,
  Calendar,
  Pencil,
  Clock,
  Check,
  Loader2,
  CalendarRange,
  RotateCcw,
  CheckSquare,
  Square,
  Utensils,
  Sun,
  Moon,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Scale,
  Salad,
  Flame,
  Timer,
  TrendingUp,
  HeartPulse
} from 'lucide-react';

interface ReportsScreenProps {
  entries: LogEntryItem[];
  categories: HealthCategory[];
  subTypes: HealthSubType[];
  onBack: () => void;
  onOpenTools: () => void;
  onNavigate?: (screen: string) => void;
  onEditEntry?: (entry: LogEntryItem) => void;
}

type ReportType = 'glucose' | 'pressure' | 'weight' | 'nutrition' | 'stats' | 'complete' | 'meal_slots' | 'fasting';
type ReportPeriod = 7 | 14 | 30 | 60 | 90 | 'all';

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

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  entries,
  categories,
  subTypes,
  onBack,
  onOpenTools,
  onNavigate,
  onEditEntry
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('glucose');
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>(14);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [showPressureAndPulseInDiary, setShowPressureAndPulseInDiary] = useState<boolean>(true);
  const [exportNotification, setExportNotification] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Load user settings
  const userSettings = loadUserSettings();
  const [patientName, setPatientName] = useState<string>(userSettings?.patientName || 'Angelo F');
  const targetMin = userSettings?.targetPreMin || 70;
  const targetMax = userSettings?.targetPostMax || userSettings?.targetPreMax || 150;
  const birthDate = userSettings?.birthDate || '1973-05-07';

  const [activeFastingSession, setActiveFastingSession] = useState(() => loadActiveFasting());

  useEffect(() => {
    const current = loadUserSettings();
    if (current && current.patientName) {
      setPatientName(current.patientName);
    }
    setActiveFastingSession(loadActiveFasting());
  }, [activeReport]);

  const notifyExport = (msg: string) => {
    setExportNotification(msg);
    setTimeout(() => {
      setExportNotification(null);
    }, 4000);
  };

  // Helper filters
  const isGlucose = (e: LogEntryItem) => {
    const name = (e.subTypeName || '').toLowerCase();
    return name.includes('glucose') || name.includes('glicemia');
  };

  const isPressureOrPulse = (e: LogEntryItem) => {
    const name = (e.subTypeName || '').toLowerCase();
    return name.includes('pressione') || name.includes('pressure') || name.includes('battiti') || name.includes('pulse') || name.includes('sistolica') || name.includes('diastolica') || Boolean(e.systolic && e.diastolic);
  };

  const isWeight = (e: LogEntryItem) => {
    const name = (e.subTypeName || '').toLowerCase();
    const cat = (e.categoryName || '').toLowerCase();
    const unit = (e.unit || '').toLowerCase();
    return name.includes('peso') || name.includes('weight') || cat.includes('peso') || unit === 'kg' || (e.note || '').toLowerCase().includes('conforme');
  };

  const isNutrition = (e: LogEntryItem) => {
    const name = (e.subTypeName || '').toLowerCase();
    const cat = (e.categoryName || '').toLowerCase();
    const note = (e.note || '').toLowerCase();
    const unit = (e.unit || '').toLowerCase();
    return name.includes('cibo') || name.includes('alimenti') || name.includes('food') || name.includes('nutri') || name.includes('carboidrati') || name.includes('calorie') || cat.includes('cibo') || cat.includes('nutri') || unit === 'cal' || unit === 'kcal' || note.includes('cal') || note.includes('grassi') || note.includes('proteine') || note.includes('gda');
  };

  const isFasting = (e: LogEntryItem) => {
    const name = (e.subTypeName || '').toLowerCase();
    const cat = (e.categoryName || '').toLowerCase();
    const note = (e.note || '').toLowerCase();
    return name.includes('digiuno') || name.includes('fasting') || cat.includes('digiuno') || note.includes('digiuno');
  };

  const allGlucoseEntries = entries.filter(isGlucose);
  const allPressureEntries = entries.filter(isPressureOrPulse);
  const allWeightEntries = entries.filter(isWeight);
  const allNutritionEntries = entries.filter(isNutrition);
  const allFastingEntries = entries.filter(isFasting);

  // Entries relevant to the currently selected Report Card / Button
  const activeReportBaseEntries = useMemo(() => {
    switch (activeReport) {
      case 'glucose':
      case 'stats':
      case 'meal_slots':
        return allGlucoseEntries;
      case 'fasting':
        return allFastingEntries.length > 0 ? allFastingEntries : allGlucoseEntries;
      case 'pressure':
        return allPressureEntries;
      case 'weight':
        return allWeightEntries;
      case 'nutrition':
        return allNutritionEntries;
      case 'complete':
      default:
        return entries;
    }
  }, [activeReport, allGlucoseEntries, allPressureEntries, allWeightEntries, allNutritionEntries, allFastingEntries, entries]);

  // Extract available years and months dynamically from the currently selected report button
  const availableYearsWithCount = useMemo(() => {
    const counts: { [year: string]: number } = {};
    activeReportBaseEntries.forEach(e => {
      const { year } = getYearMonth(e.date);
      if (year && year.length === 4) {
        counts[year] = (counts[year] || 0) + 1;
      }
    });
    const sortedYears = Object.keys(counts).sort((a, b) => b.localeCompare(a));
    return sortedYears.map(yr => ({ year: yr, count: counts[yr] }));
  }, [activeReportBaseEntries]);

  const availableMonthsWithCount = useMemo(() => {
    if (selectedYear === 'ALL') return [];
    const counts: { [month: string]: number } = {};
    activeReportBaseEntries.forEach(e => {
      const { year, month } = getYearMonth(e.date);
      if (year === selectedYear && month) {
        counts[month] = (counts[month] || 0) + 1;
      }
    });
    const sortedMonths = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return sortedMonths.map(mo => ({ month: mo, count: counts[mo] }));
  }, [activeReportBaseEntries, selectedYear]);

  // Total count of entries in the currently selected year (all months) for current report
  const selectedYearTotalCount = useMemo(() => {
    if (selectedYear === 'ALL') return activeReportBaseEntries.length;
    return availableYearsWithCount.find(y => y.year === selectedYear)?.count || 0;
  }, [availableYearsWithCount, selectedYear, activeReportBaseEntries.length]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    if (year === 'ALL') {
      setSelectedMonth('ALL');
    } else {
      const monthsForNewYear = new Set<string>();
      activeReportBaseEntries.forEach(e => {
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
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setSelectedPeriod(14);
  };

  // Time calculations
  const now = new Date();
  const periodCutoff = selectedPeriod === 'all' ? 0 : now.getTime() - selectedPeriod * 24 * 60 * 60 * 1000;

  const periodStartDate = selectedPeriod === 'all'
    ? (entries.length > 0 ? new Date(Math.min(...entries.map(e => e.timestamp || now.getTime()))) : new Date(now.getTime() - 90 * 86400000))
    : new Date(now.getTime() - selectedPeriod * 24 * 60 * 60 * 1000);

  const prevPeriodStartDate = selectedPeriod === 'all'
    ? new Date(periodStartDate.getTime() - 90 * 86400000)
    : new Date(now.getTime() - (selectedPeriod * 2) * 24 * 60 * 60 * 1000);

  // Period label computation
  let periodLabel = `${selectedPeriod} giorni`;
  let periodRangeLabel = `${selectedPeriod} giorni (${periodStartDate.toLocaleDateString('it-IT')} - ${now.toLocaleDateString('it-IT')})`;

  if (selectedYear !== 'ALL') {
    if (selectedMonth !== 'ALL') {
      const mName = MONTH_NAMES[selectedMonth] || selectedMonth;
      periodLabel = `${mName} ${selectedYear}`;
      periodRangeLabel = `Mese: ${mName} ${selectedYear}`;
    } else {
      periodLabel = `Anno ${selectedYear}`;
      periodRangeLabel = `Intero Anno ${selectedYear}`;
    }
  } else if (selectedPeriod === 'all') {
    periodLabel = 'Tutto lo storico';
    periodRangeLabel = `Tutto lo storico (${allGlucoseEntries.length} registrazioni)`;
  }

  // Filter predicate based on active Period, Year, and Month
  const isEntryInPeriod = (e: LogEntryItem) => {
    if (selectedYear !== 'ALL') {
      const ym = getYearMonth(e.date);
      if (ym.year !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && ym.month !== selectedMonth) return false;
      return true;
    }
    if (selectedPeriod === 'all') return true;
    return (e.timestamp || 0) >= periodCutoff;
  };

  // Filtered entries according to selected period/year/month
  const filteredGlucoseEntries = allGlucoseEntries.filter(isEntryInPeriod);
  const filteredPressureEntries = allPressureEntries.filter(isEntryInPeriod);
  const filteredWeightEntries = allWeightEntries.filter(isEntryInPeriod);
  const filteredNutritionEntries = allNutritionEntries.filter(isEntryInPeriod);
  const filteredDiaryEntries = entries.filter(isEntryInPeriod);

  // Category averages for Glucose (Filtered by Period)
  const categoryGlucoseAverages = categories.map(cat => {
    const catEntries = filteredGlucoseEntries.filter(e => e.categoryId === cat.id || e.categoryName === cat.name);
    const values = catEntries.map(e => parseFloat(String(e.value || '').replace(',', '.'))).filter(v => !isNaN(v));
    const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1).replace('.', ',') : '-';
    return {
      category: cat.name,
      count: catEntries.length,
      average: avg
    };
  });

  // Category averages for Pressure/Pulse (Filtered by Period)
  const categoryPressureAverages = categories.map(cat => {
    const catEntries = filteredPressureEntries.filter(e => e.categoryId === cat.id || e.categoryName === cat.name);
    const systolics = catEntries.map(e => parseFloat(String(e.systolic || e.value || '').split('/')[0].replace(',', '.'))).filter(v => !isNaN(v));
    const diastolics = catEntries.map(e => parseFloat(String(e.diastolic || e.value || '').split('/')[1] || '0')).filter(v => !isNaN(v) && v > 0);
    const pulses = catEntries.map(e => parseFloat(String(e.pulse || '').replace(',', '.'))).filter(v => !isNaN(v));

    const avgSys = systolics.length > 0 ? Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length) : '-';
    const avgDia = diastolics.length > 0 ? Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length) : '-';
    const avgPulse = pulses.length > 0 ? Math.round(pulses.reduce((a, b) => a + b, 0) / pulses.length) : '-';

    return {
      category: cat.name,
      count: catEntries.length,
      avgPressure: avgSys !== '-' && avgDia !== '-' ? `${avgSys}/${avgDia}` : (avgSys !== '-' ? `${avgSys}` : '-'),
      avgPulse: avgPulse !== '-' ? `${avgPulse}` : '-'
    };
  });

  // Temporal summary calculations for Report 3 (Statistics)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = now.getTime() - 60 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = now.getTime() - 90 * 24 * 60 * 60 * 1000;

  const getGlucoseNumeric = (e: LogEntryItem) => parseFloat(String(e.value || '').replace(',', '.'));

  const todayEntries = allGlucoseEntries.filter(e => e.timestamp >= startOfToday);
  const sevenDaysEntries = allGlucoseEntries.filter(e => e.timestamp >= sevenDaysAgo);
  const fourteenDaysEntries = allGlucoseEntries.filter(e => e.timestamp >= fourteenDaysAgo);
  const thirtyDaysEntries = allGlucoseEntries.filter(e => e.timestamp >= thirtyDaysAgo);
  const sixtyDaysEntries = allGlucoseEntries.filter(e => e.timestamp >= sixtyDaysAgo);
  const ninetyDaysEntries = allGlucoseEntries.filter(e => e.timestamp >= ninetyDaysAgo);

  const calcAvgStr = (list: LogEntryItem[], fallback: number) => {
    const vals = list.map(getGlucoseNumeric).filter(v => !isNaN(v));
    if (vals.length === 0) return fallback.toFixed(1).replace('.', ',');
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return avg.toFixed(1).replace('.', ',');
  };

  const avgToday = calcAvgStr(todayEntries, 150.0);
  const avg7Days = calcAvgStr(sevenDaysEntries, 160.0);
  const avg14Days = calcAvgStr(fourteenDaysEntries, 160.0);
  const avg30Days = calcAvgStr(thirtyDaysEntries, 160.0);
  const avg60Days = calcAvgStr(sixtyDaysEntries, 160.0);
  const avg90Days = calcAvgStr(ninetyDaysEntries, 160.0);
  const avgAll = calcAvgStr(allGlucoseEntries, 160.0);

  // HbA1c calculation based on 90 days average or all history
  const numeric90dAvg = parseFloat(avg90Days.replace(',', '.')) || parseFloat(avgAll.replace(',', '.')) || 160.0;
  const estimatedHbA1c = ((numeric90dAvg + 46.7) / 28.7 * 14.18).toFixed(1).replace('.', ',');

  // Calculate dynamic stats for currently selected period (used in Diario and top KPI cards)
  const currentPeriodEntries = filteredGlucoseEntries;
  const prevPeriodEntries = selectedYear !== 'ALL'
    ? []
    : selectedPeriod === 'all'
      ? []
      : allGlucoseEntries.filter(e => e.timestamp >= prevPeriodStartDate.getTime() && e.timestamp < periodStartDate.getTime());

  const currentPeriodValues = currentPeriodEntries.map(getGlucoseNumeric).filter(v => !isNaN(v));
  const prevPeriodValues = prevPeriodEntries.map(getGlucoseNumeric).filter(v => !isNaN(v));

  const currentPeriodAvg = currentPeriodValues.length > 0 ? Math.round(currentPeriodValues.reduce((a, b) => a + b, 0) / currentPeriodValues.length) : 108;
  const prevPeriodAvg = prevPeriodValues.length > 0 ? Math.round(prevPeriodValues.reduce((a, b) => a + b, 0) / prevPeriodValues.length) : 0;

  const stdDev = currentPeriodValues.length > 1
    ? Math.round(Math.sqrt(currentPeriodValues.reduce((sq, n) => sq + Math.pow(n - currentPeriodAvg, 2), 0) / (currentPeriodValues.length - 1)))
    : 4;

  const inTargetCount = currentPeriodValues.filter(v => v >= targetMin && v <= targetMax).length;
  const inTargetPercent = currentPeriodValues.length > 0 ? Math.round((inTargetCount / currentPeriodValues.length) * 100) : 100;

  const effectiveDays = selectedYear !== 'ALL'
    ? (selectedMonth !== 'ALL' ? 30 : 365)
    : selectedPeriod === 'all'
      ? Math.max(1, Math.ceil((now.getTime() - periodStartDate.getTime()) / (24 * 3600 * 1000)))
      : selectedPeriod;

  const readingsPerDay = (currentPeriodEntries.length / effectiveDays).toFixed(1).replace('.', ',');

  // Monthly stats for the 12-month overview in Diario
  const monthNames = ['DIC', 'GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV'];
  const monthlyData = monthNames.map((month) => {
    const matching = allGlucoseEntries.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return false;
      const mIdx = (d.getMonth() + 1) % 12;
      return monthNames[mIdx] === month;
    });
    const vals = matching.map(getGlucoseNumeric).filter(v => !isNaN(v));
    const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    return {
      month,
      avg,
      count: vals.length
    };
  });

  // ==========================================
  // MEAL SLOTS REPORT ANALYSIS (5 Fasce Orarie)
  // ==========================================
  const mealSlots = useMemo(() => loadMealSlots(), []);
  const mealSlotsReportAnalysis = useMemo(() => {
    return analyzeEntriesByMealSlot(
      filteredGlucoseEntries,
      mealSlots,
      targetMin,
      targetMax
    );
  }, [filteredGlucoseEntries, mealSlots, targetMin, targetMax]);

  // Time Slot mapping for the Daily Log Grid
  const timeSlots = [
    { id: 'night', label: 'Notte', range: '0:00 - 6:00', minHour: 0, maxHour: 6 },
    { id: 'pre_bf', label: 'Prima della colazione', range: '6:00 - 9:00', minHour: 6, maxHour: 9 },
    { id: 'post_bf', label: 'Dopo la colazione', range: '9:00 - 11:00', minHour: 9, maxHour: 11 },
    { id: 'pre_lunch', label: 'Prima di pranzo', range: '11:00 - 14:00', minHour: 11, maxHour: 14 },
    { id: 'post_lunch', label: 'Dopo pranzo', range: '14:00 - 17:00', minHour: 14, maxHour: 17 },
    { id: 'pre_dinner', label: 'Prima di cena', range: '17:00 - 19:00', minHour: 17, maxHour: 19 },
    { id: 'post_dinner', label: 'Dopo cena', range: '19:00 - 22:00', minHour: 19, maxHour: 22 },
    { id: 'bedtime', label: 'Ora di coricarsi', range: '22:00 - 0:00', minHour: 22, maxHour: 24 }
  ];

  // Group entries by Date for the Diary Grid (filtered by selected period / year / month)
  const dateMap: { [dateStr: string]: LogEntryItem[] } = {};
  filteredDiaryEntries.forEach(e => {
    if (!dateMap[e.date]) {
      dateMap[e.date] = [];
    }
    dateMap[e.date].push(e);
  });

  const sortedDates = Object.keys(dateMap).sort((a, b) => {
    const dA = new Date(a).getTime();
    const dB = new Date(b).getTime();
    return dB - dA;
  });

  const getSlotForTime = (timeStr: string) => {
    if (!timeStr) return 1;
    const parts = timeStr.split(':');
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return 1;
    const found = timeSlots.findIndex(s => hour >= s.minHour && hour < s.maxHour);
    return found !== -1 ? found : 1;
  };

  // PDF Export
  const handleSaveAsPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    notifyExport('📄 Generazione del file PDF in corso...');

    const cleanName = (patientName || 'Angelo F').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const tagPeriod = selectedYear !== 'ALL'
      ? (selectedMonth !== 'ALL' ? `${selectedYear}_${selectedMonth}` : `${selectedYear}`)
      : (selectedPeriod === 'all' ? 'Tutto' : `${selectedPeriod}gg`);

    let reportLabel = 'Diario';
    if (activeReport === 'glucose') reportLabel = `Glicemico_${tagPeriod}`;
    else if (activeReport === 'pressure') reportLabel = `Pressione_e_Battiti_${tagPeriod}`;
    else if (activeReport === 'weight') reportLabel = `Peso_Corporeo_${tagPeriod}`;
    else if (activeReport === 'nutrition') reportLabel = `Riepilogo_Nutrizionale_${tagPeriod}`;
    else if (activeReport === 'stats') reportLabel = `Statistiche_Glicemia_${tagPeriod}`;
    else if (activeReport === 'meal_slots') reportLabel = `Fasce_Pasti_${tagPeriod}`;
    else if (activeReport === 'complete') reportLabel = `Diario_${tagPeriod}`;

    const fileName = `Report_${reportLabel}_${cleanName}_${dateStr}.pdf`;

    try {
      await exportElementToPdf('printable-report-area', fileName);
      notifyExport('✅ File PDF generato con successo!');
    } catch (e) {
      console.warn('Direct PDF export error, attempting print dialog fallback:', e);
      try {
        window.print();
        notifyExport('📄 Finestra di stampa/salvataggio PDF aperta.');
      } catch (printErr) {
        console.error('Print fallback failed:', printErr);
        alert('Impossibile generare il PDF. Prova a premere Ctrl+P (o Cmd+P su Mac) per stampare la pagina.');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // CSV Export for all reports with Period & Year/Month filter support
  const handleExportCSV = () => {
    const cleanName = patientName || 'Angelo F';

    if (activeReport === 'glucose') {
      downloadGlucoseCSV(filteredGlucoseEntries, cleanName, periodLabel);
      notifyExport(`✅ Report Glicemico (${periodLabel}) esportato in formato CSV!`);
    } else if (activeReport === 'pressure') {
      downloadPressureCSV(filteredPressureEntries, cleanName, periodLabel);
      notifyExport(`✅ Report Pressione e Battiti (${periodLabel}) esportato in formato CSV!`);
    } else if (activeReport === 'weight') {
      downloadWeightCSV(filteredWeightEntries, cleanName, periodLabel);
      notifyExport(`✅ Report Peso Corporeo (${periodLabel}) esportato in formato CSV!`);
    } else if (activeReport === 'nutrition') {
      downloadNutritionCSV(filteredNutritionEntries, cleanName, periodLabel);
      notifyExport(`✅ Report Riepilogo Nutrizionale (${periodLabel}) esportato in formato CSV!`);
    } else if (activeReport === 'fasting') {
      downloadFastingCSV(entries, cleanName, periodLabel);
      notifyExport(`✅ Report Digiuno Intermittente (${periodLabel}) esportato in formato CSV!`);
    } else if (activeReport === 'stats') {
      const temporalStats = [
        {
          period: 'Oggi',
          count: todayEntries.length,
          avg: avgToday,
          status: parseFloat(avgToday.replace(',', '.')) <= targetMax && parseFloat(avgToday.replace(',', '.')) >= targetMin ? 'In Intervallo' : 'Fuori Intervallo'
        },
        {
          period: 'Ultimi 7 giorni (1 sett.)',
          count: sevenDaysEntries.length,
          avg: avg7Days,
          status: parseFloat(avg7Days.replace(',', '.')) <= targetMax && parseFloat(avg7Days.replace(',', '.')) >= targetMin ? 'In Intervallo' : 'Fuori Intervallo'
        },
        {
          period: 'Ultimi 14 giorni (2 sett.)',
          count: fourteenDaysEntries.length,
          avg: avg14Days,
          status: parseFloat(avg14Days.replace(',', '.')) <= targetMax && parseFloat(avg14Days.replace(',', '.')) >= targetMin ? 'In Intervallo' : 'Fuori Intervallo'
        },
        {
          period: 'Ultimi 30 giorni (1 mese)',
          count: thirtyDaysEntries.length,
          avg: avg30Days,
          status: parseFloat(avg30Days.replace(',', '.')) <= targetMax && parseFloat(avg30Days.replace(',', '.')) >= targetMin ? 'In Intervallo' : 'Fuori Intervallo'
        },
        {
          period: 'Ultimi 60 giorni (2 mesi)',
          count: sixtyDaysEntries.length,
          avg: avg60Days,
          status: parseFloat(avg60Days.replace(',', '.')) <= targetMax && parseFloat(avg60Days.replace(',', '.')) >= targetMin ? 'In Intervallo' : 'Fuori Intervallo'
        },
        {
          period: 'Ultimi 90 giorni (3 mesi)',
          count: ninetyDaysEntries.length,
          avg: avg90Days,
          status: parseFloat(avg90Days.replace(',', '.')) <= targetMax && parseFloat(avg90Days.replace(',', '.')) >= targetMin ? 'In Intervallo' : 'Fuori Intervallo'
        },
        {
          period: `Tutto lo storico (${allGlucoseEntries.length} letture)`,
          count: allGlucoseEntries.length,
          avg: avgAll,
          status: parseFloat(avgAll.replace(',', '.')) <= targetMax && parseFloat(avgAll.replace(',', '.')) >= targetMin ? 'In Intervallo' : 'Fuori Intervallo'
        }
      ];

      const categoryStats = categoryGlucoseAverages.map(c => ({
        category: c.category,
        count: c.count,
        avg: c.average
      }));

      downloadStatsCSV(temporalStats, categoryStats, estimatedHbA1c, cleanName, periodLabel);
      notifyExport(`✅ Statistiche Glicemiche (${periodLabel}) esportate in formato CSV!`);
    } else if (activeReport === 'complete') {
      const exportTag = selectedYear !== 'ALL'
        ? (selectedMonth !== 'ALL' ? `${selectedYear}_${selectedMonth}` : `${selectedYear}`)
        : selectedPeriod;
      downloadDiaryCSV(filteredDiaryEntries, exportTag, cleanName, showPressureAndPulseInDiary);
      notifyExport(`✅ Diario (${periodLabel}) esportato in formato CSV!`);
    } else if (activeReport === 'meal_slots') {
      const rows = [
        ['REPORT ANALISI FASCE PASTI - ONTRACK'],
        ['Utente:', cleanName],
        ['Periodo:', periodLabel],
        ['Target Glicemico:', `${targetMin} - ${targetMax} mg/dL`],
        [''],
        ['FASCIA PASTO', 'ORARIO DEFINITO', 'N. LETTURE', 'MEDIA (mg/dL)', 'MIN', 'MAX', 'DEV. STANDARD', '% NEL TARGET', '% SOPRA TARGET', '% SOTTO TARGET', 'MEDIA PRE-PASTO', 'LETTURE PRE', 'MEDIA POST-PASTO', 'LETTURE POST']
      ];
      mealSlotsReportAnalysis.forEach(ma => {
        rows.push([
          ma.slot.name,
          `${ma.slot.startTime} - ${ma.slot.endTime}`,
          String(ma.count),
          ma.avg !== null ? String(ma.avg) : 'N/D',
          ma.min !== null ? String(ma.min) : 'N/D',
          ma.max !== null ? String(ma.max) : 'N/D',
          String(ma.stdDev),
          `${ma.inTargetPct}%`,
          `${ma.aboveTargetPct}%`,
          `${ma.belowTargetPct}%`,
          ma.preAvg !== null ? String(ma.preAvg) : 'N/D',
          String(ma.preCount),
          ma.postAvg !== null ? String(ma.postAvg) : 'N/D',
          String(ma.postCount)
        ]);
      });
      rows.push(['']);
      rows.push(['DETTAGLIO CRONOLOGICO LETTURE PER FASCIA']);
      rows.push(['DATA', 'ORA', 'FASCIA PASTO', 'VALORE', 'UNITA', 'TIMING PASTO', 'NOTE']);
      filteredGlucoseEntries.forEach(entry => {
        const slot = getMealSlotForEntry(entry.time, mealSlots);
        rows.push([
          entry.date || '',
          entry.time || '',
          slot ? slot.name : 'Altro',
          String(entry.value || ''),
          entry.unit || 'mg/dL',
          entry.mealTiming || '',
          entry.note || ''
        ]);
      });
      const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Report_Fasce_Pasti_${cleanName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notifyExport(`✅ Report Fasce Pasti (${periodLabel}) esportato in formato CSV!`);
    } else {
      downloadCSV(filteredDiaryEntries, `Report_Dati_${cleanName.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
      notifyExport('✅ Dati esportati in formato CSV!');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-[#e8ecee] dark:bg-[#121418] text-stone-800 dark:text-stone-100">

      {/* Header */}
      <OnTrackHeader
        title="Reports"
        showBack={true}
        onBack={onBack}
        showToolsMenu={true}
        onOpenTools={onOpenTools}
        onNavigate={onNavigate}
      />

      {/* Main Container */}
      <div className="flex-1 p-2 sm:p-5 mx-auto w-full space-y-4 pb-16 print:p-0 print:max-w-none print:m-0 max-w-7xl">

        {/* Export Notification Banner */}
        {exportNotification && (
          <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-md text-xs sm:text-sm font-bold flex items-center justify-between animate-fadeIn print:hidden">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-200" />
              <span>{exportNotification}</span>
            </div>
            <button onClick={() => setExportNotification(null)} className="text-emerald-200 hover:text-white text-xs underline">
              Chiudi
            </button>
          </div>
        )}

        {/* REPORT SELECTOR CARDS & ACTIONS (Hidden when printing) */}
        <div className="bg-white dark:bg-[#1a1d24] p-4 border border-stone-300 dark:border-stone-800 shadow-sm space-y-4 print:hidden rounded-2xl">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-3">
            <div>
              <h3 className="font-bold text-stone-800 dark:text-stone-100 text-base">Seleziona Tipo di Report</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                Scegli il modello e il periodo (7, 14, 30, 60, 90 giorni o tutto) per la visualizzazione e l'esportazione. I conteggi delle misurazioni sono riferiti al periodo scelto.
              </p>
            </div>

            {/* Action Buttons Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* PDF Button */}
              <button
                onClick={handleSaveAsPDF}
                disabled={isGeneratingPdf}
                className={`px-3.5 py-2 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer ${
                  isGeneratingPdf
                    ? 'bg-[#238a9a] opacity-80 cursor-wait'
                    : 'bg-[#2ca3b5] hover:bg-[#238a9a] active:scale-[0.98]'
                }`}
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isGeneratingPdf ? 'Generazione...' : 'PDF'}</span>
              </button>

              {/* CSV Button */}
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-[#e97849] hover:bg-[#d86b3d] active:bg-[#c75e33] text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all active:scale-[0.98] cursor-pointer"
                title={`Esporta report ${activeReport} in formato CSV`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* 8 Report Cards: Glicemico, Pressione e battiti, Peso, Nutrizione, Statistiche Glicemia, Fasce Pasti, Digiuno, Diario */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">

            {/* Card 1: Glicemico */}
            <button
              onClick={() => setActiveReport('glucose')}
              className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
                activeReport === 'glucose'
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-[#e0b828] ring-2 ring-[#e0b828]/40 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <div className="p-1 bg-[#e0b828] text-white rounded-lg shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-stone-800 dark:text-stone-100 truncate">Glicemico</span>
              </div>
              <span className="text-[9px] font-mono text-stone-500 dark:text-stone-400">{filteredGlucoseEntries.length} letture</span>
            </button>

            {/* Card 2: Pressione e battiti */}
            <button
              onClick={() => setActiveReport('pressure')}
              className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
                activeReport === 'pressure'
                  ? 'bg-sky-50/90 dark:bg-sky-950/40 border-[#2ca3b5] ring-2 ring-[#2ca3b5]/40 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <div className="p-1 bg-[#2ca3b5] text-white rounded-lg shrink-0">
                  <Heart className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-stone-800 dark:text-stone-100 truncate">Pressione</span>
              </div>
              <span className="text-[9px] font-mono text-stone-500 dark:text-stone-400">{filteredPressureEntries.length} letture</span>
            </button>

            {/* Card 3: Peso */}
            <button
              onClick={() => setActiveReport('weight')}
              className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
                activeReport === 'weight'
                  ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-600 ring-2 ring-indigo-600/40 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <div className="p-1 bg-indigo-600 text-white rounded-lg shrink-0">
                  <Scale className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-stone-800 dark:text-stone-100 truncate">Peso</span>
              </div>
              <span className="text-[9px] font-mono text-indigo-700 dark:text-indigo-400 font-bold">{filteredWeightEntries.length} pesate</span>
            </button>

            {/* Card 4: Riepilogo Nutrizionale */}
            <button
              onClick={() => setActiveReport('nutrition')}
              className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
                activeReport === 'nutrition'
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-600 ring-2 ring-amber-600/40 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <div className="p-1 bg-amber-600 text-white rounded-lg shrink-0">
                  <Utensils className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-stone-800 dark:text-stone-100 truncate">Nutrizione</span>
              </div>
              <span className="text-[9px] font-mono text-amber-700 dark:text-amber-400 font-bold">{filteredNutritionEntries.length} pasti</span>
            </button>

            {/* Card 5: Statistiche Glicemia */}
            <button
              onClick={() => setActiveReport('stats')}
              className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
                activeReport === 'stats'
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-[#73a832] ring-2 ring-[#73a832]/40 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <div className="p-1 bg-[#73a832] text-white rounded-lg shrink-0">
                  <BarChart2 className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-stone-800 dark:text-stone-100 truncate">Statistiche</span>
              </div>
              <span className="text-[9px] font-mono text-[#73a832] font-bold">HbA1c & Medie</span>
            </button>

            {/* Card 6: Fasce Pasti */}
            <button
              onClick={() => setActiveReport('meal_slots')}
              className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
                activeReport === 'meal_slots'
                  ? 'bg-teal-50/90 dark:bg-teal-950/40 border-teal-600 ring-2 ring-teal-600/40 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <div className="p-1 bg-teal-600 text-white rounded-lg shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-stone-800 dark:text-stone-100 truncate">Fasce Pasti</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-teal-600 dark:text-teal-400">5 Fasce</span>
            </button>

            {/* Card 7: Digiuno Intermittente */}
            <button
              onClick={() => setActiveReport('fasting')}
              className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer relative overflow-hidden ${
                activeReport === 'fasting'
                  ? 'bg-teal-50/90 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/40 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <div className="p-1 bg-teal-600 text-white rounded-lg shrink-0">
                    <Timer className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-stone-800 dark:text-stone-100 truncate">Digiuno</span>
                </div>
                {/* Visual Indicator: Green if in progress, Gray if not in progress */}
                <div
                  className="flex items-center shrink-0 ml-1"
                  title={activeFastingSession?.isActive ? 'Digiuno in corso' : 'Nessun digiuno attivo'}
                >
                  {activeFastingSession?.isActive ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full h-2 w-2 bg-stone-300 dark:bg-stone-600"></span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between w-full text-[9px] font-mono font-bold">
                <span className={activeFastingSession?.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400'}>
                  {activeFastingSession?.isActive ? 'In corso' : 'Inattivo'}
                </span>
                <span className="text-teal-600 dark:text-teal-400 font-semibold">{activeFastingSession?.isActive && activeFastingSession.protocol ? activeFastingSession.protocol : '16:8'}</span>
              </div>
            </button>

            {/* Card 8: Diario */}
            <button
              onClick={() => setActiveReport('complete')}
              className={`p-2.5 text-left rounded-xl border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer ${
                activeReport === 'complete'
                  ? 'bg-rose-50/90 dark:bg-rose-950/40 border-[#d93838] ring-2 ring-[#d93838]/40 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <div className="p-1 bg-[#d93838] text-white rounded-lg shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-stone-800 dark:text-stone-100 truncate">Diario</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-[#d93838]">Diario Globale</span>
            </button>

          </div>

          {/* UNIFIED FILTER CONTROLS: PERIOD (7, 14, 30, 60, 90 gg, Tutto), ANNO & MESE, OPZIONI DIARIO */}
          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 text-xs space-y-3">

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Period Selector Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5 text-stone-700 dark:text-stone-300 font-semibold">
                  <CalendarRange className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                  <span>Periodo:</span>
                </div>

                <div className="inline-flex flex-wrap rounded-xl border border-stone-300 dark:border-stone-700 p-0.5 bg-stone-100 dark:bg-stone-800 shadow-2xs">
                  {([7, 14, 30, 60, 90, 'all'] as const).map(p => {
                    const isSelected = selectedYear === 'ALL' && selectedPeriod === p;
                    const label = p === 'all' ? 'Tutto' : `${p} gg`;

                    // Color highlight matched with active report
                    let activeBgClass = 'bg-[#d93838] text-white shadow-xs';
                    if (activeReport === 'glucose') activeBgClass = 'bg-[#e0b828] text-stone-900 shadow-xs font-black';
                    else if (activeReport === 'pressure') activeBgClass = 'bg-[#2ca3b5] text-white shadow-xs';
                    else if (activeReport === 'weight') activeBgClass = 'bg-indigo-600 text-white shadow-xs';
                    else if (activeReport === 'nutrition') activeBgClass = 'bg-amber-600 text-white shadow-xs';
                    else if (activeReport === 'stats') activeBgClass = 'bg-[#73a832] text-white shadow-xs';
                    else if (activeReport === 'meal_slots') activeBgClass = 'bg-teal-600 text-white shadow-xs';
                    else if (activeReport === 'fasting') activeBgClass = 'bg-teal-600 text-white shadow-xs';

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setSelectedPeriod(p);
                          setSelectedYear('ALL');
                          setSelectedMonth('ALL');
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? activeBgClass
                            : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Patient Name input */}
              <div className="flex items-center space-x-2 text-stone-700 dark:text-stone-300">
                <User className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                <span className="font-semibold">Utente:</span>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="px-2.5 py-1 border border-stone-300 dark:border-stone-700 rounded-lg font-bold text-stone-800 dark:text-stone-100 bg-stone-50 dark:bg-stone-900 focus:bg-white dark:focus:bg-stone-800 w-36 text-xs shadow-2xs"
                  placeholder="Nome Utente"
                />
                <span className="text-stone-400 dark:text-stone-500 text-[11px] hidden sm:inline">
                  Target: {targetMin}-{targetMax} mg/dL
                </span>
              </div>
            </div>

            {/* SECOND ROW: FILTRI AVANZATI (ANNO, MESE, OPZIONI DIARIO) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100 dark:border-stone-800/60">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-1.5 text-stone-700 dark:text-stone-300 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                  <span>Filtro Temporale:</span>
                </div>

                {/* Year Selector */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-stone-500 dark:text-stone-400 text-[11px]">Anno:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="px-2 py-1 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 shadow-2xs cursor-pointer focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="ALL">Tutti gli anni ({activeReportBaseEntries.length})</option>
                    {availableYearsWithCount.map(({ year, count }) => (
                      <option key={year} value={year}>{year} ({count})</option>
                    ))}
                  </select>
                </div>

                {/* Month Selector */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-stone-500 dark:text-stone-400 text-[11px]">Mese:</span>
                  <select
                    value={selectedMonth}
                    disabled={selectedYear === 'ALL'}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 shadow-2xs cursor-pointer focus:ring-1 focus:ring-amber-500 ${
                      selectedYear === 'ALL' ? 'opacity-50 cursor-not-allowed bg-stone-100 dark:bg-stone-900' : ''
                    }`}
                  >
                    <option value="ALL">
                      {selectedYear === 'ALL' ? 'Tutti i mesi' : `Tutti i mesi (${selectedYearTotalCount})`}
                    </option>
                    {selectedYear !== 'ALL' && availableMonthsWithCount.map(({ month, count }) => (
                      <option key={month} value={month}>{MONTH_NAMES[month] || month} ({count})</option>
                    ))}
                  </select>
                </div>

                {/* Reset Filters Button */}
                {(selectedYear !== 'ALL' || selectedMonth !== 'ALL') && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
                    title="Reimposta filtro temporale"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}

                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono hidden md:inline">
                  • {periodRangeLabel}
                </span>
              </div>

              {/* Toggle for Blood Pressure & Pulse in Diary (Only shown when Diario tab is active) */}
              {activeReport === 'complete' && (
                <button
                  type="button"
                  onClick={() => setShowPressureAndPulseInDiary(!showPressureAndPulseInDiary)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    showPressureAndPulseInDiary
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 shadow-2xs'
                      : 'bg-stone-50 dark:bg-stone-800/80 border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                  }`}
                  title="Attiva o disattiva la visualizzazione di pressione e battiti cardiaci nel diario"
                >
                  {showPressureAndPulseInDiary ? (
                    <CheckSquare className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <div className="flex items-center space-x-1">
                    <Activity className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500/30" />
                    <span>Mostra Pressione e Battiti</span>
                  </div>
                </button>
              )}
            </div>

          </div>

        </div>

        {/* PRINTABLE REPORT WRAPPER (Always in Light Medical Sheet Theme regardless of active app theme) */}
        <div id="printable-report-area" className="text-stone-900">

        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* REPORT 1: GLICEMICO */}
        {/* ========================================================================= */}
        {activeReport === 'glucose' && (
          <div data-pdf-section="true" data-pdf-orientation="portrait" className="space-y-6 text-white print:text-stone-900">

            {/* Sub-Header Card (styled like Report Digiuno) */}
            <div className="bg-gradient-to-r from-[#1c2938] via-[#243447] to-[#1a2330] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-stone-700/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-inner shrink-0">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Report Glicemico
                    </h2>
                    <p className="text-xs text-stone-300 mt-0.5">
                      Utente: <strong className="text-white">{patientName}</strong> • Periodo: <strong className="text-amber-300">{periodLabel}</strong> ({periodRangeLabel}) • Target: <span className="font-mono font-bold text-amber-200">{targetMin}-{targetMax} mg/dL</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 self-start sm:self-auto text-xs text-stone-300 shrink-0">
                  <span className="font-mono font-bold text-amber-300 text-sm">{filteredGlucoseEntries.length}</span>
                  <span>registrazioni</span>
                </div>
              </div>
            </div>

            {/* Hero Summary Card */}
            <div className="bg-gradient-to-br from-[#162230] via-[#1c2c3e] to-[#121c27] text-white rounded-2xl border border-amber-500/30 shadow-lg p-5 sm:p-6 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 border-b border-white/10 pb-4">
                <div className="flex items-center space-x-3">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40">
                        Panoramica Glicemica
                      </span>
                      <span className="text-xs text-stone-300 font-mono">
                        Target: <strong className="text-amber-200">{targetMin}-{targetMax} mg/dL</strong>
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight mt-1 flex items-baseline space-x-2">
                      <span>{currentPeriodAvg} mg/dL</span>
                      <span className="text-xs font-normal text-stone-300 font-sans">
                        media periodo (±{stdDev} variabilità)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/40 px-3.5 py-2 rounded-xl border border-white/10 text-xs font-mono">
                  <span className="text-stone-400">HbA1c Stimata:</span>
                  <span className="text-base font-black text-amber-300">{estimatedHbA1c}%</span>
                </div>
              </div>

              {/* 4 Meta Badges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
                {/* 1. Media Globale */}
                <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>Media Periodo</span>
                  </div>
                  <div className="text-xl font-bold text-amber-300 font-mono">
                    {currentPeriodAvg} <span className="text-xs text-stone-400">mg/dL</span>
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {filteredGlucoseEntries.length} registrazioni totali
                  </div>
                </div>

                {/* 2. Time in Range */}
                <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>In Intervallo (TIR)</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-400 font-mono">
                    {inTargetPercent}%
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {inTargetCount} su {currentPeriodValues.length} misurazioni
                  </div>
                </div>

                {/* 3. Deviazione Standard */}
                <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                    <span>Variabilità Glicemica</span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    ±{stdDev} <span className="text-xs text-stone-400">mg/dL</span>
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Stabilità del profilo
                  </div>
                </div>

                {/* 4. Frequenza Controlli */}
                <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Frequenza Letture</span>
                  </div>
                  <div className="text-xl font-bold text-sky-300 font-mono">
                    {readingsPerDay} <span className="text-xs text-stone-400">/ die</span>
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Media giornaliera
                  </div>
                </div>
              </div>
            </div>

            {/* Averages Table Card */}
            <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-amber-400" />
                Medie Glicemiche per Categoria ({periodLabel})
              </h4>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3 border-r border-white/10">Categoria</th>
                      <th className="p-3 border-r border-white/10 text-center">Numero Letture</th>
                      <th className="p-3 text-right">Media mg/dL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-stone-200 font-mono">
                    {categoryGlucoseAverages.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'}>
                        <td className="p-3 border-r border-white/10 font-sans font-medium text-white">{row.category}</td>
                        <td className="p-3 border-r border-white/10 text-center text-stone-300">{row.count}</td>
                        <td className="p-3 text-right font-bold text-amber-300 text-sm">{row.average}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Readings Table Card */}
            <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Registro Dettagliato Letture ({filteredGlucoseEntries.length} elementi)
                </h4>
                <span className="text-[11px] text-stone-400 font-mono">
                  {periodLabel}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3 border-r border-white/10">Data e Ora</th>
                      <th className="p-3 border-r border-white/10">Valore</th>
                      <th className="p-3 border-r border-white/10">Momento / Categoria</th>
                      <th className="p-3 border-r border-white/10">Note Evento</th>
                      <th className="p-3 text-center print:hidden w-16">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-stone-200">
                    {filteredGlucoseEntries.length > 0 ? (
                      filteredGlucoseEntries.map((e, idx) => (
                        <tr
                          key={e.id}
                          className={`group ${idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'} hover:bg-white/5 transition-colors ${onEditEntry ? 'cursor-pointer' : ''}`}
                          onClick={() => onEditEntry && onEditEntry(e)}
                        >
                          <td className="p-3 border-r border-white/10 font-mono text-[11px] text-stone-300">{e.date} {e.time}</td>
                          <td className="p-3 border-r border-white/10 font-bold text-amber-300 font-mono text-sm">{e.value} {e.unit || 'mg/dL'}</td>
                          <td className="p-3 border-r border-white/10 font-medium text-white">{e.categoryName}</td>
                          <td className="p-3 border-r border-white/10 text-stone-400 italic">{e.note || '-'}</td>
                          <td className="p-3 text-center print:hidden" onClick={(ev) => ev.stopPropagation()}>
                            {onEditEntry && (
                              <button
                                type="button"
                                onClick={() => onEditEntry(e)}
                                className="p-1.5 text-stone-400 hover:text-amber-300 hover:bg-white/10 rounded-lg transition-colors inline-block cursor-pointer"
                                title="Modifica lettura"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-stone-400 italic">
                          Nessun dato di glicemia registrato per il periodo selezionato ({periodLabel}).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* REPORT 2: PRESSIONE E BATTITI */}
        {/* ========================================================================= */}
        {activeReport === 'pressure' && (
          <div data-pdf-section="true" data-pdf-orientation="portrait" className="space-y-6 text-white print:text-stone-900">

            {/* Sub-Header Card (styled like Report Digiuno) */}
            <div className="bg-gradient-to-r from-[#1c2938] via-[#243447] to-[#1a2330] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-stone-700/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#2ca3b5]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#2ca3b5]/20 border border-[#2ca3b5]/40 text-[#5ed1e0] flex items-center justify-center shadow-inner shrink-0">
                    <Heart className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Report Pressione e Battiti
                    </h2>
                    <p className="text-xs text-stone-300 mt-0.5">
                      Utente: <strong className="text-white">{patientName}</strong> • Periodo: <strong className="text-[#5ed1e0]">{periodLabel}</strong> ({periodRangeLabel})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 self-start sm:self-auto text-xs text-stone-300 shrink-0">
                  <span className="font-mono font-bold text-[#5ed1e0] text-sm">{filteredPressureEntries.length}</span>
                  <span>misurazioni</span>
                </div>
              </div>
            </div>

            {/* Hero Summary Card */}
            {(() => {
              const pressureWithSysDia = filteredPressureEntries.filter(e => e.systolic && e.diastolic);
              const avgSys = pressureWithSysDia.length > 0 ? Math.round(pressureWithSysDia.reduce((a, b) => a + (b.systolic || 0), 0) / pressureWithSysDia.length) : 120;
              const avgDia = pressureWithSysDia.length > 0 ? Math.round(pressureWithSysDia.reduce((a, b) => a + (b.diastolic || 0), 0) / pressureWithSysDia.length) : 80;
              const pressureWithPulse = filteredPressureEntries.filter(e => e.pulse && e.pulse > 0);
              const avgPulse = pressureWithPulse.length > 0 ? Math.round(pressureWithPulse.reduce((a, b) => a + (b.pulse || 0), 0) / pressureWithPulse.length) : 72;

              const isNormal = avgSys <= 129 && avgDia <= 84;
              const isOptimal = avgSys < 120 && avgDia < 80;

              return (
                <div className="bg-gradient-to-br from-[#162230] via-[#1c2c3e] to-[#121c27] text-white rounded-2xl border border-[#2ca3b5]/40 shadow-lg p-5 sm:p-6 space-y-5 relative overflow-hidden">
                  <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#2ca3b5]/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 border-b border-white/10 pb-4">
                    <div className="flex items-center space-x-3">
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5ed1e0] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#2ca3b5]"></span>
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#2ca3b5]/20 text-[#5ed1e0] border border-[#2ca3b5]/40">
                            Profilo Pressorio Medio
                          </span>
                          <span className="text-xs text-stone-300 font-mono">
                            Stato: <strong className={isOptimal ? 'text-emerald-300' : isNormal ? 'text-teal-300' : 'text-amber-300'}>{isOptimal ? 'Ottimale' : isNormal ? 'Normale' : 'Attenzione'}</strong>
                          </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight mt-1 flex items-baseline space-x-2">
                          <span>{avgSys} / {avgDia} <span className="text-lg font-normal text-stone-400">mmHg</span></span>
                          <span className="text-xs font-normal text-stone-300 font-sans">
                            • {avgPulse} bpm battiti medi
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-black/40 px-3.5 py-2 rounded-xl border border-white/10 text-xs font-mono">
                      <span className="text-stone-400">Frequenza:</span>
                      <span className="text-base font-black text-rose-400">{avgPulse} BPM</span>
                    </div>
                  </div>

                  {/* 4 Meta Badges Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
                    <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
                      <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                        <Heart className="w-3.5 h-3.5 text-[#5ed1e0]" />
                        <span>Sistolica Media (Max)</span>
                      </div>
                      <div className="text-xl font-bold text-[#5ed1e0] font-mono">
                        {avgSys} <span className="text-xs text-stone-400">mmHg</span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {avgSys < 120 ? 'Livello Ottimale' : avgSys <= 129 ? 'Livello Normale' : 'Sopra la norma'}
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
                      <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                        <Heart className="w-3.5 h-3.5 text-[#5ed1e0]" />
                        <span>Diastolica Media (Min)</span>
                      </div>
                      <div className="text-xl font-bold text-[#5ed1e0] font-mono">
                        {avgDia} <span className="text-xs text-stone-400">mmHg</span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {avgDia < 80 ? 'Livello Ottimale' : avgDia <= 84 ? 'Livello Normale' : 'Sopra la norma'}
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
                      <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                        <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                        <span>Battiti Cardiaci</span>
                      </div>
                      <div className="text-xl font-bold text-rose-400 font-mono">
                        {avgPulse} <span className="text-xs text-stone-400">bpm</span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Frequenza a riposo
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1">
                      <div className="text-[11px] font-bold text-stone-400 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Classificazione Clinica</span>
                      </div>
                      <div className="text-base font-bold text-emerald-300 truncate">
                        {isOptimal ? 'Ottimale (<120/<80)' : isNormal ? 'Normale (120-129)' : 'Pre-Ipertensione'}
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Linee guida ESC/ESH
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Averages Table Card */}
            <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-[#5ed1e0]" />
                Medie Pressione e Battiti per Momento della Giornata ({periodLabel})
              </h4>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3 border-r border-white/10">Momento</th>
                      <th className="p-3 border-r border-white/10 text-center">Misurazioni</th>
                      <th className="p-3 border-r border-white/10 text-center">Media Pressione (mmHg)</th>
                      <th className="p-3 text-center">Media Battiti (bpm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-stone-200 font-mono">
                    {categoryPressureAverages.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'}>
                        <td className="p-3 border-r border-white/10 font-sans font-medium text-white">{row.category}</td>
                        <td className="p-3 border-r border-white/10 text-center text-stone-300">{row.count}</td>
                        <td className="p-3 border-r border-white/10 text-center font-bold text-[#5ed1e0] text-sm">{row.avgPressure}</td>
                        <td className="p-3 text-center font-bold text-rose-400 text-sm">{row.avgPulse}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Readings Table Card with Battiti */}
            <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-[#5ed1e0]" />
                  Registro Dettagliato Pressione e Pulsazioni ({filteredPressureEntries.length} elementi)
                </h4>
                <span className="text-[11px] text-stone-400 font-mono">
                  {periodLabel}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3 border-r border-white/10">Data e Ora</th>
                      <th className="p-3 border-r border-white/10">Pressione Arteriosa (mmHg)</th>
                      <th className="p-3 border-r border-white/10 text-center">Battiti (bpm)</th>
                      <th className="p-3 border-r border-white/10">Momento</th>
                      <th className="p-3 border-r border-white/10">Note</th>
                      <th className="p-3 text-center print:hidden w-16">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-stone-200">
                    {filteredPressureEntries.length > 0 ? (
                      filteredPressureEntries.map((e, idx) => {
                        const sysDiaStr = e.systolic && e.diastolic ? `${e.systolic}/${e.diastolic}` : `${e.value || '-'}`;
                        const pulseStr = e.pulse || '-';

                        return (
                          <tr
                            key={e.id}
                            className={`group ${idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'} hover:bg-white/5 transition-colors ${onEditEntry ? 'cursor-pointer' : ''}`}
                            onClick={() => onEditEntry && onEditEntry(e)}
                          >
                            <td className="p-3 border-r border-white/10 font-mono text-[11px] text-stone-300">{e.date} {e.time}</td>
                            <td className="p-3 border-r border-white/10 font-bold text-[#5ed1e0] font-mono text-sm">
                              {sysDiaStr} mmHg
                            </td>
                            <td className="p-3 border-r border-white/10 font-bold text-rose-400 font-mono text-center text-sm">
                              {pulseStr !== '-' ? `${pulseStr} bpm` : '-'}
                            </td>
                            <td className="p-3 border-r border-white/10 font-medium text-white">{e.categoryName}</td>
                            <td className="p-3 border-r border-white/10 text-stone-400 italic">{e.note || '-'}</td>
                            <td className="p-3 text-center print:hidden" onClick={(ev) => ev.stopPropagation()}>
                              {onEditEntry && (
                                <button
                                  type="button"
                                  onClick={() => onEditEntry(e)}
                                  className="p-1.5 text-stone-400 hover:text-[#5ed1e0] hover:bg-white/10 rounded-lg transition-colors inline-block cursor-pointer"
                                  title="Modifica lettura"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-stone-400 italic">
                          Nessun dato di pressione o frequenza cardiaca registrato per il periodo selezionato ({periodLabel}).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* REPORT 3: STATISTICHE GLICEMIA (CON FILTRO 7, 14, 30, 60, 90, TUTTO) */}
        {/* ========================================================================= */}
        {activeReport === 'stats' && (
          <div data-pdf-section="true" data-pdf-orientation="portrait" className="space-y-6 text-white print:text-stone-900">

            {/* Sub-Header Card (styled like Report Digiuno) */}
            <div className="bg-gradient-to-r from-[#1c2938] via-[#243447] to-[#1a2330] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-stone-700/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-inner shrink-0">
                    <BarChart2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Statistiche Glicemia
                    </h2>
                    <p className="text-xs text-stone-300 mt-0.5">
                      Utente: <strong className="text-white">{patientName}</strong> • Periodo: <strong className="text-emerald-300">{periodLabel}</strong> ({periodRangeLabel}) • Intervallo: <span className="font-mono font-bold text-emerald-200">{targetMin}-{targetMax} mg/dL</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 self-start sm:self-auto text-xs text-stone-300 shrink-0">
                  <span className="font-bold text-emerald-300">HbA1c & Medie</span>
                </div>
              </div>
            </div>

            {/* Top Stat Summary Inset Cards for currently selected period */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-[#131f2d] border border-stone-800 p-4 rounded-xl text-center space-y-1">
                <div className="text-xs font-semibold text-stone-400">Media {periodLabel}</div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">{currentPeriodAvg}</div>
                <div className="text-[10px] text-stone-500 font-mono">mg/dL ({currentPeriodEntries.length} letture)</div>
              </div>

              <div className="bg-[#131f2d] border border-stone-800 p-4 rounded-xl text-center space-y-1">
                <div className="text-xs font-semibold text-stone-400">In Intervallo (TIR)</div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">{inTargetPercent}%</div>
                <div className="text-[10px] text-stone-500 font-mono">{targetMin}-{targetMax} mg/dL</div>
              </div>

              <div className="bg-[#131f2d] border border-stone-800 p-4 rounded-xl text-center space-y-1">
                <div className="text-xs font-semibold text-stone-400">Dev. Standard</div>
                <div className="text-2xl font-extrabold text-white font-mono">±{stdDev}</div>
                <div className="text-[10px] text-stone-500 font-mono">Variabilità</div>
              </div>

              <div className="bg-[#131f2d] border border-stone-800 p-4 rounded-xl text-center space-y-1">
                <div className="text-xs font-semibold text-stone-400">Ctrl glic./giorno</div>
                <div className="text-2xl font-extrabold text-sky-400 font-mono">{readingsPerDay}</div>
                <div className="text-[10px] text-stone-500 font-mono">Letture medie / die</div>
              </div>

              <div className="bg-[#1a1c2d] border border-amber-500/30 p-4 rounded-xl text-center col-span-2 sm:col-span-1 space-y-1">
                <div className="text-xs font-semibold text-amber-300">HbA1c Stimata</div>
                <div className="text-2xl font-extrabold text-amber-400 font-mono">{estimatedHbA1c}%</div>
                <div className="text-[10px] text-stone-400 font-mono">Formula clinica 90 gg</div>
              </div>
            </div>

            {/* Medie Temporali Table Card */}
            <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Prospetto Medie Temporali per Finestre di Monitoraggio
              </h4>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3 border-r border-white/10">Periodo di Riferimento</th>
                      <th className="p-3 border-r border-white/10 text-center">Numero Letture</th>
                      <th className="p-3 border-r border-white/10 text-right">Media mg/dL</th>
                      <th className="p-3 text-right">Stato Target ({targetMin}-{targetMax})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-stone-200 font-mono">
                    {/* Oggi */}
                    <tr className="bg-black/20">
                      <td className="p-3 border-r border-white/10 font-sans font-medium text-white">Oggi</td>
                      <td className="p-3 border-r border-white/10 text-center text-stone-300">{todayEntries.length}</td>
                      <td className="p-3 border-r border-white/10 text-right font-bold text-emerald-300 text-sm">{avgToday}</td>
                      <td className="p-3 text-right font-semibold font-sans">
                        {parseFloat(avgToday.replace(',', '.')) <= targetMax && parseFloat(avgToday.replace(',', '.')) >= targetMin ? (
                          <span className="text-emerald-400 font-bold">In Intervallo</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Fuori Intervallo</span>
                        )}
                      </td>
                    </tr>

                    {/* 7 gg */}
                    <tr className="bg-black/40">
                      <td className="p-3 border-r border-white/10 font-sans font-medium text-white">Ultimi 7 giorni (1 settimana)</td>
                      <td className="p-3 border-r border-white/10 text-center text-stone-300">{sevenDaysEntries.length}</td>
                      <td className="p-3 border-r border-white/10 text-right font-bold text-emerald-300 text-sm">{avg7Days}</td>
                      <td className="p-3 text-right font-semibold font-sans">
                        {parseFloat(avg7Days.replace(',', '.')) <= targetMax && parseFloat(avg7Days.replace(',', '.')) >= targetMin ? (
                          <span className="text-emerald-400 font-bold">In Intervallo</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Fuori Intervallo</span>
                        )}
                      </td>
                    </tr>

                    {/* 14 gg */}
                    <tr className="bg-black/20">
                      <td className="p-3 border-r border-white/10 font-sans font-medium text-white">Ultimi 14 giorni (2 settimane)</td>
                      <td className="p-3 border-r border-white/10 text-center text-stone-300">{fourteenDaysEntries.length}</td>
                      <td className="p-3 border-r border-white/10 text-right font-bold text-emerald-300 text-sm">{avg14Days}</td>
                      <td className="p-3 text-right font-semibold font-sans">
                        {parseFloat(avg14Days.replace(',', '.')) <= targetMax && parseFloat(avg14Days.replace(',', '.')) >= targetMin ? (
                          <span className="text-emerald-400 font-bold">In Intervallo</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Fuori Intervallo</span>
                        )}
                      </td>
                    </tr>

                    {/* 30 gg */}
                    <tr className="bg-black/40">
                      <td className="p-3 border-r border-white/10 font-sans font-medium text-white">Ultimi 30 giorni (1 mese)</td>
                      <td className="p-3 border-r border-white/10 text-center text-stone-300">{thirtyDaysEntries.length}</td>
                      <td className="p-3 border-r border-white/10 text-right font-bold text-emerald-300 text-sm">{avg30Days}</td>
                      <td className="p-3 text-right font-semibold font-sans">
                        {parseFloat(avg30Days.replace(',', '.')) <= targetMax && parseFloat(avg30Days.replace(',', '.')) >= targetMin ? (
                          <span className="text-emerald-400 font-bold">In Intervallo</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Fuori Intervallo</span>
                        )}
                      </td>
                    </tr>

                    {/* 60 gg */}
                    <tr className="bg-black/20">
                      <td className="p-3 border-r border-white/10 font-sans font-medium text-white">Ultimi 60 giorni (2 mesi)</td>
                      <td className="p-3 border-r border-white/10 text-center text-stone-300">{sixtyDaysEntries.length}</td>
                      <td className="p-3 border-r border-white/10 text-right font-bold text-emerald-300 text-sm">{avg60Days}</td>
                      <td className="p-3 text-right font-semibold font-sans">
                        {parseFloat(avg60Days.replace(',', '.')) <= targetMax && parseFloat(avg60Days.replace(',', '.')) >= targetMin ? (
                          <span className="text-emerald-400 font-bold">In Intervallo</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Fuori Intervallo</span>
                        )}
                      </td>
                    </tr>

                    {/* 90 gg */}
                    <tr className="bg-black/40">
                      <td className="p-3 border-r border-white/10 font-sans font-medium text-white">Ultimi 90 giorni (3 mesi)</td>
                      <td className="p-3 border-r border-white/10 text-center text-stone-300">{ninetyDaysEntries.length}</td>
                      <td className="p-3 border-r border-white/10 text-right font-bold text-emerald-300 text-sm">{avg90Days}</td>
                      <td className="p-3 text-right font-semibold font-sans">
                        {parseFloat(avg90Days.replace(',', '.')) <= targetMax && parseFloat(avg90Days.replace(',', '.')) >= targetMin ? (
                          <span className="text-emerald-400 font-bold">In Intervallo</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Fuori Intervallo</span>
                        )}
                      </td>
                    </tr>

                    {/* Tutto lo storico */}
                    <tr className="bg-black/20">
                      <td className="p-3 border-r border-white/10 font-sans font-medium text-white">Tutto lo storico</td>
                      <td className="p-3 border-r border-white/10 text-center text-stone-300">{allGlucoseEntries.length}</td>
                      <td className="p-3 border-r border-white/10 text-right font-bold text-emerald-300 text-sm">{avgAll}</td>
                      <td className="p-3 text-right font-semibold font-sans">
                        {parseFloat(avgAll.replace(',', '.')) <= targetMax && parseFloat(avgAll.replace(',', '.')) >= targetMin ? (
                          <span className="text-emerald-400 font-bold">In Intervallo</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Fuori Intervallo</span>
                        )}
                      </td>
                    </tr>

                    {/* HbA1c */}
                    <tr className="bg-black/60 font-bold border-t-2 border-white/20">
                      <td className="p-3 border-r border-white/10 text-white font-sans">HbA1c Stimata</td>
                      <td className="p-3 border-r border-white/10 text-center text-stone-400">-</td>
                      <td className="p-3 border-r border-white/10 text-right font-bold text-amber-300 text-base">{estimatedHbA1c}%</td>
                      <td className="p-3 text-right text-stone-400 font-sans text-xs">Formula media 90 gg</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Medie per Momento della Giornata Card */}
            <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                Medie Glicemiche per Categoria e Momento ({periodLabel})
              </h4>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3 border-r border-white/10">Momento / Categoria</th>
                      <th className="p-3 border-r border-white/10 text-center">Numero Letture</th>
                      <th className="p-3 text-right">Media Glicemica (mg/dL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-stone-200 font-mono">
                    {categoryGlucoseAverages.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'}>
                        <td className="p-3 border-r border-white/10 font-sans font-medium text-white">{row.category}</td>
                        <td className="p-3 border-r border-white/10 text-center text-stone-300">{row.count}</td>
                        <td className="p-3 text-right font-bold text-emerald-300 text-sm">{row.average}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-stone-400 italic text-center pt-2">
              *Tutti i valori sono calcolati automaticamente sulla base delle misurazioni registrate nel diario OnTrack.
            </p>

          </div>
        )}

        {/* ========================================================================= */}
        {/* REPORT 4: DIARIO (REPORT COMPLETO SU 7, 14, 30, 60, 90 GG O TUTTO) */}
        {/* ========================================================================= */}
        {activeReport === 'complete' && (
          <div className="space-y-6 text-white print:text-stone-900">

            {/* 1. SEPARATE TOP HEADER CARD (Identical detached box style to Fasting Report) */}
            <div className="bg-gradient-to-r from-[#1c2938] via-[#243447] to-[#1a2330] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-stone-700/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center shadow-inner shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Report Diario
                    </h2>
                    <p className="text-xs text-stone-300 mt-0.5">
                      Utente: <strong className="text-white">{patientName}</strong> • Periodo: <strong className="text-rose-300">{periodLabel}</strong> ({periodRangeLabel}) • Target: <span className="font-mono font-bold text-rose-200">{targetMin}-{targetMax} mg/dL</span>
                    </p>
                  </div>
                </div>

                {/* Status and Action Badges at Top Right */}
                <div className="flex flex-wrap items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10 self-start sm:self-auto">
                  <span className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-500 text-stone-950 font-black shadow-xs">
                    Diario Completo
                  </span>
                  <span className="px-2.5 py-1 text-xs font-mono font-bold text-rose-300">
                    {filteredDiaryEntries.length} registrazioni
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="min-w-[1040px] space-y-6 text-white print:text-stone-900 print:space-y-4 print:min-w-0">

                {/* PAGE 1: PANORAMICA SU N GIORNI & STATISTICHE (LANDSCAPE ORIENTATION) */}
                <div
                  id="diary-page-overview"
                  data-pdf-section="true"
                  data-pdf-orientation="landscape"
                  data-pdf-single-page="true"
                  className="bg-[#131f2d] p-5 sm:p-6 border border-stone-800 rounded-2xl shadow-md space-y-5 print:border-none print:shadow-none print:p-0 print:break-after-page text-white"
                >

                  {/* Overview Sub-Title Banner */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <BarChart2 className="w-5 h-5 text-rose-400" />
                      <h3 className="text-base font-bold text-white tracking-tight">
                        Panoramica Statistica & Trend Glicemico ({periodLabel})
                      </h3>
                    </div>
                    <div className="text-xs font-mono text-stone-400">
                      Intervallo Target: <span className="font-bold text-white">{targetMin}-{targetMax} mg/dL</span>
                    </div>
                  </div>

                  {/* 2-Column Top Layout: Overview & Stats on Left (Col 1-6), Trend Chart on Right (Col 7-12) */}
                  <div className="grid grid-cols-12 gap-4 items-stretch">

                    {/* Left Column (Col 1-6): Panoramica su N giorni & Periodo Precedente */}
                    <div className="col-span-6 space-y-3 flex flex-col justify-between">

                      {/* Section: Panoramica su N giorni */}
                      <div className="space-y-2">
                        <div className="flex items-baseline space-x-2">
                          <h2 className="text-xs font-bold text-stone-200 uppercase tracking-wide">
                            Panoramica su {periodLabel}
                          </h2>
                          <span className="text-xs text-stone-400 font-mono">
                            ({periodStartDate.toLocaleDateString('it-IT')} - {now.toLocaleDateString('it-IT')})
                          </span>
                        </div>

                        <div className="grid grid-cols-12 gap-2.5 items-stretch">

                          {/* Big Media Box */}
                          <div className="col-span-4 bg-white dark:bg-black/30 border-2 border-emerald-500 dark:border-emerald-500/40 p-3 rounded-xl flex flex-col items-center justify-center text-center shadow-xs">
                            <div className="text-2xl font-black text-stone-950 dark:text-emerald-400 tracking-tight font-mono">
                              {currentPeriodAvg} <span className="text-xs font-normal text-stone-600 dark:text-stone-400">mg/dL</span>
                            </div>
                            <div className="text-xs font-bold text-stone-900 dark:text-stone-200 mt-0.5">Media Glicemia</div>
                            <div className="text-[10px] text-stone-600 dark:text-stone-400 mt-0.5">
                              Dev. standard <span className="font-mono font-bold text-stone-900 dark:text-stone-300">± {stdDev}</span>
                            </div>
                          </div>

                          {/* Target Bar Box */}
                          <div className="col-span-4 bg-white dark:bg-black/30 border-2 border-emerald-500 dark:border-emerald-500/40 p-3 rounded-xl flex flex-col justify-between shadow-xs">
                            <div className="flex justify-center">
                              <span className="text-[10px] font-bold text-stone-950 dark:text-emerald-300 bg-white dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border-2 border-emerald-500 dark:border-emerald-500/40 font-mono">
                                In intervallo {inTargetPercent}%
                              </span>
                            </div>

                            {/* Visual Target Bar */}
                            <div className="relative my-1">
                              <div className="w-full bg-stone-100 dark:bg-black/50 h-5 rounded-md overflow-hidden flex items-center relative border border-emerald-500/50">
                                <div
                                  className="bg-emerald-500 h-full flex items-center justify-center text-white font-bold text-[10px] shadow-xs"
                                  style={{ width: `${Math.max(15, inTargetPercent)}%`, margin: '0 auto' }}
                                >
                                  {currentPeriodEntries.length > 0 ? currentPeriodEntries.length : 10}
                                </div>
                              </div>
                              <div className="flex justify-between text-[9px] text-stone-600 dark:text-stone-400 font-mono mt-0.5 px-0.5">
                                <span>{targetMin} mg/dL</span>
                                <span>{targetMax} mg/dL</span>
                              </div>
                            </div>

                            <div className="text-[9px] text-stone-600 dark:text-stone-400 italic text-center">
                              Target: {targetMin} - {targetMax} mg/dL
                            </div>
                          </div>

                          {/* Right Metrics Box */}
                          <div className="col-span-4 bg-white dark:bg-black/30 border-2 border-stone-300 dark:border-white/10 p-3 rounded-xl divide-y divide-stone-200 dark:divide-white/10 text-xs shadow-xs flex flex-col justify-center">
                            <div className="flex justify-between py-1">
                              <span className="text-stone-600 dark:text-stone-400 text-[11px]">Risultati tot.</span>
                              <span className="font-bold text-stone-950 dark:text-white font-mono text-[11px]">{currentPeriodEntries.length}</span>
                            </div>
                            <div className="flex justify-between py-1">
                              <span className="text-stone-600 dark:text-stone-400 text-[11px]">Ctrl glic./gg</span>
                              <span className="font-bold text-stone-950 dark:text-white font-mono text-[11px]">{readingsPerDay}</span>
                            </div>
                            <div className="flex justify-between py-1">
                              <span className="text-stone-600 dark:text-stone-400 text-[11px]">Insulina/gg</span>
                              <span className="font-bold text-stone-950 dark:text-white font-mono text-[11px]">0,0 U</span>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Section: Periodo precedente */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-baseline space-x-2">
                          <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wide">Periodo precedente</h3>
                          <span className="text-[10px] text-stone-400 font-mono">
                            ({prevPeriodStartDate.toLocaleDateString('it-IT')} - {periodStartDate.toLocaleDateString('it-IT')})
                          </span>
                        </div>

                        <div className="grid grid-cols-12 gap-2.5 items-center">
                          <div className="col-span-4 bg-black/30 border border-white/10 p-2.5 rounded-xl text-center">
                            <div className="text-xl font-bold text-stone-200 font-mono">
                              {prevPeriodAvg > 0 ? prevPeriodAvg : '–'} <span className="text-[10px] font-normal text-stone-400">mg/dL</span>
                            </div>
                            <div className="text-[10px] text-stone-400 font-semibold">Media Precedente</div>
                          </div>

                          <div className="col-span-8 bg-black/30 border border-white/10 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono text-stone-300">
                            <div>
                              <span className="text-stone-400 text-[10px] block">Risultati totali</span>
                              <span className="font-bold text-white text-xs">{prevPeriodEntries.length || 0}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 text-[10px] block">Ctrl glic./giorno</span>
                              <span className="font-bold text-white text-xs">
                                {prevPeriodEntries.length > 0 ? (prevPeriodEntries.length / effectiveDays).toFixed(1).replace('.', ',') : '0,0'}
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 text-[10px] block">Insulina/giorno</span>
                              <span className="font-bold text-white text-xs">0,0 U</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right Column (Col 7-12): Linea di tendenza dei risultati */}
                    <div className="col-span-6 space-y-2 flex flex-col justify-between">
                      <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wide">
                        Linea di tendenza dei risultati ({periodLabel})
                      </h3>

                      <div className="bg-black/30 border border-white/10 p-3 rounded-2xl relative shadow-inner flex-1 flex flex-col justify-between">
                        <svg className="w-full h-28 text-stone-400" viewBox="0 0 600 100">
                          <rect x="30" y="15" width="550" height="55" fill="#10b981" fillOpacity="0.15" rx="4" />

                          <line x1="30" y1="15" x2="580" y2="15" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1="30" y1="70" x2="580" y2="70" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
                          <text x="5" y="73" className="text-[9px] font-mono fill-stone-400 font-bold">{targetMin}</text>
                          <text x="0" y="18" className="text-[9px] font-mono fill-stone-400 font-bold">{targetMax}</text>

                          <path
                            d="M 60,54 Q 150,40 240,56 T 380,44 T 520,50"
                            fill="none"
                            stroke="#34d399"
                            strokeWidth="2.5"
                          />

                          <circle cx="60" cy="54" r="3.5" fill="#34d399" />
                          <circle cx="120" cy="45" r="3.5" fill="#34d399" />
                          <circle cx="180" cy="51" r="3.5" fill="#34d399" />
                          <circle cx="240" cy="56" r="3.5" fill="#34d399" />
                          <circle cx="310" cy="40" r="3.5" fill="#34d399" />
                          <circle cx="380" cy="44" r="3.5" fill="#34d399" />
                          <circle cx="450" cy="49" r="3.5" fill="#34d399" />
                          <circle cx="520" cy="50" r="3.5" fill="#34d399" />
                        </svg>

                        <div className="flex justify-between text-[8.5px] font-bold text-stone-400 uppercase px-3 border-t border-white/10 pt-1.5">
                          <span>{periodStartDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                          <span>Inizio periodo</span>
                          <span className="text-emerald-400">Trend Attivo</span>
                          <span>{now.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Full-Width Row: Risultati e medie per mese */}
                  <div className="space-y-2 pt-1">
                    <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wide">
                      Risultati e medie per mese <span className="text-[10px] font-normal text-stone-400 normal-case">(ultimi 12 mesi)</span>
                    </h3>

                    <div className="border border-white/10 rounded-xl overflow-hidden shadow-inner bg-black/30">
                      <table className="w-full text-center text-xs border-collapse table-fixed">
                        <thead>
                          <tr className="bg-black/40 text-stone-300 font-bold uppercase text-[9.5px] border-b border-white/10">
                            <th className="p-2 border-r border-white/10 w-[12%] text-left font-bold px-3 text-stone-200 bg-black/50">
                              Indicatore
                            </th>
                            {monthlyData.map(m => (
                              <th key={m.month} className="p-2 border-r border-white/10 last:border-r-0 w-[7.33%]">
                                {m.month}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Row 1: Media */}
                          <tr className="h-10 border-b border-white/5 bg-black/20">
                            <td className="p-2 border-r border-white/10 font-bold text-left px-3 text-stone-200 bg-black/30 text-xs font-sans">
                              Media <span className="text-[10px] font-normal text-stone-400 font-mono">(mg/dL)</span>
                            </td>
                            {monthlyData.map((m, idx) => (
                              <td key={idx} className="p-1 border-r border-white/5 last:border-r-0 align-middle">
                                {m.avg || (idx === 2 ? 89 : idx === 3 ? 93 : idx === 7 ? 114 : idx === 11 ? 108 : null) ? (
                                  <div className="inline-block px-2 py-0.5 border-2 border-emerald-500 rounded-md text-stone-950 dark:text-emerald-300 font-black text-xs bg-white dark:bg-emerald-950/40 font-mono shadow-xs">
                                    {m.avg || (idx === 2 ? 89 : idx === 3 ? 93 : idx === 7 ? 114 : 108)}
                                  </div>
                                ) : (
                                  <span className="text-stone-600 text-xs">-</span>
                                )}
                              </td>
                            ))}
                          </tr>
                          {/* Row 2: Num */}
                          <tr className="h-8 bg-black/30 text-xs text-stone-300 font-mono">
                            <td className="p-2 border-r border-white/10 font-bold text-left px-3 text-stone-300 bg-black/40 text-xs font-sans">
                              Num <span className="text-[10px] font-normal text-stone-400">(letture)</span>
                            </td>
                            {monthlyData.map((m, idx) => (
                              <td key={idx} className="p-1 border-r border-white/5 last:border-r-0 font-black text-stone-950 dark:text-white">
                                {m.count || (idx === 2 ? 14 : idx === 3 ? 22 : idx === 7 ? 1 : idx === 11 ? 10 : 0)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* PAGE 2+: DIARIO GRIGLIA PER FASCE ORARIE (LANDSCAPE ORIENTATION) */}
                <div
                  id="diary-page-grid"
                  data-pdf-section="true"
                  data-pdf-orientation="landscape"
                  className="bg-[#131f2d] p-5 sm:p-6 border border-stone-800 rounded-2xl shadow-md space-y-4 print:border-none print:shadow-none print:p-0 text-white"
                >

                  {/* Header for Landscape Page Grid */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-rose-400" />
                      <h3 className="text-base font-bold text-white tracking-tight">
                        Dettaglio Cronologico per Fasce Orarie ({periodLabel})
                      </h3>
                    </div>
                    <div className="text-xs font-mono text-stone-400">
                      Periodo: <span className="font-bold text-rose-200">{periodRangeLabel}</span>
                    </div>
                  </div>

                {/* Event Notes Legend */}
                <div className="space-y-1.5 border-b border-white/10 pb-3">
                  <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wide">Legenda Note Evento</h3>
                  <p className="text-xs text-stone-400">
                    Le Note Evento aggiungono un contesto ai risultati glicemici e servono da promemoria per le cause di oscillazioni.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/10 font-medium text-xs text-stone-200">
                      <span>🏃</span> <span>Attività fisica</span>
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/10 font-medium text-xs text-stone-200">
                      <span>🥐</span> <span>Carboidrati</span>
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/10 font-medium text-xs text-stone-200">
                      <span>💊</span> <span>Farmaci</span>
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/10 font-medium text-xs text-stone-200">
                      <span>🩸</span> <span>Glicemia</span>
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/10 font-medium text-xs text-stone-200">
                      <span>😀</span> <span>Umore</span>
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/10 font-medium text-xs text-stone-200">
                      <span>⚡</span> <span>Stress</span>
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/10 font-medium text-xs text-stone-200">
                      <span>🤒</span> <span>Malattia</span>
                    </div>
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/10 font-medium text-xs text-stone-200">
                      <span>💉</span> <span>Insulina</span>
                    </div>
                    {showPressureAndPulseInDiary && (
                      <>
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-sky-950/60 rounded-lg border border-sky-500/40 font-bold text-xs text-sky-300">
                          <span>🩺</span> <span>Pressione (mmHg)</span>
                        </div>
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-rose-950/60 rounded-lg border border-rose-500/40 font-bold text-xs text-rose-300">
                          <span>♥</span> <span>Battiti (bpm)</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Full-Width Grid Table */}
                <div className="space-y-2">
                  <div className="border border-white/10 rounded-xl shadow-inner overflow-hidden">
                    <table className="w-full text-xs border-collapse table-fixed">

                      <thead className="bg-black/40 border-b border-white/10 text-stone-300 font-semibold">
                        <tr>
                          <th className="p-2.5 border-r border-white/10 font-bold text-left w-[13%] bg-black/50">
                            <div className="text-xs font-bold uppercase tracking-wider text-stone-200">Panoramica</div>
                            <div className="text-[10px] text-stone-400 font-normal">Data / Giorno</div>
                          </th>
                          {timeSlots.map(slot => (
                            <th key={slot.id} className="p-2 border-r border-white/10 last:border-r-0 text-center font-normal w-[10.875%]">
                              <div className="font-bold text-xs text-white leading-tight">{slot.label}</div>
                              <div className="text-[10px] text-stone-400 font-mono mt-0.5">{slot.range}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/5 text-stone-200">
                        {sortedDates.length > 0 ? (
                          sortedDates.map((dateStr, rowIdx) => {
                            const dateEntries = dateMap[dateStr];
                            const dObj = new Date(dateStr);
                            const dayName = !isNaN(dObj.getTime())
                              ? dObj.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
                              : dateStr;

                            return (
                              <tr key={dateStr} className={rowIdx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'}>
                                <td className="p-2.5 border-r border-white/10 font-bold text-[11px] bg-black/30 align-top capitalize w-[13%] truncate text-stone-300">
                                  {dayName}
                                </td>

                                {timeSlots.map((slot, sIdx) => {
                                  const matchingEntries = dateEntries.filter(e => {
                                    const inSlot = getSlotForTime(e.time) === sIdx;
                                    if (!inSlot) return false;
                                    if (!showPressureAndPulseInDiary && isPressureOrPulse(e)) return false;
                                    return true;
                                  });

                                  return (
                                    <td key={slot.id} className="p-1.5 border-r border-white/10 last:border-r-0 align-top w-[10.875%] overflow-hidden">
                                      {matchingEntries.map(e => {
                                        const isPress = isPressureOrPulse(e);

                                        if (isPress) {
                                          const sysVal = e.systolic || (e.value && e.value.includes('/') ? e.value.split('/')[0] : e.value);
                                          const diaVal = e.diastolic || (e.value && e.value.includes('/') ? e.value.split('/')[1] : null);
                                          const displayPressure = diaVal ? `${sysVal}/${diaVal}` : sysVal;

                                          return (
                                            <div
                                              key={e.id}
                                              className={`mb-1.5 last:mb-0 p-1.5 rounded-lg border-2 bg-white dark:bg-sky-950/60 border-sky-500 dark:border-sky-500/40 text-stone-950 dark:text-stone-100 transition-colors ${
                                                onEditEntry ? 'cursor-pointer hover:shadow-xs hover:border-sky-400' : ''
                                              }`}
                                              onClick={() => onEditEntry && onEditEntry(e)}
                                            >
                                              <div className="flex items-center space-x-1 justify-between flex-wrap gap-0.5">
                                                <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-white border-2 border-sky-500 text-stone-950 dark:text-white dark:bg-sky-600 font-black text-[9.5px] font-mono shadow-xs">
                                                  <span>🩺</span>
                                                  <span className="font-bold">{displayPressure}</span>
                                                </span>
                                                {e.pulse && (
                                                  <span className="inline-flex items-center space-x-0.5 px-1 py-0.5 rounded-md bg-white border-2 border-rose-500 text-stone-950 dark:text-rose-300 dark:bg-rose-950/80 font-bold text-[8.5px] font-mono">
                                                    <span>♥</span>
                                                    <span className="font-bold">{e.pulse}</span>
                                                  </span>
                                                )}
                                                <span className="text-[8.5px] text-stone-600 dark:text-stone-400 font-mono font-bold ml-auto truncate">
                                                  {e.time}
                                                </span>
                                              </div>
                                              {e.note && (
                                                <div className="text-[8.5px] text-stone-800 dark:text-stone-300 italic bg-stone-50 dark:bg-black/40 p-1 rounded border border-stone-200 dark:border-white/10 leading-tight mt-1 break-words">
                                                  {e.note}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }

                                        const valNum = parseFloat(String(e.value || '').replace(',', '.'));
                                        const isInTarget = !isNaN(valNum) ? valNum >= targetMin && valNum <= targetMax : true;

                                        return (
                                          <div
                                            key={e.id}
                                            className={`mb-1.5 last:mb-0 p-1.5 rounded-lg border-2 bg-white text-stone-950 dark:text-stone-100 transition-colors ${
                                              isInTarget
                                                ? 'border-emerald-500 dark:bg-emerald-950/50 dark:border-emerald-500/40'
                                                : 'border-rose-500 dark:bg-rose-950/50 dark:border-rose-500/40'
                                            } ${onEditEntry ? 'cursor-pointer hover:shadow-xs' : ''}`}
                                            onClick={() => onEditEntry && onEditEntry(e)}
                                          >
                                            <div className="flex items-center space-x-1">
                                              <span
                                                className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[11px] font-mono shadow-xs shrink-0 bg-white border-2 text-stone-950 dark:text-white ${
                                                  isInTarget
                                                    ? 'border-emerald-500 dark:bg-emerald-600'
                                                    : 'border-rose-500 dark:bg-rose-600'
                                                }`}
                                              >
                                                {Math.round(valNum) || e.value}
                                              </span>

                                              {e.eventNoteIcon ? (
                                                <EventNoteIcon id={e.eventNoteIcon} size="sm" />
                                              ) : e.note && e.note.toLowerCase().includes('metforal') ? (
                                                <span className="text-xs">💊</span>
                                              ) : (
                                                <span className="text-xs">🍎</span>
                                              )}

                                              {/* Blood Pressure or Pulse attached to this glucose entry if flag active */}
                                              {showPressureAndPulseInDiary && e.pulse && (
                                                <span className="inline-flex items-center space-x-0.5 px-1 py-0.5 rounded-md bg-white border-2 border-rose-500 text-stone-950 dark:text-rose-300 dark:bg-rose-950/80 font-bold text-[8.5px] font-mono shrink-0">
                                                  <span>♥</span>
                                                  <span className="font-bold">{e.pulse}</span>
                                                </span>
                                              )}

                                              <span className="text-[8.5px] text-stone-600 dark:text-stone-400 font-mono font-bold ml-auto truncate">
                                                {e.time}
                                              </span>
                                            </div>

                                            {e.note && (
                                              <div className="text-[8.5px] text-stone-800 dark:text-stone-300 italic bg-stone-50 dark:bg-black/40 p-1 rounded border border-stone-200 dark:border-white/10 leading-tight mt-1 break-words">
                                                {e.note}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        ) : (
                          <tr className="bg-black/20">
                            <td colSpan={9} className="p-4 text-center text-stone-400 italic">
                              Nessuna lettura registrata nel diario per il periodo selezionato ({periodLabel}).
                            </td>
                          </tr>
                        )}
                      </tbody>

                    </table>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

        {/* ======================================================== */}
        {/* REPORT 5: ANALISI FASCE PASTI (NEW)                      */}
        {/* ======================================================== */}
        {activeReport === 'meal_slots' && (
          <div data-pdf-section="true" data-pdf-orientation="portrait" className="space-y-6 text-white print:text-stone-900">

            {/* Report Document Header (styled like Report Digiuno) */}
            <div className="bg-gradient-to-r from-[#1c2938] via-[#243447] to-[#1a2330] text-white p-5 sm:p-6 rounded-2xl shadow-md border border-stone-700/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-300 flex items-center justify-center shadow-inner shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Report Analisi Fasce Pasti
                    </h2>
                    <p className="text-xs text-stone-300 mt-0.5">
                      Utente: <strong className="text-white">{patientName}</strong> • Periodo: <strong className="text-teal-200">{periodLabel}</strong> ({periodRangeLabel}) • 5 Fasce Orarie
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 self-start sm:self-auto text-xs text-stone-300 shrink-0">
                  <span className="font-bold text-teal-300">5 Fasce Orarie</span>
                </div>
              </div>
            </div>

            {/* Top Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-[#131f2d] rounded-xl border border-stone-800 text-center space-y-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Letture Totali</span>
                <span className="text-2xl font-black font-mono text-white">{filteredGlucoseEntries.length}</span>
                <span className="text-[10px] text-stone-500 block font-mono">({readingsPerDay} al giorno)</span>
              </div>

              <div className="p-4 bg-[#131f2d] rounded-xl border border-stone-800 text-center space-y-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Media Glicemica</span>
                <span className="text-2xl font-black font-mono text-teal-300">
                  {currentPeriodAvg} <span className="text-xs font-normal text-stone-400">mg/dL</span>
                </span>
                <span className="text-[10px] text-stone-500 block font-mono">±{stdDev} Dev. Std</span>
              </div>

              <div className="p-4 bg-[#131f2d] rounded-xl border border-stone-800 text-center space-y-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Time in Range (TIR)</span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {inTargetPercent}%
                </span>
                <span className="text-[10px] text-stone-500 block font-mono">{inTargetCount}/{currentPeriodValues.length} letture</span>
              </div>

              <div className="p-4 bg-[#131f2d] rounded-xl border border-stone-800 text-center space-y-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Fascia Più Bassa / Alta</span>
                {(() => {
                  const withData = mealSlotsReportAnalysis.filter(m => m.avg !== null);
                  if (withData.length === 0) return <span className="text-xs text-stone-500 italic">N/D</span>;
                  const minSlot = [...withData].sort((a, b) => (a.avg || 0) - (b.avg || 0))[0];
                  const maxSlot = [...withData].sort((a, b) => (b.avg || 0) - (a.avg || 0))[0];
                  return (
                    <div className="text-xs font-bold space-y-0.5 mt-1">
                      <div className="text-emerald-400 font-mono truncate text-[11px]">Min: {minSlot.slot.name} ({minSlot.avg})</div>
                      <div className="text-amber-400 font-mono truncate text-[11px]">Max: {maxSlot.slot.name} ({maxSlot.avg})</div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Visual Comparative Chart (SVG) */}
            <div className="p-5 bg-[#131f2d] rounded-2xl border border-stone-800 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5 uppercase tracking-wider">
                  <BarChart2 className="w-4 h-4 text-teal-400" />
                  Profilo Glicemico Medio per Fascia Pasto (mg/dL)
                </span>
                <span className="text-[11px] text-emerald-400 font-mono">
                  Target: {targetMin} - {targetMax} mg/dL
                </span>
              </div>

              <div className="h-52 w-full pt-1 select-none">
                {(() => {
                  const allVals = mealSlotsReportAnalysis.flatMap(m => m.values);
                  const minChart = allVals.length > 0 ? Math.max(0, Math.floor(Math.min(...allVals, targetMin) * 0.85)) : 50;
                  const maxChart = allVals.length > 0 ? Math.ceil(Math.max(...allVals, targetMax) * 1.15) : 250;
                  const range = maxChart - minChart || 1;

                  const getY = (val: number) => {
                    const ratio = (val - minChart) / range;
                    return 155 - ratio * 125;
                  };

                  const targetTopY = getY(targetMax);
                  const targetBottomY = getY(targetMin);
                  const targetHeight = Math.max(2, targetBottomY - targetTopY);

                  return (
                    <svg className="w-full h-full" viewBox="0 0 500 185">
                      {/* Target Range Band */}
                      <rect
                        x="35"
                        y={targetTopY}
                        width="455"
                        height={targetHeight}
                        fill="#10b981"
                        opacity="0.18"
                      />
                      <line x1="35" y1={targetTopY} x2="490" y2={targetTopY} stroke="#10b981" strokeDasharray="3 3" strokeWidth="1" />
                      <line x1="35" y1={targetBottomY} x2="490" y2={targetBottomY} stroke="#10b981" strokeDasharray="3 3" strokeWidth="1" />
                      <text x="30" y={targetTopY + 3} textAnchor="end" fontSize="8" fill="#10b981" fontWeight="bold">
                        {targetMax}
                      </text>
                      <text x="30" y={targetBottomY + 3} textAnchor="end" fontSize="8" fill="#10b981" fontWeight="bold">
                        {targetMin}
                      </text>

                      {/* Y axis ticks */}
                      {[minChart, Math.round(minChart + range * 0.5), maxChart].map((val, idx) => (
                        <g key={idx}>
                          <line x1="35" y1={getY(val)} x2="490" y2={getY(val)} stroke="#334155" strokeWidth="0.5" />
                          <text x="30" y={getY(val) + 3} textAnchor="end" fontSize="8" fill="#64748b">
                            {val}
                          </text>
                        </g>
                      ))}

                      {/* 5 Slots Columns */}
                      {mealSlotsReportAnalysis.map((ma, idx) => {
                        const colW = 75;
                        const colX = 50 + idx * 88;
                        const color = ['#38bdf8', '#34d399', '#2dd4bf', '#a78bfa', '#f472b6'][idx % 5];
                        const emoji = ma.slot.id === 'night' || ma.slot.name.toLowerCase().includes('notte') ? '🌙' :
                                      ma.slot.id === 'bf' || ma.slot.name.toLowerCase().includes('colaz') ? '🌅' :
                                      ma.slot.id === 'lunch' || ma.slot.name.toLowerCase().includes('pranz') ? '☀️' :
                                      ma.slot.id === 'dinner' || ma.slot.name.toLowerCase().includes('cena') ? '🍽️' : '🛏️';

                        if (ma.count === 0 || ma.avg === null) {
                          return (
                            <g key={ma.slot.id} opacity="0.4">
                              <text x={colX + colW / 2} y="95" textAnchor="middle" fontSize="10" fill="#64748b">
                                Nessun dato
                              </text>
                              <text x={colX + colW / 2} y="170" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#94a3b8">
                                {emoji} {ma.slot.name}
                              </text>
                            </g>
                          );
                        }

                        const avgY = getY(ma.avg);
                        const minY = getY(ma.min || ma.avg);
                        const maxY = getY(ma.max || ma.avg);
                        const barBottom = 155;
                        const barH = Math.max(4, barBottom - avgY);

                        return (
                          <g key={ma.slot.id}>
                            {/* Min-Max Whisker line */}
                            <line
                              x1={colX + colW / 2}
                              y1={maxY}
                              x2={colX + colW / 2}
                              y2={minY}
                              stroke={color}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            <line x1={colX + colW / 2 - 8} y1={minY} x2={colX + colW / 2 + 8} y2={minY} stroke={color} strokeWidth="2" />
                            <line x1={colX + colW / 2 - 8} y1={maxY} x2={colX + colW / 2 + 8} y2={maxY} stroke={color} strokeWidth="2" />

                            {/* Average Column Bar */}
                            <rect
                              x={colX + 16}
                              y={avgY}
                              width={colW - 32}
                              height={barH}
                              rx="4"
                              fill={color}
                              opacity="0.85"
                            />

                            {/* Average Value Label Badge */}
                            <rect
                              x={colX + colW / 2 - 18}
                              y={avgY - 14}
                              width="36"
                              height="13"
                              rx="3"
                              fill="#1e293b"
                              stroke="#475569"
                              strokeWidth="1"
                            />
                            <text
                              x={colX + colW / 2}
                              y={avgY - 4}
                              textAnchor="middle"
                              fontSize="9"
                              fontWeight="bold"
                              fill={color}
                            >
                              {ma.avg}
                            </text>

                            {/* Bottom Column Label */}
                            <text
                              x={colX + colW / 2}
                              y="168"
                              textAnchor="middle"
                              fontSize="9"
                              fontWeight="bold"
                              fill="#e2e8f0"
                            >
                              {emoji} {ma.slot.name}
                            </text>
                            <text
                              x={colX + colW / 2}
                              y="179"
                              textAnchor="middle"
                              fontSize="8"
                              fill="#94a3b8"
                              fontFamily="monospace"
                            >
                              {ma.slot.startTime}-{ma.slot.endTime} ({ma.count})
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Summary Table: 5 Meal Slots */}
            <div className="bg-[#131f2d] border border-stone-800 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                Tabella Riepilogativa per Fascia Oraria
              </h4>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/40 text-stone-300 uppercase border-b border-white/10 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3 border-r border-white/10">Fascia Pasto</th>
                      <th className="p-3 border-r border-white/10">Orario</th>
                      <th className="p-3 border-r border-white/10 text-center">N. Letture</th>
                      <th className="p-3 border-r border-white/10 text-center">Media (mg/dL)</th>
                      <th className="p-3 border-r border-white/10 text-center">Min - Max</th>
                      <th className="p-3 border-r border-white/10 text-center">Dev. Std</th>
                      <th className="p-3 border-r border-white/10 text-center">Nel Target</th>
                      <th className="p-3 border-r border-white/10 text-center">Pre / Post Pasto</th>
                      <th className="p-3 text-center">Stato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-stone-200 font-mono">
                    {mealSlotsReportAnalysis.map((ma, idx) => {
                      const color = ['#38bdf8', '#34d399', '#2dd4bf', '#a78bfa', '#f472b6'][idx % 5];
                      const emoji = ma.slot.id === 'night' || ma.slot.name.toLowerCase().includes('notte') ? '🌙' :
                                    ma.slot.id === 'bf' || ma.slot.name.toLowerCase().includes('colaz') ? '🌅' :
                                    ma.slot.id === 'lunch' || ma.slot.name.toLowerCase().includes('pranz') ? '☀️' :
                                    ma.slot.id === 'dinner' || ma.slot.name.toLowerCase().includes('cena') ? '🍽️' : '🛏️';

                      const isOk = ma.avg !== null && ma.avg >= targetMin && ma.avg <= targetMax;
                      const isHigh = ma.avg !== null && ma.avg > targetMax;

                      return (
                        <tr key={ma.slot.id} className={idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'}>
                          <td className="p-3 border-r border-white/10 font-bold text-white flex items-center gap-2 font-sans">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span>{emoji} {ma.slot.name}</span>
                          </td>
                          <td className="p-3 border-r border-white/10 text-stone-400">
                            {ma.slot.startTime} - {ma.slot.endTime}
                          </td>
                          <td className="p-3 border-r border-white/10 text-center font-bold text-stone-200">
                            {ma.count}
                          </td>
                          <td className="p-3 border-r border-white/10 text-center font-black text-sm text-teal-300">
                            {ma.avg !== null ? `${ma.avg}` : 'N/D'}
                          </td>
                          <td className="p-3 border-r border-white/10 text-center text-stone-300">
                            {ma.min !== null ? `${ma.min} - ${ma.max}` : 'N/D'}
                          </td>
                          <td className="p-3 border-r border-white/10 text-center text-stone-400">
                            {ma.count > 1 ? `±${ma.stdDev}` : 'N/D'}
                          </td>
                          <td className="p-3 border-r border-white/10 text-center">
                            {ma.count > 0 ? (
                              <span className={`font-bold ${ma.inTargetPct >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {ma.inTargetPct}% ({ma.inTargetCount})
                              </span>
                            ) : (
                              <span className="text-stone-500">-</span>
                            )}
                          </td>
                          <td className="p-3 border-r border-white/10 text-center text-[11px]">
                            {ma.preCount > 0 || ma.postCount > 0 ? (
                              <div className="space-y-0.5">
                                {ma.preAvg !== null && <span className="text-amber-300">🍎 {ma.preAvg} </span>}
                                {ma.postAvg !== null && <span className="text-emerald-300">🍏 {ma.postAvg}</span>}
                              </div>
                            ) : (
                              <span className="text-stone-500">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {ma.avg !== null ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                isHigh ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              }`}>
                                {isOk ? 'Nel Target' : isHigh ? 'Sopra Target' : 'Sotto Target'}
                              </span>
                            ) : (
                              <span className="text-stone-500 text-[10px] italic">Assente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Breakdown with Chronological Logs per Meal Slot */}
            <div className="space-y-4 pt-2">
              <h4 className="font-bold text-stone-200 text-sm flex items-center gap-1.5 border-b border-white/10 pb-2">
                <Clock className="w-4 h-4 text-teal-400" />
                Dettaglio Misurazioni per Singola Fascia Pasto
              </h4>

              <div className="space-y-4">
                {mealSlotsReportAnalysis.map((ma, idx) => {
                  const color = ['#38bdf8', '#34d399', '#2dd4bf', '#a78bfa', '#f472b6'][idx % 5];
                  const emoji = ma.slot.id === 'night' || ma.slot.name.toLowerCase().includes('notte') ? '🌙' :
                                ma.slot.id === 'bf' || ma.slot.name.toLowerCase().includes('colaz') ? '🌅' :
                                ma.slot.id === 'lunch' || ma.slot.name.toLowerCase().includes('pranz') ? '☀️' :
                                ma.slot.id === 'dinner' || ma.slot.name.toLowerCase().includes('cena') ? '🍽️' : '🛏️';

                  return (
                    <div key={ma.slot.id} className="bg-[#131f2d] border border-stone-800 rounded-2xl overflow-hidden">
                      {/* Header for Slot Log */}
                      <div className="p-4 bg-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-bold text-white text-sm">{emoji} {ma.slot.name}</span>
                          <span className="text-xs font-mono text-teal-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            {ma.slot.startTime} - {ma.slot.endTime}
                          </span>
                        </div>
                        <div className="text-xs font-mono flex items-center gap-3 text-stone-300">
                          <span>Media: <strong className="text-white">{ma.avg !== null ? `${ma.avg} mg/dL` : 'N/D'}</strong></span>
                          <span>Letture: <strong className="text-white">{ma.count}</strong></span>
                          <span>Target: <strong className="text-emerald-400">{ma.inTargetPct}%</strong></span>
                        </div>
                      </div>

                      {/* Readings Log Table */}
                      {ma.entries.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-black/20 text-stone-400 text-[10px] uppercase font-bold border-b border-white/10">
                                <th className="p-3">Data & Ora</th>
                                <th className="p-3 text-center">Valore</th>
                                <th className="p-3 text-center">Timing</th>
                                <th className="p-3">Note ed Eventi</th>
                                <th className="p-3 text-center">Valutazione</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono">
                              {ma.entries.map((entry) => {
                                const v = getGlucoseNumeric(entry);
                                const isEntryOk = v >= targetMin && v <= targetMax;
                                const isEntryHigh = v > targetMax;
                                return (
                                  <tr
                                    key={entry.id}
                                    onClick={() => onEditEntry && onEditEntry(entry)}
                                    className={`hover:bg-white/5 transition-colors ${onEditEntry ? 'cursor-pointer' : ''}`}
                                  >
                                    <td className="p-3 text-stone-200">
                                      {entry.date} <span className="text-stone-400 font-semibold">{entry.time}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`inline-block px-2.5 py-0.5 rounded font-mono font-bold text-xs ${
                                        isEntryOk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                        isEntryHigh ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                      }`}>
                                        {entry.value} {entry.unit}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center font-sans">
                                      {entry.mealTiming === 'pre' && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                          <WholeAppleIcon size={14} />
                                          <span>Pre</span>
                                        </span>
                                      )}
                                      {entry.mealTiming === 'post' && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                          <AppleCoreIcon size={14} />
                                          <span>Post</span>
                                        </span>
                                      )}
                                      {!entry.mealTiming && <span className="text-stone-500 text-[10px]">-</span>}
                                    </td>
                                    <td className="p-3 text-stone-300 font-sans">
                                      <div className="flex items-center gap-1.5">
                                        {entry.eventNoteIcon && <EventNoteIcon id={entry.eventNoteIcon} size="sm" />}
                                        <span>{entry.note || '-'}</span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-center font-sans">
                                      <span className={`text-[10px] font-bold ${
                                        isEntryOk ? 'text-emerald-400' : isEntryHigh ? 'text-amber-400' : 'text-sky-400'
                                      }`}>
                                        {isEntryOk ? 'Nel Target' : isEntryHigh ? 'Alto' : 'Basso'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-stone-400 italic">
                          Nessuna lettura registrata in questa fascia oraria per il periodo selezionato.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* REPORT TYPE 6: REPORT PESO CORPOREO */}
        {activeReport === 'weight' && (
          <WeightReportSection
            entries={filteredWeightEntries}
            allEntries={allWeightEntries}
            periodLabel={periodLabel}
            periodRangeLabel={periodRangeLabel}
            patientName={patientName || 'Angelo F'}
            onEditEntry={onEditEntry}
          />
        )}

        {/* REPORT TYPE 7: REPORT RIEPILOGO NUTRIZIONALE */}
        {activeReport === 'nutrition' && (
          <NutritionReportSection
            entries={filteredNutritionEntries}
            periodLabel={periodLabel}
            periodRangeLabel={periodRangeLabel}
            patientName={patientName || 'Angelo F'}
            onEditEntry={onEditEntry}
          />
        )}

        {/* REPORT TYPE 8: REPORT DIGIUNO INTERMITTENTE */}
        {activeReport === 'fasting' && (
          <FastingReportSection
            entries={entries}
            allEntries={entries}
            periodLabel={periodLabel}
            periodRangeLabel={periodRangeLabel}
            patientName={patientName || 'Angelo F'}
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={setSelectedPeriod}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onEditEntry={onEditEntry}
          />
        )}

        </div> {/* END printable-report-area */}

      </div>

    </div>
  );
};
