import React, { useState } from 'react';
import { HealthCategory } from '../../types/ontrack';
import { ChevronLeft, Check, Droplet } from 'lucide-react';

interface EditCategoryScreenProps {
  category: HealthCategory | null;
  onSaveCategory: (updatedCategory: HealthCategory) => void;
  onDeleteCategory: (id: string) => void;
  onBack: () => void;
}

export const EditCategoryScreen: React.FC<EditCategoryScreenProps> = ({
  category,
  onSaveCategory,
  onDeleteCategory,
  onBack
}) => {
  const isNew = !category || !category.id;
  const [name, setName] = useState(category?.name || '');
  const [isDefault, setIsDefault] = useState(category?.isDefault || false);
  const [startEnabled, setStartEnabled] = useState(category?.startTimeEnabled ?? true);
  const [startTime, setStartTime] = useState(category?.startTime || '08:00');
  const [endEnabled, setEndEnabled] = useState(category?.endTimeEnabled ?? true);
  const [endTime, setEndTime] = useState(category?.endTime || '09:30');

  const handleSave = () => {
    if (!name.trim()) return;

    const catToSave: HealthCategory = {
      id: category?.id || 'cat_' + Date.now(),
      name: name.trim(),
      order: category?.order || 99,
      isDefault,
      startTimeEnabled: startEnabled,
      startTime,
      endTimeEnabled: endEnabled,
      endTime
    };

    onSaveCategory(catToSave);
    onBack();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#dcdcdc]">
      
      {/* Top Header Bar matching Screenshot exactly: Dark Gray/Black Header */}
      <div className="bg-[#24292b] text-white px-3 py-3 flex items-center justify-between shadow-md">
        
        {/* Left: Back Chevron + Water Drop Icon + "Edit Category" */}
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-white hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-6 h-6 text-white shrink-0" />
          
          {/* Water Drop Icon */}
          <div className="relative flex items-center justify-center">
            <Droplet className="w-5 h-5 text-white fill-white" />
          </div>

          <span className="text-lg font-normal tracking-wide pl-1">
            {isNew ? 'New Category' : 'Edit Category'}
          </span>
        </button>

        {/* Right: Save Checkmark Button */}
        <button
          onClick={handleSave}
          className="flex items-center space-x-1.5 text-stone-300 hover:text-white font-medium text-base px-2 py-1 transition-colors"
        >
          <Check className="w-5 h-5 text-stone-300" />
          <span>Save</span>
        </button>

      </div>

      {/* Main Body - Pixel-perfect reproduction of screenshot photo_2_2026-08-12_17-39-14 */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6 pt-6">
        
        {/* Category Name Input Field */}
        <div className="flex items-center justify-between pt-2 pb-1">
          <label className="text-stone-800 font-normal text-lg">
            Category
          </label>
          <div className="w-56 border-b border-stone-400 focus-within:border-stone-700">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Digiuno"
              className="w-full text-right text-stone-900 font-normal text-lg bg-transparent focus:outline-none px-1"
            />
          </div>
        </div>

        {/* Default Checkbox Row */}
        <div className="flex items-center justify-between py-2">
          <label className="text-stone-800 font-normal text-lg">
            Default
          </label>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-6 h-6 border-2 border-stone-500 rounded-none text-stone-800 focus:ring-0 cursor-pointer accent-stone-700"
          />
        </div>

        {/* Section Divider: Default Category By Time */}
        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-stone-400 w-full" />
          <span className="bg-[#dcdcdc] px-3 text-sm font-normal text-stone-700 relative z-10 whitespace-nowrap">
            Default Category By Time
          </span>
          <div className="border-t border-stone-400 w-full" />
        </div>

        {/* Start Time Row */}
        <div className="flex items-center justify-between py-2">
          <span className="text-stone-800 font-normal text-lg w-16">
            Start
          </span>
          
          {/* Bevelled Android ON/OFF Toggle Button */}
          <button
            type="button"
            onClick={() => setStartEnabled(!startEnabled)}
            className={`w-20 py-1.5 rounded-sm font-bold text-xs uppercase tracking-wider border shadow-sm flex flex-col items-center justify-center transition-all ${
              startEnabled
                ? 'bg-[#e0e0e0] text-stone-900 border-stone-400'
                : 'bg-[#cccccc] text-stone-500 border-stone-400'
            }`}
          >
            <span>{startEnabled ? 'ON' : 'OFF'}</span>
            {startEnabled && (
              <div className="w-10 h-1 bg-[#8cc63f] rounded-full mt-0.5 shadow-sm" />
            )}
          </button>

          {/* Time Display/Input */}
          <div className="w-32 border-b border-stone-400 text-right">
            <input
              type="time"
              value={startTime}
              disabled={!startEnabled}
              onChange={(e) => setStartTime(e.target.value)}
              className={`text-right text-lg font-mono bg-transparent focus:outline-none ${
                startEnabled ? 'text-stone-900 font-medium' : 'text-stone-400 opacity-50'
              }`}
            />
          </div>
        </div>

        {/* End Time Row */}
        <div className="flex items-center justify-between py-2">
          <span className="text-stone-800 font-normal text-lg w-16">
            End
          </span>
          
          {/* Bevelled Android ON/OFF Toggle Button */}
          <button
            type="button"
            onClick={() => setEndEnabled(!endEnabled)}
            className={`w-20 py-1.5 rounded-sm font-bold text-xs uppercase tracking-wider border shadow-sm flex flex-col items-center justify-center transition-all ${
              endEnabled
                ? 'bg-[#e0e0e0] text-stone-900 border-stone-400'
                : 'bg-[#cccccc] text-stone-500 border-stone-400'
            }`}
          >
            <span>{endEnabled ? 'ON' : 'OFF'}</span>
            {endEnabled && (
              <div className="w-10 h-1 bg-[#8cc63f] rounded-full mt-0.5 shadow-sm" />
            )}
          </button>

          {/* Time Display/Input */}
          <div className="w-32 border-b border-stone-400 text-right">
            <input
              type="time"
              value={endTime}
              disabled={!endEnabled}
              onChange={(e) => setEndTime(e.target.value)}
              className={`text-right text-lg font-mono bg-transparent focus:outline-none ${
                endEnabled ? 'text-stone-900 font-medium' : 'text-stone-400 opacity-50'
              }`}
            />
          </div>
        </div>

        {/* Big Raised Light Gray "Delete" Button matching photo_2_2026-08-12_17-39-14 */}
        {!isNew && (
          <div className="pt-10">
            <button
              type="button"
              onClick={() => {
                onDeleteCategory(category.id);
                onBack();
              }}
              className="w-full py-3.5 bg-[#f5f5f5] hover:bg-stone-200 active:bg-stone-300 text-stone-700 font-normal text-lg rounded-sm border border-stone-300 shadow-md transition-colors text-center cursor-pointer"
            >
              Delete
            </button>
          </div>
        )}

      </div>

    </div>
  );
};
