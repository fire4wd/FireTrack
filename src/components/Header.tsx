import React from 'react';
import { Smartphone, Sparkles, PlusCircle, FolderHeart, Code2, Cpu } from 'lucide-react';

interface HeaderProps {
  onOpenAnalysis: () => void;
  onOpenNewBlank: () => void;
  activeTab: 'simulator' | 'blueprint' | 'export' | 'library';
  setActiveTab: (tab: 'simulator' | 'blueprint' | 'export' | 'library') => void;
  currentAppName: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAnalysis,
  onOpenNewBlank,
  activeTab,
  setActiveTab,
  currentAppName
}) => {
  return (
    <header className="bg-stone-900 border-b border-stone-800 text-stone-100 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-900/40 border border-emerald-400/30">
              <Smartphone className="w-5 h-5 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-stone-100 via-stone-200 to-stone-400 bg-clip-text text-transparent">
                  APK Replicator
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  Preservation Studio
                </span>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block">
                Ricostruisci e preserva vecchie app Android dismesse
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-stone-950/60 p-1.5 rounded-xl border border-stone-800/80">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'simulator'
                  ? 'bg-stone-800 text-emerald-400 shadow-sm border border-stone-700/60'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Emulatore Vivo</span>
            </button>

            <button
              onClick={() => setActiveTab('blueprint')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'blueprint'
                  ? 'bg-stone-800 text-emerald-400 shadow-sm border border-stone-700/60'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <FolderHeart className="w-4 h-4" />
              <span>Blueprint & Struttura</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'export'
                  ? 'bg-stone-800 text-emerald-400 shadow-sm border border-stone-700/60'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Codice Replicato</span>
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenAnalysis}
              className="flex items-center space-x-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-stone-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Analizza Vecchia App con AI</span>
              <span className="sm:hidden">Analizza AI</span>
            </button>

            <button
              onClick={onOpenNewBlank}
              className="flex items-center space-x-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-xl border border-stone-700 transition-all"
              title="Crea nuovo progetto vuoto"
            >
              <PlusCircle className="w-4 h-4 text-stone-400" />
              <span className="hidden lg:inline">Nuovo Replica</span>
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Sub-Nav */}
      <div className="md:hidden flex items-center justify-around bg-stone-950 border-t border-stone-800/80 py-2 px-2 text-xs">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-3 py-1.5 rounded-md flex items-center space-x-1 ${
            activeTab === 'simulator' ? 'bg-stone-800 text-emerald-400' : 'text-stone-400'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Simulatore</span>
        </button>
        <button
          onClick={() => setActiveTab('blueprint')}
          className={`px-3 py-1.5 rounded-md flex items-center space-x-1 ${
            activeTab === 'blueprint' ? 'bg-stone-800 text-emerald-400' : 'text-stone-400'
          }`}
        >
          <FolderHeart className="w-3.5 h-3.5" />
          <span>Blueprint</span>
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-3 py-1.5 rounded-md flex items-center space-x-1 ${
            activeTab === 'export' ? 'bg-stone-800 text-emerald-400' : 'text-stone-400'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Esporta</span>
        </button>
      </div>
    </header>
  );
};
