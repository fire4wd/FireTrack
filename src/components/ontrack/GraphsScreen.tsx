import React, { useState, useRef, useMemo } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { LogEntryItem, HealthSubType, MealSlotConfig } from '../../types/ontrack';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart2, 
  LineChart as LineChartIcon, 
  Percent, 
  Calendar, 
  Activity, 
  Layers, 
  ArrowRight,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle,
  Utensils,
  Sun,
  Moon,
  Sparkles,
  ChevronRight,
  Filter,
  CalendarRange,
  RotateCcw,
  Sliders,
  Maximize2,
  Heart,
  Scale,
  Zap,
  Tag
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceArea,
  ReferenceLine,
  Dot
} from 'recharts';
import { loadMealSlots, loadUserSettings } from '../../utils/ontrackStorage';
import { analyzeEntriesByMealSlot, getMealSlotForEntry, MealSlotAnalysis } from '../../utils/mealSlotMatcher';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { EventNoteIcon } from './EventNoteIcon';

interface GraphsScreenProps {
  entries: LogEntryItem[];
  subTypes: HealthSubType[];
  onBack: () => void;
  onOpenTools: () => void;
  onNavigate?: (screen: string) => void;
  onEditEntry?: (entry: LogEntryItem) => void;
}

interface GraphDataPoint {
  id: string;
  date: string;
  displayDate: string;
  time: string;
  valore: number;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  categoria: string;
  mealTiming?: 'pre' | 'post';
  note?: string;
  eventNoteIcon?: string;
  timestamp: number;
  rawEntry?: LogEntryItem;
  inTarget?: boolean;
  isHigh?: boolean;
  isLow?: boolean;
}

interface DailyAggregatedPoint {
  date: string;
  displayDate: string;
  avgValue: number;
  minValue: number;
  maxValue: number;
  count: number;
  timestamp: number;
  avgSystolic?: number;
  avgDiastolic?: number;
  avgPulse?: number;
}

interface CategoryTrendData {
  categoryName: string;
  currentAvg: number | null;
  previousAvg: number | null;
  pctChange: number | null;
  absChange: number | null;
  currentCount: number;
  previousCount: number;
  min: number | null;
  max: number | null;
}

// Convert date string YYYY-MM-DD or DD/MM/YYYY to timestamp
const parseEntryDateToTimestamp = (dateStr: string, timeStr?: string): number => {
  if (!dateStr) return 0;
  let year = 1970;
  let month = 1;
  let day = 1;

  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    }
  }

  let hours = 12;
  let minutes = 0;
  if (timeStr && timeStr.includes(':')) {
    const [h, m] = timeStr.split(':');
    hours = parseInt(h, 10) || 12;
    minutes = parseInt(m, 10) || 0;
  }

  const d = new Date(year, month - 1, day, hours, minutes);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const formatDateToInputString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const GraphsScreen: React.FC<GraphsScreenProps> = ({
  entries,
  subTypes,
  onBack,
  onOpenTools,
  onNavigate,
  onEditEntry
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'trend' | 'meals'>('timeline');
  const [selectedSubTypeId, setSelectedSubTypeId] = useState<string>(
    subTypes[0]?.id || 'sub_glucose'
  );
  
  // Date Interval State
  const [timeRange, setTimeRange] = useState<'7' | '14' | '30' | '60' | '90' | 'ALL' | 'custom'>('30');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateToInputString(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return formatDateToInputString(new Date());
  });

  // Additional Chart Filters & Display Options
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedMealTimingFilter, setSelectedMealTimingFilter] = useState<'ALL' | 'pre' | 'post'>('ALL');
  const [aggregationMode, setAggregationMode] = useState<'all' | 'daily'>('all');
  const [showMovingAverage, setShowMovingAverage] = useState<boolean>(true);
  const [selectedMealSlotFilter, setSelectedMealSlotFilter] = useState<string | 'ALL'>('ALL');
  const [expandedSlotDetails, setExpandedSlotDetails] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  const activeSubType = useMemo(() => {
    return subTypes.find(s => s.id === selectedSubTypeId) || subTypes[0] || { id: 'sub_glucose', name: 'Glicemia', unit: 'mg/dL' };
  }, [subTypes, selectedSubTypeId]);

  const userSettings = useMemo(() => loadUserSettings(), []);
  const mealSlots = useMemo(() => loadMealSlots(), []);
  const targetMin = userSettings?.targetPreMin || 70;
  const targetMax = userSettings?.targetPostMax || userSettings?.targetPreMax || 150;

  // Helper function to safely parse numeric value from log entries
  const parseVal = (val: string | number | undefined): number => {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    if (str.includes('/')) {
      const parts = str.split('/');
      const num = parseFloat(parts[0].replace(',', '.'));
      return isNaN(num) ? 0 : num;
    }
    const num = parseFloat(str.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  const isBP = useMemo(() => {
    const name = activeSubType.name.toLowerCase();
    const id = activeSubType.id.toLowerCase();
    return name.includes('pressione') || name.includes('blood pressure') || id.includes('bp') || name.includes('battiti');
  }, [activeSubType]);

  const isGlucose = useMemo(() => {
    const name = activeSubType.name.toLowerCase();
    const id = activeSubType.id.toLowerCase();
    return name.includes('glucose') || name.includes('glicemia') || id.includes('glucose');
  }, [activeSubType]);

  const isWeight = useMemo(() => {
    const name = activeSubType.name.toLowerCase();
    const id = activeSubType.id.toLowerCase();
    return name.includes('peso') || name.includes('weight') || id.includes('weight');
  }, [activeSubType]);

  // Compute timestamp interval cutoff based on selected interval
  const now = useMemo(() => Date.now(), []);

  const { intervalStartTimestamp, intervalEndTimestamp, intervalLabel } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();

    if (timeRange === 'custom') {
      const s = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : 0;
      const e = customEndDate ? new Date(`${customEndDate}T23:59:59`).getTime() : endMs;
      const label = `Dal ${customStartDate || 'Inizio'} al ${customEndDate || 'Oggi'}`;
      return { intervalStartTimestamp: s, intervalEndTimestamp: e, intervalLabel: label };
    }

    if (timeRange === 'ALL') {
      return { intervalStartTimestamp: 0, intervalEndTimestamp: endMs, intervalLabel: 'Tutto lo storico' };
    }

    const days = parseInt(timeRange, 10) || 30;
    const start = new Date(endMs - days * 24 * 3600 * 1000);
    start.setHours(0, 0, 0, 0);
    return {
      intervalStartTimestamp: start.getTime(),
      intervalEndTimestamp: endMs,
      intervalLabel: `Ultimi ${days} giorni (${start.toLocaleDateString('it-IT')} - ${end.toLocaleDateString('it-IT')})`
    };
  }, [timeRange, customStartDate, customEndDate]);

  // Filter entries for active subType
  const entriesOfActiveSubType = useMemo(() => {
    return entries.filter(e => e.subTypeId === selectedSubTypeId || e.subTypeName === activeSubType.name);
  }, [entries, selectedSubTypeId, activeSubType.name]);

  // Extract all categories present in active subType
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    entriesOfActiveSubType.forEach(e => {
      if (e.categoryName) cats.add(e.categoryName);
    });
    return Array.from(cats);
  }, [entriesOfActiveSubType]);

  // Filtered Chronological Graph Data
  const graphData: GraphDataPoint[] = useMemo(() => {
    return entriesOfActiveSubType
      .filter(e => {
        const ts = e.timestamp || parseEntryDateToTimestamp(e.date, e.time);
        if (intervalStartTimestamp > 0 && ts < intervalStartTimestamp) return false;
        if (intervalEndTimestamp > 0 && ts > intervalEndTimestamp) return false;
        if (selectedCategoryFilter !== 'ALL' && e.categoryName !== selectedCategoryFilter) return false;
        if (selectedMealTimingFilter !== 'ALL' && e.mealTiming !== selectedMealTimingFilter) return false;
        return true;
      })
      .map(e => {
        const v = parseVal(e.value);
        const ts = e.timestamp || parseEntryDateToTimestamp(e.date, e.time);
        
        let sys: number | undefined;
        let dia: number | undefined;
        let pul: number | undefined;

        if (isBP) {
          if (e.systolic) sys = parseFloat(e.systolic);
          if (e.diastolic) dia = parseFloat(e.diastolic);
          if (e.pulse) pul = parseFloat(e.pulse);
          if (!sys && String(e.value).includes('/')) {
            const parts = String(e.value).split('/');
            sys = parseFloat(parts[0]);
            dia = parseFloat(parts[1]);
          }
        }

        const inTgt = isGlucose ? (v >= targetMin && v <= targetMax) : undefined;
        const isHi = isGlucose ? (v > targetMax) : undefined;
        const isLo = isGlucose ? (v < targetMin) : undefined;

        return {
          id: e.id,
          date: e.date,
          displayDate: `${e.date} ${e.time || ''}`,
          time: e.time || '',
          valore: v,
          systolic: sys,
          diastolic: dia,
          pulse: pul,
          categoria: e.categoryName || 'Altro',
          mealTiming: e.mealTiming,
          note: e.note,
          eventNoteIcon: e.eventNoteIcon,
          timestamp: ts,
          rawEntry: e,
          inTarget: inTgt,
          isHigh: isHi,
          isLow: isLo
        };
      })
      .filter(d => (typeof d.valore === 'number' && !isNaN(d.valore) && isFinite(d.valore)) || (d.systolic && !isNaN(d.systolic)))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [
    entriesOfActiveSubType,
    intervalStartTimestamp,
    intervalEndTimestamp,
    selectedCategoryFilter,
    selectedMealTimingFilter,
    isBP,
    isGlucose,
    targetMin,
    targetMax
  ]);

  // Calculate Moving Average (3-point rolling average)
  const chartDataWithMA = useMemo(() => {
    return graphData.map((d, index, arr) => {
      const windowSize = Math.min(3, index + 1);
      const slice = arr.slice(Math.max(0, index - windowSize + 1), index + 1);
      const avgVal = slice.reduce((sum, item) => sum + item.valore, 0) / slice.length;
      return {
        ...d,
        movingAvg: parseFloat(avgVal.toFixed(1))
      };
    });
  }, [graphData]);

  // Aggregated Daily Data
  const dailyAggregatedData: DailyAggregatedPoint[] = useMemo(() => {
    const groups: { [date: string]: GraphDataPoint[] } = {};
    graphData.forEach(d => {
      if (!groups[d.date]) groups[d.date] = [];
      groups[d.date].push(d);
    });

    return Object.keys(groups).map(date => {
      const items = groups[date];
      const vals = items.map(i => i.valore);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      
      let avgSys: number | undefined;
      let avgDia: number | undefined;
      let avgPulse: number | undefined;

      const sysVals = items.map(i => i.systolic).filter((v): v is number => typeof v === 'number' && !isNaN(v));
      const diaVals = items.map(i => i.diastolic).filter((v): v is number => typeof v === 'number' && !isNaN(v));
      const pulVals = items.map(i => i.pulse).filter((v): v is number => typeof v === 'number' && !isNaN(v));

      if (sysVals.length > 0) avgSys = Math.round(sysVals.reduce((a, b) => a + b, 0) / sysVals.length);
      if (diaVals.length > 0) avgDia = Math.round(diaVals.reduce((a, b) => a + b, 0) / diaVals.length);
      if (pulVals.length > 0) avgPulse = Math.round(pulVals.reduce((a, b) => a + b, 0) / pulVals.length);

      return {
        date,
        displayDate: date,
        avgValue: parseFloat(avg.toFixed(1)),
        minValue: min,
        maxValue: max,
        count: items.length,
        timestamp: items[0].timestamp,
        avgSystolic: avgSys,
        avgDiastolic: avgDia,
        avgPulse: avgPulse
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [graphData]);

  // Summary Statistics for the Filtered Date Range
  const filteredStats = useMemo(() => {
    const values = graphData.map(d => d.valore).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    if (values.length === 0) {
      return {
        count: 0,
        average: null,
        min: null,
        max: null,
        stdDev: null,
        inTargetPct: null,
        aboveTargetPct: null,
        belowTargetPct: null,
        inTargetCount: 0,
        aboveTargetCount: 0,
        belowTargetCount: 0,
        minPoint: null,
        maxPoint: null
      };
    }

    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // Standard deviation
    const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    // In-target counts (for glucose)
    const inTarget = values.filter(v => v >= targetMin && v <= targetMax).length;
    const aboveTarget = values.filter(v => v > targetMax).length;
    const belowTarget = values.filter(v => v < targetMin).length;

    const minPoint = graphData.find(d => d.valore === minVal) || null;
    const maxPoint = graphData.find(d => d.valore === maxVal) || null;

    return {
      count,
      average: parseFloat(avg.toFixed(1)),
      min: minVal,
      max: maxVal,
      stdDev: parseFloat(stdDev.toFixed(1)),
      inTargetPct: Math.round((inTarget / count) * 100),
      aboveTargetPct: Math.round((aboveTarget / count) * 100),
      belowTargetPct: Math.round((belowTarget / count) * 100),
      inTargetCount: inTarget,
      aboveTargetCount: aboveTarget,
      belowTargetCount: belowTarget,
      minPoint,
      maxPoint
    };
  }, [graphData, targetMin, targetMax]);

  // Compute Y-Axis Domain
  const yAxisDomain = useMemo(() => {
    const vals = graphData.map(d => d.valore);
    if (isBP) {
      graphData.forEach(d => {
        if (d.systolic) vals.push(d.systolic);
        if (d.diastolic) vals.push(d.diastolic);
      });
    }

    if (vals.length === 0) return [0, 200];
    let min = Math.min(...vals);
    let max = Math.max(...vals);

    if (isGlucose) {
      min = Math.min(min, targetMin - 10);
      max = Math.max(max, targetMax + 20);
    }

    const padding = Math.max(10, (max - min) * 0.15);
    return [
      Math.max(0, Math.floor(min - padding)),
      Math.ceil(max + padding)
    ];
  }, [graphData, isBP, isGlucose, targetMin, targetMax]);

  // Reset all filters
  const handleResetFilters = () => {
    setTimeRange('30');
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setCustomStartDate(formatDateToInputString(d));
    setCustomEndDate(formatDateToInputString(new Date()));
    setSelectedCategoryFilter('ALL');
    setSelectedMealTimingFilter('ALL');
    setAggregationMode('all');
  };

  // ==========================================
  // TREND CALCULATIONS (Current Period vs Previous Period)
  // ==========================================
  const trendAnalysis = useMemo(() => {
    const days = timeRange === '7' ? 7 : timeRange === '14' ? 14 : timeRange === '30' ? 30 : timeRange === '60' ? 60 : timeRange === '90' ? 90 : 30;
    const msInDay = 24 * 3600 * 1000;
    
    let currentStart = now - days * msInDay;
    let currentEnd = now;
    let prevStart = now - 2 * days * msInDay;
    let prevEnd = now - days * msInDay;

    let periodLabel = `${days} giorni`;
    if (timeRange === 'ALL') {
      const allTimestamps = entriesOfActiveSubType.map(e => e.timestamp).filter((t): t is number => Boolean(t));
      if (allTimestamps.length > 1) {
        const minT = Math.min(...allTimestamps);
        const span = now - minT;
        const halfSpan = span / 2;
        currentStart = now - halfSpan;
        currentEnd = now;
        prevStart = minT;
        prevEnd = currentStart;
        periodLabel = `Metà Periodo Totale (~${Math.round(halfSpan / msInDay)} gg)`;
      } else {
        periodLabel = `30 giorni (predefinito)`;
      }
    }

    const currentEntries = entriesOfActiveSubType.filter(e => (e.timestamp || 0) >= currentStart && (e.timestamp || 0) <= currentEnd);
    const prevEntries = entriesOfActiveSubType.filter(e => (e.timestamp || 0) >= prevStart && (e.timestamp || 0) < prevEnd);

    // Global overall trend for active parameter
    const currentValues = currentEntries.map(e => parseVal(e.value)).filter(v => !isNaN(v) && v > 0);
    const prevValues = prevEntries.map(e => parseVal(e.value)).filter(v => !isNaN(v) && v > 0);

    const currentAvg = currentValues.length > 0 ? currentValues.reduce((a, b) => a + b, 0) / currentValues.length : null;
    const prevAvg = prevValues.length > 0 ? prevValues.reduce((a, b) => a + b, 0) / prevValues.length : null;

    let overallPctChange: number | null = null;
    let overallAbsChange: number | null = null;
    if (currentAvg !== null && prevAvg !== null && prevAvg > 0) {
      overallAbsChange = currentAvg - prevAvg;
      overallPctChange = ((currentAvg - prevAvg) / prevAvg) * 100;
    }

    // Per-Category Breakdown
    const categorySet = new Set<string>();
    entriesOfActiveSubType.forEach(e => {
      if (e.categoryName) categorySet.add(e.categoryName);
    });

    const categoryTrends: CategoryTrendData[] = Array.from(categorySet).map(catName => {
      const curCat = currentEntries.filter(e => e.categoryName === catName);
      const prevCat = prevEntries.filter(e => e.categoryName === catName);

      const curVals = curCat.map(e => parseVal(e.value)).filter(v => !isNaN(v) && v > 0);
      const prevVals = prevCat.map(e => parseVal(e.value)).filter(v => !isNaN(v) && v > 0);

      const curCatAvg = curVals.length > 0 ? curVals.reduce((a, b) => a + b, 0) / curVals.length : null;
      const prevCatAvg = prevVals.length > 0 ? prevVals.reduce((a, b) => a + b, 0) / prevVals.length : null;

      let pctChange: number | null = null;
      let absChange: number | null = null;
      if (curCatAvg !== null && prevCatAvg !== null && prevCatAvg > 0) {
        absChange = curCatAvg - prevCatAvg;
        pctChange = ((curCatAvg - prevCatAvg) / prevCatAvg) * 100;
      }

      const allCatVals = [...curVals];
      const min = allCatVals.length > 0 ? Math.min(...allCatVals) : null;
      const max = allCatVals.length > 0 ? Math.max(...allCatVals) : null;

      return {
        categoryName: catName,
        currentAvg: curCatAvg,
        previousAvg: prevCatAvg,
        pctChange,
        absChange,
        currentCount: curCat.length,
        previousCount: prevCat.length,
        min,
        max
      };
    }).sort((a, b) => b.currentCount - a.currentCount);

    // Multi-Subtype Summary
    const otherSubTypesSummary = subTypes.map(st => {
      const stEntries = entries.filter(e => e.subTypeId === st.id || e.subTypeName === st.name);
      const stCur = stEntries.filter(e => (e.timestamp || 0) >= currentStart && (e.timestamp || 0) <= currentEnd);
      const stPrev = stEntries.filter(e => (e.timestamp || 0) >= prevStart && (e.timestamp || 0) < prevEnd);

      const curV = stCur.map(e => parseVal(e.value)).filter(v => !isNaN(v) && v > 0);
      const prevV = stPrev.map(e => parseVal(e.value)).filter(v => !isNaN(v) && v > 0);

      const cAvg = curV.length > 0 ? curV.reduce((a, b) => a + b, 0) / curV.length : null;
      const pAvg = prevV.length > 0 ? prevV.reduce((a, b) => a + b, 0) / prevV.length : null;

      let pct: number | null = null;
      if (cAvg !== null && pAvg !== null && pAvg > 0) {
        pct = ((cAvg - pAvg) / pAvg) * 100;
      }

      return {
        subType: st,
        currentAvg: cAvg,
        previousAvg: pAvg,
        pctChange: pct,
        count: stCur.length
      };
    });

    return {
      periodLabel,
      days,
      currentStart,
      currentEnd,
      prevStart,
      prevEnd,
      currentAvg,
      prevAvg,
      overallPctChange,
      overallAbsChange,
      currentCount: currentEntries.length,
      previousCount: prevEntries.length,
      categoryTrends,
      otherSubTypesSummary
    };
  }, [entries, entriesOfActiveSubType, timeRange, activeSubType.name, subTypes, now]);

  // ==========================================
  // MEAL SLOTS ANALYSIS (Grouped by time bands)
  // ==========================================
  const filteredEntriesForMeals = useMemo(() => {
    return entriesOfActiveSubType.filter(e => {
      const ts = e.timestamp || parseEntryDateToTimestamp(e.date, e.time);
      if (intervalStartTimestamp > 0 && ts < intervalStartTimestamp) return false;
      if (intervalEndTimestamp > 0 && ts > intervalEndTimestamp) return false;
      return true;
    });
  }, [entriesOfActiveSubType, intervalStartTimestamp, intervalEndTimestamp]);

  const mealSlotsAnalysis = useMemo(() => {
    return analyzeEntriesByMealSlot(
      filteredEntriesForMeals,
      mealSlots,
      targetMin,
      targetMax,
      parseVal
    );
  }, [filteredEntriesForMeals, mealSlots, targetMin, targetMax]);

  const displayedMealSlotsAnalysis = useMemo(() => {
    if (selectedMealSlotFilter === 'ALL') return mealSlotsAnalysis;
    return mealSlotsAnalysis.filter(m => m.slot.id === selectedMealSlotFilter);
  }, [mealSlotsAnalysis, selectedMealSlotFilter]);

  const totalMealReadings = useMemo(() => {
    return mealSlotsAnalysis.reduce((acc, curr) => acc + curr.count, 0);
  }, [mealSlotsAnalysis]);

  const renderTrendBadge = (pct: number | null, abs: number | null, unit: string) => {
    if (pct === null) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
          <Minus className="w-3 h-3 mr-1" />
          Dati prec. assenti
        </span>
      );
    }

    const formattedPct = (pct >= 0 ? `+${pct.toFixed(1)}` : pct.toFixed(1)) + '%';
    const formattedAbs = abs !== null ? (abs >= 0 ? `+${abs.toFixed(1)}` : abs.toFixed(1)) : '';

    if (Math.abs(pct) < 1.0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <Minus className="w-3 h-3 mr-1 text-slate-500" />
          <span>Stabile ({formattedPct})</span>
        </span>
      );
    }

    if (pct > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" />
          <span>{formattedPct} ({formattedAbs} {unit})</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" />
        <span>{formattedPct} ({formattedAbs} {unit})</span>
      </span>
    );
  };

  // Custom Chart Dot component
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;

    let dotColor = '#2ca3b5';
    if (isGlucose) {
      if (payload.isHigh) dotColor = '#f59e0b';
      else if (payload.isLow) dotColor = '#0ea5e9';
      else if (payload.inTarget) dotColor = '#10b981';
    }

    const isHovered = hoveredPointId === payload.id;

    return (
      <circle
        cx={cx}
        cy={cy}
        r={isHovered ? 6 : 4.5}
        fill={dotColor}
        stroke="#ffffff"
        strokeWidth={1.5}
        className="cursor-pointer transition-all duration-150 hover:opacity-90"
        onClick={() => payload.rawEntry && onEditEntry && onEditEntry(payload.rawEntry)}
      />
    );
  };

  // Custom Tooltip for Recharts
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as GraphDataPoint;

    return (
      <div className="bg-stone-900/95 text-white p-3 rounded-xl shadow-2xl border border-stone-700 text-xs space-y-1.5 max-w-xs z-50 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-stone-700 pb-1 gap-2">
          <div className="flex items-center space-x-1.5 font-mono text-stone-300">
            <Calendar className="w-3 h-3 text-[#38bdf8]" />
            <span>{data.date}</span>
            {data.time && <span>{data.time}</span>}
          </div>
          {data.mealTiming && (
            <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-stone-800 text-[10px] font-bold">
              {data.mealTiming === 'pre' ? <WholeAppleIcon size={12} /> : <AppleCoreIcon size={12} />}
              <span>{data.mealTiming === 'pre' ? 'Pre-pasto' : 'Post-pasto'}</span>
            </span>
          )}
        </div>

        {/* Value Display */}
        <div className="flex items-baseline space-x-2 pt-0.5">
          {isBP ? (
            <div className="text-base font-bold text-sky-400 font-mono">
              {data.systolic && data.diastolic ? `${data.systolic}/${data.diastolic} mmHg` : `${data.valore} mmHg`}
              {data.pulse && <span className="text-xs text-rose-400 ml-2 font-normal">({data.pulse} bpm)</span>}
            </div>
          ) : (
            <div className="text-lg font-bold font-mono flex items-center space-x-1.5">
              <span className={
                isGlucose
                  ? (data.inTarget ? 'text-emerald-400' : data.isHigh ? 'text-amber-400' : 'text-sky-400')
                  : 'text-cyan-400'
              }>
                {data.valore} {activeSubType.unit}
              </span>
            </div>
          )}
        </div>

        {/* Category & Status */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-semibold">
            {data.categoria}
          </span>
          {isGlucose && (
            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
              data.inTarget ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
              data.isHigh ? 'bg-amber-950 text-amber-300 border border-amber-800' :
              'bg-sky-950 text-sky-300 border border-sky-800'
            }`}>
              {data.inTarget ? 'Nel Target' : data.isHigh ? 'Sopra Target' : 'Sotto Target'}
            </span>
          )}
        </div>

        {/* Notes / Event icon */}
        {(data.note || data.eventNoteIcon) && (
          <div className="text-[11px] text-stone-300 pt-1 border-t border-stone-800 flex items-center space-x-1.5">
            {data.eventNoteIcon && <EventNoteIcon id={data.eventNoteIcon} size="sm" />}
            {data.note && <span className="italic truncate">{data.note}</span>}
          </div>
        )}

        {onEditEntry && data.rawEntry && (
          <div className="text-[10px] text-[#38bdf8] pt-1 font-semibold flex items-center space-x-1">
            <span>Tocca per modificare</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full bg-[#e8ecee] dark:bg-[#121418] text-stone-900 dark:text-stone-100 transition-colors">
      
      {/* Header */}
      <OnTrackHeader
        title="Grafici & Trend"
        showBack={true}
        onBack={onBack}
        showToolsMenu={true}
        onOpenTools={onOpenTools}
        onNavigate={onNavigate}
      />

      {/* Main Body */}
      <div className="flex-1 p-3 sm:p-5 max-w-5xl mx-auto w-full space-y-4 pb-16">
        
        {/* Mode Selector Tabs: Andamento Temporale vs Analisi Trend % vs Fasce Pasti */}
        <div className="flex items-center p-1 bg-stone-200 dark:bg-stone-900 rounded-xl border border-stone-300 dark:border-stone-800 shadow-2xs">
          <button
            onClick={() => setViewMode('timeline')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === 'timeline'
                ? 'bg-white dark:bg-[#1a1d24] text-[#1d8998] dark:text-[#38bdf8] shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="truncate">Andamento Temporale</span>
          </button>

          <button
            onClick={() => setViewMode('trend')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === 'trend'
                ? 'bg-white dark:bg-[#1a1d24] text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Percent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="truncate">Trend %</span>
          </button>

          <button
            onClick={() => setViewMode('meals')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === 'meals'
                ? 'bg-white dark:bg-[#1a1d24] text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="truncate">Fasce Pasti</span>
          </button>
        </div>

        {/* Global Controls Panel: Parametro & Filtro Intervallo di Date */}
        <div className="bg-white dark:bg-[#1a1d24] p-4 border border-stone-300 dark:border-stone-800 rounded-2xl shadow-xs space-y-3">
          
          {/* Top Row: Parametro & SubType Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-[#2ca3b5]/15 text-[#1d8998] dark:text-[#38bdf8] rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block leading-tight">
                  Parametro Monitorato
                </span>
                <span className="text-[11px] text-stone-500 font-mono">
                  {activeSubType.name} ({activeSubType.unit})
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedSubTypeId}
                onChange={(e) => setSelectedSubTypeId(e.target.value)}
                className="bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#2ca3b5] cursor-pointer shadow-2xs"
              >
                {subTypes.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Second Row: Date Interval Quick Presets & Custom Picker */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-stone-700 dark:text-stone-300">
                <CalendarRange className="w-4 h-4 text-[#2ca3b5]" />
                <span>Intervallo di Date:</span>
              </div>

              {/* Preset Buttons */}
              <div className="inline-flex flex-wrap rounded-xl border border-stone-300 dark:border-stone-700 p-0.5 bg-stone-100 dark:bg-stone-800 shadow-2xs">
                {(['7', '14', '30', '60', '90', 'ALL', 'custom'] as const).map(rng => (
                  <button
                    key={rng}
                    onClick={() => setTimeRange(rng)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timeRange === rng
                        ? 'bg-[#2ca3b5] text-white shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {rng === 'ALL' ? 'Tutto' : rng === 'custom' ? 'Personalizzato' : `${rng} gg`}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker (Shown when 'custom' is active or always collapsible) */}
            {timeRange === 'custom' && (
              <div className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-200">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-stone-600 dark:text-stone-400 text-[11px]">Da Data:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg font-mono text-xs font-semibold focus:outline-none focus:border-[#2ca3b5]"
                  />
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-stone-600 dark:text-stone-400 text-[11px]">A Data:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg font-mono text-xs font-semibold focus:outline-none focus:border-[#2ca3b5]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 text-xs font-bold text-stone-600 dark:text-stone-300 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 rounded-lg flex items-center space-x-1 ml-auto cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Ripristina</span>
                </button>
              </div>
            )}

            {/* Active Range Summary Info */}
            <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 font-mono pt-1">
              <span>Filtro attivo: <strong className="text-stone-800 dark:text-stone-200">{intervalLabel}</strong></span>
              <span>{graphData.length} letture trovate</span>
            </div>
          </div>

          {/* Third Row: Additional Filters (Category, Meal Timing, Aggregation) */}
          {viewMode === 'timeline' && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-200 dark:border-stone-800 text-xs">
              
              {/* Category Filter */}
              <div className="flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-stone-500 font-semibold">Categoria:</span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1 font-semibold text-xs cursor-pointer"
                >
                  <option value="ALL">Tutte ({entriesOfActiveSubType.length})</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Meal Timing (Pre / Post) for Glucose */}
              {isGlucose && (
                <div className="flex items-center space-x-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                  <button
                    type="button"
                    onClick={() => setSelectedMealTimingFilter('ALL')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                      selectedMealTimingFilter === 'ALL' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs' : 'text-stone-500'
                    }`}
                  >
                    Tutti
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMealTimingFilter('pre')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer ${
                      selectedMealTimingFilter === 'pre' ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs' : 'text-stone-500'
                    }`}
                  >
                    <WholeAppleIcon size={12} />
                    <span>Pre</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMealTimingFilter('post')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer ${
                      selectedMealTimingFilter === 'post' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs' : 'text-stone-500'
                    }`}
                  >
                    <AppleCoreIcon size={12} />
                    <span>Post</span>
                  </button>
                </div>
              )}

              {/* Aggregation Mode (All vs Daily Avg) */}
              <div className="flex items-center space-x-1.5 ml-auto">
                <span className="text-stone-500 text-[11px]">Vista:</span>
                <button
                  type="button"
                  onClick={() => setAggregationMode(aggregationMode === 'all' ? 'daily' : 'all')}
                  className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 cursor-pointer shadow-2xs"
                >
                  {aggregationMode === 'all' ? '📍 Singoli Punti' : '📊 Media Giornaliera'}
                </button>
              </div>

            </div>
          )}

        </div>

        {/* VIEW 1: ENHANCED TIMELINE LINE CHART */}
        {viewMode === 'timeline' && (
          <div className="space-y-4">
            
            {/* KPI Statistics Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              
              {/* Media nel Periodo */}
              <div className="bg-white dark:bg-[#1a1d24] p-3 rounded-2xl border border-stone-300 dark:border-stone-800 shadow-xs">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">
                  Media Periodo
                </span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-[#1d8998] dark:text-[#38bdf8]">
                    {filteredStats.average !== null ? filteredStats.average : '—'}
                  </span>
                  <span className="text-[10px] text-stone-400">{activeSubType.unit}</span>
                </div>
                {isGlucose && filteredStats.average !== null && (
                  <span className={`text-[9px] font-bold block mt-1 ${
                    filteredStats.average >= targetMin && filteredStats.average <= targetMax
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {filteredStats.average >= targetMin && filteredStats.average <= targetMax ? '✓ In Target' : '⚠ Fuori Target'}
                  </span>
                )}
              </div>

              {/* Minimo */}
              <div className="bg-white dark:bg-[#1a1d24] p-3 rounded-2xl border border-stone-300 dark:border-stone-800 shadow-xs">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">
                  Valore Minimo
                </span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-sky-600 dark:text-sky-400">
                    {filteredStats.min !== null ? filteredStats.min : '—'}
                  </span>
                  <span className="text-[10px] text-stone-400">{activeSubType.unit}</span>
                </div>
                {filteredStats.minPoint && (
                  <span className="text-[9px] text-stone-400 font-mono block mt-1 truncate">
                    {filteredStats.minPoint.date}
                  </span>
                )}
              </div>

              {/* Massimo */}
              <div className="bg-white dark:bg-[#1a1d24] p-3 rounded-2xl border border-stone-300 dark:border-stone-800 shadow-xs">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">
                  Valore Massimo
                </span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                    {filteredStats.max !== null ? filteredStats.max : '—'}
                  </span>
                  <span className="text-[10px] text-stone-400">{activeSubType.unit}</span>
                </div>
                {filteredStats.maxPoint && (
                  <span className="text-[9px] text-stone-400 font-mono block mt-1 truncate">
                    {filteredStats.maxPoint.date}
                  </span>
                )}
              </div>

              {/* In Target % */}
              <div className="bg-white dark:bg-[#1a1d24] p-3 rounded-2xl border border-stone-300 dark:border-stone-800 shadow-xs">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">
                  % Nel Target
                </span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {filteredStats.inTargetPct !== null ? `${filteredStats.inTargetPct}%` : '—'}
                  </span>
                </div>
                <span className="text-[9px] text-stone-400 font-mono block mt-1">
                  {filteredStats.inTargetCount}/{filteredStats.count} letture
                </span>
              </div>

              {/* Deviazione Standard (Stabilità) */}
              <div className="bg-white dark:bg-[#1a1d24] p-3 rounded-2xl border border-stone-300 dark:border-stone-800 shadow-xs">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">
                  Dev. Standard
                </span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-stone-700 dark:text-stone-300">
                    {filteredStats.stdDev !== null ? `±${filteredStats.stdDev}` : '—'}
                  </span>
                </div>
                <span className="text-[9px] text-stone-400 block mt-1">
                  Variabilità
                </span>
              </div>

              {/* Totale Misurazioni */}
              <div className="bg-white dark:bg-[#1a1d24] p-3 rounded-2xl border border-stone-300 dark:border-stone-800 shadow-xs">
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">
                  Totale Letture
                </span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-xl font-black font-mono text-stone-900 dark:text-stone-100">
                    {filteredStats.count}
                  </span>
                  <span className="text-[10px] text-stone-400">dati</span>
                </div>
                <span className="text-[9px] text-[#1d8998] font-bold block mt-1">
                  {timeRange === 'ALL' ? 'Tutto lo storico' : `${timeRange} giorni`}
                </span>
              </div>

            </div>

            {/* Main Interactive Recharts Line Graph Card */}
            <div className="bg-white dark:bg-[#1a1d24] p-4 sm:p-5 border border-stone-300 dark:border-stone-800 rounded-2xl shadow-xs space-y-3">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-[#2ca3b5] text-white rounded-lg">
                    <LineChartIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base">
                      Grafico a Linee: Andamento {activeSubType.name}
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                      {intervalLabel} • {graphData.length} registrazioni cronologiche
                    </p>
                  </div>
                </div>

                {/* Target Range Legend for Glucose */}
                {isGlucose && (
                  <div className="flex items-center space-x-3 text-[11px] font-semibold">
                    <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500 inline-block" />
                      <span>Target ({targetMin} - {targetMax} mg/dL)</span>
                    </div>
                    <div className="flex items-center space-x-1 text-amber-600 dark:text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      <span>Alto</span>
                    </div>
                    <div className="flex items-center space-x-1 text-sky-600 dark:text-sky-400">
                      <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                      <span>Basso</span>
                    </div>
                  </div>
                )}
              </div>

              {graphData.length === 0 ? (
                <div className="h-72 flex flex-col items-center justify-center text-stone-400 text-xs italic space-y-2">
                  <Info className="w-8 h-8 text-stone-300 dark:text-stone-600" />
                  <p>Nessun dato registrato per {activeSubType.name} nell'intervallo selezionato.</p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3 py-1.5 bg-[#2ca3b5] text-white font-bold rounded-lg not-italic text-xs shadow-xs"
                  >
                    Reimposta Filtri
                  </button>
                </div>
              ) : (
                <div className="h-72 sm:h-80 w-full select-none pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={aggregationMode === 'daily' ? dailyAggregatedData : chartDataWithMA}
                      margin={{ top: 10, right: 15, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-stone-800" />
                      
                      <XAxis
                        dataKey={aggregationMode === 'daily' ? 'date' : 'displayDate'}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        interval="preserveStartEnd"
                        minTickGap={25}
                      />
                      
                      <YAxis
                        domain={yAxisDomain}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        unit={` ${activeSubType.unit}`}
                      />

                      {/* Green Target Reference Area for Glucose */}
                      {isGlucose && (
                        <ReferenceArea
                          {...({
                            y1: targetMin,
                            y2: targetMax,
                            fill: "#10b981",
                            fillOpacity: 0.12,
                            stroke: "#10b981",
                            strokeOpacity: 0.4,
                            strokeDasharray: "3 3"
                          } as any)}
                        />
                      )}

                      {isGlucose && (
                        <>
                          <ReferenceLine y={targetMin} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
                          <ReferenceLine y={targetMax} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
                        </>
                      )}

                      <RechartsTooltip content={<CustomChartTooltip />} />

                      {/* Blood Pressure Lines: Systolic + Diastolic */}
                      {isBP ? (
                        <>
                          <Line
                            type="monotone"
                            dataKey={aggregationMode === 'daily' ? 'avgSystolic' : 'systolic'}
                            name="Sistolica (Max)"
                            stroke="#ef4444"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#ef4444' }}
                            activeDot={{ r: 6 }}
                          />
                          <Line
                            type="monotone"
                            dataKey={aggregationMode === 'daily' ? 'avgDiastolic' : 'diastolic'}
                            name="Diastolica (Min)"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#3b82f6' }}
                            activeDot={{ r: 6 }}
                          />
                        </>
                      ) : aggregationMode === 'daily' ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="avgValue"
                            stroke="#2ca3b5"
                            strokeWidth={2.5}
                            fill="#2ca3b5"
                            fillOpacity={0.15}
                          />
                          <Line
                            type="monotone"
                            dataKey="avgValue"
                            name={`Media ${activeSubType.name}`}
                            stroke="#1d8998"
                            strokeWidth={3}
                            dot={{ r: 5, fill: '#1d8998' }}
                            activeDot={{ r: 7 }}
                          />
                        </>
                      ) : (
                        <>
                          {/* Shaded Area under Curve */}
                          <Area
                            type="monotone"
                            dataKey="valore"
                            stroke="#2ca3b5"
                            strokeWidth={2}
                            fill="#2ca3b5"
                            fillOpacity={0.12}
                          />
                          
                          {/* Moving average trend line */}
                          {showMovingAverage && graphData.length > 3 && (
                            <Line
                              type="monotone"
                              dataKey="movingAvg"
                              name="Media Mobile (3pt)"
                              stroke="#6366f1"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                          )}

                          {/* Primary chronological reading line */}
                          <Line
                            type="monotone"
                            dataKey="valore"
                            name={activeSubType.name}
                            stroke="#2ca3b5"
                            strokeWidth={2.5}
                            dot={<CustomDot />}
                            activeDot={{ r: 7, stroke: '#1d8998', strokeWidth: 2 }}
                          />
                        </>
                      )}

                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart footer hint */}
              <div className="flex items-center justify-between text-[11px] text-stone-400 pt-2 border-t border-stone-100 dark:border-stone-800">
                <span>💡 Tocca un punto nel grafico per visualizzare i dettagli completi o modificarlo.</span>
                {graphData.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowMovingAverage(!showMovingAverage)}
                    className="text-[#1d8998] dark:text-[#38bdf8] font-bold hover:underline"
                  >
                    {showMovingAverage ? 'Nascondi Media Mobile' : 'Mostra Media Mobile'}
                  </button>
                )}
              </div>

            </div>

            {/* Chronological List of Readings in Selected Range */}
            <div className="bg-white dark:bg-[#1a1d24] p-4 rounded-2xl border border-stone-300 dark:border-stone-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                <h5 className="font-bold text-stone-900 dark:text-stone-100 text-sm flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#2ca3b5]" />
                  <span>Dettaglio Cronologico delle Letture ({graphData.length})</span>
                </h5>
                <span className="text-[11px] text-stone-500 font-mono">
                  {intervalLabel}
                </span>
              </div>

              {graphData.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-2">Nessuna lettura nel periodo.</p>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800/80 max-h-72 overflow-y-auto pr-1">
                  {graphData.slice().reverse().map((d) => {
                    const isOk = isGlucose ? d.inTarget : true;
                    return (
                      <div
                        key={d.id}
                        onClick={() => d.rawEntry && onEditEntry && onEditEntry(d.rawEntry)}
                        className="py-2 px-2 flex items-center justify-between hover:bg-teal-50/50 dark:hover:bg-teal-950/30 rounded-xl transition-colors cursor-pointer text-xs"
                      >
                        <div className="flex items-center space-x-2.5">
                          {d.mealTiming === 'pre' && <WholeAppleIcon size={16} />}
                          {d.mealTiming === 'post' && <AppleCoreIcon size={16} />}
                          
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-stone-800 dark:text-stone-200 font-mono">
                                {d.date} {d.time}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] font-semibold">
                                {d.categoria}
                              </span>
                            </div>
                            {d.note && (
                              <p className="text-[11px] text-stone-500 italic mt-0.5 truncate max-w-xs">
                                {d.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2.5">
                          {isBP ? (
                            <span className="font-bold font-mono text-sm text-stone-900 dark:text-stone-100">
                              {d.systolic && d.diastolic ? `${d.systolic}/${d.diastolic}` : d.valore} <span className="text-[10px] font-normal text-stone-400">{activeSubType.unit}</span>
                            </span>
                          ) : (
                            <span className={`font-black font-mono text-sm ${
                              isGlucose
                                ? (isOk ? 'text-emerald-600 dark:text-emerald-400' : d.isHigh ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400')
                                : 'text-[#1d8998] dark:text-[#38bdf8]'
                            }`}>
                              {d.valore} <span className="text-[10px] font-normal text-stone-400">{activeSubType.unit}</span>
                            </span>
                          )}

                          <ChevronRight className="w-4 h-4 text-stone-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW 2: TREND ANALYSIS VIEW (Percentage Variation by Category) */}
        {viewMode === 'trend' && (
          <div className="space-y-3">
            
            {/* Main Trend Summary Card */}
            <div className="bg-white dark:bg-[#1a1d24] p-4 border border-stone-300 dark:border-stone-800 rounded-2xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-200 dark:border-stone-800 pb-2.5">
                <div>
                  <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Variazione Globale {activeSubType.name}</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Confronto: Ultimi {trendAnalysis.periodLabel} vs Periodo Precedente
                  </p>
                </div>

                <div>
                  {renderTrendBadge(trendAnalysis.overallPctChange, trendAnalysis.overallAbsChange, activeSubType.unit)}
                </div>
              </div>

              {/* 3 Metric Comparison Blocks */}
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                
                {/* Media Periodo Attuale */}
                <div className="bg-stone-50 dark:bg-stone-800/80 p-2.5 rounded-lg border border-stone-200 dark:border-stone-700">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-semibold">
                    Media Attuale
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-[#1d8998] dark:text-[#38bdf8] block tracking-tight">
                    {trendAnalysis.currentAvg !== null ? `${trendAnalysis.currentAvg.toFixed(1)}` : '—'}
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {trendAnalysis.currentCount} letture
                  </span>
                </div>

                {/* Media Periodo Precedente */}
                <div className="bg-stone-50 dark:bg-stone-800/80 p-2.5 rounded-lg border border-stone-200 dark:border-stone-700">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-semibold">
                    Media Precedente
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-stone-700 dark:text-stone-300 block tracking-tight">
                    {trendAnalysis.prevAvg !== null ? `${trendAnalysis.prevAvg.toFixed(1)}` : '—'}
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {trendAnalysis.previousCount} letture
                  </span>
                </div>

                {/* Variazione % */}
                <div className="bg-stone-50 dark:bg-stone-800/80 p-2.5 rounded-lg border border-stone-200 dark:border-stone-700">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-semibold">
                    Variazione %
                  </span>
                  <span className={`text-lg sm:text-xl font-bold block tracking-tight ${
                    trendAnalysis.overallPctChange === null ? 'text-stone-400' :
                    trendAnalysis.overallPctChange > 1 ? 'text-amber-600 dark:text-amber-400' :
                    trendAnalysis.overallPctChange < -1 ? 'text-emerald-600 dark:text-emerald-400' :
                    'text-slate-600 dark:text-slate-400'
                  }`}>
                    {trendAnalysis.overallPctChange !== null ? (
                      `${trendAnalysis.overallPctChange >= 0 ? '+' : ''}${trendAnalysis.overallPctChange.toFixed(1)}%`
                    ) : '—'}
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {trendAnalysis.overallAbsChange !== null ? `${trendAnalysis.overallAbsChange >= 0 ? '+' : ''}${trendAnalysis.overallAbsChange.toFixed(1)} ${activeSubType.unit}` : 'N/D'}
                  </span>
                </div>

              </div>
            </div>

            {/* Per-Category Trend Cards */}
            <div className="bg-white dark:bg-[#1a1d24] p-4 border border-stone-300 dark:border-stone-800 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-[#2ca3b5]" />
                  <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                    Trend % per Categoria di Rilevazione
                  </h4>
                </div>
                <span className="text-xs text-stone-500 font-mono">
                  {trendAnalysis.categoryTrends.length} Categorie
                </span>
              </div>

              {trendAnalysis.categoryTrends.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-400 italic">
                  Nessuna rilevazione categorizzata per {activeSubType.name}.
                </div>
              ) : (
                <div className="divide-y divide-stone-200 dark:divide-stone-800">
                  {trendAnalysis.categoryTrends.map((catTrend) => {
                    const hasCur = catTrend.currentAvg !== null;
                    const hasPrev = catTrend.previousAvg !== null;

                    return (
                      <div key={catTrend.categoryName} className="py-3 first:pt-1 last:pb-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 font-bold text-xs">
                              {catTrend.categoryName}
                            </span>
                            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                              ({catTrend.currentCount} letture attuali)
                            </span>
                          </div>

                          <div>
                            {renderTrendBadge(catTrend.pctChange, catTrend.absChange, activeSubType.unit)}
                          </div>
                        </div>

                        {/* Comparative Row & Visual Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-stone-50 dark:bg-stone-800/50 p-2 rounded-lg">
                          <div>
                            <span className="text-[10px] text-stone-400 block">Attuale</span>
                            <span className="font-bold text-stone-800 dark:text-stone-200 font-mono">
                              {hasCur ? `${catTrend.currentAvg?.toFixed(1)} ${activeSubType.unit}` : 'Nessun dato'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-stone-400 block">Precedente</span>
                            <span className="font-semibold text-stone-600 dark:text-stone-400 font-mono">
                              {hasPrev ? `${catTrend.previousAvg?.toFixed(1)} ${activeSubType.unit}` : 'Nessun dato'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-stone-400 block">Min / Max</span>
                            <span className="font-semibold text-stone-700 dark:text-stone-300 font-mono text-[11px]">
                              {catTrend.min !== null ? `${catTrend.min} - ${catTrend.max}` : '—'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-stone-400 block">Differenza Assoluta</span>
                            <span className="font-bold text-stone-800 dark:text-stone-200 font-mono text-[11px]">
                              {catTrend.absChange !== null ? (
                                `${catTrend.absChange >= 0 ? '+' : ''}${catTrend.absChange.toFixed(1)} ${activeSubType.unit}`
                              ) : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Multi-Parameter Comparative Summary */}
            <div className="bg-white dark:bg-[#1a1d24] p-4 border border-stone-300 dark:border-stone-800 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Panoramica Variazione Tutti i Parametri</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trendAnalysis.otherSubTypesSummary.map(({ subType, currentAvg, previousAvg, pctChange, count }) => (
                  <div
                    key={subType.id}
                    onClick={() => setSelectedSubTypeId(subType.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                      subType.id === selectedSubTypeId
                        ? 'bg-teal-50/80 dark:bg-teal-950/40 border-teal-400 dark:border-teal-700 shadow-2xs'
                        : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700 hover:border-teal-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                        {subType.name}
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono">
                        Media: {currentAvg !== null ? `${currentAvg.toFixed(1)} ${subType.unit}` : 'N/D'} ({count} letture)
                      </span>
                    </div>

                    <div>
                      {pctChange !== null ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center space-x-0.5 ${
                          pctChange > 1 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          pctChange < -1 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                        }`}>
                          {pctChange > 1 ? <ArrowUpRight className="w-3 h-3" /> : pctChange < -1 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          <span>{pctChange >= 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-400 italic">Dati prec. N/D</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: MEAL SLOTS GROUPING VIEW */}
        {viewMode === 'meals' && (
          <div className="space-y-4">
            
            {/* Header info & Filter Bar */}
            <div className="bg-white dark:bg-[#1a1d24] p-4 border border-stone-300 dark:border-stone-800 rounded-2xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
                <div>
                  <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Andamento per Fascia Pasto: {activeSubType.name}
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Raggruppamento delle letture basato sulle 5 fasce orarie definite nel Diario Classico.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 px-2.5 py-1 rounded-lg font-bold">
                    {totalMealReadings} letture totali
                  </span>
                </div>
              </div>

              {/* Slot Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedMealSlotFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                    selectedMealSlotFilter === 'ALL'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-stone-300'
                  }`}
                >
                  Tutte le Fasce ({totalMealReadings})
                </button>
                {mealSlotsAnalysis.map((ma, idx) => {
                  const isSelected = selectedMealSlotFilter === ma.slot.id;
                  const color = ma.slot.color || ['#1e293b', '#0284c7', '#0f766e', '#4338ca', '#312e81'][idx % 5];
                  const emoji = ma.slot.id === 'night' || ma.slot.name.toLowerCase().includes('notte') ? '🌙' :
                                ma.slot.id === 'bf' || ma.slot.name.toLowerCase().includes('colaz') ? '🌅' :
                                ma.slot.id === 'lunch' || ma.slot.name.toLowerCase().includes('pranz') ? '☀️' :
                                ma.slot.id === 'dinner' || ma.slot.name.toLowerCase().includes('cena') ? '🍽️' : '🛏️';
                  return (
                    <button
                      key={ma.slot.id}
                      type="button"
                      onClick={() => setSelectedMealSlotFilter(isSelected ? 'ALL' : ma.slot.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-2xs'
                          : 'bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span>{emoji} {ma.slot.name}</span>
                      <span className="text-[10px] font-mono opacity-80">({ma.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comparative Visual Bar & Whisker Chart (5 Slots Comparison) */}
            <div className="bg-white dark:bg-[#1a1d24] p-4 border border-stone-300 dark:border-stone-800 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-teal-600" />
                  Confronto Medie e Range per Fascia ({activeSubType.unit})
                </span>
                <div className="flex items-center gap-2 text-[10px] text-stone-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-emerald-500/40 inline-block" />
                    Target ({targetMin}-{targetMax})
                  </span>
                </div>
              </div>

              {totalMealReadings === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-stone-400 text-xs italic space-y-2">
                  <Info className="w-5 h-5 text-stone-300 dark:text-stone-600" />
                  <p>Nessun dato registrato nell'intervallo selezionato.</p>
                </div>
              ) : (
                <div className="relative h-56 w-full pt-1 select-none">
                  {(() => {
                    const allVals = mealSlotsAnalysis.flatMap(m => m.values);
                    const minChart = allVals.length > 0 ? Math.max(0, Math.floor(Math.min(...allVals, targetMin) * 0.85)) : 50;
                    const maxChart = allVals.length > 0 ? Math.ceil(Math.max(...allVals, targetMax) * 1.15) : 250;
                    const range = maxChart - minChart || 1;

                    const getY = (val: number) => {
                      const ratio = (val - minChart) / range;
                      return 160 - ratio * 130;
                    };

                    const targetTopY = getY(targetMax);
                    const targetBottomY = getY(targetMin);
                    const targetHeight = Math.max(2, targetBottomY - targetTopY);

                    return (
                      <svg className="w-full h-full" viewBox="0 0 500 190">
                        {/* Target Range Band */}
                        <rect
                          x="35"
                          y={targetTopY}
                          width="455"
                          height={targetHeight}
                          className="fill-emerald-500/10 dark:fill-emerald-400/10"
                        />
                        <line
                          x1="35"
                          y1={targetTopY}
                          x2="490"
                          y2={targetTopY}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          strokeWidth="1"
                          opacity="0.6"
                        />
                        <line
                          x1="35"
                          y1={targetBottomY}
                          x2="490"
                          y2={targetBottomY}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          strokeWidth="1"
                          opacity="0.6"
                        />
                        <text x="30" y={targetTopY + 3} textAnchor="end" fontSize="8" fill="#10b981" fontWeight="bold">
                          {targetMax}
                        </text>
                        <text x="30" y={targetBottomY + 3} textAnchor="end" fontSize="8" fill="#10b981" fontWeight="bold">
                          {targetMin}
                        </text>

                        {/* Y axis ticks */}
                        {[minChart, Math.round(minChart + range * 0.5), maxChart].map((val, idx) => (
                          <g key={idx}>
                            <line x1="35" y1={getY(val)} x2="490" y2={getY(val)} stroke="currentColor" className="text-stone-200 dark:text-stone-800" strokeWidth="0.5" />
                            <text x="30" y={getY(val) + 3} textAnchor="end" fontSize="8" className="fill-stone-400">
                              {val}
                            </text>
                          </g>
                        ))}

                        {/* 5 Slots Columns */}
                        {mealSlotsAnalysis.map((ma, idx) => {
                          const colW = 75;
                          const colX = 50 + idx * 88;
                          const color = ma.slot.color || ['#1e293b', '#0284c7', '#0f766e', '#4338ca', '#312e81'][idx % 5];
                          const emoji = ma.slot.id === 'night' || ma.slot.name.toLowerCase().includes('notte') ? '🌙' :
                                        ma.slot.id === 'bf' || ma.slot.name.toLowerCase().includes('colaz') ? '🌅' :
                                        ma.slot.id === 'lunch' || ma.slot.name.toLowerCase().includes('pranz') ? '☀️' :
                                        ma.slot.id === 'dinner' || ma.slot.name.toLowerCase().includes('cena') ? '🍽️' : '🛏️';

                          if (ma.count === 0 || ma.avg === null) {
                            return (
                              <g key={ma.slot.id} className="opacity-40">
                                <text x={colX + colW / 2} y="100" textAnchor="middle" fontSize="10" fill="currentColor" className="fill-stone-400">
                                  Nessun dato
                                </text>
                                <text x={colX + colW / 2} y="175" textAnchor="middle" fontSize="9" fontWeight="bold" className="fill-stone-500">
                                  {emoji} {ma.slot.name}
                                </text>
                              </g>
                            );
                          }

                          const avgY = getY(ma.avg);
                          const minY = getY(ma.min || ma.avg);
                          const maxY = getY(ma.max || ma.avg);
                          const barBottom = 160;
                          const barH = Math.max(4, barBottom - avgY);
                          const isHighlighted = selectedMealSlotFilter === 'ALL' || selectedMealSlotFilter === ma.slot.id;

                          return (
                            <g
                              key={ma.slot.id}
                              className={`cursor-pointer transition-opacity ${isHighlighted ? 'opacity-100' : 'opacity-30'}`}
                              onClick={() => setSelectedMealSlotFilter(selectedMealSlotFilter === ma.slot.id ? 'ALL' : ma.slot.id)}
                            >
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
                              {/* Min cap */}
                              <line
                                x1={colX + colW / 2 - 8}
                                y1={minY}
                                x2={colX + colW / 2 + 8}
                                y2={minY}
                                stroke={color}
                                strokeWidth="2"
                              />
                              {/* Max cap */}
                              <line
                                x1={colX + colW / 2 - 8}
                                y1={maxY}
                                x2={colX + colW / 2 + 8}
                                y2={maxY}
                                stroke={color}
                                strokeWidth="2"
                              />

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
                                fill="currentColor"
                                className="fill-white dark:fill-stone-900 stroke-stone-300 dark:stroke-stone-700"
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
                                y="174"
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="bold"
                                className="fill-stone-800 dark:fill-stone-200"
                              >
                                {emoji} {ma.slot.name}
                              </text>
                              <text
                                x={colX + colW / 2}
                                y="185"
                                textAnchor="middle"
                                fontSize="8"
                                className="fill-stone-400 font-mono"
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
              )}
            </div>

            {/* Detailed Cards for Each Meal Slot */}
            <div className="space-y-3">
              {displayedMealSlotsAnalysis.map((ma, idx) => {
                const color = ma.slot.color || ['#1e293b', '#0284c7', '#0f766e', '#4338ca', '#312e81'][idx % 5];
                const emoji = ma.slot.id === 'night' || ma.slot.name.toLowerCase().includes('notte') ? '🌙' :
                              ma.slot.id === 'bf' || ma.slot.name.toLowerCase().includes('colaz') ? '🌅' :
                              ma.slot.id === 'lunch' || ma.slot.name.toLowerCase().includes('pranz') ? '☀️' :
                              ma.slot.id === 'dinner' || ma.slot.name.toLowerCase().includes('cena') ? '🍽️' : '🛏️';
                const isExpanded = expandedSlotDetails === ma.slot.id;

                const isOk = ma.avg !== null && ma.avg >= targetMin && ma.avg <= targetMax;
                const isHigh = ma.avg !== null && ma.avg > targetMax;
                const isLow = ma.avg !== null && ma.avg < targetMin;

                return (
                  <div
                    key={ma.slot.id}
                    className="bg-white dark:bg-[#1a1d24] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Card Header Bar */}
                    <div className="p-4 border-b border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50 dark:bg-stone-900/30">
                      <div className="flex items-center gap-2.5">
                        <span className="w-4 h-4 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: color }} />
                        <div>
                          <h5 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                            <span>{emoji} {ma.slot.name}</span>
                            <span className="text-xs font-mono font-normal text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded">
                              {ma.slot.startTime} - {ma.slot.endTime}
                            </span>
                          </h5>
                        </div>
                      </div>

                      {/* Main Average Box */}
                      <div className="flex items-center gap-3">
                        {ma.avg !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xl sm:text-2xl font-black font-mono text-stone-900 dark:text-stone-100">
                              {ma.avg} <span className="text-xs font-normal text-stone-400">{activeSubType.unit}</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                              isOk ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' :
                              isHigh ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800' :
                              'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                            }`}>
                              {isOk ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              <span>{isOk ? 'Nel Target' : isHigh ? 'Sopra Target' : 'Sotto Target'}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400 italic">Nessun dato registrato</span>
                        )}
                      </div>
                    </div>

                    {/* Card Body Metrics */}
                    {ma.count > 0 && (
                      <div className="p-4 space-y-4">
                        {/* 4 Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-lg border border-stone-100 dark:border-stone-800">
                            <span className="text-[10px] text-stone-400 block font-medium">Range Min - Max</span>
                            <span className="font-bold font-mono text-stone-800 dark:text-stone-200">
                              {ma.min} - {ma.max} {activeSubType.unit}
                            </span>
                          </div>
                          <div className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-lg border border-stone-100 dark:border-stone-800">
                            <span className="text-[10px] text-stone-400 block font-medium">Stabilità (Dev. Std)</span>
                            <span className="font-bold font-mono text-stone-800 dark:text-stone-200">
                              ±{ma.stdDev} {activeSubType.unit}
                            </span>
                          </div>
                          <div className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-lg border border-stone-100 dark:border-stone-800">
                            <span className="text-[10px] text-stone-400 block font-medium">In Target ({targetMin}-{targetMax})</span>
                            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              {ma.inTargetPct}% ({ma.inTargetCount}/{ma.count})
                            </span>
                          </div>
                          <div className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-lg border border-stone-100 dark:border-stone-800">
                            <span className="text-[10px] text-stone-400 block font-medium">Letture nel periodo</span>
                            <span className="font-bold font-mono text-stone-800 dark:text-stone-200">
                              {ma.count} misurazioni
                            </span>
                          </div>
                        </div>

                        {/* Visual Target Breakdown Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-medium text-stone-500 dark:text-stone-400">
                            <span>Distribuzione Glicemica</span>
                            <span>{ma.inTargetPct}% Target • {ma.aboveTargetPct}% Alto • {ma.belowTargetPct}% Basso</span>
                          </div>
                          <div className="h-2.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden flex">
                            {ma.belowTargetCount > 0 && (
                              <div
                                style={{ width: `${ma.belowTargetPct}%` }}
                                className="bg-sky-500 h-full"
                                title={`Sotto Target: ${ma.belowTargetCount} (${ma.belowTargetPct}%)`}
                              />
                            )}
                            {ma.inTargetCount > 0 && (
                              <div
                                style={{ width: `${ma.inTargetPct}%` }}
                                className="bg-emerald-500 h-full"
                                title={`Nel Target: ${ma.inTargetCount} (${ma.inTargetPct}%)`}
                              />
                            )}
                            {ma.aboveTargetCount > 0 && (
                              <div
                                style={{ width: `${ma.aboveTargetPct}%` }}
                                className="bg-amber-500 h-full"
                                title={`Sopra Target: ${ma.aboveTargetCount} (${ma.aboveTargetPct}%)`}
                              />
                            )}
                          </div>
                        </div>

                        {/* Pre-pasto vs Post-pasto Comparison */}
                        {(ma.preCount > 0 || ma.postCount > 0) && (
                          <div className="p-3 bg-stone-50/80 dark:bg-stone-900/60 rounded-xl border border-stone-200/80 dark:border-stone-800 space-y-2">
                            <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                              <Utensils className="w-3.5 h-3.5 text-teal-600" />
                              Confronto Pre vs Post Pasto ({ma.slot.name})
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              <div className="flex items-center gap-2 p-2 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700">
                                <WholeAppleIcon size={20} />
                                <div>
                                  <span className="text-[10px] text-stone-400 block">Pre Pasto</span>
                                  <span className="font-bold font-mono text-stone-900 dark:text-stone-100">
                                    {ma.preAvg !== null ? `${ma.preAvg} ${activeSubType.unit}` : 'N/D'}
                                  </span>
                                  <span className="text-[9px] text-stone-400 block font-mono">({ma.preCount} letture)</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 p-2 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700">
                                <AppleCoreIcon size={20} />
                                <div>
                                  <span className="text-[10px] text-stone-400 block">Post Pasto</span>
                                  <span className="font-bold font-mono text-stone-900 dark:text-stone-100">
                                    {ma.postAvg !== null ? `${ma.postAvg} ${activeSubType.unit}` : 'N/D'}
                                  </span>
                                  <span className="text-[9px] text-stone-400 block font-mono">({ma.postCount} letture)</span>
                                </div>
                              </div>

                              {ma.preAvg !== null && ma.postAvg !== null && (
                                <div className="col-span-2 sm:col-span-1 flex flex-col justify-center p-2 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700">
                                  <span className="text-[10px] text-stone-400 block">Delta Incremento</span>
                                  <span className={`font-bold font-mono ${
                                    ma.postAvg - ma.preAvg > 50 ? 'text-amber-600' : 'text-emerald-600'
                                  }`}>
                                    {ma.postAvg - ma.preAvg >= 0 ? `+${ma.postAvg - ma.preAvg}` : `${ma.postAvg - ma.preAvg}`} {activeSubType.unit}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Toggle to view individual entries */}
                        <div className="pt-1 border-t border-stone-100 dark:border-stone-800">
                          <button
                            type="button"
                            onClick={() => setExpandedSlotDetails(isExpanded ? null : ma.slot.id)}
                            className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Nascondi letture' : `Mostra ${ma.entries.length} letture in questa fascia`}</span>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {ma.entries.map((entry) => {
                                const v = parseVal(entry.value);
                                const isEntryOk = v >= targetMin && v <= targetMax;
                                return (
                                  <div
                                    key={entry.id}
                                    onClick={() => onEditEntry && onEditEntry(entry)}
                                    className="flex items-center justify-between p-2 rounded-lg bg-stone-50 dark:bg-stone-900 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-stone-200 dark:border-stone-800 text-xs cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      {entry.mealTiming === 'pre' && <WholeAppleIcon size={14} />}
                                      {entry.mealTiming === 'post' && <AppleCoreIcon size={14} />}
                                      <span className="font-mono text-stone-500 dark:text-stone-400">{entry.date} {entry.time}</span>
                                      {entry.eventNoteIcon && <EventNoteIcon id={entry.eventNoteIcon} size="sm" />}
                                      {entry.note && (
                                        <span className="text-stone-400 text-[10px] truncate max-w-[120px]">
                                          ({entry.note})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-mono font-bold ${
                                        isEntryOk ? 'text-emerald-600 dark:text-emerald-400' :
                                        v > targetMax ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'
                                      }`}>
                                        {entry.value} {entry.unit}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
