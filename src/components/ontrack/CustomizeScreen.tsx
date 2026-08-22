import React from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { ChevronRight } from 'lucide-react';

interface CustomizeScreenProps {
  onNavigate: (screen: string) => void;
  onBack: () => void;
}

export const CustomizeScreen: React.FC<CustomizeScreenProps> = ({
  onNavigate,
  onBack
}) => {
  return (
    <div className="flex flex-col min-h-full bg-[#f8fafc]">
      
      {/* Header Bar */}
      <OnTrackHeader
        title="Customize"
        showBack={true}
        onBack={onBack}
        showToolsMenu={false}
      />

      {/* Menu List */}
      <div className="flex-1 max-w-2xl mx-auto w-full bg-white divide-y divide-stone-200 border-b border-stone-200">
        
        <button
          onClick={() => onNavigate('system-settings')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
        >
          <span className="text-base font-medium text-stone-800">
            Impostazioni sistema (Diario & Note Evento)
          </span>
          <ChevronRight className="w-5 h-5 text-stone-400" />
        </button>

        <button
          onClick={() => onNavigate('customize-categories')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
        >
          <span className="text-base font-medium text-stone-800">
            Categorie (Colazione, Pranzo, etc)
          </span>
          <ChevronRight className="w-5 h-5 text-stone-400" />
        </button>

        <button
          onClick={() => onNavigate('customize-subtypes')}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
        >
          <span className="text-base font-medium text-stone-800">
            SubTypes (Medications, etc)
          </span>
          <ChevronRight className="w-5 h-5 text-stone-400" />
        </button>

      </div>

    </div>
  );
};
