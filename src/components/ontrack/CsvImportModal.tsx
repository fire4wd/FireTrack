import React, { useState, useRef } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { HealthCategory, HealthSubType, LogEntryItem } from '../../types/ontrack';
import { parseHealthCsv, convertToLogEntryItems, CsvParseResult } from '../../utils/csvImporter';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  FileText, 
  Calendar, 
  Check, 
  Trash2, 
  ArrowRight,
  Info,
  Layers,
  PlusCircle,
  RefreshCw,
  X
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: HealthCategory[];
  subTypes: HealthSubType[];
  onImportComplete: (
    newEntries: LogEntryItem[], 
    mode: 'append' | 'replace',
    targetSubTypes?: string[],
    categoryLabel?: string
  ) => void;
}

const SAMPLE_GLUCOSE_CSV = `Tipo di elemento\tData e ora\tValore\tDose consigliata\tUnità\tManuale\tValore aggiuntivo\tNote\tFonte di dati
I risultati glicemici\t14 Ago 2026, 00:20\t180\t\tmg/dL\tSì\tPost-pasto\tDolce compleanno\t
I risultati glicemici\t13 Ago 2026, 20:22\t159\t\tmg/dL\tNo\tPre-pasto\t\t
I risultati glicemici\t12 Ago 2026, 08:12\t170\t\tmg/dL\tNo\tPre-pasto\t\t
I risultati glicemici\t5 Ago 2026, 20:16\t138\t\tmg/dL\tNo\tPre-pasto\t\t
I risultati glicemici\t5 Ago 2026, 07:10\t176\t\tmg/dL\tNo\tPre-pasto\t\t
I risultati glicemici\t2 Ago 2026, 17:47\t151\t\tmg/dL\tNo\tPre-pasto\t\t
I risultati glicemici\t2 Ago 2026, 14:54\t200\t\tmg/dL\tNo\tPre-pasto\t\t`;

const SAMPLE_PRESSURE_CSV = `Data,Ora,Tipo,Sistolica/Diastolica - Battiti,Fase Pasto,Pasto,Note
2026-08-13,07:27,Pressione,118/76 - 70 bpm,Pre pasto,Colazione,Misurazione mattutina
2026-08-13,19:27,Pressione,122/80 - 74 bpm,Pre pasto,Cena,Dopo lavoro`;

const SAMPLE_WEIGHT_CSV = `Data,Ora,Tipo,Peso (kg),Quanto conforme siete stati?
2026-08-01,12:00,Peso,96.5,Abbastanza buono
2026-06-07,12:00,Peso,98.5,Abbastanza buono
2026-06-03,12:00,Peso,99,Abbastanza buono
2026-05-11,12:00,Peso,99.5,Abbastanza buono
2026-03-09,12:00,Peso,100.6,Abbastanza buono
2025-10-19,12:00,Peso,100.6,Abbastanza buono
2025-08-13,12:00,Peso,97.6,Abbastanza buono
2025-08-11,12:00,Peso,97.5,Abbastanza buono
2025-08-04,12:00,Peso,98,Abbastanza buono
2025-07-28,12:00,Peso,97.5,Abbastanza buono
2025-07-21,12:00,Peso,97.5,Abbastanza buono
2025-07-14,12:00,Peso,98,Abbastanza buono
2025-07-08,12:00,Peso,97,Abbastanza buono
2025-05-09,12:00,Peso,97.5,Abbastanza buono
2025-05-02,12:00,Peso,97.2,Abbastanza buono
2025-04-26,12:00,Peso,97.5,Abbastanza buono
2025-04-13,12:00,Peso,99,Abbastanza buono
2025-04-07,12:00,Peso,97.5,Abbastanza buono
2025-03-31,12:00,Peso,97.2,Abbastanza buono
2025-03-03,12:00,Peso,96.9,Abbastanza buono
2025-03-02,12:00,Peso,96.9,Abbastanza buono
2025-02-24,12:00,Peso,97.3,Abbastanza buono
2025-02-17,12:00,Peso,97,Abbastanza buono
2025-02-10,12:00,Peso,97,Abbastanza buono
2025-02-08,12:00,Peso,97,Abbastanza buono
2025-02-03,12:00,Peso,98,Abbastanza buono
2025-01-15,12:00,Peso,99,Scarso
2025-01-11,12:00,Peso,97.5,Abbastanza buono
2024-03-10,12:00,Peso,99,Abbastanza buono
2024-03-02,12:00,Peso,100,Abbastanza buono
2023-09-08,12:00,Peso,99,Abbastanza buono
2023-09-05,12:00,Peso,101,Abbastanza buono
2023-09-01,12:00,Peso,104,Abbastanza buono
2023-08-27,12:00,Peso,100,Scarso
2023-08-11,12:00,Peso,101,Abbastanza buono
2023-07-02,12:00,Peso,105,Abbastanza buono
2022-11-06,12:00,Peso,105,Abbastanza buono
2022-10-31,12:00,Peso,106,Abbastanza buono
2022-10-24,12:00,Peso,107,Abbastanza buono
2022-10-04,12:00,Peso,109,Abbastanza buono
2022-04-22,12:00,Peso,103,Abbastanza buono
2022-04-04,12:00,Peso,105,Non applicabile
2021-12-20,12:00,Peso,99.5,Abbastanza buono
2021-12-13,12:00,Peso,99,Abbastanza buono
2021-12-06,12:00,Peso,99.5,Abbastanza buono
2021-11-23,12:00,Peso,100,Abbastanza buono
2021-11-22,12:00,Peso,100,Abbastanza buono
2021-11-07,12:00,Peso,100.5,Abbastanza buono
2021-10-02,12:00,Peso,101,Abbastanza buono
2021-09-18,12:00,Peso,102,Abbastanza buono
2021-09-04,12:00,Peso,103,Abbastanza buono
2021-08-20,12:00,Peso,113,Abbastanza buono
2021-07-18,12:00,Peso,107,Abbastanza buono
2021-06-15,12:00,Peso,109.4,Abbastanza buono
2021-04-05,12:00,Peso,111,Abbastanza buono
2021-02-06,12:00,Peso,119,Abbastanza buono
2020-02-06,12:00,Peso,128.7,Non applicabile`;

const SAMPLE_NUTRITION_CSV = `Data,Ora,Tipo,Alimenti (Cal),% GDA,Grassi (g),Proteine (g),Carboidrati (g),Esercizio (Cal),Netto (Cal),Note
2026-08-16,12:00,Alimenti,-,-,-,-,-,-,-,Aggiungi Nota
2026-08-15,12:00,Alimenti,-,-,-,-,-,-,-,Aggiungi Nota
2026-08-14,12:00,Alimenti,-,-,-,-,-,-,-,Aggiungi Nota
2026-08-13,12:00,Alimenti,-,-,-,-,-,-,-,Aggiungi Nota
2026-08-12,12:00,Alimenti,-,-,-,-,-,-,-,Aggiungi Nota
2026-08-11,12:00,Alimenti,-,-,-,-,-,-,-,Aggiungi Nota
2026-08-10,12:00,Alimenti,-,-,-,-,-,-,-,Aggiungi Nota
2026-08-09,12:00,Alimenti,-,-,-,-,-,-,-,Aggiungi Nota
2026-08-02,12:00,Alimenti,421,23,-,-,18.48,27.56,37.25,-
2026-07-19,12:00,Alimenti,471,26,24.26,25.68,37.84,-,-,-
2026-06-02,12:00,Alimenti,1102,61,37.56,40.83,146.09,-,-,-
2026-05-10,12:00,Alimenti,399,22,17.84,23.43,37.19,-,-,-
2026-05-09,12:00,Alimenti,399,22,11.61,35.03,37.25,-,-,-
2026-05-08,12:00,Alimenti,488,27,16.26,27.78,61.20,-,-,-
2026-05-07,12:00,Alimenti,628,35,34.68,20.88,61.20,-,-,-
2026-05-06,12:00,Alimenti,471,26,24.26,25.68,37.84,-,-,-
2026-05-05,12:00,Alimenti,471,26,24.26,25.68,37.84,-,-,-
2026-05-04,12:00,Alimenti,1,0,0.11,0.07,0.00,-,-,-
2026-05-03,12:00,Alimenti,1,0,0.11,0.07,0.00,-,-,-
2026-05-02,12:00,Alimenti,484,27,16.38,25.98,61.62,-,-,-
2026-05-01,12:00,Alimenti,421,23,18.51,23.57,40.21,-,-,-
2026-04-30,12:00,Alimenti,471,26,24.26,25.68,37.84,-,-,-
2026-04-29,12:00,Alimenti,421,23,18.48,27.56,37.25,-,-,-
2026-04-28,12:00,Alimenti,628,35,34.68,20.88,61.20,-,-,-
2026-04-27,12:00,Alimenti,564,31,4.36,45.30,80.61,-,-,-
2026-04-26,12:00,Alimenti,943,52,32.05,45.68,124.36,-,-,-
2026-04-25,12:00,Alimenti,945,52,24.88,54.96,128.32,-,-,-
2026-04-24,12:00,Alimenti,545,30,13.38,20.00,89.80,-,-,-`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  categories = [],
  subTypes = [],
  onImportComplete
}) => {
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  // Default: 'append' (Aggiungi alle letture esistenti)
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleParse = (text: string, name: string | null = null) => {
    setCsvText(text);
    setImportSuccessMessage(null);
    if (name) setFileName(name);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const result = parseHealthCsv(text, categories, subTypes);
    setParseResult(result);
    setImportMode('append');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleParse(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        handleParse(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadPreset = (type: 'glucose' | 'pressure' | 'weight' | 'nutrition') => {
    if (type === 'glucose') handleParse(SAMPLE_GLUCOSE_CSV, 'Esempio_Glicemie_Ago2026.csv');
    else if (type === 'pressure') handleParse(SAMPLE_PRESSURE_CSV, 'Esempio_Pressione_Ago2026.csv');
    else if (type === 'weight') handleParse(SAMPLE_WEIGHT_CSV, 'Esempio_Peso_Ago2026.csv');
    else if (type === 'nutrition') handleParse(SAMPLE_NUTRITION_CSV, 'Esempio_Riepilogo_Nutrizionale.csv');
  };

  const getOtherCategoriesHint = (categoryLabel: string): string => {
    const cl = (categoryLabel || '').toLowerCase();
    if (cl.includes('glicem')) return 'Pressione, Peso, Nutrizione, Farmaci';
    if (cl.includes('press')) return 'Glicemia, Peso, Nutrizione, Farmaci';
    if (cl.includes('peso')) return 'Glicemia, Pressione, Nutrizione, Farmaci';
    if (cl.includes('nutri') || cl.includes('aliment') || cl.includes('cibo')) return 'Glicemia, Pressione, Peso, Farmaci';
    return 'altre categorie';
  };

  const getCategoryBadgeStyle = (detectedFormat?: string, categoryLabel?: string) => {
    const cat = (categoryLabel || '').toLowerCase();
    if (detectedFormat === 'glucose' || cat.includes('glicem')) {
      return {
        bg: 'bg-teal-50',
        border: 'border-teal-200',
        badgeBg: 'bg-[#1d8998]',
        text: 'text-teal-900',
        subText: 'text-teal-700',
        iconEmoji: '🩸',
        label: 'Glicemia'
      };
    }
    if (detectedFormat === 'pressure' || cat.includes('press')) {
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        badgeBg: 'bg-rose-600',
        text: 'text-rose-900',
        subText: 'text-rose-700',
        iconEmoji: '❤️',
        label: 'Pressione Arteriosa'
      };
    }
    if (detectedFormat === 'weight' || cat.includes('peso')) {
      return {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        badgeBg: 'bg-indigo-600',
        text: 'text-indigo-900',
        subText: 'text-indigo-700',
        iconEmoji: '⚖️',
        label: 'Peso Corporeo'
      };
    }
    if (detectedFormat === 'nutrition' || cat.includes('nutri') || cat.includes('aliment')) {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        badgeBg: 'bg-amber-600',
        text: 'text-amber-900',
        subText: 'text-amber-700',
        iconEmoji: '🥗',
        label: 'Nutrizione / Alimenti'
      };
    }
    return {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      badgeBg: 'bg-blue-600',
      text: 'text-blue-900',
      subText: 'text-blue-700',
      iconEmoji: '📋',
      label: categoryLabel || 'Dati Sanitari'
    };
  };

  const executeImport = (modeToUse: 'append' | 'replace') => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    setIsProcessing(true);

    const items = convertToLogEntryItems(parseResult.validRows);
    const count = items.length;
    const catLabel = parseResult.categoryLabel || 'Misurazioni';
    const targetSubTypes = parseResult.targetSubTypes;
    const isSingleCategory = targetSubTypes && targetSubTypes.length > 0 && targetSubTypes.length <= 2;

    setTimeout(() => {
      if (typeof onImportComplete === 'function') {
        onImportComplete(items, modeToUse, targetSubTypes, catLabel);
      }
      setIsProcessing(false);
      setShowOverwriteConfirm(false);
      
      const successMsg = modeToUse === 'replace'
        ? (isSingleCategory
            ? `Sostituite con successo ${count} letture di "${catLabel}". Le altre categorie (${getOtherCategoriesHint(catLabel)}) sono state conservate intatte!`
            : `Sostituite con successo ${count} letture nel database!`)
        : `${count} misurazioni di "${catLabel}" aggiunte con successo al database.`;

      setImportSuccessMessage(successMsg);
      handleClear();
    }, 300);
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    
    // Se l'utente ha scelto di sovrascrivere, chiediamo conferma esplicita
    if (importMode === 'replace') {
      setShowOverwriteConfirm(true);
      return;
    }

    // Altrimenti eseguiamo direttamente l'aggiunta (append)
    executeImport('append');
  };

  const handleClear = () => {
    setCsvText('');
    setFileName(null);
    setParseResult(null);
    setImportMode('append');
    setShowOverwriteConfirm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-stone-300 flex flex-col max-h-[92vh] overflow-hidden animate-scaleIn">
        
        {/* Modal Header */}
        <div className="bg-[#1d8998] text-white px-5 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/15 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Importa Misurazioni da CSV / Excel</h2>
              <p className="text-xs text-teal-100">
                Supporta formato standard con data italiana (es. 14 Ago 2026, 00:20), Pre/Post pasto e note
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Success Banner */}
          {importSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-start justify-between text-emerald-900 animate-fadeIn">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Operazione completata con successo</p>
                  <p className="text-xs text-emerald-700 mt-0.5">{importSuccessMessage}</p>
                </div>
              </div>
              <button
                onClick={() => setImportSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* STEP 1: Upload / Paste Area */}
          {!parseResult && (
            <div className="space-y-4">
              
              {/* Drag and drop box */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                  dragActive
                    ? 'border-teal-500 bg-teal-50/70 scale-[1.01]'
                    : 'border-stone-300 hover:border-teal-400 bg-stone-50/60 hover:bg-stone-50'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-sm text-stone-800 block">
                    Trascina qui il file CSV o clicca per selezionarlo dal dispositivo
                  </span>
                  <span className="text-xs text-stone-500 block">
                    Formati accettati: .csv, .tsv, .txt (separatore virgola, punto e virgola o tabulazione)
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Sample Data Fast Test Buttons */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-stone-600 shrink-0" />
                  <span className="text-xs font-bold text-stone-800">
                    Formati di esempio pronti per il test:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadPreset('glucose')}
                    className="p-2 bg-white hover:bg-teal-50 border border-stone-200 hover:border-teal-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-teal-800 group-hover:text-teal-900">🩸 Glicemie</div>
                    <div className="text-[9px] text-stone-500">7 letture Pre/Post pasto</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPreset('pressure')}
                    className="p-2 bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-rose-800 group-hover:text-rose-900">❤️ Pressione</div>
                    <div className="text-[9px] text-stone-500">3 valori (es. 94 106 95)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPreset('weight')}
                    className="p-2 bg-white hover:bg-indigo-50 border border-stone-200 hover:border-indigo-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-indigo-800 group-hover:text-indigo-900">⚖️ Peso</div>
                    <div className="text-[9px] text-stone-500">2 colonne (h 19:27)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPreset('nutrition')}
                    className="p-2 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-amber-800 group-hover:text-amber-900">🥗 Nutrizione</div>
                    <div className="text-[9px] text-stone-500">Calorie, GDA, Macro</div>
                  </button>
                </div>
              </div>

              {/* Direct Paste Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  Oppure incolla direttamente il testo copiato da Excel / Blocco Note:
                </label>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Incolla qui le righe (es: I risultati glicemici	14 Ago 2026, 00:20	180		mg/dL	Sì	Post-pasto...)"
                  className="w-full p-3 font-mono text-xs bg-white border border-stone-300 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!csvText.trim()}
                    onClick={() => handleParse(csvText, 'Testo Incollato')}
                    className="px-4 py-2 bg-[#1d8998] hover:bg-[#16707c] disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
                  >
                    <span>Analizza e Mostra Anteprima</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* STEP 2: PREVIEW TABLE & STATS */}
          {parseResult && (() => {
            const badgeStyle = getCategoryBadgeStyle(parseResult.detectedFormat, parseResult.categoryLabel);
            const isSingleCategory = parseResult.targetSubTypes && parseResult.targetSubTypes.length > 0 && parseResult.targetSubTypes.length <= 2;
            const otherCats = getOtherCategoriesHint(parseResult.categoryLabel);

            return (
              <div className="space-y-5 animate-fadeIn">
                
                {/* Summary Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center space-x-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-lg">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-emerald-900 font-mono">
                        {parseResult.validRows.length}
                      </div>
                      <div className="text-xs text-emerald-700 font-medium">Letture Valide Riconosciute</div>
                    </div>
                  </div>

                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 flex items-center space-x-3">
                    <div className="p-2.5 bg-stone-700 text-white rounded-lg">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-800">
                        {parseResult.dateRange ? `${parseResult.dateRange.start} → ${parseResult.dateRange.end}` : 'N/D'}
                      </div>
                      <div className="text-xs text-stone-500 font-medium">Intervallo Date Rilevato</div>
                    </div>
                  </div>

                  <div className={`${badgeStyle.bg} border ${badgeStyle.border} rounded-xl p-3.5 flex items-center space-x-3`}>
                    <div className={`p-2 text-xl rounded-lg bg-white/80 border ${badgeStyle.border} shadow-2xs flex items-center justify-center shrink-0`}>
                      {badgeStyle.iconEmoji}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-xs font-bold ${badgeStyle.text} truncate`}>
                          {parseResult.categoryLabel}
                        </span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-bold uppercase rounded text-white ${badgeStyle.badgeBg}`}>
                          Riconosciuto
                        </span>
                      </div>
                      <div className={`text-[11px] ${badgeStyle.subText} font-medium truncate`}>
                        {fileName || 'File Caricato'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warnings if any rows invalid */}
                {parseResult.invalidRows.length > 0 && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs space-y-1">
                    <div className="font-bold flex items-center space-x-1.5 text-red-900">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span>{parseResult.invalidRows.length} righe ignorate per formato non conforme:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-700 max-h-20 overflow-y-auto">
                      {parseResult.invalidRows.slice(0, 5).map((inv, idx) => (
                        <li key={idx}>Riga {inv.rowNumber}: {inv.error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Import Mode Selector */}
                <div className="bg-stone-100/90 border border-stone-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-stone-800">
                      Modalità di Salvataggio nel Database:
                    </label>
                    <span className="text-[11px] text-stone-500 font-medium">
                      Seleziona l'azione desiderata
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* OPTION 1: APPEND (DEFAULT) */}
                    <label className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 relative ${
                      importMode === 'append'
                        ? 'bg-emerald-50/70 border-teal-600 shadow-xs ring-1 ring-teal-600/30'
                        : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="mt-1 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <PlusCircle className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span className="font-bold text-xs text-stone-900">Aggiungi alle letture esistenti</span>
                          <span className="px-1.5 py-0.5 bg-teal-600 text-white font-bold text-[9px] uppercase tracking-wider rounded-md">
                            Predefinito
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-600 block leading-snug">
                          Conserva tutte le misurazioni già presenti nel registro e aggiunge le nuove {parseResult.validRows.length} letture di <strong>{parseResult.categoryLabel}</strong>.
                        </span>
                      </div>
                    </label>

                    {/* OPTION 2: REPLACE / SELECTIVE OVERWRITE */}
                    <label className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 relative ${
                      importMode === 'replace'
                        ? 'bg-amber-50/80 border-amber-500 shadow-xs ring-1 ring-amber-500/40'
                        : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="mt-1 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="font-bold text-xs text-stone-900">
                            {isSingleCategory 
                              ? `Sostituisci solo ${parseResult.categoryLabel}` 
                              : 'Sostituisci tutte le letture'}
                          </span>
                          <span className="px-1.5 py-0.5 bg-amber-600 text-white font-bold text-[9px] uppercase tracking-wider rounded-md">
                            {isSingleCategory ? 'Sovrascrivi Categoria' : 'Sovrascrittura'}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-600 block leading-snug">
                          {isSingleCategory ? (
                            <>
                              Cancella solo le vecchie registrazioni di <strong>{parseResult.categoryLabel}</strong> nel database. Tutti gli altri dati ({otherCats}) rimarranno intatti.
                            </>
                          ) : (
                            'Cancella tutte le vecchie misurazioni memorizzate e salva solo quelle nuove.'
                          )}
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Overwrite Warning Banner */}
                  {importMode === 'replace' && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-900 animate-fadeIn">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="leading-snug text-[11px]">
                        {isSingleCategory ? (
                          <>
                            <strong>Sovrascrittura Selettiva della Categoria:</strong> Verranno cancellate e rimpiazzate SOLO le letture di <strong>{parseResult.categoryLabel}</strong>. Tutte le tue altre misurazioni salvate ({otherCats}) rimarranno <strong>invariate e protette</strong>.
                          </>
                        ) : (
                          <>
                            <strong>Avviso di sicurezza:</strong> Cliccando su <em>"Salva"</em> ti verrà richiesta una conferma prima di cancellare le letture attuali e sostituirle con quelle del file.
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Table Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-stone-700">
                      Anteprima Dati ({parseResult.validRows.length} righe)
                    </h3>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-xs text-stone-500 hover:text-red-600 font-semibold flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cambia File</span>
                    </button>
                  </div>

                  <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs max-h-72 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-100 border-b border-stone-200 text-stone-600 font-bold sticky top-0">
                        <tr>
                          <th className="p-2.5">Data & Ora</th>
                          <th className="p-2.5">Tipo</th>
                          <th className="p-2.5 text-right">Valore</th>
                          <th className="p-2.5">Timing Pasto</th>
                          <th className="p-2.5">Categoria Assegnata</th>
                          <th className="p-2.5">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {parseResult.validRows.map((row) => (
                          <tr key={row.id} className="hover:bg-stone-50/80 transition-colors">
                            <td className="p-2.5 font-mono text-stone-800 whitespace-nowrap">
                              <span className="font-bold">{row.date}</span>
                              <span className="text-stone-500 ml-1.5">{row.time}</span>
                            </td>
                            <td className="p-2.5 text-stone-700 whitespace-nowrap">
                              {row.subTypeName}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap">
                              <span className="text-base text-[#1d8998]">{row.value}</span>
                              <span className="text-[10px] text-stone-500 ml-1">{row.unit}</span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              {row.mealTiming === 'pre' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                                  <WholeAppleIcon className="w-3.5 h-3.5 text-amber-900" />
                                  <span>Pre pasto</span>
                                </span>
                              )}
                              {row.mealTiming === 'post' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold">
                                  <AppleCoreIcon className="w-3.5 h-3.5 text-emerald-900" />
                                  <span>Post pasto</span>
                                </span>
                              )}
                              {!row.mealTiming && <span className="text-stone-400">-</span>}
                            </td>
                            <td className="p-2.5 text-stone-700 whitespace-nowrap font-medium">
                              <span className="px-2 py-0.5 bg-stone-100 rounded text-[11px] text-stone-700 border border-stone-200">
                                {row.categoryName}
                              </span>
                            </td>
                            <td className="p-2.5 text-stone-600 max-w-xs truncate italic">
                              {row.note || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            );
          })()}

        </div>

        {/* Modal Footer Actions */}
        <div className="bg-stone-100 border-t border-stone-200 px-5 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-200 transition-colors"
          >
            Annulla
          </button>

          {parseResult && parseResult.validRows.length > 0 && (() => {
            const isSingleCategory = parseResult.targetSubTypes && parseResult.targetSubTypes.length > 0 && parseResult.targetSubTypes.length <= 2;
            const catLabel = parseResult.categoryLabel || 'Misurazioni';

            return (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmImport}
                className={`px-6 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer ${
                  importMode === 'replace'
                    ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white'
                    : 'bg-[#5cb85c] hover:bg-[#4cae4c] active:bg-[#449d44] disabled:opacity-50 text-white'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  {isProcessing 
                    ? 'Salvataggio in corso...' 
                    : importMode === 'replace'
                      ? (isSingleCategory 
                          ? `Sostituisci solo ${parseResult.validRows.length} Letture (${catLabel})` 
                          : `Sovrascrivi con ${parseResult.validRows.length} Letture`)
                      : `Aggiungi ${parseResult.validRows.length} Letture (${catLabel})`}
                </span>
              </button>
            );
          })()}
        </div>

      </div>

      {/* OVERWRITE CONFIRMATION MODAL */}
      {showOverwriteConfirm && parseResult && (() => {
        const isSingleCategory = parseResult.targetSubTypes && parseResult.targetSubTypes.length > 0 && parseResult.targetSubTypes.length <= 2;
        const catLabel = parseResult.categoryLabel || 'Misurazioni';
        const otherCats = getOtherCategoriesHint(catLabel);

        return (
          <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-400 max-w-md w-full p-5 space-y-4 animate-scaleIn text-stone-900">
              
              {/* Header Alert */}
              <div className="flex items-start space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-stone-900 leading-tight">
                    {isSingleCategory 
                      ? `Sostituire solo le letture di "${catLabel}"?` 
                      : 'Confermi la sovrascrittura di tutte le letture?'}
                  </h3>
                  <p className="text-xs text-amber-800 font-medium">
                    {isSingleCategory 
                      ? `Verranno eliminate SOLO le misurazioni di ${catLabel}` 
                      : 'Questa azione eliminerà le misurazioni attuali'}
                  </p>
                </div>
              </div>

              {/* Explanatory Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-2.5 leading-relaxed">
                {isSingleCategory ? (
                  <>
                    <p>
                      Hai selezionato la <strong>sovrascrittura selettiva</strong> per la categoria <strong>"{catLabel}"</strong>.
                    </p>
                    <p>
                      Dal database verranno eliminate <strong>esclusivamente le precedenti registrazioni di {catLabel}</strong> e sostituite con le <strong className="underline decoration-amber-600 font-bold">{parseResult.validRows.length} misurazioni</strong> presenti in questo file CSV.
                    </p>
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-emerald-950 font-medium text-[11px] flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Dati protetti:</strong> Tutte le altre registrazioni ({otherCats}) <strong>rimarranno intatte</strong> nel database.
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Hai selezionato l'opzione <strong>"Sostituisci tutte le letture"</strong>.
                    </p>
                    <p>
                      Tutte le letture attualmente salvate nel database verranno <strong>cancellate</strong> e sostituite esclusivamente con le <strong className="underline decoration-amber-600">{parseResult.validRows.length} misurazioni</strong> presenti nel file CSV.
                    </p>
                  </>
                )}
                <div className="pt-1 text-[11px] text-stone-600 flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>Se preferisci non eliminare alcuna lettura esistente, scegli <em>"Passa ad Aggiungi"</em>.</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => executeImport('replace')}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {isSingleCategory 
                      ? `Sì, Sostituisci solo i dati di ${catLabel}` 
                      : 'Sì, Sovrascrivi ed Elimina Vecchie Letture'}
                  </span>
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('append');
                      setShowOverwriteConfirm(false);
                    }}
                    className="flex-1 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-teal-700" />
                    <span>Passa ad "Aggiungi"</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowOverwriteConfirm(false)}
                    className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Annulla
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};
