import React from 'react';
import { OnTrackApp } from './components/OnTrackApp';

export default function App() {
  return (
    <div className="w-full min-h-screen bg-[#e8ecee] dark:bg-[#121418] text-stone-900 dark:text-stone-100 font-sans flex flex-col">
      <OnTrackApp />
    </div>
  );
}
