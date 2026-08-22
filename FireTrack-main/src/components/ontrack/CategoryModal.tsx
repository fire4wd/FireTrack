import React from 'react';
import { HealthCategory } from '../../types/ontrack';

interface CategoryModalProps {
  isOpen: boolean;
  categories: HealthCategory[];
  selectedCategoryId: string;
  onSelectCategory: (category: HealthCategory) => void;
  onClose: () => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-[#1a1d24] rounded-none shadow-2xl w-full max-w-xs overflow-hidden border border-stone-400 dark:border-stone-700">
        
        {/* Dark Header */}
        <div className="bg-[#111111] text-white px-4 py-3 border-b border-stone-800">
          <h3 className="text-base font-bold tracking-wide">Seleziona Categoria</h3>
        </div>

        {/* Options List */}
        <div className="divide-y divide-stone-200 dark:divide-stone-800 max-h-[60vh] overflow-y-auto">
          {categories.map((cat) => {
            const isSelected = cat.id === selectedCategoryId || cat.name === selectedCategoryId;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat);
                  onClose();
                }}
                className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  {cat.name}
                </span>

                {/* Android Radio Circle */}
                <div className="w-5 h-5 rounded-full border-2 border-stone-500 dark:border-stone-400 flex items-center justify-center">
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#8cc63f]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Cancel Action */}
        <div className="bg-stone-100 dark:bg-stone-900 px-4 py-2 text-right border-t border-stone-200 dark:border-stone-800">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 uppercase tracking-wider px-2 py-1"
          >
            Annulla
          </button>
        </div>

      </div>
    </div>
  );
};
