import React from 'react';

interface AppleIconProps {
  className?: string;
  size?: number;
}

/**
 * Pre-pasto Icon: Whole Apple silhouette with stem and leaf
 */
export const WholeAppleIcon: React.FC<AppleIconProps> = ({ className = 'w-4 h-4 text-stone-800' }) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Stem */}
      <path d="M15.3 8.2 C15.3 5.8 16.1 3.5 17.2 2 C17.7 2 17.8 2.4 17.6 2.8 C16.8 4.5 16.4 6.5 16.5 8.3 Z" />
      {/* Leaf */}
      <path d="M15.4 5.8 C12.5 4.2 9.5 5.2 7.2 7.2 C9.6 8.6 12.8 8.1 15.4 5.8 Z" />
      {/* Apple Body */}
      <path d="M16 9 C17.5 8.1 19.8 8 22 9.2 C24.8 10.8 25.8 14 25.2 17.5 C24.2 22.5 20.4 28.6 17.5 28.8 C16.7 28.9 16.3 28.2 16 28.2 C15.7 28.2 15.3 28.9 14.5 28.8 C11.6 28.6 7.8 22.5 6.8 17.5 C6.2 14 7.2 10.8 10 9.2 C12.2 8 14.5 8.1 16 9 Z" />
    </svg>
  );
};

/**
 * Post-pasto Icon: Apple Core silhouette matching user's image (torsolo di mela with stem and curved leaf)
 */
export const AppleCoreIcon: React.FC<AppleIconProps> = ({ className = 'w-4 h-4 text-stone-800' }) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Stem */}
      <path d="M15.3 8.2 C15.3 5.8 16.1 3.5 17.2 2 C17.7 2 17.8 2.4 17.6 2.8 C16.8 4.5 16.4 6.5 16.5 8.3 Z" />
      {/* Leaf curving to upper-left */}
      <path d="M15.4 5.8 C12.5 4.2 9.5 5.2 7.2 7.2 C9.6 8.6 12.8 8.1 15.4 5.8 Z" />
      {/* Apple Core Body with Top Shoulders, Bitten Center Waist, and Bottom Lobes */}
      <path d="M16 9.2 C17.6 8.4 19.8 8.3 22 9.6 C23.8 10.7 24.2 12.5 23.5 14.2 C20.5 15.2 18.8 17.5 18.8 19.2 C18.8 20.8 20.5 23 23.5 24 C24.2 25.5 23.8 27.2 22 28.3 C19.8 29.5 17.5 29 16 28.1 C14.5 29 12.2 29.5 10 28.3 C8.2 27.2 7.8 25.5 8.5 24 C11.5 23 13.2 20.8 13.2 19.2 C13.2 17.5 11.5 15.2 8.5 14.2 C7.8 12.5 8.2 10.7 10 9.6 C12.2 8.3 14.4 8.4 16 9.2 Z" />
    </svg>
  );
};
