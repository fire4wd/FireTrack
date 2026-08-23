import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  FileCode,
  Share2,
  CheckCircle2,
  AlertCircle,
  Pill,
  Copy,
  Check,
  HelpCircle,
  Trash2,
  Plus
} from 'lucide-react';
import { MedicationItem } from '../../types/ontrack';
import {
  downloadMedicationsCSV,
  downloadMedicationsJSON,
  downloadMedicationCsvTemplate,
  parseMedicationsCSV,
  parseMedicationsJSON,
  saveMedications
} from '../../utils/ontrackStorage';

interface MedicationsImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  medications: MedicationItem[];
  onUpdateMedications: (updated: MedicationItem[]) => void;
  patientName?: string;
}

export const MedicationsImportExportModal: React.FC<MedicationsImportExportModalProps> = ({
  isOpen,
  onClose,
  medications,
  onUpdateMedications,
  patientName = 'Utente'
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [importMergeStrategy, setImportMergeStrategy] = useState<'append' | 'replace'>('append');
  const [parsedPreview, setParsedPreview] = useState<MedicationItem[] | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportCSV = async () => {
    setIsProcessing(true);
    setStatusFeedback(null);
    try {
      const res = await downloadMedicationsCSV(medications, patientName);
      if (res.success) {
        setStatusFeedback({ type: 'success', message: res.message });
      } else {
        setStatusFeedback({ type: 'error', message: res.message });
      }
    } catch (e: any) {
      setStatusFeedback({ type: 'error', message: e?.message || 'Errore durante l\'esportazione CSV' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportJSON = async () => {
    setIsProcessing(true);
    setStatusFeedback(null);
    try {
      const res = await downloadMedicationsJSON(medications, patientName);
      if (res.success) {
        setStatusFeedback({ type: 'success', message: res.message });
      } else {
        setStatusFeedback({ type: 'error', message: res.message });
      }
    } catch (e: any) {
      setStatusFeedback({ type: 'error', message: e?.message || 'Errore durante l\'esportazione JSON' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setStatusFeedback({ type: 'error', message: 'Il file selezionato è vuoto.' });
        return;
      }
      processImportText(text, file.name);
    };
    reader.onerror = () => {
      setStatusFeedback({ type: 'error', message: 'Impossibile leggere il file selezionato.' });
    };
    reader.readAsText(file);
    // Reset file input value so same file can be selected again if needed
    e.target.value = '';
  };

  const processImportText = (text: string, sourceName: string = 'Testo') => {
    setStatusFeedback(null);
    const trimmed = text.trim();
    let result: { items: MedicationItem[]; count: number } = { items: [], count: 0 };

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      result = parseMedicationsJSON(trimmed);
    } else {
      result = parseMedicationsCSV(trimmed);
    }

    if (result.count === 0) {
      setStatusFeedback({
        type: 'error',
        message: 'Nessun farmaco valido riconosciuto nel file o testo inserito. Verifica il formato.'
      });
      setParsedPreview(null);
      return;
    }

    setParsedPreview(result.items);
    setStatusFeedback({
      type: 'success',
      message: `Riconosciuti ${result.count} farmaci da "${sourceName}". Controlla l'anteprima e conferma l'importazione.`
    });
  };

  const handleApplyImport = () => {
    if (!parsedPreview || parsedPreview.length === 0) return;

    let finalMedications: MedicationItem[] = [];

    if (importMergeStrategy === 'replace') {
      finalMedications = parsedPreview;
    } else {
      // Merge: append new ones, or update existing with matching name
      const existingMap = new Map<string, MedicationItem>();
      medications.forEach(m => existingMap.set(m.name.toLowerCase().trim(), { ...m }));

      parsedPreview.forEach(p => {
        const key = p.name.toLowerCase().trim();
        if (existingMap.has(key)) {
          // Update existing
          const existing = existingMap.get(key)!;
          existingMap.set(key, {
            ...existing,
            dosage: p.dosage || existing.dosage,
            schedule: p.schedule || existing.schedule,
            instructions: p.instructions || existing.instructions,
            active: p.active !== undefined ? p.active : existing.active
          });
        } else {
          // Add new
          existingMap.set(key, p);
        }
      });

      finalMedications = Array.from(existingMap.values());
    }

    saveMedications(finalMedications);
    onUpdateMedications(finalMedications);

    setStatusFeedback({
      type: 'success',
      message: `Importazione completata con successo! ${finalMedications.length} farmaci ora registrati.`
    });
    setParsedPreview(null);
    setPastedText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white dark:bg-[#1a1d24] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden text-stone-900 dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#3b7080]/15 text-[#3b7080] dark:text-[#5aa1b5]">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                Importa / Esporta Farmaci
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {medications.length} farmaci registrati attualmente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-200/50 dark:hover:bg-stone-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-900/40 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('export');
              setStatusFeedback(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'export'
                ? 'bg-white dark:bg-stone-800 text-[#3b7080] dark:text-[#5aa1b5] shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Esporta Farmaci</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setStatusFeedback(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'import'
                ? 'bg-white dark:bg-stone-800 text-[#3b7080] dark:text-[#5aa1b5] shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Importa Farmaci</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {statusFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start space-x-2.5 border ${
                statusFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              {statusFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusFeedback.message}</span>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 1: EXPORT                                                   */}
          {/* =============================================================== */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                Esporta la lista completa dei tuoi farmaci, posologie, fasce orarie ed istruzioni in formato <strong>CSV</strong> (apribile in Excel, Numbers, Fogli Google) oppure in <strong>JSON</strong> per conservare un backup ripristinabile.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* CSV Export Card */}
                <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-stone-800 dark:text-stone-100 font-bold text-sm">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Formato Tabellare CSV</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Compatibile con Excel con separatore punto e virgola e intestazioni in italiano.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessing || medications.length === 0}
                    onClick={handleExportCSV}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Scarica CSV Farmaci</span>
                  </button>
                </div>

                {/* JSON Export Card */}
                <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-stone-800 dark:text-stone-100 font-bold text-sm">
                      <FileCode className="w-4 h-4 text-[#3b7080]" />
                      <span>Backup JSON Strutturato</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Formato completo standard ideale per trasferire i dati tra dispositivi o fare backup.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessing || medications.length === 0}
                    onClick={handleExportJSON}
                    className="w-full py-2.5 bg-[#3b7080] hover:bg-[#2e5865] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Scarica JSON Farmaci</span>
                  </button>
                </div>
              </div>

              {/* Template Download Option */}
              <div className="pt-2 flex items-center justify-between border-t border-stone-100 dark:border-stone-800 text-xs">
                <span className="text-stone-500 dark:text-stone-400">
                  Vuoi preparare una lista farmaci da importare?
                </span>
                <button
                  type="button"
                  onClick={downloadMedicationCsvTemplate}
                  className="font-bold text-[#3b7080] dark:text-[#5aa1b5] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Scarica Template CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: IMPORT                                                   */}
          {/* =============================================================== */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Import method selector */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('file');
                    setParsedPreview(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    importMode === 'file'
                      ? 'bg-[#3b7080] text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  📁 Carica File (.csv / .json)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('text');
                    setParsedPreview(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    importMode === 'text'
                      ? 'bg-[#3b7080] text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  📝 Incolla Testo
                </button>
              </div>

              {/* Mode: File Upload */}
              {importMode === 'file' && (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv,.json,text/csv,application/json,text/plain"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-[#3b7080] dark:hover:border-[#5aa1b5] p-6 rounded-2xl text-center bg-stone-50 dark:bg-stone-800/30 transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#3b7080]/15 group-hover:bg-[#3b7080]/25 flex items-center justify-center text-[#3b7080] transition-colors">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Clicca per selezionare un file CSV o JSON
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Supporta file .csv (esportati o compilati) e file .json di backup
                    </p>
                  </div>
                </div>
              )}

              {/* Mode: Paste Text */}
              {importMode === 'text' && (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Incolla qui il contenuto del file CSV o JSON dei farmaci...&#10;Esempio CSV:&#10;Nome Farmaco;Dosaggio;Orario / Frequenza;Istruzioni;Attivo&#10;Metformina;500 mg;Colazione, Cena;A stomaco pieno;Sì"
                    className="w-full p-3 text-xs font-mono rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#3b7080]"
                  />
                  <button
                    type="button"
                    disabled={!pastedText.trim()}
                    onClick={() => processImportText(pastedText, 'Testo Incollato')}
                    className="px-4 py-2 bg-[#3b7080] hover:bg-[#2e5865] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Analizza Testo
                  </button>
                </div>
              )}

              {/* PREVIEW & COMMIT SECTION */}
              {parsedPreview && parsedPreview.length > 0 && (
                <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span>Anteprima: {parsedPreview.length} farmaci pronti all'importazione</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setParsedPreview(null)}
                      className="text-[10px] text-stone-400 hover:text-stone-600"
                    >
                      Annulla
                    </button>
                  </div>

                  {/* List preview */}
                  <div className="max-h-40 overflow-y-auto divide-y divide-teal-100 dark:divide-teal-900/60 bg-white dark:bg-stone-900 rounded-lg border border-teal-100 dark:border-teal-900 p-2 text-xs">
                    {parsedPreview.map((med, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <strong className="text-stone-800 dark:text-stone-100">{med.name}</strong>
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-[10px] font-semibold text-[#3b7080]">
                            {med.dosage || 'Dose non spec.'}
                          </span>
                          {med.schedule && (
                            <span className="text-[10px] text-stone-400 block truncate">
                              ⏰ {med.schedule}
                            </span>
                          )}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${med.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                          {med.active !== false ? 'Attivo' : 'Disattivato'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Strategy Choice */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 block">
                      Modalità di importazione:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center space-x-2 ${
                          importMergeStrategy === 'append'
                            ? 'bg-[#3b7080]/10 border-[#3b7080] font-bold text-stone-900 dark:text-stone-100'
                            : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="mergeStrategy"
                          checked={importMergeStrategy === 'append'}
                          onChange={() => setImportMergeStrategy('append')}
                          className="text-[#3b7080] focus:ring-[#3b7080]"
                        />
                        <span>Unisci / Aggiungi ai farmaci esistenti</span>
                      </label>

                      <label
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center space-x-2 ${
                          importMergeStrategy === 'replace'
                            ? 'bg-amber-500/10 border-amber-500 font-bold text-amber-900 dark:text-amber-200'
                            : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="mergeStrategy"
                          checked={importMergeStrategy === 'replace'}
                          onChange={() => setImportMergeStrategy('replace')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Sostituisci tutti i farmaci esistenti</span>
                      </label>
                    </div>
                  </div>

                  {/* Commit Button */}
                  <button
                    type="button"
                    onClick={handleApplyImport}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer mt-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Conferma Importazione ({parsedPreview.length} Farmaci)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-stone-50 dark:bg-stone-800/60 border-t border-stone-200 dark:border-stone-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
