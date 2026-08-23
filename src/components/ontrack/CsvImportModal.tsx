import React, { useState, useRef } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { WholeAppleIcon, AppleCoreIcon } from './AppleIcons';
import { HealthCategory, HealthSubType, LogEntryItem, SavedFastingRecord, MedicationItem } from '../../types/ontrack';
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
  Download,
  Flame,
  Pill,
  Timer,
  X
} from 'lucide-react';
import { 
  downloadGlucoseCsvTemplate, 
  downloadPressureCsvTemplate, 
  downloadWeightCsvTemplate, 
  downloadNutritionCsvTemplate, 
  downloadMedicationCsvTemplate, 
  downloadFastingCsvTemplate,
  saveSavedFastings,
  loadSavedFastings,
  saveMedications,
  loadMedications
} from '../../utils/ontrackStorage';

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
2026-03-09,12:00,Peso,100.6,Abbastanza buono`;

const SAMPLE_NUTRITION_CSV = `Data,Ora,Tipo,Alimenti (Cal),% GDA,Grassi (g),Proteine (g),Carboidrati (g),Esercizio (Cal),Netto (Cal),Note
2026-08-16,12:00,Alimenti,421,23,18.48,27.56,37.25,-,-,Pranzo equilibrato
2026-08-15,12:00,Alimenti,471,26,24.26,25.68,37.84,-,-,Cena proteica
2026-08-14,12:00,Alimenti,545,30,13.38,20.00,89.80,-,-,Cena leggera`;

const SAMPLE_MEDICATIONS_CSV = `Nome Farmaco,Dosaggio,Orario / Frequenza,Istruzioni,Attivo (Si/No)
Metformina,500 mg,Pranzo e Cena,Durante i pasti a stomaco pieno,Sì
Cardioaspirina,100 mg,Pranzo,A stomaco pieno con abbondante acqua,Sì
Omega 3,1000 mg,Colazione,Durante la colazione,Sì
Januvia (Sitagliptin),100 mg,Mattina,Una volta al giorno al risveglio,Sì
Vitamina D3,2000 UI,Mattina,Dopo colazione,Sì`;

const SAMPLE_FASTING_CSV = `Data,Inizio,Fine (Rottura),Durata (Ore),Piano,Stadio Metabolico,Glicemia Inizio,Glicemia Fine,Note / Dettagli
2026-08-15,20:30,13:00,16.5,16:8,Chetosi (16-22h),128,84,Rottura digiuno con insalata di pollo e noci. Ottima energia!
2026-08-14,20:00,10:30,14.5,14:10,Lipolisi (12-16h),132,88,Piano 14:10 (Normale) completato con facilità.
2026-08-13,20:00,14:30,18.5,18:6,Chetosi (16-22h),138,82,Piano 18:6 completato. Glicemia stabile.
2026-08-12,19:30,16:00,20.5,20:4,Autofagia (22h+),140,78,Mercoledì: Digiuno 20:4 del Guerriero, chetosi avanzata.
2026-08-11,20:00,12:00,16.0,16:8,Chetosi (16-22h),125,86,Pranzo leggero con verdure grigliate.
2026-08-10,20:30,10:30,14.0,14:10,Lipolisi (12-16h),134,89,Inizio settimana 14:10, idratazione costante.`;

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

  const handleLoadPreset = (type: 'glucose' | 'pressure' | 'weight' | 'nutrition' | 'medication' | 'fasting') => {
    if (type === 'glucose') handleParse(SAMPLE_GLUCOSE_CSV, 'Esempio_Glicemie_Ago2026.csv');
    else if (type === 'pressure') handleParse(SAMPLE_PRESSURE_CSV, 'Esempio_Pressione_Ago2026.csv');
    else if (type === 'weight') handleParse(SAMPLE_WEIGHT_CSV, 'Esempio_Peso_Ago2026.csv');
    else if (type === 'nutrition') handleParse(SAMPLE_NUTRITION_CSV, 'Esempio_Riepilogo_Nutrizionale.csv');
    else if (type === 'medication') handleParse(SAMPLE_MEDICATIONS_CSV, 'Esempio_Farmaci_Terapie.csv');
    else if (type === 'fasting') handleParse(SAMPLE_FASTING_CSV, 'Esempio_Digiuno_Intermittente.csv');
  };

  const getOtherCategoriesHint = (categoryLabel: string): string => {
    const cl = (categoryLabel || '').toLowerCase();
    if (cl.includes('glicem')) return 'Pressione, Peso, Nutrizione, Farmaci, Digiuno';
    if (cl.includes('press')) return 'Glicemia, Peso, Nutrizione, Farmaci, Digiuno';
    if (cl.includes('peso')) return 'Glicemia, Pressione, Nutrizione, Farmaci, Digiuno';
    if (cl.includes('nutri') || cl.includes('aliment') || cl.includes('cibo')) return 'Glicemia, Pressione, Peso, Farmaci, Digiuno';
    if (cl.includes('farmac') || cl.includes('terapi') || cl.includes('med')) return 'Glicemia, Pressione, Peso, Nutrizione, Digiuno';
    if (cl.includes('digiun') || cl.includes('fasting')) return 'Glicemia, Pressione, Peso, Nutrizione, Farmaci';
    return 'altre categorie';
  };

  const getCategoryBadgeStyle = (detectedFormat?: string, categoryLabel?: string) => {
    const cat = (categoryLabel || '').toLowerCase();
    if (detectedFormat === 'fasting' || cat.includes('digiun') || cat.includes('fasting')) {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        badgeBg: 'bg-orange-600',
        text: 'text-orange-900',
        subText: 'text-orange-700',
        iconEmoji: '⏱️',
        label: 'Digiuno Intermittente'
      };
    }
    if (detectedFormat === 'medication' || cat.includes('farmac') || cat.includes('terapi') || cat.includes('med')) {
      return {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        badgeBg: 'bg-indigo-600',
        text: 'text-indigo-900',
        subText: 'text-indigo-700',
        iconEmoji: '💊',
        label: 'Farmaci / Terapie'
      };
    }
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
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        badgeBg: 'bg-purple-600',
        text: 'text-purple-900',
        subText: 'text-purple-700',
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

    // Se stiamo importando sessioni di digiuno, sincronizziamo con savedFastings di ontrackStorage
    if (parseResult.detectedFormat === 'fasting' || (targetSubTypes && targetSubTypes.includes('sub_fasting'))) {
      try {
        const newFastings: SavedFastingRecord[] = parseResult.validRows.map((r, idx) => {
          const dur = parseFloat(r.value || '16') || 16;
          return {
            id: `fast_rec_${r.date}_${r.time}_${idx}`,
            startDate: r.fastingStartDate || r.date,
            startTime: r.fastingStartTime || '20:00',
            endDate: r.fastingEndDate || r.date,
            endTime: r.fastingEndTime || r.time || '12:00',
            durationHours: dur,
            targetHours: r.fastingTargetHours || 16,
            protocol: r.fastingProtocol || '16:8',
            startingGlucose: r.fastingStartGlucose !== undefined ? Number(r.fastingStartGlucose) : undefined,
            endingGlucose: r.fastingEndGlucose !== undefined ? Number(r.fastingEndGlucose) : undefined,
            note: r.note || 'Importato da tracciato CSV',
            isCompleted: dur >= 12
          };
        });

        if (modeToUse === 'replace') {
          saveSavedFastings(newFastings);
        } else {
          const current = loadSavedFastings();
          const merged = [...newFastings, ...current.filter(c => !newFastings.some(n => n.startDate === c.startDate && n.startTime === c.startTime))];
          saveSavedFastings(merged);
        }
      } catch (err) {
        console.error('Error syncing imported fastings:', err);
      }
    }

    // Se stiamo importando un catalogo farmaci, sincronizziamo con medications di ontrackStorage
    if (parseResult.detectedFormat === 'medication' || (targetSubTypes && targetSubTypes.includes('sub_medication'))) {
      try {
        const medRows = parseResult.validRows.filter(r => r.medicationName);
        if (medRows.length > 0) {
          const newMeds: MedicationItem[] = medRows.map((r, idx) => ({
            id: `med_imported_${idx}_${Date.now()}`,
            name: r.medicationName || 'Farmaco',
            dosage: r.medicationDosage || r.value || '1 dose',
            schedule: r.medicationSchedule || 'Mattina',
            instructions: r.medicationInstructions || r.note || '',
            active: r.medicationActive !== undefined ? r.medicationActive : true
          }));

          if (modeToUse === 'replace') {
            saveMedications(newMeds);
          } else {
            const current = loadMedications();
            const merged = [...current];
            newMeds.forEach(nm => {
              if (!merged.some(m => m.name.toLowerCase() === nm.name.toLowerCase())) {
                merged.push(nm);
              }
            });
            saveMedications(merged);
          }
        }
      } catch (err) {
        console.error('Error syncing imported medications:', err);
      }
    }

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
                Supporta Glicemie, Pressione, Peso, Nutrizione, Farmaci/Terapie e Digiuno Intermittente
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

              {/* Official CSV Template Downloader Section */}
              <div className="bg-gradient-to-r from-teal-50/70 via-blue-50/50 to-orange-50/70 border border-teal-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Download className="w-4 h-4 text-teal-700 shrink-0" />
                    <span className="text-xs font-bold text-stone-800">
                      Scarica Tracciati e Modelli CSV Precompilati:
                    </span>
                  </div>
                  <span className="text-[10px] text-teal-700 font-semibold bg-white/80 px-2 py-0.5 rounded-full border border-teal-200">
                    Compatibili al 100%
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={downloadGlucoseCsvTemplate}
                    className="p-2 bg-white hover:bg-teal-50 border border-stone-200 hover:border-teal-400 rounded-xl text-left transition-all group shadow-2xs flex flex-col justify-between"
                  >
                    <div className="text-[11px] font-bold text-teal-800 group-hover:text-teal-900 flex items-center space-x-1">
                      <span>🩸</span>
                      <span className="truncate">Glicemie</span>
                    </div>
                    <div className="text-[9px] text-stone-500 mt-1 flex items-center text-teal-600 font-semibold">
                      <Download className="w-2.5 h-2.5 mr-0.5" /> .csv
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={downloadPressureCsvTemplate}
                    className="p-2 bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-400 rounded-xl text-left transition-all group shadow-2xs flex flex-col justify-between"
                  >
                    <div className="text-[11px] font-bold text-rose-800 group-hover:text-rose-900 flex items-center space-x-1">
                      <span>❤️</span>
                      <span className="truncate">Pressione</span>
                    </div>
                    <div className="text-[9px] text-stone-500 mt-1 flex items-center text-rose-600 font-semibold">
                      <Download className="w-2.5 h-2.5 mr-0.5" /> .csv
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={downloadWeightCsvTemplate}
                    className="p-2 bg-white hover:bg-purple-50 border border-stone-200 hover:border-purple-400 rounded-xl text-left transition-all group shadow-2xs flex flex-col justify-between"
                  >
                    <div className="text-[11px] font-bold text-purple-800 group-hover:text-purple-900 flex items-center space-x-1">
                      <span>⚖️</span>
                      <span className="truncate">Peso</span>
                    </div>
                    <div className="text-[9px] text-stone-500 mt-1 flex items-center text-purple-600 font-semibold">
                      <Download className="w-2.5 h-2.5 mr-0.5" /> .csv
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={downloadNutritionCsvTemplate}
                    className="p-2 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-400 rounded-xl text-left transition-all group shadow-2xs flex flex-col justify-between"
                  >
                    <div className="text-[11px] font-bold text-amber-800 group-hover:text-amber-900 flex items-center space-x-1">
                      <span>🥗</span>
                      <span className="truncate">Nutrizione</span>
                    </div>
                    <div className="text-[9px] text-stone-500 mt-1 flex items-center text-amber-600 font-semibold">
                      <Download className="w-2.5 h-2.5 mr-0.5" /> .csv
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={downloadMedicationCsvTemplate}
                    className="p-2 bg-white hover:bg-indigo-50 border border-stone-200 hover:border-indigo-400 rounded-xl text-left transition-all group shadow-2xs flex flex-col justify-between"
                  >
                    <div className="text-[11px] font-bold text-indigo-800 group-hover:text-indigo-900 flex items-center space-x-1">
                      <span>💊</span>
                      <span className="truncate">Farmaci</span>
                    </div>
                    <div className="text-[9px] text-stone-500 mt-1 flex items-center text-indigo-600 font-semibold">
                      <Download className="w-2.5 h-2.5 mr-0.5" /> .csv
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={downloadFastingCsvTemplate}
                    className="p-2 bg-white hover:bg-orange-50 border border-stone-200 hover:border-orange-400 rounded-xl text-left transition-all group shadow-2xs flex flex-col justify-between"
                  >
                    <div className="text-[11px] font-bold text-orange-800 group-hover:text-orange-900 flex items-center space-x-1">
                      <span>⏱️</span>
                      <span className="truncate">Digiuno</span>
                    </div>
                    <div className="text-[9px] text-stone-500 mt-1 flex items-center text-orange-600 font-semibold">
                      <Download className="w-2.5 h-2.5 mr-0.5" /> .csv
                    </div>
                  </button>
                </div>
              </div>

              {/* Sample Data Fast Test Buttons */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-stone-600 shrink-0" />
                  <span className="text-xs font-bold text-stone-800">
                    Formati di esempio pronti per il test:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadPreset('glucose')}
                    className="p-2 bg-white hover:bg-teal-50 border border-stone-200 hover:border-teal-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-teal-800 group-hover:text-teal-900">🩸 Glicemie</div>
                    <div className="text-[9px] text-stone-500">7 letture Pre/Post</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPreset('pressure')}
                    className="p-2 bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-rose-800 group-hover:text-rose-900">❤️ Pressione</div>
                    <div className="text-[9px] text-stone-500">Sistolica / Battiti</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPreset('weight')}
                    className="p-2 bg-white hover:bg-purple-50 border border-stone-200 hover:border-purple-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-purple-800 group-hover:text-purple-900">⚖️ Peso</div>
                    <div className="text-[9px] text-stone-500">Trend storico (kg)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPreset('nutrition')}
                    className="p-2 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-amber-800 group-hover:text-amber-900">🥗 Nutrizione</div>
                    <div className="text-[9px] text-stone-500">Calorie, Macro</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPreset('medication')}
                    className="p-2 bg-white hover:bg-indigo-50 border border-stone-200 hover:border-indigo-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-indigo-800 group-hover:text-indigo-900">💊 Farmaci</div>
                    <div className="text-[9px] text-stone-500">Dosi e orari</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadPreset('fasting')}
                    className="p-2 bg-white hover:bg-orange-50 border border-stone-200 hover:border-orange-400 rounded-lg text-left transition-all group"
                  >
                    <div className="text-[11px] font-bold text-orange-800 group-hover:text-orange-900">⏱️ Digiuno</div>
                    <div className="text-[9px] text-stone-500">16:8, chetosi</div>
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
                        {parseResult.detectedFormat === 'fasting' ? (
                          <tr>
                            <th className="p-2.5">Data & Orario</th>
                            <th className="p-2.5">Protocollo</th>
                            <th className="p-2.5 text-right">Durata (Ore)</th>
                            <th className="p-2.5">Rottura (Fine)</th>
                            <th className="p-2.5 text-center">Glicemia Inizio/Fine</th>
                            <th className="p-2.5">Note / Dettagli</th>
                          </tr>
                        ) : parseResult.detectedFormat === 'medication' ? (
                          <tr>
                            <th className="p-2.5">Nome Farmaco</th>
                            <th className="p-2.5">Dosaggio</th>
                            <th className="p-2.5">Orario / Frequenza</th>
                            <th className="p-2.5">Istruzioni</th>
                            <th className="p-2.5 text-center">Stato</th>
                            <th className="p-2.5">Categoria</th>
                          </tr>
                        ) : parseResult.detectedFormat === 'pressure' ? (
                          <tr>
                            <th className="p-2.5">Data & Ora</th>
                            <th className="p-2.5 text-right">Sistolica / Diastolica</th>
                            <th className="p-2.5 text-center">Battiti (bpm)</th>
                            <th className="p-2.5">Timing Pasto</th>
                            <th className="p-2.5">Categoria</th>
                            <th className="p-2.5">Note</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="p-2.5">Data & Ora</th>
                            <th className="p-2.5">Tipo</th>
                            <th className="p-2.5 text-right">Valore</th>
                            <th className="p-2.5">Timing Pasto</th>
                            <th className="p-2.5">Categoria Assegnata</th>
                            <th className="p-2.5">Note</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {parseResult.validRows.map((row) => (
                          <tr key={row.id} className="hover:bg-stone-50/80 transition-colors">
                            {parseResult.detectedFormat === 'fasting' ? (
                              <>
                                <td className="p-2.5 font-mono text-stone-800 whitespace-nowrap">
                                  <span className="font-bold">{row.date}</span>
                                  <span className="text-orange-600 font-semibold ml-1.5">{row.fastingStartTime || row.time}</span>
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 font-bold border border-orange-200">
                                    {row.fastingProtocol || '16:8'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap text-orange-700">
                                  <span className="text-base">{row.value}</span>
                                  <span className="text-[10px] text-stone-500 ml-1">ore</span>
                                </td>
                                <td className="p-2.5 font-mono text-stone-700 whitespace-nowrap">
                                  {row.fastingEndTime || '-'}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap font-mono text-xs">
                                  {row.fastingStartGlucose || row.fastingEndGlucose ? (
                                    <span className="px-2 py-0.5 bg-teal-50 text-teal-900 rounded border border-teal-200">
                                      {row.fastingStartGlucose ?? '-'} → {row.fastingEndGlucose ?? '-'} mg/dL
                                    </span>
                                  ) : (
                                    <span className="text-stone-400">-</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-stone-600 max-w-xs truncate italic">
                                  {row.note || '-'}
                                </td>
                              </>
                            ) : parseResult.detectedFormat === 'medication' ? (
                              <>
                                <td className="p-2.5 font-bold text-stone-900 whitespace-nowrap flex items-center space-x-1.5">
                                  <span className="text-indigo-600">💊</span>
                                  <span>{row.medicationName || row.subTypeName}</span>
                                </td>
                                <td className="p-2.5 font-mono font-bold text-indigo-700 whitespace-nowrap">
                                  {row.medicationDosage || row.value} {row.unit}
                                </td>
                                <td className="p-2.5 text-stone-700 whitespace-nowrap">
                                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-900 font-medium">
                                    {row.medicationSchedule || row.categoryName}
                                  </span>
                                </td>
                                <td className="p-2.5 text-stone-600 max-w-xs truncate italic">
                                  {row.medicationInstructions || row.note || '-'}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    row.medicationActive !== false 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-stone-100 text-stone-500'
                                  }`}>
                                    {row.medicationActive !== false ? 'Attivo' : 'Sospeso'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-stone-700 whitespace-nowrap font-medium">
                                  <span className="px-2 py-0.5 bg-stone-100 rounded text-[11px] text-stone-700 border border-stone-200">
                                    {row.categoryName}
                                  </span>
                                </td>
                              </>
                            ) : parseResult.detectedFormat === 'pressure' ? (
                              <>
                                <td className="p-2.5 font-mono text-stone-800 whitespace-nowrap">
                                  <span className="font-bold">{row.date}</span>
                                  <span className="text-stone-500 ml-1.5">{row.time}</span>
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap text-rose-700">
                                  <span className="text-base">{row.systolic || row.value}</span>
                                  <span className="text-stone-400 mx-0.5">/</span>
                                  <span className="text-base">{row.diastolic || '-'}</span>
                                  <span className="text-[10px] text-stone-500 ml-1">mmHg</span>
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-rose-600 whitespace-nowrap">
                                  {row.pulse ? `${row.pulse} bpm` : '-'}
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
                              </>
                            ) : (
                              <>
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
                              </>
                            )}
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
