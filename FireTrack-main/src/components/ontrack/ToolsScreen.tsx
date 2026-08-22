import React, { useState } from 'react';
import { OnTrackHeader } from './OnTrackHeader';
import { 
  ChevronRight, 
  ChevronDown, 
  Settings, 
  Sliders, 
  Database, 
  RotateCcw, 
  FileSpreadsheet, 
  Trash2, 
  ShieldAlert,
  AlertTriangle 
} from 'lucide-react';
import { clearSqliteCacheAndReload } from '../../utils/sqliteDb';

interface ToolsScreenProps {
  onNavigate: (screen: string) => void;
  onBack: () => void;
  onExportCSV?: () => void;
  onExportBackup?: () => void;
  onOpenCsvImport?: () => void;
  onClearAllEntries?: () => void;
  onClearAllBloodRecords?: () => void;
}

export const ToolsScreen: React.FC<ToolsScreenProps> = ({
  onNavigate,
  onBack,
  onExportCSV,
  onExportBackup,
  onOpenCsvImport,
  onClearAllEntries,
  onClearAllBloodRecords
}) => {
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);

  const menuItems = [
    { 
      id: 'system-settings', 
      label: 'Le mie impostazioni (Impostazioni sistema)',
      sub: 'Impostazioni pasto Diario classico e reordine Note Evento',
      icon: Sliders,
      action: () => onNavigate('system-settings')
    },
    { 
      id: 'csv-import', 
      label: 'Importa Misurazioni da CSV / Excel',
      sub: 'Carica file CSV con anteprima prima del salvataggio nel database',
      icon: FileSpreadsheet,
      action: () => {
        if (onOpenCsvImport) {
          onOpenCsvImport();
        } else {
          onNavigate('system-settings');
        }
      }
    },
    { 
      id: 'backup-restore', 
      label: 'Gestione Backup, Ripristino & Esportazione',
      sub: 'Scarica database SQLite/JSON, esporta CSV/Excel o carica backup dal dispositivo',
      icon: Database,
      action: () => onNavigate('backup')
    },
  ];

  const dangerSubItems = [
    { 
      id: 'clear-entries', 
      label: 'Cancella Tutte le Letture Inserite',
      sub: 'Svuota tutte le misurazioni salvate nel database (irreversibile)',
      icon: Trash2,
      action: () => {
        if (onClearAllEntries) {
          onClearAllEntries();
        }
      }
    },
    { 
      id: 'clear-blood-tests', 
      label: 'Cancella Storico Analisi di Laboratorio',
      sub: 'Svuota tutti i prelievi ed esami del sangue registrati (irreversibile)',
      icon: Trash2,
      action: () => {
        if (onClearAllBloodRecords) {
          onClearAllBloodRecords();
        }
      }
    },
    { 
      id: 'clear-cache', 
      label: 'Pulisci Cache Browser & Ripristina Dati',
      sub: 'Svuota la memoria locale e ricarica le categorie di default',
      icon: RotateCcw,
      action: () => {
        clearSqliteCacheAndReload();
      }
    },
  ];

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-stone-100 via-[#e4e8eb] to-stone-200 dark:from-[#121418] dark:via-[#16191f] dark:to-[#121418] text-stone-900 dark:text-stone-100 transition-colors">
      
      {/* Header Bar */}
      <OnTrackHeader
        title="Strumenti & Impostazioni"
        showBack={true}
        onBack={onBack}
        showToolsMenu={false}
        onNavigate={(screen) => onNavigate(screen)}
      />

      {/* Menu List Container */}
      <div className="flex-1 max-w-3xl mx-auto w-full p-4 sm:p-6 space-y-6 pb-12">
        <div className="bg-white dark:bg-[#1a1d24] border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-md overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className="w-full p-5 flex items-center justify-between text-left transition-all group cursor-pointer hover:bg-stone-50/80 dark:hover:bg-stone-800/50"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-xl border shadow-xs transition-all bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700 group-hover:bg-[#8cc63f] group-hover:text-stone-900">
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-stone-900 dark:text-stone-100">
                    {item.label}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{item.sub}</div>
                </div>
              </div>
              <div className="p-2 rounded-full text-stone-400 dark:text-stone-500 transition-all shrink-0 ml-3 group-hover:bg-[#8cc63f] group-hover:text-stone-900">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}

          {/* Zona Pericolosa - Unica Entry con le 3 voci al suo interno */}
          <div className="bg-white dark:bg-[#1a1d24] transition-colors">
            <button
              onClick={() => setIsDangerZoneOpen(!isDangerZoneOpen)}
              className={`w-full p-5 flex items-center justify-between text-left transition-all cursor-pointer ${
                isDangerZoneOpen 
                  ? 'bg-rose-50/80 dark:bg-rose-950/30' 
                  : 'hover:bg-rose-50/40 dark:hover:bg-rose-950/20'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl border shadow-xs transition-all ${
                  isDangerZoneOpen
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/80'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-rose-700 dark:text-rose-400 flex items-center space-x-2">
                    <span>Zona Pericolosa</span>
                    <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                      3 Azioni
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Azioni irreversibili: cancellazione letture, storico esami e ripristino dati
                  </div>
                </div>
              </div>
              <div className={`p-2 rounded-full transition-all shrink-0 ml-3 ${
                isDangerZoneOpen
                  ? 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 rotate-180'
                  : 'text-stone-400 dark:text-stone-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:text-rose-600'
              }`}>
                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
              </div>
            </button>

            {/* Voci Pericolose Espandibili all'interno dell'entry */}
            {isDangerZoneOpen && (
              <div className="p-3 sm:p-4 bg-rose-50/40 dark:bg-rose-950/20 border-t border-rose-100 dark:border-rose-900/50 space-y-2.5">
                <div className="flex items-center space-x-2 px-2 py-1.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-900/40 rounded-xl border border-rose-200 dark:border-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>Attenzione: le azioni seguenti sono permanenti ed eliminano i dati memorizzati.</span>
                </div>

                <div className="bg-white dark:bg-[#15181f] border border-rose-200 dark:border-rose-900/60 rounded-xl overflow-hidden divide-y divide-rose-100 dark:divide-rose-900/40">
                  {dangerSubItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className="w-full p-4 flex items-center justify-between text-left transition-all group cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="p-2.5 rounded-lg border shadow-xs transition-all bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800 group-hover:bg-rose-600 group-hover:text-white">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-rose-800 dark:text-rose-300 group-hover:text-rose-900 dark:group-hover:text-rose-200">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">{item.sub}</div>
                        </div>
                      </div>
                      <div className="p-1.5 rounded-full text-stone-400 dark:text-stone-500 transition-all shrink-0 ml-2 group-hover:bg-rose-600 group-hover:text-white">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

