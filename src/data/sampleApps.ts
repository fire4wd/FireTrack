import { AppBlueprint } from '../types';

export const sampleApps: AppBlueprint[] = [
  {
    id: 'memo-pad-holo',
    appName: 'MemoPad Holo (2012)',
    category: 'Produttività',
    versionOriginal: 'v1.4.2 (Android 4.0 Holo)',
    yearOriginal: '2012',
    summary: 'Classica app di note offline con interfaccia Holo Dark/Light, categorizzazione con tag e ricerca rapida.',
    designSystem: {
      primaryColor: '#0099cc',
      secondaryColor: '#33b5e5',
      backgroundColor: '#121212',
      fontStyle: 'Roboto Holo Clean',
      overallStyle: 'Android Holo Dark vintage con accenti azzurro tron e schede sottili.'
    },
    screens: [
      {
        id: 'screen_notes_list',
        name: 'Elenco Note',
        description: 'Schermata principale con elenco note ordinate per data e barra di ricerca superiore.',
        components: [
          { id: 'c1', type: 'input', label: 'Cerca nota...', placeholder: 'Filtra per titolo o contenuto' },
          { id: 'c2', type: 'list', label: 'Lista Note Memorizzate' },
          { id: 'c3', type: 'button', label: '+ Nuova Nota', action: 'add_note' }
        ],
        keyActions: ['Creazione rapida', 'Ricerca immediata', 'Filtro per Tag']
      },
      {
        id: 'screen_note_edit',
        name: 'Editor Nota',
        description: 'Form di inserimento titolo, categoria e contenuto testo con salvataggio automatico.',
        components: [
          { id: 'c4', type: 'input', label: 'Titolo Nota', placeholder: 'Es. Lista della spesa' },
          { id: 'c5', type: 'input', label: 'Contenuto', placeholder: 'Scrivi qui...' },
          { id: 'c6', type: 'button', label: 'Salva Nota', action: 'save_note' }
        ],
        keyActions: ['Salvataggio locale', 'Copia testo', 'Eliminazione']
      }
    ],
    features: [
      { id: 'f1', title: 'Funzionamento 100% Offline', description: 'Nessun server esterno richiesto, salvataggio nel database locale.', priority: 'Alta', completed: true },
      { id: 'f2', title: 'Ricerca', description: 'Filtra istantaneamente l\'elenco note durante la digitazione.', priority: 'Alta', completed: true },
      { id: 'f3', title: 'Temi Retro Holo', description: 'Passaggio tra Holo Dark e Holo Light originale.', priority: 'Media', completed: true }
    ],
    dataModel: [
      { id: 'd1', entity: 'Note', fields: ['id: string', 'title: string', 'content: string', 'tag: string', 'updatedAt: date'] }
    ],
    recommendations: [
      'Mantieni il layout nostalgico Holo con la barra azzurra Android 4.0.',
      'Aggiungi esportazione in file .txt o .json per non perdere mai i dati.',
      'Aggiungi la possibilità di condividere le note.'
    ],
    mockData: {
      Note: [
        { id: 'n1', title: 'Ricetta Torta di Mele Vintage', content: '3 uova, 200g farina, 100g zucchero, 2 mele red, cannella.', tag: 'Cucina', updatedAt: '2013-10-14' },
        { id: 'n2', title: 'Codici Segreti Gioco 2012', content: 'Su, Su, Giù, Giù, Sinistra, Destra, B, A', tag: 'Gaming', updatedAt: '2012-05-20' },
        { id: 'n3', title: 'Contatti Utili Vecchia App', content: 'Assistenza tecnica: support@oldapp.org (Dismesso)', tag: 'Info', updatedAt: '2014-01-08' }
      ]
    },
    userNotes: 'App salvata dall\'archivio APK 2012. Replicata fedelmente.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'unit-convert-retro',
    appName: 'Quick Unit Converter 2011',
    category: 'Utilità',
    versionOriginal: 'v2.1.0 (Android 2.3 Gingerbread)',
    yearOriginal: '2011',
    summary: 'Convertitore rapido di unità di misura (Lunghezza, Peso, Temperatura, Valuta) con tastiera numerica integrata.',
    designSystem: {
      primaryColor: '#8a9a5b',
      secondaryColor: '#4c6328',
      backgroundColor: '#1b211a',
      fontStyle: 'Monospace Retro Display',
      overallStyle: 'Toni caldi stile Gingerbread, pulsanti grandi e schermo digitale LCD verde.'
    },
    screens: [
      {
        id: 'screen_converter',
        name: 'Convertitore Principale',
        description: 'Selezione categoria, unità di partenza, unità di arrivo e risultato in tempo reale.',
        components: [
          { id: 'cc1', type: 'toggle', label: 'Categoria: Lunghezza / Peso / Temp / Valuta' },
          { id: 'cc2', type: 'input', label: 'Valore da convertire', placeholder: '100' },
          { id: 'cc3', type: 'card', label: 'Risultato Convertito' }
        ],
        keyActions: ['Calcolo istantaneo', 'Inversione Unità', 'Copia Risultato']
      }
    ],
    features: [
      { id: 'f10', title: 'Calcolo Istantaneo Senza Ricaricamento', description: 'Conversione dinamica ad ogni cifra digitata.', priority: 'Alta', completed: true },
      { id: 'f11', title: 'Supporto Unità Imperiali e Metriche', description: 'Metri, Chilometri, Miglia, Pollici, Libbre, Kg, Celsius, Fahrenheit.', priority: 'Alta', completed: true }
    ],
    dataModel: [
      { id: 'd10', entity: 'ConversionRates', fields: ['category: string', 'fromUnit: string', 'toUnit: string', 'multiplier: number'] }
    ],
    recommendations: [
      'Aggiungi un tastierino numerico a schermo per simulare la digitazione sui vecchi telefoni senza tastiera touch reattiva.',
      'Fornisci opzione di personalizzazione tassi di cambio.'
    ],
    mockData: {
      ConversionHistory: [
        { id: 'h1', query: '100 Km -> Miglia', result: '62.1371 mi', date: '2011-09-01' },
        { id: 'h2', query: '37.5 °C -> °F', result: '99.5 °F', date: '2011-09-02' }
      ]
    },
    userNotes: 'Replicato da screenshot vecchio HTC Desire.',
    createdAt: new Date().toISOString()
  }
];
