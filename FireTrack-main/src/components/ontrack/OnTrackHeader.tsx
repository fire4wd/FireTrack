import React from 'react';
import { ChevronLeft, Check, MoreVertical, FileText, Clock, BarChart2, Plus, Calendar, Activity } from 'lucide-react';

interface OnTrackHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  showSave?: boolean;
  onSave?: () => void;
  showToolsMenu?: boolean;
  onOpenTools?: () => void;
  onNavigate?: (screen: string) => void;
}

export const OnTrackHeader: React.FC<OnTrackHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  showSave = false,
  onSave,
  showToolsMenu = true,
  onOpenTools,
  onNavigate
}) => {
  return (
    <div className="bg-[#2b3032] text-white px-3 py-2.5 flex items-center justify-between shadow-md relative z-20">
      
      {/* Left Title, Two Drops Icon, and Version Badge v0.0.1 */}
      <div className="flex items-center space-x-2 min-w-0">
        {showBack ? (
          <button
            onClick={onBack}
            className="p-1 hover:bg-stone-700/60 rounded-full transition-colors flex items-center shrink-0"
            title="Indietro"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
            {/* Two Drops Icon (Le due gocce) */}
            <svg className="w-5 h-5 ml-0.5 shrink-0" viewBox="0 0 100 100">
              <path d="M36 15 C36 15, 18 40, 18 53 C18 63, 26 71, 36 71 C46 71, 54 63, 54 53 C54 40, 36 15, 36 15 Z" fill="#ffffff" />
              <path d="M64 28 C64 28, 44 58, 44 72 C44 84, 53 92, 64 92 C75 92, 84 84, 84 72 C84 58, 64 28, 64 28 Z" fill="#e54b2b" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center space-x-2 shrink-0">
            {/* Two Drops Icon (Le due gocce) */}
            <svg className="w-6 h-6 shrink-0" viewBox="0 0 100 100">
              <path d="M36 15 C36 15, 18 40, 18 53 C18 63, 26 71, 36 71 C46 71, 54 63, 54 53 C54 40, 36 15, 36 15 Z" fill="#ffffff" />
              <path d="M64 28 C64 28, 44 58, 44 72 C44 84, 53 92, 64 92 C75 92, 84 84, 84 72 C84 58, 64 28, 64 28 Z" fill="#e54b2b" />
            </svg>
          </div>
        )}

        <div className="flex items-center space-x-1.5 truncate">
          <span className="font-bold text-lg sm:text-xl tracking-tight text-white truncate">
            {title}
          </span>
        </div>
      </div>

      {/* Right Controls (Pill Badge with Fire + Menu ⋮) */}
      <div className="flex items-center space-x-2 shrink-0 ml-2">
        
        {/* Compact Navigation Bar Icons (When inside sub-screens) */}
        {showBack && onNavigate && (
          <div className="flex items-center space-x-1 sm:space-x-1.5 mr-1 bg-stone-800/60 p-1 rounded-full border border-stone-700/50">
            {/* Reports */}
            <button
              onClick={() => onNavigate('reports')}
              className="w-7 h-7 rounded-full bg-[#e0b828] hover:bg-[#d0a718] text-white flex items-center justify-center shadow-xs transition-transform active:scale-90"
              title="Reports"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            {/* Storico */}
            <button
              onClick={() => onNavigate('history')}
              className="w-7 h-7 rounded-full bg-[#5a6265] hover:bg-[#4a5153] text-white flex items-center justify-center shadow-xs transition-transform active:scale-90"
              title="Storico"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            {/* Calendario */}
            <button
              onClick={() => onNavigate('calendar')}
              className="w-7 h-7 rounded-full bg-[#e55137] hover:bg-[#d44127] text-white flex items-center justify-center shadow-xs transition-transform active:scale-90"
              title="Calendario"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            {/* Grafici */}
            <button
              onClick={() => onNavigate('graphs')}
              className="w-7 h-7 rounded-full bg-[#2ca3b5] hover:bg-[#238a9a] text-white flex items-center justify-center shadow-xs transition-transform active:scale-90"
              title="Grafici"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            {/* Esami del Sangue */}
            <button
              onClick={() => onNavigate('blood-tests')}
              className="w-7 h-7 rounded-full bg-[#9333ea] hover:bg-[#7e22ce] text-white flex items-center justify-center shadow-xs transition-transform active:scale-90"
              title="Esami del Sangue"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            {/* Add */}
            <button
              onClick={() => onNavigate('add')}
              className="w-7 h-7 rounded-full bg-[#5cb85c] hover:bg-[#4cae4c] text-white flex items-center justify-center shadow-xs transition-transform active:scale-90"
              title="Nuova Lettura (+)"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        )}

        {/* Save button if editing */}
        {showSave && onSave && (
          <button
            onClick={onSave}
            className="flex items-center space-x-1 px-2.5 py-1 text-sm font-semibold text-stone-200 hover:text-white hover:bg-stone-700/50 rounded transition-colors"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Salva</span>
          </button>
        )}

        {/* Right Badge Pill "FireTrack 🔥" matching photo IMG_20260813_172227 */}
        {showToolsMenu && onOpenTools && (
          <div className="flex items-center space-x-1.5">
            <button
              onClick={onOpenTools}
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#1e2224] border border-[#d65129]/80 rounded-lg text-xs font-mono text-stone-200 hover:border-[#e56138] transition-colors shadow-xs"
              title="Apri Impostazioni FireTrack"
            >
              <span className="font-semibold text-stone-200 tracking-wide text-xs">
                FireTrack
              </span>
              <div className="w-4 h-4 bg-gradient-to-tr from-amber-600 to-red-500 rounded flex items-center justify-center text-[10px] leading-none shadow-xs">
                🔥
              </div>
            </button>

            {/* Three Dots Menu Icon ⋮ */}
            <button
              onClick={onOpenTools}
              className="p-1 hover:bg-stone-700/60 rounded text-stone-300 hover:text-white transition-colors"
              title="Strumenti e Impostazioni"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
