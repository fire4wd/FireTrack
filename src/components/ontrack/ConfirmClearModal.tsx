import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface ConfirmClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalEntriesCount?: number;
  title?: string;
  itemTypeLabel?: string;
  confirmMessage?: string;
}

export const ConfirmClearModal: React.FC<ConfirmClearModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  totalEntriesCount = 0,
  title,
  itemTypeLabel = 'letture',
  confirmMessage
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Reset step whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  // Auto-focus the "Annulla" (Cancel) button whenever the modal opens or step changes
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, step]);

  // Handle ESC key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (typeof onClose === 'function') {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSafeClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleSafeConfirm = () => {
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-stone-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={handleSafeClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-white dark:bg-[#1a1d24] w-full max-w-md rounded-2xl shadow-2xl border border-stone-300 dark:border-stone-700 overflow-hidden text-stone-900 dark:text-stone-100 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${step === 1 ? 'bg-amber-600 dark:bg-amber-700' : 'bg-red-600 dark:bg-red-700'} text-white px-5 py-4 flex items-center justify-between shadow-xs transition-colors duration-200`}>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              {step === 1 ? (
                <AlertTriangle className="w-5 h-5 text-white" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold">
                {step === 1 ? 'Conferma Cancellazione' : 'Ultima Conferma Definitiva'}
              </h3>
              <span className="text-[11px] opacity-90 block">
                {step === 1 ? 'Passaggio 1 di 2' : 'Passaggio 2 di 2 • Azione Finale'}
              </span>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {step === 1 ? (
            /* STEP 1: First Confirmation */
            <>
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {title || `Sei sicuro di voler cancellare TUTTI i ${itemTypeLabel} inseriti nel database?`}
                </p>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  {confirmMessage || `Questa operazione eliminerà tutti i ${totalEntriesCount > 0 ? `${totalEntriesCount} ` : ''}elementi registrati. Le categorie, i parametri e le impostazioni di sistema rimarranno intatte.`}
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-[11px] text-amber-900 dark:text-amber-200 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-semibold">
                  Ti verrà richiesta una seconda conferma di sicurezza prima dell'eliminazione effettiva.
                </span>
              </div>

              {/* Action Buttons: "Annulla" is primary and pre-selected / focused */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 bg-red-50/60 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 active:bg-red-200 text-xs font-bold transition-colors"
                >
                  Elimina definitivamente
                </button>

                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={handleSafeClose}
                  autoFocus
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 dark:hover:bg-stone-600 text-white text-xs font-bold shadow-md ring-2 ring-stone-900 dark:ring-stone-600 ring-offset-2 transition-all focus:outline-none focus:ring-4 focus:ring-teal-500"
                >
                  Annulla
                </button>
              </div>
            </>
          ) : (
            /* STEP 2: Second Final Confirmation */
            <>
              <div className="text-center space-y-2">
                <p className="text-sm font-extrabold text-red-700 dark:text-red-400">
                  ATTENZIONE: Stai per eliminare IRREVERSIBILMENTE tutti i record di {itemTypeLabel}.
                </p>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  Non sarà possibile annullare questa operazione né recuperare i dati eliminati.
                  Sei assolutamente certo di voler procedere con la cancellazione immediata?
                </p>
              </div>

              <div className="bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800 rounded-xl p-3 text-[11px] text-red-900 dark:text-red-200 flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="font-bold">
                  Conferma finale: tutti i record di {itemTypeLabel} registrati verranno azzerati.
                </span>
              </div>

              {/* Action Buttons: "Annulla" is STILL pre-selected and focused */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleSafeConfirm}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  Sì, elimina definitivamente tutto
                </button>

                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={handleSafeClose}
                  autoFocus
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 dark:hover:bg-stone-600 text-white text-xs font-bold shadow-md ring-2 ring-stone-900 dark:ring-stone-600 ring-offset-2 transition-all focus:outline-none focus:ring-4 focus:ring-teal-500"
                >
                  Annulla
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
