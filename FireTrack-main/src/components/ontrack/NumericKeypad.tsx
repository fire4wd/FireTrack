import React, { useState, useEffect } from 'react';
import { Delete, Check, ArrowRight, RotateCcw, Plus, Minus } from 'lucide-react';

export interface NumericKeypadProps {
  value: string;
  onChange: (val: string) => void;
  onConfirm?: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  unit?: string;
  label?: string;
  subLabel?: string;
  allowDecimal?: boolean;
  showQuickAdjust?: boolean;
  quickIncrements?: number[];
  quickPresets?: number[];
  onClose?: () => void;
  className?: string;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  onConfirm,
  onNext,
  hasNext = false,
  unit,
  label,
  subLabel,
  allowDecimal = true,
  showQuickAdjust = true,
  quickIncrements = [-10, -1, 1, 10],
  quickPresets,
  onClose,
  className = ''
}) => {
  // Preselected state: when opened or field switched, any new digit replaces the existing value
  const [isSelected, setIsSelected] = useState(true);

  useEffect(() => {
    setIsSelected(true);
  }, [label, subLabel, unit]);

  const triggerHaptic = () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(8);
      }
    } catch (_) {
      // Ignore haptic errors if not supported
    }
  };

  const handleDigit = (digit: string) => {
    triggerHaptic();
    if (isSelected || value === '0' || value === '') {
      setIsSelected(false);
      onChange(digit);
    } else {
      onChange(value + digit);
    }
  };

  const handleDecimal = () => {
    triggerHaptic();
    if (!allowDecimal) return;
    if (isSelected || !value || value === '') {
      setIsSelected(false);
      onChange('0,');
    } else if (!value.includes(',') && !value.includes('.')) {
      onChange(value + ',');
    }
  };

  const handleBackspace = () => {
    triggerHaptic();
    if (isSelected) {
      setIsSelected(false);
      onChange('');
    } else if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    triggerHaptic();
    setIsSelected(false);
    onChange('');
  };

  const handleQuickAdjust = (delta: number) => {
    triggerHaptic();
    setIsSelected(false);
    const num = parseFloat(value.replace(',', '.')) || 0;
    const newNum = Math.max(0, num + delta);
    // Format appropriately: if whole number, no decimal; if has decimals, keep 1 decimal
    const isDecimalDelta = delta % 1 !== 0 || value.includes(',') || value.includes('.');
    const formatted = isDecimalDelta 
      ? newNum.toFixed(1).replace('.', ',') 
      : String(Math.round(newNum));
    onChange(formatted);
  };

  const handlePreset = (presetVal: number) => {
    triggerHaptic();
    setIsSelected(false);
    onChange(String(presetVal));
  };

  return (
    <div 
      className={`bg-white dark:bg-[#1a1d24] border border-stone-300 dark:border-stone-700 rounded-2xl shadow-xl p-3.5 select-none ${className}`}
      id="ontrack-numeric-keypad"
    >
      {/* Header & Value Display */}
      {(label || unit) && (
        <div className="mb-2.5 bg-stone-50 dark:bg-stone-900/80 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            {label && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block truncate">
                {label}
              </span>
            )}
            {subLabel && (
              <span className="text-[10px] text-stone-400 dark:text-stone-500 block truncate">
                {subLabel}
              </span>
            )}
          </div>
          <div 
            onClick={() => setIsSelected(!isSelected)}
            className="flex items-baseline space-x-1 font-mono text-right flex-shrink-0 cursor-pointer"
            title="Clicca per selezionare / deselezionare"
          >
            <span className={`text-2xl font-black tracking-tight rounded-lg px-1.5 py-0.5 transition-all ${
              isSelected
                ? 'bg-[#1d8998]/20 dark:bg-[#38bdf8]/30 text-[#1d8998] dark:text-[#38bdf8] ring-2 ring-[#1d8998] dark:ring-[#38bdf8]'
                : 'text-[#1d8998] dark:text-[#38bdf8]'
            }`}>
              {value || <span className="text-stone-300 dark:text-stone-600 font-normal">0</span>}
            </span>
            {unit && (
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                {unit}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Presets (if provided) */}
      {quickPresets && quickPresets.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[10px] text-stone-400 font-bold uppercase mr-0.5 shrink-0">Rapidi:</span>
          {quickPresets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePreset(p)}
              className="px-2.5 py-1 text-xs font-bold font-mono bg-stone-100 dark:bg-stone-800 hover:bg-[#1d8998]/10 dark:hover:bg-[#38bdf8]/20 hover:text-[#1d8998] dark:hover:text-[#38bdf8] text-stone-700 dark:text-stone-300 rounded-lg border border-stone-200 dark:border-stone-700 transition-colors shrink-0 active:scale-95"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Quick Increments / Adjustments */}
      {showQuickAdjust && (
        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
          {quickIncrements.map((inc) => (
            <button
              key={inc}
              type="button"
              onClick={() => handleQuickAdjust(inc)}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold font-mono transition-all active:scale-95 flex items-center justify-center space-x-0.5 ${
                inc > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-100'
              }`}
            >
              {inc > 0 ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              <span>{Math.abs(inc)}</span>
            </button>
          ))}
        </div>
      )}

      {/* 3x4 Numpad Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, rIdx) => (
          <React.Fragment key={rIdx}>
            {row.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-12 sm:h-13 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:bg-[#1d8998] active:text-white dark:active:bg-[#38bdf8] dark:active:text-stone-900 text-stone-900 dark:text-stone-100 text-xl font-bold font-mono rounded-xl border border-stone-200 dark:border-stone-700/80 shadow-xs transition-all active:scale-95 flex items-center justify-center cursor-pointer"
              >
                {digit}
              </button>
            ))}
          </React.Fragment>
        ))}

        {/* 4th row: Decimal / Comma, 0, Backspace */}
        <button
          type="button"
          onClick={handleDecimal}
          disabled={!allowDecimal}
          className={`h-12 sm:h-13 text-xl font-bold font-mono rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
            allowDecimal
              ? 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 border-stone-200 dark:border-stone-700/80 cursor-pointer'
              : 'bg-stone-50 dark:bg-stone-900 text-stone-300 dark:text-stone-700 border-stone-100 dark:border-stone-800 cursor-not-allowed'
          }`}
        >
          ,
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-12 sm:h-13 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:bg-[#1d8998] active:text-white dark:active:bg-[#38bdf8] dark:active:text-stone-900 text-stone-900 dark:text-stone-100 text-xl font-bold font-mono rounded-xl border border-stone-200 dark:border-stone-700/80 shadow-xs transition-all active:scale-95 flex items-center justify-center cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="h-12 sm:h-13 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 active:bg-rose-600 active:text-white text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-xs transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          title="Cancella ultima cifra"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* Action Footer Buttons: Clear, (Next se presente), Confirm/Done */}
      <div className="mt-2.5 grid grid-cols-12 gap-1.5">
        <button
          type="button"
          onClick={handleClear}
          className="col-span-3 py-2 px-1 text-xs font-bold text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl border border-stone-200 dark:border-stone-700 transition-colors flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
          title="Cancella tutto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>C</span>
        </button>

        {hasNext && onNext ? (
          <>
            <button
              type="button"
              onClick={onNext}
              className="col-span-4 py-2 px-1 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-xl border border-teal-200 dark:border-teal-800 transition-colors flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
            >
              <span>Succ.</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onConfirm || onClose}
              className="col-span-5 py-2 px-2 text-xs font-bold text-white bg-[#1d8998] hover:bg-[#166c78] dark:bg-[#38bdf8] dark:text-stone-950 dark:hover:bg-[#0ea5e9] rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>OK</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onConfirm || onClose}
            className="col-span-9 py-2 px-3 text-xs font-bold text-white bg-[#1d8998] hover:bg-[#166c78] dark:bg-[#38bdf8] dark:text-stone-950 dark:hover:bg-[#0ea5e9] rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>OK / Fatto</span>
          </button>
        )}
      </div>
    </div>
  );
};
