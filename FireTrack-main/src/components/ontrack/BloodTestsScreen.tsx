import React, { useState } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { BloodTestParameter, BloodTestRecord } from '../../types/ontrack';
import { 
  evaluateBloodParam, 
  formatParamRangeLabel, 
  downloadBloodTestsCSV, 
  downloadBloodTestCsvTemplate 
} from '../../utils/ontrackStorage';
import { exportElementToPdf } from '../../utils/pdfExport';
import { BloodTestAddModal } from './BloodTestAddModal';
import { BloodTestImportModal } from './BloodTestImportModal';
import { BloodTestParamsModal } from './BloodTestParamsModal';
import { BloodTestTrendChart } from './BloodTestTrendChart';
import { ConfirmClearModal } from './ConfirmClearModal';
import { defaultBloodTestRecords } from '../../data/ontrackDefaults';
import { 
  Plus, 
  Upload, 
  Sliders, 
  TrendingUp, 
  Download, 
  Save, 
  ArrowUpDown, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Calendar,
  Sparkles,
  FileSpreadsheet,
  Activity,
  Loader2
} from 'lucide-react';

interface BloodTestsScreenProps {
  records: BloodTestRecord[];
  parameters: BloodTestParameter[];
  onSaveRecords: (records: BloodTestRecord[]) => void;
  onSaveParameters: (parameters: BloodTestParameter[]) => void;
  onBack: () => void;
  onNavigate: (screen: any) => void;
  onOpenTools: () => void;
  patientName?: string;
}

export const BloodTestsScreen: React.FC<BloodTestsScreenProps> = ({
  records,
  parameters,
  onSaveRecords,
  onSaveParameters,
  onBack,
  onNavigate,
  onOpenTools,
  patientName = 'Angelo F'
}) => {
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BloodTestRecord | null>(null);

  // View state
  const [showTrendChart, setShowTrendChart] = useState(false);
  const [selectedChartParamId, setSelectedChartParamId] = useState<string>(parameters[0]?.id || 'glucose');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('asc'); // 'asc' = oldest to newest
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  const notifyExport = (msg: string) => {
    setExportNotification(msg);
    setTimeout(() => {
      setExportNotification(null);
    }, 4000);
  };

  // Handlers
  const handleClearAllRecords = () => {
    onSaveRecords([]);
    notifyExport('🗑️ Tutti gli esami di laboratorio sono stati cancellati.');
  };

  const handleSaveSingleRecord = (savedRecord: BloodTestRecord) => {
    const exists = records.some(r => r.id === savedRecord.id);
    let updated: BloodTestRecord[];
    if (exists) {
      updated = records.map(r => r.id === savedRecord.id ? savedRecord : r);
    } else {
      updated = [...records, savedRecord];
    }
    onSaveRecords(updated);
  };

  const handleDeleteRecord = (id: string, date: string) => {
    const updated = records.filter(r => r.id !== id);
    onSaveRecords(updated);
    notifyExport(`Prelievo del ${date} eliminato.`);
  };

  const handleImportComplete = (imported: BloodTestRecord[], mode: 'merge' | 'replace') => {
    if (mode === 'replace') {
      onSaveRecords(imported);
    } else {
      // Merge: replace existing if same date, or append
      const merged = [...records];
      imported.forEach(imp => {
        const existingIdx = merged.findIndex(m => m.date === imp.date);
        if (existingIdx >= 0) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            values: { ...merged[existingIdx].values, ...imp.values },
            notes: imp.notes || merged[existingIdx].notes
          };
        } else {
          merged.push(imp);
        }
      });
      onSaveRecords(merged);
    }
  };

  // Sort records
  const sortedRecords = [...records].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.timestamp - b.timestamp;
    }
    return b.timestamp - a.timestamp;
  });

  // Calculate stats
  let totalValues = 0;
  let inRangeValues = 0;
  let outOfRangeValues = 0;

  records.forEach(r => {
    parameters.forEach(p => {
      const val = r.values[p.id] ?? r.values[p.name.toLowerCase()] ?? null;
      if (val !== null && val !== undefined) {
        totalValues++;
        const evalRes = evaluateBloodParam(val, p);
        if (evalRes.isGreen) inRangeValues++;
        if (evalRes.isRed) outOfRangeValues++;
      }
    });
  });

  const inRangePercent = totalValues > 0 ? Math.round((inRangeValues / totalValues) * 100) : 100;

  const handleSaveAsPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    notifyExport('📄 Generazione del file PDF in corso... Attendere...');

    const cleanName = (patientName || 'Angelo F').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Esami_Sangue_${cleanName}_${dateStr}.pdf`;

    try {
      await exportElementToPdf('printable-bloodtests-area', fileName);
      notifyExport('✅ File PDF esami del sangue generato con successo!');
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

  return (
    <div className="flex flex-col min-h-full bg-[#e8ecee] dark:bg-[#121418] text-stone-800 dark:text-stone-100">
      
      {/* Header */}
      <OnTrackHeader
        title="Esami del Sangue"
        showBack={true}
        onBack={onBack}
        showToolsMenu={true}
        onOpenTools={onOpenTools}
        onNavigate={onNavigate}
      />

      {/* Main Container */}
      <div className="flex-1 p-3 sm:p-5 max-w-7xl mx-auto w-full space-y-4 pb-16">
        
        {/* Top Control Bar with Action Buttons */}
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100 leading-tight">
                Storico Analisi di Laboratorio
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {records.length} date di prelievo registrate • {parameters.length} parametri monitorati
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Nuovo Prelievo */}
            <button
              onClick={() => {
                setEditingRecord(null);
                setIsAddModalOpen(true);
              }}
              className="px-3.5 py-2 bg-[#9333ea] hover:bg-[#7e22ce] active:bg-[#6b21a8] text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuovo Prelievo</span>
            </button>

            {/* Importa CSV */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-semibold text-xs rounded-xl border border-stone-300 dark:border-stone-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
              <span className="hidden sm:inline">Importa CSV</span>
              <span className="sm:hidden">Importa</span>
            </button>

            {/* Configura Range */}
            <button
              onClick={() => setIsParamsModalOpen(true)}
              className="px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-semibold text-xs rounded-xl border border-stone-300 dark:border-stone-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
              <span className="hidden sm:inline">Range & Parametri</span>
              <span className="sm:hidden">Range</span>
            </button>

            {/* Toggle Trend Chart */}
            <button
              onClick={() => setShowTrendChart(!showTrendChart)}
              className={`px-3 py-2 font-semibold text-xs rounded-xl border flex items-center space-x-1.5 transition-colors cursor-pointer ${
                showTrendChart 
                  ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200' 
                  : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
              <span className="hidden sm:inline">{showTrendChart ? 'Nascondi Grafico' : 'Grafico Trend'}</span>
              <span className="sm:hidden">Trend</span>
            </button>

            {/* Esporta CSV */}
            <button
              onClick={() => downloadBloodTestsCSV(records, parameters, patientName)}
              className="px-3.5 py-2 bg-[#e97849] hover:bg-[#d86b3d] active:bg-[#c75e33] text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>CSV</span>
            </button>

            {/* Stampa / PDF */}
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

            {/* Svuota Storico / Cancella Dati */}
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              disabled={records.length === 0}
              className={`px-3 py-2 text-xs font-bold rounded-xl border flex items-center space-x-1.5 transition-all cursor-pointer ${
                records.length === 0
                  ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 border-stone-200 dark:border-stone-700 cursor-not-allowed opacity-60'
                  : 'bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 active:bg-red-200 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900 shadow-2xs hover:border-red-300'
              }`}
              title={records.length === 0 ? 'Nessun esame da eliminare' : 'Elimina tutti gli esami di laboratorio registrati'}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span className="hidden sm:inline">Svuota Storico</span>
              <span className="sm:hidden">Svuota</span>
            </button>

          </div>

        </div>

        {/* Export Toast / Notification Banner */}
        {exportNotification && (
          <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-md text-xs sm:text-sm font-bold flex items-center justify-between animate-fadeIn print:hidden no-print">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>{exportNotification}</span>
            </div>
            <button
              onClick={() => setExportNotification(null)}
              className="text-emerald-200 hover:text-white text-xs underline cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        )}

        {/* Trend Chart (Conditional) */}
        {showTrendChart && (
          <div className="no-print">
            <BloodTestTrendChart
              records={records}
              parameters={parameters}
              initialParamId={selectedChartParamId}
            />
          </div>
        )}

        {/* Printable Blood Tests Area (Captured for PDF in Landscape A4 - 100% Full Width) */}
        <div className="overflow-x-auto pb-4">
          <div
            id="printable-bloodtests-area"
            data-pdf-section="true"
            data-pdf-orientation="landscape"
            className="min-w-[1040px] w-full space-y-4 bg-white dark:bg-[#1a1d24] p-5 sm:p-6 rounded-2xl border border-stone-300 dark:border-stone-800 shadow-sm print:border-none print:shadow-none print:p-0 text-stone-800 dark:text-stone-100"
          >
            {/* Top Bar (Patient & Metadata) */}
            <div className="flex items-start justify-between border-b-2 border-stone-800 dark:border-stone-700 pb-3">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                  Diario Personale • Analisi di Laboratorio
                </div>
                <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
                  {patientName}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 dark:text-stone-400 font-medium">
                  <div>
                    <span className="text-stone-400 dark:text-stone-500">Tipo Documento:</span>{' '}
                    <span className="font-bold text-stone-800 dark:text-stone-200">Storico Esami del Sangue</span>
                  </div>
                  <div>
                    <span className="text-stone-400 dark:text-stone-500">Periodo Monitorato:</span>{' '}
                    <span className="font-bold text-stone-800 dark:text-stone-200">
                      {sortedRecords.length > 0
                        ? `${sortedRecords[0].date} - ${sortedRecords[sortedRecords.length - 1].date}`
                        : 'Nessun prelievo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right text-xs text-stone-500 dark:text-stone-400 font-mono space-y-0.5">
                <div className="font-bold text-stone-800 dark:text-stone-200 text-sm">ANALISI DI LABORATORIO</div>
                <div>Generato: {new Date().toLocaleDateString('it-IT')}</div>
                <div className="text-[10px] text-stone-400 font-sans">OnTrack</div>
              </div>
            </div>

            {/* Summary Metric Chips inside printable area - 4 Columns Across Full Landscape Width */}
            <div className="grid grid-cols-4 gap-3 w-full">
              <div className="bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase">Prelievi Storici</div>
                  <div className="text-lg font-bold text-stone-900 dark:text-stone-100 font-mono">{records.length}</div>
                </div>
                <div className="p-1.5 bg-purple-100 dark:bg-purple-950/60 rounded-lg text-purple-700 dark:text-purple-300">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase">Parametri Monitorati</div>
                  <div className="text-lg font-bold text-stone-900 dark:text-stone-100 font-mono">{parameters.length}</div>
                </div>
                <div className="p-1.5 bg-blue-100 dark:bg-blue-950/60 rounded-lg text-blue-700 dark:text-blue-300">
                  <Sliders className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase">Nel Range Normale</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">{inRangePercent}%</div>
                </div>
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase">Fuori Soglia</div>
                  <div className="text-lg font-bold text-rose-700 dark:text-rose-400 font-mono">{outOfRangeValues}</div>
                </div>
                <div className="p-1.5 bg-rose-100 dark:bg-rose-950/60 rounded-lg text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Main Matrix Table matching clinical report - 100% Full Width */}
            <div className="bg-white dark:bg-[#1a1d24] border border-stone-300 dark:border-stone-700 rounded-xl shadow-xs overflow-hidden w-full">
              
              {/* Table Header Controls */}
              <div className="bg-stone-50 dark:bg-stone-800/80 px-4 py-2 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between print:hidden">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                    Tabella Analitica Cronologica
                  </span>
                  <span className="text-[11px] text-stone-400 hidden sm:inline">
                    (Clicca sulla colonna per visualizzare il grafico di trend)
                  </span>
                </div>

                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 flex items-center space-x-1 px-2.5 py-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg transition-colors cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{sortOrder === 'asc' ? 'Cronologico: Meno Recenti → Nuovi' : 'Cronologico: Più Recenti → Vecchi'}</span>
                </button>
              </div>

              {/* Table Matrix View */}
              <div className="w-full">
                <table className="w-full text-xs text-left border-collapse table-fixed">
                  
                  {/* Header Row with Analyte Names & Range Parentheses */}
                  <thead>
                    <tr className="bg-stone-100/90 dark:bg-stone-800/90 border-b-2 border-stone-300 dark:border-stone-700">
                      
                      {/* Date Column */}
                      <th 
                        className="p-2.5 font-bold text-stone-800 dark:text-stone-200 border-r border-stone-300 dark:border-stone-700 bg-stone-200/80 dark:bg-stone-700/80 text-left"
                        style={{ width: '13%' }}
                      >
                        Data
                      </th>

                      {/* Dynamic Parameter Columns - Proportional 100% Distribution */}
                      {parameters.map((param) => {
                        const rangeLabel = formatParamRangeLabel(param);
                        const isSelected = selectedChartParamId === param.id && showTrendChart;
                        const paramWidthPercent = parameters.length > 0 ? (87 / parameters.length) : 87;

                        return (
                          <th
                            key={param.id}
                            onClick={() => {
                              setSelectedChartParamId(param.id);
                              setShowTrendChart(true);
                            }}
                            style={{ width: `${paramWidthPercent}%` }}
                            className={`p-2 text-center border-r border-stone-300 dark:border-stone-700 last:border-r-0 cursor-pointer transition-colors group select-none ${
                              isSelected ? 'bg-purple-100/80 dark:bg-purple-950/80 text-purple-950 dark:text-purple-200' : 'hover:bg-stone-200/60 dark:hover:bg-stone-700/60 text-stone-800 dark:text-stone-200'
                            }`}
                            title={`Clicca per vedere il trend temporale di ${param.name}`}
                          >
                            <div className="font-bold text-[11.5px] leading-tight group-hover:text-purple-700 dark:group-hover:text-purple-400">
                              {param.name}
                            </div>
                            {rangeLabel && (
                              <div className="text-[9.5px] font-normal text-stone-500 dark:text-stone-400 mt-0.5 leading-tight">
                                {rangeLabel}
                              </div>
                            )}
                          </th>
                        );
                      })}

                      {/* Actions Column (Visible only in screen UI) */}
                      <th className="p-2 text-center font-bold text-stone-600 dark:text-stone-400 w-[55px] print:hidden no-print border-l border-stone-200 dark:border-stone-700">
                        Azioni
                      </th>

                    </tr>
                  </thead>

                  {/* Body Rows */}
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800 font-mono text-[12px]">
                    {sortedRecords.length === 0 ? (
                      <tr>
                        <td 
                          colSpan={parameters.length + 2}
                          className="p-8 text-center text-stone-400 dark:text-stone-500 font-sans"
                        >
                          Nessun esame registrato. Clicca su "+ Nuovo Prelievo" o "Importa CSV" per iniziare.
                        </td>
                      </tr>
                    ) : (
                      sortedRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                          
                          {/* Date Cell */}
                          <td 
                            className="p-2.5 font-bold text-stone-900 dark:text-stone-100 border-r border-stone-300 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900/60 text-left"
                            style={{ width: '13%' }}
                          >
                            {record.date}
                          </td>

                          {/* Parameter Values Cells */}
                          {parameters.map((param) => {
                            const val = record.values[param.id] ?? 
                              (param.id === 'acr' ? record.values['microalbuminuria'] : undefined) ?? 
                              record.values[param.name.toLowerCase()] ?? 
                              null;
                            const paramWidthPercent = parameters.length > 0 ? (87 / parameters.length) : 87;
                            
                            if (val === null || val === undefined) {
                              return (
                                <td 
                                  key={param.id} 
                                  style={{ width: `${paramWidthPercent}%` }}
                                  className="p-2 text-center text-stone-300 dark:text-stone-600 border-r border-stone-200 dark:border-stone-700 last:border-r-0 bg-white dark:bg-[#1a1d24]"
                                >
                                  -
                                </td>
                              );
                            }

                            const evalRes = evaluateBloodParam(val, param);
                            const valDisplay = String(val).replace('.', ',');

                            return (
                              <td
                                key={param.id}
                                style={{ width: `${paramWidthPercent}%` }}
                                className={`p-2 text-center font-bold border-r border-stone-200 dark:border-stone-700 last:border-r-0 transition-colors ${
                                  evalRes.isGreen
                                    ? 'bg-[#dcfce7] dark:bg-emerald-950/60 text-[#15803d] dark:text-emerald-300'
                                    : 'bg-[#fee2e2] dark:bg-rose-950/60 text-[#b91c1c] dark:text-rose-300'
                                }`}
                              >
                                <span className="inline-flex items-center justify-center space-x-0.5">
                                  <span>{valDisplay}</span>
                                  {evalRes.status === 'high' && <span className="text-[10px] ml-0.5 font-black">↑</span>}
                                  {evalRes.status === 'low' && <span className="text-[10px] ml-0.5 font-black">↓</span>}
                                </span>
                              </td>
                            );
                          })}

                          {/* Action buttons (Edit & Delete) */}
                          <td className="p-1.5 text-center whitespace-nowrap print:hidden no-print border-l border-stone-200 dark:border-stone-700 w-[55px]">
                            <div className="flex items-center justify-center space-x-1 font-sans">
                              <button
                                onClick={() => {
                                  setEditingRecord(record);
                                  setIsAddModalOpen(true);
                                }}
                                className="p-1 text-stone-500 hover:text-purple-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors cursor-pointer"
                                title="Modifica riga"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(record.id, record.date)}
                                className="p-1 text-stone-400 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors cursor-pointer"
                                title="Elimina riga"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>

                </table>
              </div>

              {/* Table Footer with Legend */}
              <div className="bg-stone-50 dark:bg-stone-900/80 px-4 py-2.5 border-t border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-stone-600 dark:text-stone-400 gap-2">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-bold text-stone-800 dark:text-stone-200">Legenda:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-[#dcfce7] dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 inline-block"></span>
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">Nel Range di Riferimento</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-[#fee2e2] dark:bg-rose-950 border border-rose-300 dark:border-rose-700 inline-block"></span>
                    <span className="font-semibold text-rose-800 dark:text-rose-300">Fuori Range (↑ Elevato / ↓ Basso)</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsParamsModalOpen(true)}
                  className="text-purple-700 dark:text-purple-400 hover:underline font-semibold flex items-center space-x-1 print:hidden no-print cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Modifica valori soglia range</span>
                </button>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* Modals */}
      <BloodTestAddModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSaveSingleRecord}
        parameters={parameters}
        recordToEdit={editingRecord}
      />

      <BloodTestImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
        parameters={parameters}
      />

      <BloodTestParamsModal
        isOpen={isParamsModalOpen}
        onClose={() => setIsParamsModalOpen(false)}
        parameters={parameters}
        onSaveParameters={onSaveParameters}
      />

      <ConfirmClearModal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        onConfirm={handleClearAllRecords}
        totalEntriesCount={records.length}
        title="Cancellare TUTTI gli esami del sangue?"
        itemTypeLabel="esami di laboratorio"
        confirmMessage={`Questa operazione eliminerà tutti i ${records.length > 0 ? `${records.length} ` : ''}prelievi registrati nello storico delle analisi di laboratorio. I parametri e i range di riferimento rimarranno intatti.`}
      />

    </div>
  );
};
