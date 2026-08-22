import React, { useState, useRef } from 'react';
import { X, Sparkles, Upload, FileText, Image as ImageIcon, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import { AppBlueprint } from '../types';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppBlueprintGenerated: (blueprint: AppBlueprint) => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  onClose,
  onAppBlueprintGenerated
}) => {
  const [promptText, setPromptText] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        if (event.target?.result) {
          setImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRunAnalysis = async () => {
    if (!promptText.trim() && images.length === 0 && !codeSnippet.trim()) {
      setErrorMsg('Inserisci almeno una descrizione, uno screenshot o del codice/stringhe estratte dalla vecchia app.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/analyze-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          codeSnippet: codeSnippet,
          images: images
        })
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || resData.details || 'Errore durante l\'analisi AI');
      }

      const data = resData.data;

      // Map response to AppBlueprint
      const newBlueprint: AppBlueprint = {
        id: 'app-' + Date.now(),
        appName: data.appName || 'Vecchia App Replicata',
        category: data.category || 'Generale',
        versionOriginal: 'v1.0 (Ricostruita)',
        yearOriginal: '2013-2015',
        summary: data.summary || 'Applicazione ricreata mediante analisi AI.',
        designSystem: {
          primaryColor: data.designSystem?.primaryColor || '#0099cc',
          secondaryColor: data.designSystem?.secondaryColor || '#33b5e5',
          backgroundColor: data.designSystem?.backgroundColor || '#121212',
          fontStyle: data.designSystem?.fontStyle || 'Roboto Holo Clean',
          overallStyle: data.designSystem?.overallStyle || 'Material/Holo Vintage'
        },
        screens: (data.screens || []).map((sc: any, idx: number) => ({
          id: sc.id || `screen_${idx + 1}`,
          name: sc.name || `Schermata ${idx + 1}`,
          description: sc.description || '',
          components: Array.isArray(sc.components)
            ? sc.components.map((cName: string, cIdx: number) => ({
                id: `comp_${idx}_${cIdx}`,
                type: cName.toLowerCase().includes('input') || cName.toLowerCase().includes('cerca')
                  ? 'input'
                  : cName.toLowerCase().includes('pulsante') || cName.toLowerCase().includes('button')
                  ? 'button'
                  : 'card',
                label: typeof cName === 'string' ? cName : 'Elemento UI'
              }))
            : [],
          keyActions: Array.isArray(sc.keyActions) ? sc.keyActions : []
        })),
        features: (data.features || []).map((f: any, idx: number) => ({
          id: `feat_${idx}`,
          title: f.title || `Funzionalità ${idx + 1}`,
          description: f.description || '',
          priority: f.priority || 'Alta',
          completed: true
        })),
        dataModel: (data.dataModel || []).map((dm: any, idx: number) => ({
          id: `data_${idx}`,
          entity: dm.entity || 'Entità',
          fields: Array.isArray(dm.fields) ? dm.fields : []
        })),
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        userNotes: 'Ricostruzione generata da AI in base agli input forniti dall\'utente.',
        createdAt: new Date().toISOString()
      };

      onAppBlueprintGenerated(newBlueprint);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Si è verificato un problema con il servizio di analisi.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-stone-100 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-100">Analisi e Ripristino con AI</h2>
              <p className="text-xs text-stone-400">
                Fornisci screenshot, testi o descrizioni della vecchia app per replicarla.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          
          {/* Info Banner */}
          <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl flex items-start space-x-2.5 text-stone-300">
            <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Non è possibile eseguire file bianari <code className="text-emerald-300 font-mono">.apk</code> direttamente come emulatori nativi, ma possiamo <strong>ricreare la tua app al 100% come applicazione web moderna</strong> analizzando i tuoi screenshot, le stringhe estratte o la descrizione delle funzionalità!
            </p>
          </div>

          {/* Prompt / Description */}
          <div>
            <label className="block text-stone-300 font-medium mb-1.5">
              1. Come funzionava la tua app? Descrivi funzionalità, colori e schermate:
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Es. Era una vecchia app del 2013 per calcolare i costi della spesa in condivisione. Aveva uno schermo scuro, un pulsante blu per aggiungere articoli, un grafico a torta e salvataggio offline..."
              rows={3}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-xs"
            />
          </div>

          {/* Screenshots Upload */}
          <div>
            <label className="block text-stone-300 font-medium mb-1.5">
              2. Hai screenshot o foto dello schermo della vecchia app? (Opzionale)
            </label>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-700 group">
                  <img src={img} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-stone-700 hover:border-emerald-500/80 bg-stone-950 flex flex-col items-center justify-center text-stone-400 hover:text-emerald-400 transition-colors"
              >
                <ImageIcon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">+ Immagine</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Decompiled Code or Extracted Text */}
          <div>
            <label className="block text-stone-300 font-medium mb-1.5">
              3. Stringhe estrapolate dall'APK o file XML/JSON (Opzionale):
            </label>
            <textarea
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              placeholder="Incolla qui stringhe.xml, nomi delle Activity, o testo decompilato..."
              rows={2}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 font-mono text-[11px] text-stone-300 placeholder-stone-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-6 border-t border-stone-800 pt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-200 transition-colors"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-stone-950 font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analisi AI in corso...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Ricostruisci con AI</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
