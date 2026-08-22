import React, { useState } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { HealthSubType } from '../../types/ontrack';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';

interface CustomizeSubTypesScreenProps {
  subTypes: HealthSubType[];
  onUpdateSubTypes: (updated: HealthSubType[]) => void;
  onBack: () => void;
}

export const CustomizeSubTypesScreen: React.FC<CustomizeSubTypesScreenProps> = ({
  subTypes,
  onUpdateSubTypes,
  onBack
}) => {
  const [subTypeList, setSubTypeList] = useState<HealthSubType[]>(subTypes);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const newSt: HealthSubType = {
      id: 'sub_' + Date.now(),
      name: newName.trim(),
      unit: newUnit.trim() || 'unità',
      isCustom: true
    };
    const updated = [...subTypeList, newSt];
    setSubTypeList(updated);
    onUpdateSubTypes(updated);
    setNewName('');
    setNewUnit('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = subTypeList.filter(s => s.id !== id);
    setSubTypeList(updated);
    onUpdateSubTypes(updated);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#e8ecee]">
      
      {/* Header Bar */}
      <OnTrackHeader
        title="Manage SubTypes"
        showBack={true}
        onBack={onBack}
        showToolsMenu={false}
      />

      {/* Main List */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-2 sm:p-4 space-y-3 pb-12">
        
        <div className="bg-white divide-y divide-stone-200 border border-stone-300 shadow-sm">
          {subTypeList.map((st) => (
            <div
              key={st.id}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-stone-50 transition-colors"
            >
              <div>
                <span className="text-base font-medium text-stone-800 block">
                  {st.name}
                </span>
                <span className="text-xs text-stone-400">
                  Unità: {st.unit}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {st.isCustom && (
                  <button
                    onClick={() => handleDelete(st.id)}
                    className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                    title="Elimina SubType"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <ChevronRight className="w-5 h-5 text-stone-400" />
              </div>
            </div>
          ))}
        </div>

        {/* Add New SubType Form or Button */}
        {showAddForm ? (
          <div className="bg-white p-3 border border-stone-300 space-y-2">
            <input
              type="text"
              placeholder="Nome SubType (es. Saturazione O2)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:border-emerald-600"
              autoFocus
            />
            <input
              type="text"
              placeholder="Unità di misura (es. %)"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:border-emerald-600"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded"
              >
                Annulla
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-1.5 bg-[#8cc63f] hover:bg-[#7bb334] text-white text-xs font-bold rounded shadow"
              >
                Aggiungi
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-3.5 bg-[#e0e4e6] hover:bg-[#d4d9dc] text-stone-700 font-semibold text-base border border-stone-300 shadow-sm flex items-center justify-center space-x-2 transition-colors"
          >
            <Plus className="w-5 h-5 text-stone-600" />
            <span>Add Custom SubType</span>
          </button>
        )}

      </div>

    </div>
  );
};
