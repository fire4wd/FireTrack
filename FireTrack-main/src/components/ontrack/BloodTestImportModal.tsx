import React, { useState, useRef } from 'react';
import { BloodTestParameter, BloodTestRecord } from '../../types/ontrack';
import { evaluateBloodParam, downloadBloodTestCsvTemplate, formatParamRangeLabel } from '../../utils/ontrackStorage';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  AlertTriangle,
  Check, 
  ArrowRight, 
  CheckCircle2,
  RefreshCw,
  Info,
  Trash2,
  PlusCircle
} from 'lucide-react';

interface BloodTestImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (records: BloodTestRecord[], mode: 'merge' | 'replace') => void;
  parameters: BloodTestParameter[];
}

export const BloodTestImportModal: React.FC<BloodTestImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  parameters
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<BloodTestRecord[]>([]);
  const [matchedHeaders, setMatchedHeaders] = useState<{ original: string; paramId: string | 'date' | 'notes' | 'ignored' }[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Clean parameter name for comparison
  const normalizeHeader = (header: string): string => {
    return header
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/<.*?>/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const parseCsvData = (text: string) => {
    try {
      setErrorMsg(null);
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        setErrorMsg('Il file deve contenere almeno una riga di intestazione e una riga di dati.');
        return;
      }

      // Detect separator (; or , or \t)
      const firstLine = lines[0];
      let separator = ';';
      if (firstLine.includes(';') && (firstLine.match(/;/g)?.length || 0) >= (firstLine.match(/,/g)?.length || 0)) {
        separator = ';';
      } else if (firstLine.includes('\t')) {
        separator = '\t';
      } else if (firstLine.includes(',')) {
        separator = ',';
      }

      // Simple CSV split taking quotes into account
      const splitCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let curr = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === separator && !insideQuotes) {
            result.push(curr.trim().replace(/^"|"$/g, ''));
            curr = '';
          } else {
            curr += char;
          }
        }
        result.push(curr.trim().replace(/^"|"$/g, ''));
        return result;
      };

      const rawHeaders = splitCsvLine(lines[0]);
      
      // Match each header to a BloodTestParameter or Date or Note
      const headerMapping = rawHeaders.map(h => {
        const norm = normalizeHeader(h);
        if (norm.includes('data') || norm.includes('date') || norm.includes('periodo') || norm.includes('mese') || norm.includes('giorno')) {
          return { original: h, paramId: 'date' as const };
        }
        if (norm.includes('note') || norm.includes('referto') || norm.includes('comment')) {
          return { original: h, paramId: 'notes' as const };
        }

        // Try exact/partial matching against configured parameters
        for (const p of parameters) {
          const pNorm = normalizeHeader(p.name);
          const pIdNorm = normalizeHeader(p.id);
          if (norm === pNorm || norm === pIdNorm || norm.startsWith(pNorm) || pNorm.startsWith(norm)) {
            return { original: h, paramId: p.id };
          }
        }

        return { original: h, paramId: 'ignored' as const };
      });

      setMatchedHeaders(headerMapping);

      const records: BloodTestRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        if (cols.length === 0 || cols.every(c => !c.trim())) continue;

        let rowDate = '';
        let rowNotes = '';
        const rowValues: Record<string, number | null> = {};

        cols.forEach((val, idx) => {
          if (idx >= headerMapping.length) return;
          const mapping = headerMapping[idx];
          const cleanVal = val.trim();

          if (mapping.paramId === 'date') {
            rowDate = cleanVal;
          } else if (mapping.paramId === 'notes') {
            rowNotes = cleanVal;
          } else if (mapping.paramId !== 'ignored' && cleanVal) {
            const num = parseFloat(cleanVal.replace(',', '.'));
            if (!isNaN(num)) {
              rowValues[mapping.paramId] = num;
            }
          }
        });

        // Fallback date if first column was date without header
        if (!rowDate && cols[0]) {
          rowDate = cols[0].trim();
        }

        if (rowDate || Object.keys(rowValues).length > 0) {
          // calculate timestamp
          let timestamp = Date.now();
          const dStr = rowDate.trim();
          if (/^\d{6}$/.test(dStr)) {
            const y = parseInt(dStr.substring(0, 4), 10);
            const m = parseInt(dStr.substring(4, 6), 10) - 1;
            timestamp = new Date(y, m, 15).getTime();
          } else if (dStr.includes('-')) {
            timestamp = new Date(dStr).getTime() || Date.now();
          } else if (dStr.includes('/')) {
            const parts = dStr.split('/');
            if (parts.length === 3) {
              timestamp = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime() || Date.now();
            }
          }

          records.push({
            id: `btest_imp_${Date.now()}_${i}`,
            date: rowDate || `Data #${i}`,
            timestamp,
            values: rowValues,
            notes: rowNotes || undefined
          });
        }
      }

      if (records.length === 0) {
        setErrorMsg('Nessun dato valido trovato nel file. Verifica il formato.');
        setParsedRows([]);
      } else {
        setParsedRows(records);
      }

    } catch (err) {
      setErrorMsg('Errore nella lettura del file CSV. Assicurati che sia un formato tabellare valido.');
      console.error('CSV parse error:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    setFile(uploaded);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      parseCsvData(content);
    };
    reader.readAsText(uploaded);
  };

  const handlePasteChange = (text: string) => {
    setRawText(text);
    if (text.trim()) {
      parseCsvData(text);
    } else {
      setParsedRows([]);
    }
  };

  const executeImport = (modeToUse: 'merge' | 'replace') => {
    if (parsedRows.length === 0) return;
    onImportComplete(parsedRows, modeToUse);
    setShowOverwriteConfirm(false);
    onClose();
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    if (importMode === 'replace') {
      setShowOverwriteConfirm(true);
      return;
    }
    executeImport('merge');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#1a1d24] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-100">
        
        {/* Header */}
        <div className="bg-[#2b3032] dark:bg-[#181c20] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#9333ea] flex items-center justify-center text-white font-bold shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Importa Esami del Sangue da File
              </h3>
              <p className="text-xs text-stone-300">
                Carica fogli Excel / CSV con colonne parametri e righe per data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Quick Info & Template Download */}
          <div className="bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-2 text-xs text-purple-900 dark:text-purple-200">
              <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Formato consigliato: </span>
                <span>Una colonna "Data" (es. 201810 o 15/10/2018) e colonne per ciascun analita (Glicemia, Creatinina, Colesterolo, ecc.).</span>
              </div>
            </div>
            <button
              onClick={() => downloadBloodTestCsvTemplate(parameters)}
              className="px-3 py-1.5 bg-white dark:bg-stone-800 hover:bg-purple-100 dark:hover:bg-purple-950 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200 text-xs font-bold rounded-lg shadow-xs flex items-center justify-center space-x-1.5 shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica Template CSV</span>
            </button>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex border-b border-stone-200 dark:border-stone-800">
            <button
              onClick={() => setActiveTab('file')}
              className={`pb-2 px-4 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'file'
                  ? 'border-[#9333ea] text-[#9333ea] dark:text-purple-400'
                  : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Carica File (.csv / .txt)
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`pb-2 px-4 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'paste'
                  ? 'border-[#9333ea] text-[#9333ea] dark:text-purple-400'
                  : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Incolla Testo / Tabella da Excel
            </button>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'file' && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-[#9333ea] dark:hover:border-purple-500 bg-stone-50 dark:bg-stone-900 hover:bg-purple-50/30 dark:hover:bg-purple-950/30 rounded-xl p-6 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-stone-400 dark:text-stone-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-stone-800 dark:text-stone-200">
                {file ? file.name : 'Clicca o trascina qui il file CSV'}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Supporta file separati da virgola, punto e virgola o tabulazione
              </p>
            </div>
          )}

          {/* Tab 2: Paste Text */}
          {activeTab === 'paste' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                Incolla qui le righe copiate da Excel o Blocco Note:
              </label>
              <textarea
                value={rawText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder="Data;Glicemia;Creatinina;Colesterolo&#10;201810;138;0,76;179&#10;201901;243;0,72;181"
                rows={5}
                className="w-full p-3 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-mono text-stone-800 dark:text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-[#9333ea]/30 focus:border-[#9333ea]"
              />
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Section if Parsed */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Anteprima Riconoscimento: {parsedRows.length} sessioni trovate</span>
                </div>

                {/* Import Mode Radio */}
                <div className="flex items-center space-x-3 text-xs">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-[#9333ea] focus:ring-[#9333ea]"
                    />
                    <span className="font-semibold text-stone-700 dark:text-stone-300">Aggiungi</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-[#9333ea] focus:ring-[#9333ea]"
                    />
                    <span className="font-semibold text-rose-700 dark:text-rose-400">Sostituisci Tutto</span>
                  </label>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-x-auto max-h-60 shadow-xs bg-white dark:bg-stone-900">
                <table className="w-full text-xs text-left divide-y divide-stone-200 dark:divide-stone-800">
                  <thead className="bg-stone-100 dark:bg-stone-800 sticky top-0 z-10 text-stone-700 dark:text-stone-300 font-bold">
                    <tr>
                      <th className="p-2 border-r border-stone-200 dark:border-stone-800">Data</th>
                      {parameters.map(p => (
                        <th key={p.id} className="p-2 border-r border-stone-200 dark:border-stone-800 text-center whitespace-nowrap">
                          {p.name}
                        </th>
                      ))}
                      <th className="p-2">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                    {parsedRows.slice(0, 15).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-stone-50/80 dark:hover:bg-stone-800/50">
                        <td className="p-2 font-mono font-bold text-stone-900 dark:text-stone-100 border-r border-stone-200 dark:border-stone-800 whitespace-nowrap">
                          {row.date}
                        </td>
                        {parameters.map(p => {
                          const val = row.values[p.id] ?? null;
                          if (val === null || val === undefined) {
                            return <td key={p.id} className="p-2 text-center text-stone-300 dark:text-stone-600 border-r border-stone-200 dark:border-stone-800">-</td>;
                          }
                          const evalRes = evaluateBloodParam(val, p);
                          return (
                            <td 
                              key={p.id} 
                              className={`p-2 text-center font-bold border-r border-stone-200 dark:border-stone-800 ${
                                evalRes.isGreen
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                              }`}
                            >
                              {String(val).replace('.', ',')}
                            </td>
                          );
                        })}
                        <td className="p-2 text-stone-500 dark:text-stone-400 truncate max-w-[150px]">
                          {row.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 15 && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400 text-right">
                  Mostrate le prime 15 righe di {parsedRows.length}...
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-semibold text-xs rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={parsedRows.length === 0}
              onClick={handleConfirmImport}
              className={`px-5 py-2.5 disabled:bg-stone-300 dark:disabled:bg-stone-700 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer ${
                importMode === 'replace'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-[#9333ea] hover:bg-[#7e22ce]'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {importMode === 'replace'
                  ? `Sovrascrivi con ${parsedRows.length} Prelievi`
                  : `Aggiungi ${parsedRows.length} Prelievi`}
              </span>
            </button>
          </div>

        </div>

      </div>

      {/* OVERWRITE CONFIRMATION MODAL */}
      {showOverwriteConfirm && parsedRows.length > 0 && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border-2 border-amber-400 max-w-md w-full p-5 space-y-4 animate-scaleIn text-stone-900 dark:text-stone-100">
            
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900 dark:text-white leading-tight">
                  Confermi la sovrascrittura degli esami del sangue?
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                  Questa operazione cancellerà tutti gli esami attualmente registrati
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-2 leading-relaxed">
              <p>
                Hai selezionato <strong>"Sostituisci Tutto"</strong>. Tutti i prelievi del sangue registrati in precedenza verranno eliminati e sostituiti con i <strong>{parsedRows.length} prelievi</strong> di questo file.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeImport('replace')}
                className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sì, Sovrascrivi ed Elimina Esami Esistenti</span>
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('merge');
                    setShowOverwriteConfirm(false);
                  }}
                  className="flex-1 py-2.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Passa ad "Aggiungi"</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowOverwriteConfirm(false)}
                  className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
