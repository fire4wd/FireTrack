import React, { useState } from 'react';
import { BloodTestParameter } from '../../types/ontrack';
import { formatParamRangeLabel } from '../../utils/ontrackStorage';
import { 
  X, 
  Plus, 
  Trash2, 
  Check, 
  ArrowUp, 
  ArrowDown, 
  Sliders, 
  Sparkles, 
  RotateCcw,
  Pencil
} from 'lucide-react';
import { defaultBloodTestParameters } from '../../data/ontrackDefaults';

interface BloodTestParamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: BloodTestParameter[];
  onSaveParameters: (newParams: BloodTestParameter[]) => void;
}

export const BloodTestParamsModal: React.FC<BloodTestParamsModalProps> = ({
  isOpen,
  onClose,
  parameters,
  onSaveParameters
}) => {
  const [paramsList, setParamsList] = useState<BloodTestParameter[]>(() => [...parameters]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Param form state
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('mg/dL');
  const [newConditionType, setNewConditionType] = useState<'range' | 'max_only' | 'min_only'>('range');
  const [newMin, setNewMin] = useState('');
  const [newMax, setNewMax] = useState('');

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setParamsList([...defaultBloodTestParameters]);
    setEditingId(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= paramsList.length) return;

    const updated = [...paramsList];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    // re-assign orders
    updated.forEach((p, idx) => {
      p.order = idx + 1;
    });

    setParamsList(updated);
  };

  const handleDelete = (id: string) => {
    setParamsList(prev => prev.filter(p => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleUpdateItem = (id: string, updates: Partial<BloodTestParameter>) => {
    setParamsList(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const minNum = newMin.trim() ? parseFloat(newMin.replace(',', '.')) : undefined;
    const maxNum = newMax.trim() ? parseFloat(newMax.replace(',', '.')) : undefined;

    const newParam: BloodTestParameter = {
      id: `param_${Date.now()}_${newName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: newName.trim(),
      unit: newUnit.trim() || 'mg/dL',
      conditionType: newConditionType,
      min: minNum,
      max: maxNum,
      order: paramsList.length + 1
    };

    setParamsList(prev => [...prev, newParam]);
    setNewName('');
    setNewMin('');
    setNewMax('');
  };

  const handleSaveAndClose = () => {
    onSaveParameters(paramsList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#1a1d24] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-100">
        
        {/* Header */}
        <div className="bg-[#2b3032] dark:bg-[#181c20] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#9333ea] flex items-center justify-center text-white font-bold shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Personalizza Parametri & Range Esami
              </h3>
              <p className="text-xs text-stone-300">
                Imposta i valori soglia che determinano la colorazione verde/rosso
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Quick Header info & Reset button */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              Parametri Attivi ({paramsList.length})
            </span>
            <button
              onClick={handleResetDefaults}
              className="text-xs font-semibold text-stone-500 dark:text-stone-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center space-x-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ripristina Default</span>
            </button>
          </div>

          {/* List of parameters */}
          <div className="space-y-2.5">
            {paramsList.map((param, idx) => {
              const isEditing = editingId === param.id;

              return (
                <div 
                  key={param.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isEditing 
                      ? 'bg-purple-50/50 dark:bg-purple-950/40 border-[#9333ea]/50 shadow-sm' 
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-white dark:hover:bg-stone-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-stone-400 dark:text-stone-500 w-5">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                          <span>{param.name}</span>
                          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/70 px-1.5 py-0.5 rounded">
                            {formatParamRangeLabel(param)}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">
                          Unità: <span className="font-mono">{param.unit}</span> • Tipo:{' '}
                          {param.conditionType === 'range' ? 'Intervallo min - max' : param.conditionType === 'max_only' ? 'Solo Massimo' : 'Solo Minimo'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {/* Reorder up/down */}
                      <button
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30 transition-colors"
                        title="Sposta su"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === paramsList.length - 1}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30 transition-colors"
                        title="Sposta giù"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      {/* Edit toggle */}
                      <button
                        onClick={() => setEditingId(isEditing ? null : param.id)}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isEditing ? 'bg-[#9333ea] text-white' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                        }`}
                        title="Modifica Range"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(param.id)}
                        className="p-1 text-stone-400 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-1"
                        title="Rimuovi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit Form */}
                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-900 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">Nome Esame</label>
                        <input
                          type="text"
                          value={param.name}
                          onChange={(e) => handleUpdateItem(param.id, { name: e.target.value })}
                          className="w-full p-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded font-semibold text-stone-800 dark:text-stone-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">Unità</label>
                        <input
                          type="text"
                          value={param.unit}
                          onChange={(e) => handleUpdateItem(param.id, { unit: e.target.value })}
                          className="w-full p-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded font-semibold text-stone-800 dark:text-stone-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">Tipo Regola</label>
                        <select
                          value={param.conditionType}
                          onChange={(e) => handleUpdateItem(param.id, { conditionType: e.target.value as any })}
                          className="w-full p-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded font-semibold text-stone-800 dark:text-stone-200"
                        >
                          <option value="range">Intervallo (Min - Max)</option>
                          <option value="max_only">Solo Massimo (&lt; Max)</option>
                          <option value="min_only">Solo Minimo (&gt; Min)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                          {param.conditionType === 'range' ? 'Min - Max' : param.conditionType === 'max_only' ? 'Valore Max' : 'Valore Min'}
                        </label>
                        <div className="flex space-x-1">
                          {param.conditionType !== 'max_only' && (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={param.min !== undefined ? String(param.min).replace('.', ',') : ''}
                              onChange={(e) => {
                                const v = e.target.value.trim() ? parseFloat(e.target.value.replace(',', '.')) : undefined;
                                handleUpdateItem(param.id, { min: v });
                              }}
                              placeholder="Min"
                              className="w-full p-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded font-bold text-stone-800 dark:text-stone-200"
                            />
                          )}
                          {param.conditionType !== 'min_only' && (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={param.max !== undefined ? String(param.max).replace('.', ',') : ''}
                              onChange={(e) => {
                                const v = e.target.value.trim() ? parseFloat(e.target.value.replace(',', '.')) : undefined;
                                handleUpdateItem(param.id, { max: v });
                              }}
                              placeholder="Max"
                              className="w-full p-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded font-bold text-stone-800 dark:text-stone-200"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add New Parameter Box */}
          <div className="bg-stone-100 dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="font-bold text-xs text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Aggiungi Nuovo Esame / Analita</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Es. Ferritina o Vitamina D"
                  className="w-full p-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg font-semibold text-stone-800 dark:text-stone-200"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="Unità (es. ng/mL)"
                  className="w-full p-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg font-semibold text-stone-800 dark:text-stone-200"
                />
              </div>
              <div>
                <select
                  value={newConditionType}
                  onChange={(e) => setNewConditionType(e.target.value as any)}
                  className="w-full p-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg font-semibold text-stone-800 dark:text-stone-200"
                >
                  <option value="range">Intervallo (Min - Max)</option>
                  <option value="max_only">Solo Massimo (&lt; Max)</option>
                  <option value="min_only">Solo Minimo (&gt; Min)</option>
                </select>
              </div>
              <div className="flex space-x-1">
                {newConditionType !== 'max_only' && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newMin}
                    onChange={(e) => setNewMin(e.target.value)}
                    placeholder="Min"
                    className="w-full p-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg font-bold text-stone-800 dark:text-stone-200"
                  />
                )}
                {newConditionType !== 'min_only' && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newMax}
                    onChange={(e) => setNewMax(e.target.value)}
                    placeholder="Max"
                    className="w-full p-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg font-bold text-stone-800 dark:text-stone-200"
                  />
                )}
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={!newName.trim()}
                  className="px-3 py-2 bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white font-bold rounded-lg shrink-0 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-stone-50 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-semibold text-xs rounded-xl hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2.5 bg-[#9333ea] hover:bg-[#7e22ce] text-white font-bold text-xs rounded-xl shadow-md transition-transform active:scale-95 flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Salva Configurazioni</span>
          </button>
        </div>

      </div>
    </div>
  );
};
