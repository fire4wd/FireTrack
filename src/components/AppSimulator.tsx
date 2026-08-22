import React, { useState, useEffect } from 'react';
import { Smartphone, RotateCcw, Plus, Search, Trash2, CheckCircle, ArrowLeft, RefreshCw, Sun, Moon, Battery, Wifi, ShieldCheck, Download } from 'lucide-react';
import { AppBlueprint, AppScreen } from '../types';

interface AppSimulatorProps {
  blueprint: AppBlueprint;
  onUpdateBlueprint: (updated: AppBlueprint) => void;
}

export const AppSimulator: React.FC<AppSimulatorProps> = ({
  blueprint,
  onUpdateBlueprint
}) => {
  const [activeScreenId, setActiveScreenId] = useState<string>(
    blueprint.screens[0]?.id || 'screen_1'
  );
  
  // Local state simulating database items
  const [items, setItems] = useState<any[]>(
    blueprint.mockData?.Note || [
      { id: '1', title: 'Nota di Esempio Replicata', content: 'Questa è una nota salvata nella replica.', tag: 'Generale', date: new Date().toLocaleDateString() },
      { id: '2', title: 'Spesa Vecchia App', content: 'Latte, Pane, Caffè, Biscotti', tag: 'Spesa', date: new Date().toLocaleDateString() }
    ]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [activeCategory, setActiveCategory] = useState('Lunghezza');
  const [inputValue, setInputValue] = useState('100');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Sync when blueprint changes
  useEffect(() => {
    if (blueprint.screens.length > 0) {
      setActiveScreenId(blueprint.screens[0].id);
    }
  }, [blueprint.id]);

  const activeScreen = blueprint.screens.find(s => s.id === activeScreenId) || blueprint.screens[0];

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      title: newItemTitle,
      content: newItemContent || 'Nessun dettaglio',
      tag: 'Generale',
      date: new Date().toLocaleDateString()
    };

    const updatedItems = [newItem, ...items];
    setItems(updatedItems);
    setNewItemTitle('');
    setNewItemContent('');

    // Update parent mock data if possible
    onUpdateBlueprint({
      ...blueprint,
      mockData: {
        ...blueprint.mockData,
        Note: updatedItems
      }
    });
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
  };

  const filteredItems = items.filter(i =>
    i.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Dynamic style bindings
  const primaryBg = blueprint.designSystem?.primaryColor || '#0099cc';
  const appBg = isDarkMode
    ? (blueprint.designSystem?.backgroundColor || '#121212')
    : '#f8fafc';
  const textColor = isDarkMode ? '#f1f5f9' : '#0f172a';
  const cardBg = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#ffffff';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start justify-center p-2 sm:p-4">
      
      {/* Phone Hardware Frame */}
      <div className="relative mx-auto w-full max-w-[380px] h-[720px] bg-stone-950 rounded-[48px] p-3 shadow-2xl border-4 border-stone-800 flex flex-col justify-between select-none">
        
        {/* Top Notch & Speaker */}
        <div className="relative w-full pt-1 pb-2 flex items-center justify-between px-6 z-20 text-[10px] text-stone-400 font-mono">
          <span>09:41</span>
          <div className="w-20 h-4 bg-stone-900 rounded-full border border-stone-800 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-stone-950 border border-stone-800" />
          </div>
          <div className="flex items-center space-x-1">
            <Wifi className="w-3 h-3" />
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Screen Bezel Container */}
        <div
          className="relative w-full h-full rounded-[36px] overflow-hidden flex flex-col justify-between transition-colors duration-300 border border-stone-800/80 shadow-inner"
          style={{ backgroundColor: appBg, color: textColor }}
        >
          
          {/* App Bar / Action Bar */}
          <div
            className="p-3.5 flex items-center justify-between shadow-md"
            style={{ backgroundColor: primaryBg, color: '#ffffff' }}
          >
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight truncate max-w-[200px]">
                {blueprint.appName}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-[10px] font-mono opacity-80">{blueprint.versionOriginal || 'v1.0'}</span>
            </div>
          </div>

          {/* Screen Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            
            {/* Interactive Screen Renderer */}
            {activeScreen ? (
              <div className="space-y-3">
                
                {/* Search Bar if available */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-50" />
                  <input
                    type="text"
                    placeholder="Cerca nella replica..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none transition-all"
                    style={{
                      backgroundColor: cardBg,
                      borderColor: borderColor,
                      color: textColor
                    }}
                  />
                </div>

                {/* Form to add item */}
                <form
                  onSubmit={handleAddItem}
                  className="p-3 rounded-xl border space-y-2 shadow-sm"
                  style={{ backgroundColor: cardBg, borderColor: borderColor }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 block">
                    Aggiungi Nuovo Elemento
                  </span>
                  <input
                    type="text"
                    placeholder="Titolo..."
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded border focus:outline-none"
                    style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: borderColor, color: textColor }}
                  />
                  <input
                    type="text"
                    placeholder="Contenuto o nota..."
                    value={newItemContent}
                    onChange={(e) => setNewItemContent(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded border focus:outline-none"
                    style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: borderColor, color: textColor }}
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center space-x-1 shadow"
                    style={{ backgroundColor: primaryBg }}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Salva nel Database</span>
                  </button>
                </form>

                {/* Items List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-medium opacity-70 px-1">
                    <span>Elementi Memorizzati ({filteredItems.length})</span>
                    <span className="text-[10px] font-mono">Offline Ready</span>
                  </div>

                  {filteredItems.length === 0 ? (
                    <div className="p-4 text-center text-xs opacity-50 italic">
                      Nessun dato trovato.
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl border flex items-start justify-between space-x-2 shadow-sm"
                        style={{ backgroundColor: cardBg, borderColor: borderColor }}
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-xs truncate">{item.title}</h4>
                          <p className="text-[11px] opacity-80 line-clamp-2 mt-0.5">{item.content}</p>
                          {item.date && (
                            <span className="text-[9px] opacity-50 block mt-1 font-mono">{item.date}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>
            ) : (
              <div className="p-4 text-center text-xs opacity-60">Seleziona una schermata</div>
            )}

          </div>

          {/* Bottom App Navigation Bar inside Emulator */}
          <div
            className="p-2 border-t flex items-center justify-around text-[10px]"
            style={{ backgroundColor: isDarkMode ? '#090d16' : '#f1f5f9', borderColor: borderColor }}
          >
            {blueprint.screens.map((screen) => (
              <button
                key={screen.id}
                onClick={() => setActiveScreenId(screen.id)}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  activeScreenId === screen.id
                    ? 'font-bold shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: activeScreenId === screen.id ? primaryBg : 'transparent',
                  color: activeScreenId === screen.id ? '#ffffff' : textColor
                }}
              >
                {screen.name}
              </button>
            ))}
          </div>

        </div>

        {/* Bottom Hardware Home Bar */}
        <div className="w-full pt-2 flex justify-center">
          <div className="w-28 h-1 bg-stone-700 rounded-full" />
        </div>

      </div>

      {/* Simulator Control Panel & Info */}
      <div className="flex-1 space-y-4 max-w-xl">
        
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 text-stone-200 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h3 className="font-bold text-base text-stone-100">{blueprint.appName}</h3>
              <p className="text-xs text-stone-400">
                Anno originale: {blueprint.yearOriginal || 'N/A'} • Categoria: {blueprint.category}
              </p>
            </div>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 hover:text-stone-100 transition-colors flex items-center space-x-1.5 text-xs"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
              <span>{isDarkMode ? 'Tema Chiaro' : 'Tema Scuro'}</span>
            </button>
          </div>

          <p className="text-xs text-stone-300 leading-relaxed bg-stone-950 p-3 rounded-xl border border-stone-800/80">
            {blueprint.summary}
          </p>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-stone-950/80 p-2.5 rounded-xl border border-stone-800">
              <span className="text-emerald-400 font-bold block text-sm">{blueprint.screens.length}</span>
              <span className="text-[10px] text-stone-400">Schermate</span>
            </div>
            <div className="bg-stone-950/80 p-2.5 rounded-xl border border-stone-800">
              <span className="text-emerald-400 font-bold block text-sm">{blueprint.features.length}</span>
              <span className="text-[10px] text-stone-400">Funzionalità</span>
            </div>
            <div className="bg-stone-950/80 p-2.5 rounded-xl border border-stone-800">
              <span className="text-emerald-400 font-bold block text-sm">{items.length}</span>
              <span className="text-[10px] text-stone-400">Record nel DB</span>
            </div>
          </div>

          {/* Active Screen Key Actions */}
          {activeScreen && activeScreen.keyActions?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-stone-300 block">
                Azioni chiave della schermata selezionata ({activeScreen.name}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeScreen.keyActions.map((act, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[11px] flex items-center space-x-1"
                  >
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    <span>{act}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* User Notes */}
          {blueprint.userNotes && (
            <div className="text-xs text-stone-400 bg-stone-950/40 p-3 rounded-xl border border-stone-800">
              <strong className="text-stone-300 block mb-1">Note di Preservazione:</strong>
              {blueprint.userNotes}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
