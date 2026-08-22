import React from 'react';

interface Fire4wdLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const Fire4wdLogo: React.FC<Fire4wdLogoProps> = ({ size = 'md', showText = true }) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
  }[size];

  const textSize = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm'
  }[size];

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Icon Squircle Card matching photo_2026-08-13_16-56-31 */}
      <div className={`${sizeClasses} bg-white rounded-2xl p-1.5 shadow-md border border-stone-300 flex items-center justify-center relative overflow-hidden`}>
        
        {/* Inner Light Gray Background Box */}
        <div className="w-full h-full bg-[#d0d5d8] rounded-xl flex items-center justify-center relative p-1">
          
          {/* Two Red Blood Drops SVG matching screenshot */}
          <svg className="w-full h-full text-[#d64527] fill-current drop-shadow-xs" viewBox="0 0 100 100">
            {/* Top Left Blood Drop */}
            <path
              d="M32 20 C32 20, 14 45, 14 58 C14 68, 22 76, 32 76 C42 76, 50 68, 50 58 C50 45, 32 20, 32 20 Z"
              fill="#d94326"
            />
            {/* Bottom Right Blood Drop (Slightly larger, overlapping) */}
            <path
              d="M62 32 C62 32, 40 62, 40 76 C40 88, 50 96, 62 96 C74 96, 84 88, 84 76 C84 62, 62 32, 62 32 Z"
              fill="#c03217"
            />
          </svg>

        </div>

      </div>

      {/* Label "FireTrack v1.0.0" underneath */}
      {showText && (
        <span className={`mt-1 font-bold tracking-tight text-stone-600 ${textSize} font-sans flex items-center space-x-1`}>
          <span>FireTrack</span>
          <span className="text-[10px] text-amber-700 font-mono bg-amber-100 px-1 py-0.2 rounded border border-amber-200">v1.0.0</span>
        </span>
      )}
    </div>
  );
};
