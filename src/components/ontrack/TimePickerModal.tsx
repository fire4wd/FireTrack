import React, { useState, useEffect } from 'react';
import { X, Clock, Check, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string;
  initialValue?: string;
  onChange?: (newTime: string) => void;
  onConfirm?: (newTime: string) => void;
  title?: string;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  isOpen,
  onClose,
  value,
  initialValue,
  onChange,
  onConfirm,
  title = 'Seleziona Orario'
}) => {
  const timeSource = value || initialValue || '';

  // Parse initial time
  const parseTime = (timeStr: string) => {
    if (!timeStr) {
      const now = new Date();
      return {
        hours: now.getHours(),
        minutes: now.getMinutes()
      };
    }
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return {
      hours: isNaN(h) ? 12 : Math.max(0, Math.min(23, h)),
      minutes: isNaN(m) ? 0 : Math.max(0, Math.min(59, m))
    };
  };

  const [selectedHours, setSelectedHours] = useState<number>(12);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'hours' | 'minutes'>('hours');

  useEffect(() => {
    if (isOpen) {
      const { hours, minutes } = parseTime(timeSource);
      setSelectedHours(hours);
      setSelectedMinutes(minutes);
      setActiveTab('hours');
    }
  }, [isOpen, timeSource]);

  if (!isOpen) return null;

  const formatHours = (h: number) => String(h).padStart(2, '0');
  const formatMinutes = (m: number) => String(m).padStart(2, '0');
  const currentTimeString = `${formatHours(selectedHours)}:${formatMinutes(selectedMinutes)}`;

  const handleHourSelect = (h: number) => {
    setSelectedHours(h);
    // Automatically shift to minute selection for super smooth 2-step picking
    setActiveTab('minutes');
  };

  const handleMinuteSelect = (m: number) => {
    setSelectedMinutes(m);
  };

  const handleQuickPreset = (h: number, m: number) => {
    setSelectedHours(h);
    setSelectedMinutes(m);
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    setSelectedHours(now.getHours());
    setSelectedMinutes(now.getMinutes());
  };

  const handleConfirm = () => {
    if (typeof onChange === 'function') {
      onChange(currentTimeString);
    }
    if (typeof onConfirm === 'function') {
      onConfirm(currentTimeString);
    }
    onClose();
  };

  const hourButtons = Array.from({ length: 24 }, (_, i) => i);
  const minuteButtons = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const quickPresets = [
    { label: '07:00 (Sveglia)', h: 7, m: 0 },
    { label: '08:30 (Colazione)', h: 8, m: 30 },
    { label: '12:30 (Pranzo)', h: 12, m: 30 },
    { label: '16:30 (Merenda)', h: 16, m: 30 },
    { label: '19:30 (Pre-cena)', h: 19, m: 30 },
    { label: '20:30 (Cena)', h: 20, m: 30 },
    { label: '23:00 (Notte)', h: 23, m: 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Backdrop */}
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#1a1d24] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-700 overflow-hidden z-10 animate-in slide-in-from-bottom-4 duration-200">
        
        {/* Mobile handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full" />
        </div>

        {/* Title Bar */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-800/40">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg transition-colors cursor-pointer"
            aria-label="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Big Digital Clock Display with Steppers */}
          <div className="bg-stone-100 dark:bg-stone-900/90 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 flex items-center justify-center space-x-4">
            
            {/* Hours Block */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setSelectedHours(prev => (prev + 1) % 24)}
                className="p-1 text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                title="Aumenta ora"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                onClick={() => setActiveTab('hours')}
                className={`w-18 py-2 rounded-xl text-3xl font-black font-mono transition-all cursor-pointer text-center ${
                  activeTab === 'hours'
                    ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-400'
                    : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700'
                }`}
              >
                {formatHours(selectedHours)}
              </button>

              <button
                type="button"
                onClick={() => setSelectedHours(prev => (prev - 1 + 24) % 24)}
                className="p-1 text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                title="Diminuisci ora"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
              <span className="text-[10px] font-bold text-stone-500 uppercase mt-0.5">Ore (0-23)</span>
            </div>

            {/* Separator Colon */}
            <span className="text-3xl font-black text-stone-400 dark:text-stone-500 pb-5">:</span>

            {/* Minutes Block */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setSelectedMinutes(prev => (prev + 1) % 60)}
                className="p-1 text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                title="Aumenta minuto"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                onClick={() => setActiveTab('minutes')}
                className={`w-18 py-2 rounded-xl text-3xl font-black font-mono transition-all cursor-pointer text-center ${
                  activeTab === 'minutes'
                    ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-400'
                    : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700'
                }`}
              >
                {formatMinutes(selectedMinutes)}
              </button>

              <button
                type="button"
                onClick={() => setSelectedMinutes(prev => (prev - 1 + 60) % 60)}
                className="p-1 text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                title="Diminuisci minuto"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
              <span className="text-[10px] font-bold text-stone-500 uppercase mt-0.5">Minuti</span>
            </div>

            {/* Quick "Now" Button */}
            <div className="flex flex-col items-center pl-2 border-l border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={handleSetCurrentTime}
                className="px-3 py-2 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex flex-col items-center space-y-1"
                title="Imposta ora corrente"
              >
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Adesso</span>
              </button>
            </div>
          </div>

          {/* Tab Selector: Scegli Ore vs Scegli Minuti */}
          <div className="grid grid-cols-2 gap-2 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('hours')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'hours'
                  ? 'bg-white dark:bg-stone-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              1. Scegli Ora ({formatHours(selectedHours)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('minutes')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'minutes'
                  ? 'bg-white dark:bg-stone-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              2. Scegli Minuti ({formatMinutes(selectedMinutes)})
            </button>
          </div>

          {/* Selection Grid for Hours */}
          {activeTab === 'hours' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-stone-500 font-semibold px-1">
                <span>Tocca l'ora desiderata:</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">Passa in automatico ai minuti</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {hourButtons.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourSelect(h)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedHours === h
                        ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-400 font-black'
                        : 'bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {formatHours(h)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selection Grid for Minutes */}
          {activeTab === 'minutes' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-stone-500 font-semibold px-1">
                <span>Scatti ogni 5 minuti o regolazione fine:</span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMinutes(prev => (prev - 1 + 60) % 60)}
                    className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-xs font-bold hover:bg-stone-300"
                  >
                    -1m
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMinutes(prev => (prev + 1) % 60)}
                    className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-xs font-bold hover:bg-stone-300"
                  >
                    +1m
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {minuteButtons.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteSelect(m)}
                    className={`py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedMinutes === m
                        ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-400 font-black'
                        : 'bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    :{formatMinutes(m)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Presets Pills */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
              Fasce Orarie Frequenti
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPresets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickPreset(p.h, p.m)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-100 dark:bg-stone-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 hover:text-teal-700 dark:hover:text-teal-300 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Conferma ({currentTimeString})</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
