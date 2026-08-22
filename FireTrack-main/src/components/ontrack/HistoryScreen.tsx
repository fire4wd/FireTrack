import React, { useState, useMemo } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { EventNoteIcon } from './EventNoteIcon';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { LogEntryItem } from '../../types/ontrack';
import { exportElementToPdf } from '../../utils/pdfExport';
import { downloadCSV, loadUserSettings } from '../../utils/ontrackStorage';
import {
  Trash2,
  Search,
  Filter,
  Pencil,
  Calendar,
  RotateCcw,
  Heart,
  Activity,
  CalendarRange,
  FileText,
  Download,
  Loader2,
  Check
} from 'lucide-react';

interface HistoryScreenProps {
  entries: LogEntryItem[];
  onDeleteEntry: (id: string) => void;
  onEditEntry?: (entry: LogEntryItem) => void;
  onClearAll: () => void;
  onBack: () => void;
  onOpenTools: () => void;
  onNavigate?: (screen: string) => void;
}

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

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  entries,
  onDeleteEntry,
  onEditEntry,
  onClearAll,
  onBack,
  onOpenTools,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubType, setFilterSubType] = useState('ALL');
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

  // Available sub-types from entries
  const subTypeOptions = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.subTypeName).filter(Boolean)));
  }, [entries]);

  // Extract only years present in DB entries with counts
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

  // Extract only months present for the currently selected year with counts
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

  // Handle year change: auto-reset month if selected month is not in new year's months
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
    setSearchQuery('');
    setFilterSubType('ALL');
    setSelectedPeriod('all');
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
  };

  const now = new Date();
  const periodCutoff = typeof selectedPeriod === 'number'
    ? now.getTime() - selectedPeriod * 24 * 60 * 60 * 1000
    : 0;

  // Period label computation
  let periodRangeLabel = selectedPeriod === 'all' ? 'Tutto lo storico' : `Ultimi ${selectedPeriod} giorni`;
  if (selectedYear !== 'ALL') {
    if (selectedMonth !== 'ALL') {
      periodRangeLabel = `${MONTH_NAMES[selectedMonth] || selectedMonth} ${selectedYear}`;
    } else {
      periodRangeLabel = `Anno ${selectedYear}`;
    }
  }

  const hasActiveFilters = searchQuery !== '' || filterSubType !== 'ALL' || selectedYear !== 'ALL' || selectedMonth !== 'ALL' || selectedPeriod !== 'all';

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const ym = getYearMonth(e.date);

      // Search Query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query ||
        (e.subTypeName && e.subTypeName.toLowerCase().includes(query)) ||
        (e.categoryName && e.categoryName.toLowerCase().includes(query)) ||
        (e.note && e.note.toLowerCase().includes(query)) ||
        (e.value && e.value.toLowerCase().includes(query)) ||
        (e.pulse && e.pulse.toLowerCase().includes(query)) ||
        (e.systolic && e.systolic.includes(query)) ||
        (e.diastolic && e.diastolic.includes(query)) ||
        (e.date && e.date.includes(query));

      // SubType Filter
      const matchesFilter = filterSubType === 'ALL' || e.subTypeName === filterSubType;

      // Year & Month Filter
      if (selectedYear !== 'ALL') {
        if (ym.year !== selectedYear) return false;
        if (selectedMonth !== 'ALL' && ym.month !== selectedMonth) return false;
      } else if (selectedPeriod !== 'all') {
        // Quick Period Filter
        if (e.timestamp && e.timestamp < periodCutoff) return false;
      }

      return matchesSearch && matchesFilter;
    });
  }, [entries, searchQuery, filterSubType, selectedYear, selectedMonth, selectedPeriod, periodCutoff]);

  // Export to PDF
  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);
    const cleanName = (patientName || 'Angelo F').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const tagPeriod = selectedYear !== 'ALL'
      ? (selectedMonth !== 'ALL' ? `${selectedYear}_${selectedMonth}` : `${selectedYear}`)
      : (selectedPeriod === 'all' ? 'Tutto' : `${selectedPeriod}gg`);

    const fileName = `Storico_Misurazioni_${tagPeriod}_${cleanName}_${dateStr}.pdf`;

    try {
      await exportElementToPdf('printable-history-area', fileName);
      notifyExport('✅ Storico esportato in PDF con successo!');
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

  // Export to CSV
  const handleExportCSV = () => {
    const cleanName = (patientName || 'Angelo F').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const tagPeriod = selectedYear !== 'ALL'
      ? (selectedMonth !== 'ALL' ? `${selectedYear}_${selectedMonth}` : `${selectedYear}`)
      : (selectedPeriod === 'all' ? 'Tutto' : `${selectedPeriod}gg`);

    downloadCSV(filteredEntries, `Storico_Misurazioni_${tagPeriod}_${cleanName}`);
    notifyExport('✅ Storico esportato in CSV con successo!');
  };

  return (
    <div className="flex flex-col min-h-full bg-[#e8ecee] dark:bg-[#121418] text-stone-900 dark:text-stone-100 transition-colors">

      {/* Header */}
      <OnTrackHeader
        title="Cronologia Storico"
        showBack={true}
        onBack={onBack}
        showToolsMenu={true}
        onOpenTools={onOpenTools}
        onNavigate={onNavigate}
      />

      {/* Export Notification Toast */}
      {exportNotification && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1d8998] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-300" />
          <span>{exportNotification}</span>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 p-3 sm:p-6 max-w-3xl mx-auto w-full space-y-3 pb-12">

        {/* Search & Advanced Filters Bar */}
        <div className="bg-white dark:bg-[#1a1d24] p-3.5 border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl space-y-3 shadow-xs">

          {/* Row 1: Search & SubType Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            {/* Search input */}
            <div className="sm:col-span-7 relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cerca per valore, categoria, note, battiti o data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 dark:bg-stone-800/90 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#1d8998] dark:focus:border-[#38bdf8]"
              />
            </div>

            {/* SubType Dropdown */}
            <div className="sm:col-span-5 flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-[#1d8998] dark:text-[#38bdf8] shrink-0" />
              <select
                value={filterSubType}
                onChange={(e) => setFilterSubType(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800/90 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-[#1d8998] cursor-pointer font-medium"
              >
                <option value="ALL">Tutti i tipi ({entries.length})</option>
                {subTypeOptions.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Pulsantiera Filtri Temporali (7, 14, 30, 60, 90, Tutto) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800/60">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5 text-stone-700 dark:text-stone-300 font-semibold text-xs">
                <CalendarRange className="w-3.5 h-3.5 text-[#1d8998] dark:text-[#38bdf8]" />
                <span>Periodo Rapido:</span>
              </div>

              <div className="inline-flex flex-wrap rounded-xl border border-stone-300 dark:border-stone-700 p-0.5 bg-stone-100 dark:bg-stone-800 shadow-2xs">
                {([7, 14, 30, 60, 90, 'all'] as const).map(p => {
                  const isSelected = selectedYear === 'ALL' && selectedPeriod === p;
                  const label = p === 'all' ? 'Tutto' : `${p} gg`;

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
                          ? 'bg-[#1d8998] dark:bg-[#38bdf8] text-white dark:text-stone-900 shadow-xs'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick reset if any filter */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center space-x-1 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer ml-auto"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Azzera filtri</span>
              </button>
            )}
          </div>

          {/* Row 3: Anno & Mese a DB + Export Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100 dark:border-stone-800/60 text-xs">

            {/* Year & Month selectors */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Anno */}
              <div className="flex items-center space-x-1.5">
                <span className="text-stone-500 dark:text-stone-400 text-[11px] font-bold">Anno:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="bg-stone-50 dark:bg-stone-800/90 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 font-semibold cursor-pointer shadow-2xs"
                >
                  <option value="ALL">Tutti gli anni ({entries.length})</option>
                  {availableYearsWithCount.map(({ year, count }) => (
                    <option key={year} value={year}>
                      {year} ({count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mese */}
              <div className="flex items-center space-x-1.5">
                <span className="text-stone-500 dark:text-stone-400 text-[11px] font-bold">Mese:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={selectedYear === 'ALL'}
                  className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none font-semibold shadow-2xs ${
                    selectedYear === 'ALL'
                      ? 'bg-stone-100 dark:bg-stone-850 border-stone-200 dark:border-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed opacity-60'
                      : 'bg-stone-50 dark:bg-stone-800/90 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:border-emerald-500 cursor-pointer'
                  }`}
                >
                  <option value="ALL">
                    {selectedYear === 'ALL' ? 'Tutti i mesi' : `Tutti i mesi (${selectedYearTotalCount})`}
                  </option>
                  {selectedYear !== 'ALL' && availableMonthsWithCount.map(({ month, count }) => (
                    <option key={month} value={month}>
                      {MONTH_NAMES[month] || month} ({count})
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono hidden md:inline">
                • {periodRangeLabel}
              </span>
            </div>

            {/* Export Buttons: PDF & CSV */}
            <div className="flex items-center space-x-2 ml-auto">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isGeneratingPdf || filteredEntries.length === 0}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#d93838] hover:bg-[#b82e2e] text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="Esporta storico filtrato in PDF"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>Esporta PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredEntries.length === 0}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#2b7280] hover:bg-[#205762] text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="Esporta storico filtrato in CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>

          </div>

          {/* Counter banner */}
          <div className="text-stone-500 dark:text-stone-400 text-[11px] font-mono pt-1">
            Elementi visualizzati: <strong className="text-stone-800 dark:text-stone-200">{filteredEntries.length}</strong> su {entries.length}
          </div>

        </div>

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1d24] p-8 text-center border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl text-stone-500 dark:text-stone-400 text-xs italic space-y-2 shadow-xs">
            <p>Nessun registro trovato con i filtri selezionati.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-[#1d8998] dark:text-[#38bdf8] font-bold underline cursor-pointer"
              >
                Mostra tutti i record
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a1d24] border border-stone-300 dark:border-stone-800 rounded-none sm:rounded-xl divide-y divide-stone-200 dark:divide-stone-800 shadow-xs overflow-hidden">
            {filteredEntries.map((entry) => {
              const isPressure = (entry.subTypeName || '').toLowerCase().includes('pressure') ||
                                (entry.subTypeName || '').toLowerCase().includes('pressione') ||
                                Boolean(entry.systolic && entry.diastolic);

              const pressureDisplay = entry.systolic && entry.diastolic
                ? `${entry.systolic}/${entry.diastolic}`
                : (isPressure && entry.value.includes('/') ? entry.value : null);

              return (
                <div
                  key={entry.id}
                  className="p-3.5 flex items-start justify-between space-x-2 hover:bg-stone-50/80 dark:hover:bg-stone-800/50 transition-colors group cursor-pointer"
                  onClick={() => onEditEntry && onEditEntry(entry)}
                >

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      {entry.eventNoteIcon && (
                        <EventNoteIcon id={entry.eventNoteIcon} size="sm" />
                      )}
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100 group-hover:text-[#1d8998] dark:group-hover:text-[#38bdf8] transition-colors">
                        {entry.subTypeName}
                      </span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 rounded">
                        {entry.categoryName}
                      </span>
                      {entry.mealTiming === 'pre' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded flex items-center space-x-1" title="Pre pasto">
                          <WholeAppleIcon className="w-3 h-3 text-amber-900 dark:text-amber-300" />
                          <span>Pre pasto</span>
                        </span>
                      )}
                      {entry.mealTiming === 'post' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded flex items-center space-x-1" title="Post pasto">
                          <AppleCoreIcon className="w-3 h-3 text-emerald-900 dark:text-emerald-300" />
                          <span>Post pasto</span>
                        </span>
                      )}
                    </div>

                    {/* Primary Value Display */}
                    <div className="flex items-baseline space-x-2 flex-wrap gap-y-1">
                      <span className="text-xl font-bold text-[#1d8998] dark:text-[#38bdf8] tracking-tight font-mono">
                        {entry.value}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                        {entry.unit}
                      </span>

                      {/* Always show vitals badges when available on entry */}
                      <div className="flex items-center space-x-2 ml-1 flex-wrap gap-y-1">
                        {/* Pressure pill if distinct */}
                        {pressureDisplay && !isPressure && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 text-xs font-mono font-bold shadow-2xs">
                            <Activity className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                            <span>{pressureDisplay} mmHg</span>
                          </span>
                        )}

                        {/* Heart rate / Pulse pill */}
                        {entry.pulse && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-mono font-bold shadow-2xs">
                            <Heart className="w-3 h-3 text-rose-600 dark:text-rose-400 fill-rose-500/30" />
                            <span>{entry.pulse} bpm</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono flex items-center space-x-3 pt-0.5">
                      <span>{entry.date}</span>
                      <span>{entry.time}</span>
                      {entry.reminder && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">• Promemoria</span>
                      )}
                    </div>

                    {entry.note && (
                      <p className="text-xs text-stone-600 dark:text-stone-300 italic bg-stone-50 dark:bg-stone-800/80 p-1.5 rounded border border-stone-200 dark:border-stone-700 mt-1">
                        "{entry.note}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    {onEditEntry && (
                      <button
                        type="button"
                        onClick={() => onEditEntry(entry)}
                        className="p-1.5 text-stone-400 hover:text-[#1d8998] dark:hover:text-[#38bdf8] hover:bg-teal-50 dark:hover:bg-stone-800 rounded transition-colors"
                        title="Modifica lettura"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                      title="Elimina voce"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* OFF-SCREEN PRINTABLE TEMPLATE FOR HIGH RESOLUTION PDF EXPORT */}
        <div
          id="printable-history-area"
          data-pdf-section="true"
          data-pdf-orientation="portrait"
          className="fixed -left-[9999px] top-0 bg-white text-stone-900 font-sans p-6 w-[800px] space-y-4 pointer-events-none"
          style={{ zIndex: -100 }}
        >
          {/* PDF Header */}
          <div className="border-b-2 border-stone-800 pb-3 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Storico Misurazioni Cliniche</h1>
              <p className="text-xs text-stone-600 font-mono mt-0.5">
                Utente: <strong>{patientName}</strong> • Periodo: <strong>{periodRangeLabel}</strong> • Generato il: {new Date().toLocaleDateString('it-IT')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold px-2.5 py-1 bg-stone-100 rounded border border-stone-300 font-mono">
                {filteredEntries.length} registrazioni
              </span>
            </div>
          </div>

          {/* Printable Table */}
          <table className="w-full text-left text-xs border-collapse border border-stone-300">
            <thead>
              <tr className="bg-stone-100 text-stone-800 font-bold border-b border-stone-300">
                <th className="p-2 border-r border-stone-300 w-24">Data / Ora</th>
                <th className="p-2 border-r border-stone-300">Tipo Parametro</th>
                <th className="p-2 border-r border-stone-300 w-24 text-right">Valore</th>
                <th className="p-2 border-r border-stone-300">Pressione / Battiti</th>
                <th className="p-2 border-r border-stone-300">Fascia / Pasto</th>
                <th className="p-2">Note / Terapia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-stone-500 italic">
                    Nessuna registrazione trovata per il periodo selezionato ({periodRangeLabel}).
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e, idx) => {
                  const isPressure = (e.subTypeName || '').toLowerCase().includes('pressure') ||
                                    (e.subTypeName || '').toLowerCase().includes('pressione') ||
                                    Boolean(e.systolic && e.diastolic);
                  const pressStr = e.systolic && e.diastolic
                    ? `${e.systolic}/${e.diastolic} mmHg`
                    : (isPressure ? e.value : '-');
                  const pulseStr = e.pulse ? `${e.pulse} bpm` : '';

                  return (
                    <tr key={e.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                      <td className="p-1.5 border-r border-stone-200 font-mono text-[11px]">
                        <div>{e.date}</div>
                        <div className="text-stone-500">{e.time}</div>
                      </td>
                      <td className="p-1.5 border-r border-stone-200 font-semibold">
                        {e.subTypeName}
                      </td>
                      <td className="p-1.5 border-r border-stone-200 text-right font-mono font-bold text-stone-900">
                        {e.value} {e.unit}
                      </td>
                      <td className="p-1.5 border-r border-stone-200 font-mono text-[11px]">
                        {pressStr !== '-' && <div>🩺 {pressStr}</div>}
                        {pulseStr && <div>♥ {pulseStr}</div>}
                        {pressStr === '-' && !pulseStr && <span className="text-stone-400">-</span>}
                      </td>
                      <td className="p-1.5 border-r border-stone-200 text-[11px]">
                        <div>{e.categoryName}</div>
                        {e.mealTiming === 'pre' && <div className="text-amber-700 font-semibold">Pre pasto</div>}
                        {e.mealTiming === 'post' && <div className="text-emerald-700 font-semibold">Post pasto</div>}
                      </td>
                      <td className="p-1.5 text-stone-700 italic text-[11px]">
                        {e.note || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className="pt-2 border-t border-stone-300 text-[10px] text-stone-500 flex justify-between font-mono">
            <span>OnTrack Health Monitor • Report Ufficiale Utente</span>
            <span>Totale: {filteredEntries.length} record • Generato il {new Date().toLocaleDateString('it-IT')}</span>
          </div>
        </div>

      </div>

    </div>
  );
};


