import React from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { HealthCategory } from '../../types/ontrack';
import { ChevronRight, Plus, Trash2, Menu } from 'lucide-react';

interface CustomizeCategoriesScreenProps {
  categories: HealthCategory[];
  onUpdateCategories: (updated: HealthCategory[]) => void;
  onEditCategory: (cat: HealthCategory | null) => void;
  onBack: () => void;
}

export const CustomizeCategoriesScreen: React.FC<CustomizeCategoriesScreenProps> = ({
  categories,
  onUpdateCategories,
  onEditCategory,
  onBack
}) => {
  const handleDeleteCategory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = categories.filter(c => c.id !== id);
    onUpdateCategories(updated);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#e8ecee]">
      
      {/* Header Bar */}
      <OnTrackHeader
        title="Categories"
        showBack={true}
        onBack={onBack}
        showToolsMenu={false}
      />

      {/* Main List */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-2 sm:p-4 space-y-3 pb-12">
        
        <div className="bg-white divide-y divide-stone-200 border border-stone-300 shadow-sm">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => onEditCategory(cat)}
              className="px-4 py-3.5 flex items-center justify-between hover:bg-stone-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-3">
                {/* Reorder drag handle icon matching screenshot */}
                <div className="flex flex-col space-y-0.5 opacity-40 text-stone-600">
                  <Menu className="w-4 h-4" />
                </div>
                <span className="text-base font-medium text-stone-800">
                  {cat.name}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => handleDeleteCategory(e, cat.id)}
                  className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                  title="Elimina Categoria"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-stone-400" />
              </div>
            </div>
          ))}
        </div>

        {/* Add Another Category Button -> Opens EditCategoryScreen form */}
        <button
          onClick={() => onEditCategory(null)}
          className="w-full py-3.5 bg-[#e0e4e6] hover:bg-[#d4d9dc] active:bg-[#c8cdcf] text-stone-700 font-semibold text-base border border-stone-300 shadow-sm flex items-center justify-center space-x-2 transition-colors"
        >
          <Plus className="w-5 h-5 text-stone-600" />
          <span>Add Another</span>
        </button>

      </div>

    </div>
  );
};
