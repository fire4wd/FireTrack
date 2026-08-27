import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { NumericKeypad } from './NumericKeypad';

export interface NumericKeypadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  label?: string;
  subLabel?: string;
  unit?: string;
  value: string;
  onChange: (val: string) => void;
  onConfirm?: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  allowDecimal?: boolean;
  showQuickAdjust?: boolean;
  quickIncrements?: number[];
  quickPresets?: number[];
}

export const NumericKeypadModal: React.FC<NumericKeypadModalProps> = ({
  isOpen,
  onClose,
  title,
  label,
  subLabel,
  unit,
  value,
  onChange,
  onConfirm,
  onNext,
  hasNext,
  allowDecimal = true,
  showQuickAdjust = true,
  quickIncrements,
  quickPresets
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-sm bg-white dark:bg-[#1a1d24] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
              {title || label || 'Inserimento Numerico'}
            </h3>
            {subLabel && (
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {subLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors cursor-pointer"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Keypad */}
        <div className="p-3.5 overflow-y-auto">
          <NumericKeypad
            value={value}
            onChange={onChange}
            onConfirm={onConfirm || onClose}
            onNext={onNext}
            hasNext={hasNext}
            unit={unit}
            label={label}
            subLabel={subLabel}
            allowDecimal={allowDecimal}
            showQuickAdjust={showQuickAdjust}
            quickIncrements={quickIncrements}
            quickPresets={quickPresets}
            onClose={onClose}
            className="border-0 shadow-none p-0 bg-transparent dark:bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};
