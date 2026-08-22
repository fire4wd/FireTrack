import React, { useState, useEffect } from 'react';
import { BloodTestParameter, BloodTestRecord } from '../../types/ontrack';
import { evaluateBloodParam, formatParamRangeLabel } from '../../utils/ontrackStorage';
import { NumericKeypadModal } from './NumericKeypadModal';
import { X, Check, Calendar, AlertCircle, ArrowUp, ArrowDown, CheckCircle2, Sparkles, Calculator } from 'lucide-react';

interface BloodTestAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: BloodTestRecord) => void;
  parameters: BloodTestParameter[];
  recordToEdit?: BloodTestRecord | null;
}

export const BloodTestAddModal: React.FC<BloodTestAddModalProps> = ({
  isOpen,
  onClose,
  onSave,
  parameters,
  recordToEdit
}) => {
  const [dateStr, setDateStr] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeKeypadParamId, setActiveKeypadParamId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (recordToEdit) {
        setDateStr(recordToEdit.date || '');
        const valMap: Record<string, string> = {};
        parameters.forEach(p => {
          const v = recordToEdit.values[p.id] ?? 
            (p.id === 'acr' ? recordToEdit.values['microalbuminuria'] : undefined) ?? 
            recordToEdit.values[p.name.toLowerCase()] ?? 
            null;
          if (v !== null && v !== undefined) {
            valMap[p.id] = String(v).replace('.', ',');
          } else {
            valMap[p.id] = '';
          }
        });
        setValues(valMap);
        setNotes(recordToEdit.notes || '');
      } else {
        // Default today's date in YYYYMM format or standard
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        setDateStr(`${y}${m}`);
        
        const initialVals: Record<string, string> = {};
        parameters.forEach(p => {
          initialVals[p.id] = '';
        });
        setValues(initialVals);
        setNotes('');
      }
      setErrorMsg(null);
    }
  }, [isOpen, recordToEdit, parameters]);

  if (!isOpen) return null;

  const handleValueChange = (paramId: string, val: string) => {
    setValues(prev => ({
      ...prev,
      [paramId]: val
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateStr.trim()) {
      setErrorMsg('Inserisci la data o il periodo del prelievo (es. 201905 o 15/05/2019).');
      return;
    }

    const parsedValues: Record<string, number | null> = {};
    let hasAtLeastOneVal = false;

    parameters.forEach(p => {
      const rawVal = values[p.id]?.trim();
      if (rawVal) {
        const num = parseFloat(rawVal.replace(',', '.'));
        if (!isNaN(num)) {
          parsedValues[p.id] = num;
          hasAtLeastOneVal = true;
        }
      }
    });

    if (!hasAtLeastOneVal) {
      setErrorMsg('Inserisci almeno il valore di un esame per salvare.');
      return;
    }

    // Try parsing timestamp from date
    let timestamp = Date.now();
    const cleanDate = dateStr.trim();
    if (/^\d{6}$/.test(cleanDate)) {
      // YYYYMM
      const y = parseInt(cleanDate.substring(0, 4), 10);
      const m = parseInt(cleanDate.substring(4, 6), 10) - 1;
      timestamp = new Date(y, m, 15).getTime();
    } else if (cleanDate.includes('-')) {
      timestamp = new Date(cleanDate).getTime() || Date.now();
    } else if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/');
      if (parts.length === 3) {
        timestamp = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime() || Date.now();
      }
    }

    const newRecord: BloodTestRecord = {
      id: recordToEdit?.id || `btest_${Date.now()}`,
      date: cleanDate,
      timestamp,
      values: parsedValues,
      notes: notes.trim() || undefined
    };

    onSave(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#1a1d24] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-100">
        
        {/* Modal Header */}
        <div className="bg-[#2b3032] dark:bg-[#181c20] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#9333ea] flex items-center justify-center text-white font-bold shadow-xs">
              💉
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                {recordToEdit ? 'Modifica Prelievo Esami' : 'Nuovo Prelievo Esami'}
              </h3>
              <p className="text-xs text-stone-300">
                Inserimento valori con calcolo immediato del range
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date / Period Field */}
          <div className="bg-stone-50 dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              Data o Periodo del Prelievo *
            </label>
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <Calendar className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  placeholder="Es. 201905 oppure 15/05/2019"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-sm font-semibold text-stone-800 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-[#9333ea]/30 focus:border-[#9333ea]"
                  required
                />
              </div>
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    setDateStr(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
                  }}
                  className="px-2.5 py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  Mese Corrente
                </button>
              </div>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Formati supportati: formato compatto (es. <span className="font-mono font-bold">201810</span>, <span className="font-mono font-bold">201905</span>) oppure esteso (<span className="font-mono font-bold">15/05/2019</span>).
            </p>
          </div>

          {/* Parameters Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Parametri Esami ({parameters.length})
              </label>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Lascia vuoti i test non effettuati
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {parameters.map((param) => {
                const rawVal = values[param.id] ?? '';
                const numVal = rawVal ? parseFloat(rawVal.replace(',', '.')) : null;
                const evalRes = evaluateBloodParam(numVal, param);

                return (
                  <div 
                    key={param.id}
                    className={`p-3 rounded-xl border transition-all ${
                      rawVal
                        ? evalRes.isGreen
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-xs'
                          : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 shadow-xs'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <div className="text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center space-x-1">
                          <span>{param.name}</span>
                          <span className="text-[11px] font-normal text-stone-500 dark:text-stone-400">
                            {formatParamRangeLabel(param)}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-500">
                          {param.unit}
                        </div>
                      </div>

                      {/* Live Status Badge */}
                      {rawVal && (
                        <div>
                          {evalRes.isGreen ? (
                            <span className="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <Check className="w-2.5 h-2.5" />
                              <span>OK</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              {evalRes.status === 'high' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                              <span>{evalRes.status === 'high' ? 'Alto' : 'Basso'}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rawVal}
                        onClick={() => setActiveKeypadParamId(param.id)}
                        onChange={(e) => handleValueChange(param.id, e.target.value)}
                        placeholder={`Valore (${param.unit})`}
                        className={`w-full pl-3 pr-8 py-1.5 rounded-lg text-sm font-bold transition-colors focus:outline-hidden focus:ring-2 cursor-pointer ${
                          rawVal
                            ? evalRes.isGreen
                              ? 'bg-white dark:bg-stone-800 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-100 focus:ring-emerald-300'
                              : 'bg-white dark:bg-stone-800 border-rose-400 dark:border-rose-600 text-rose-900 dark:text-rose-100 focus:ring-rose-300'
                            : 'bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-100 focus:ring-[#9333ea]/30 focus:border-[#9333ea]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setActiveKeypadParamId(param.id)}
                        className="absolute right-2 text-stone-400 hover:text-[#9333ea] dark:hover:text-[#c084fc] transition-colors p-1"
                        title="Apri tastierino numerico"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              Note (Opzionale)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. Prelievo semestrale, terapia confermata"
              className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-800 dark:text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-[#9333ea]/30 focus:border-[#9333ea]"
            />
          </div>

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
              type="submit"
              className="px-5 py-2.5 bg-[#9333ea] hover:bg-[#7e22ce] text-white font-bold text-xs rounded-xl shadow-md transition-transform active:scale-95 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{recordToEdit ? 'Salva Modifiche' : 'Salva Prelievo'}</span>
            </button>
          </div>

        </form>

      </div>

      {/* Numeric Keypad Modal for Blood Test Parameters */}
      {(() => {
        if (!activeKeypadParamId) return null;
        const currentParam = parameters.find(p => p.id === activeKeypadParamId);
        if (!currentParam) return null;
        const currentIndex = parameters.findIndex(p => p.id === activeKeypadParamId);
        const hasNext = currentIndex >= 0 && currentIndex < parameters.length - 1;

        // Generate smart presets based on param min/max
        const smartPresets: number[] = [];
        if (currentParam.min !== undefined && currentParam.max !== undefined) {
          smartPresets.push(currentParam.min, Math.round(((currentParam.min + currentParam.max) / 2) * 10) / 10, currentParam.max);
        } else if (currentParam.max !== undefined) {
          smartPresets.push(Math.round(currentParam.max * 0.7), currentParam.max, Math.round(currentParam.max * 1.3));
        }

        return (
          <NumericKeypadModal
            isOpen={!!activeKeypadParamId}
            onClose={() => setActiveKeypadParamId(null)}
            title={currentParam.name}
            label={currentParam.name}
            subLabel={formatParamRangeLabel(currentParam)}
            unit={currentParam.unit}
            value={values[activeKeypadParamId] || ''}
            onChange={(newVal) => handleValueChange(activeKeypadParamId, newVal)}
            onConfirm={() => setActiveKeypadParamId(null)}
            onNext={hasNext ? () => {
              const nextParam = parameters[currentIndex + 1];
              if (nextParam) setActiveKeypadParamId(nextParam.id);
              else setActiveKeypadParamId(null);
            } : undefined}
            hasNext={hasNext}
            allowDecimal={true}
            quickPresets={smartPresets.length > 0 ? smartPresets : undefined}
          />
        );
      })()}

    </div>
  );
};
