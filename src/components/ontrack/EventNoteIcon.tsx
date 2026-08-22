import React from 'react';

export interface EventNoteIconProps {
  id: string; // 'carbs' | 'exercise' | 'meds' | 'bottle' | 'meter' | 'sick' | 'stress' | 'sad'
  size?: 'sm' | 'md' | 'lg' | 'xl';
  selected?: boolean;
  onClick?: () => void;
  showLabel?: boolean;
  className?: string;
}

export const defaultEventNotes = [
  { id: 'carbs', label: 'Carboidrati', bgColor: '#eab308', iconSymbol: '🥐' },
  { id: 'exercise', label: 'Attività fisica', bgColor: '#ec4899', iconSymbol: '🏃' },
  { id: 'meds', label: 'Farmaci', bgColor: '#ef4444', iconSymbol: '💊' },
  { id: 'bottle', label: 'Insulina / Flacone', bgColor: '#64748b', iconSymbol: '🍾' },
  { id: 'meter', label: 'Glicemia', bgColor: '#f97316', iconSymbol: '🩸' },
  { id: 'sick', label: 'Malattia', bgColor: '#22c55e', iconSymbol: '🤢' },
  { id: 'stress', label: 'Stress', bgColor: '#eab308', iconSymbol: '⚡' },
  { id: 'sad', label: 'Umore', bgColor: '#3b82f6', iconSymbol: '🙁' },
];

export const EventNoteIcon: React.FC<EventNoteIconProps> = ({
  id,
  size = 'md',
  selected = false,
  onClick,
  showLabel = false,
  className = ''
}) => {
  const noteInfo = defaultEventNotes.find(n => n.id === id) || {
    id,
    label: id,
    bgColor: '#3b82f6',
    iconSymbol: '📝'
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-14 h-14 text-xl'
  }[size];

  // Vector graphics for exact screenshot match
  const renderVectorGlyph = () => {
    switch (id) {
      case 'carbs':
        // Fork & Knife / Bread
        return (
          <svg className="w-1/2 h-1/2 fill-white stroke-white" viewBox="0 0 24 24">
            <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.46 3.91 3.45 4.38L6 22h2l.45-8.62C10.44 12.91 11 11.12 11 9zm7-7h-1a3 3 0 0 0-3 3v8h2v9h2V2z" />
          </svg>
        );
      case 'exercise':
        // Running person
        return (
          <svg className="w-1/2 h-1/2 fill-white" viewBox="0 0 24 24">
            <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 6.1 1.2z" />
          </svg>
        );
      case 'meds':
        // Capsule pill
        return (
          <svg className="w-1/2 h-1/2 fill-white" viewBox="0 0 24 24">
            <path d="M6 3h12v2H6zm0 16h12v2H6zm3-13h6v10H9zm1 2v6h4V8z" />
            <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        );
      case 'bottle':
        // Insulin / Medicine Bottle
        return (
          <svg className="w-1/2 h-1/2 fill-white" viewBox="0 0 24 24">
            <path d="M9 2h6v2H9zm1 3h4v2h-4zm-3 4h10v12H7z" />
          </svg>
        );
      case 'meter':
        // Glass tumbler / test strip
        return (
          <svg className="w-1/2 h-1/2 stroke-white fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M6 3l1.5 16a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2L18 3" />
            <path d="M6 8h12" />
          </svg>
        );
      case 'sick':
        // Nauseous face > <
        return (
          <svg className="w-1/2 h-1/2 fill-none stroke-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M7 9l3 2-3 2M17 9l-3 2 3 2M8 17s1.5-1.5 4-1.5 4 1.5 4 1.5" />
          </svg>
        );
      case 'stress':
        // Stressed face with sweat drop
        return (
          <svg className="w-1/2 h-1/2 fill-none stroke-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M8 10h.01M16 10h.01M8 17c1.5-1 6.5-1 8 0" />
            <path d="M19 6c.5 1 1 2 1 3s-.5 2-1 2-1-1-1-2 .5-2 1-3z" fill="white" />
          </svg>
        );
      case 'sad':
        // Sad face
        return (
          <svg className="w-1/2 h-1/2 fill-none stroke-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M8 10h.01M16 10h.01M16 16c-1.5-1.5-6.5-1.5-8 0" />
          </svg>
        );
      default:
        return <span className="text-white font-bold">{noteInfo.iconSymbol}</span>;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center justify-center cursor-pointer select-none transition-all ${className}`}
      title={noteInfo.label}
    >
      <div
        className={`${sizeClasses} rounded-full flex items-center justify-center shadow-xs transition-transform active:scale-95 ${
          selected ? 'ring-3 ring-offset-2 ring-stone-800 scale-105' : 'hover:scale-105'
        }`}
        style={{ backgroundColor: noteInfo.bgColor }}
      >
        {renderVectorGlyph()}
      </div>
      {showLabel && (
        <span className="text-[10px] font-semibold text-stone-700 mt-1 text-center max-w-[60px] truncate">
          {noteInfo.label}
        </span>
      )}
    </div>
  );
};
