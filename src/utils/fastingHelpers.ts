import { FastingLevelDefinition, LogEntryItem } from '../types/ontrack';

export const FASTING_METABOLIC_LEVELS: FastingLevelDefinition[] = [
  {
    level: 1,
    title: 'Aumento della glicemia',
    minHours: 0,
    maxHours: 2,
    rangeLabel: '0h - 2h',
    description: "Nelle prime ore di digiuno il corpo degrada il glicogeno. La glicemia sale e il pancreas rilascia insulina per scomporre il glucosio in energia, immagazzinando l'eccesso.",
    badgeBg: 'bg-blue-500/15 dark:bg-blue-950/40',
    badgeBorder: 'border-blue-400/40 dark:border-blue-800',
    textColor: 'text-blue-600 dark:text-blue-400',
    barColor: '#3b82f6'
  },
  {
    level: 2,
    title: 'Calo della glicemia',
    minHours: 2,
    maxHours: 5,
    rangeLabel: '2h - 5h',
    description: "La glicemia torna a valori normali dopo il picco. L'insulina viene trasferita nel sistema circolatorio e i livelli non continuano a salire.",
    badgeBg: 'bg-sky-500/15 dark:bg-sky-950/40',
    badgeBorder: 'border-sky-400/40 dark:border-sky-800',
    textColor: 'text-sky-600 dark:text-sky-400',
    barColor: '#0ea5e9'
  },
  {
    level: 3,
    title: 'La glicemia torna normale',
    minHours: 5,
    maxHours: 8,
    rangeLabel: '5h - 8h',
    description: "La glicemia si stabilizza. Lo stomaco segnala la fame ma non è fame vera. Il corpo utilizza il glucosio immagazzinato e continua a funzionare normalmente.",
    badgeBg: 'bg-cyan-500/15 dark:bg-cyan-950/40',
    badgeBorder: 'border-cyan-400/40 dark:border-cyan-800',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    barColor: '#06b6d4'
  },
  {
    level: 4,
    title: 'Passaggio alla modalità digiuno',
    minHours: 8,
    maxHours: 10,
    rangeLabel: '8h - 10h',
    description: "Il fegato esaurisce le riserve di glucosio. Il corpo entra in gluconeogenesi: produce glucosio dal grasso corporeo invece che dai carboidrati. Il consumo calorico aumenta.",
    badgeBg: 'bg-teal-500/15 dark:bg-teal-950/40',
    badgeBorder: 'border-teal-400/40 dark:border-teal-800',
    textColor: 'text-teal-600 dark:text-teal-400',
    barColor: '#14b8a6'
  },
  {
    level: 5,
    title: 'Combustione dei grassi (poco glicogeno)',
    minHours: 10,
    maxHours: 12,
    rangeLabel: '10h - 12h',
    description: "Le riserve di glicogeno sono quasi esaurite. Le cellule adipose rilasciano grasso nel sangue che va al fegato per essere convertito in energia.",
    badgeBg: 'bg-emerald-500/15 dark:bg-emerald-950/40',
    badgeBorder: 'border-emerald-400/40 dark:border-emerald-800',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    barColor: '#10b981'
  },
  {
    level: 6,
    title: 'Stato di chetosi',
    minHours: 12,
    maxHours: 18,
    rangeLabel: '12h - 18h',
    description: "Il corpo brucia grassi come carburante. Il fegato converte il grasso in chetoni, una fonte energetica alternativa. La chetosi riduce l'infiammazione e fa bene a cuore, metabolismo e cervello.",
    badgeBg: 'bg-amber-500/15 dark:bg-amber-950/40',
    badgeBorder: 'border-amber-400/40 dark:border-amber-800',
    textColor: 'text-amber-600 dark:text-amber-400',
    barColor: '#f59e0b'
  },
  {
    level: 7,
    title: 'Modalità bruciagrassi',
    minHours: 18,
    maxHours: 24,
    rangeLabel: '18h - 24h',
    description: "Più il digiuno si allunga, più la chetosi si intensifica. Dopo 18 ore, l'energia derivante dal grasso aumenta del 60%. I chetoni regolano il metabolismo e attivano processi anti-infiammatori.",
    badgeBg: 'bg-orange-500/15 dark:bg-orange-950/40',
    badgeBorder: 'border-orange-400/40 dark:border-orange-800',
    textColor: 'text-orange-600 dark:text-orange-400',
    barColor: '#f97316'
  },
  {
    level: 8,
    title: 'Autofagia',
    minHours: 24,
    maxHours: 48,
    rangeLabel: '24h - 48h',
    description: "Il corpo avvia l'autofagia: le cellule fanno pulizia eliminando componenti inutili e danneggiati. Virus e batteri vengono scomposti e riciclati. È un processo di ringiovanimento cellulare.",
    badgeBg: 'bg-purple-500/15 dark:bg-purple-950/40',
    badgeBorder: 'border-purple-400/40 dark:border-purple-800',
    textColor: 'text-purple-600 dark:text-purple-400',
    barColor: '#9333ea'
  },
  {
    level: 9,
    title: 'Ormone della crescita',
    minHours: 48,
    maxHours: 56,
    rangeLabel: '48h - 56h',
    description: "L'ormone della crescita aumenta molto. Favorisce la produzione di chetoni, riduce la fame, aumenta la massa muscolare e migliora la salute cardiovascolare.",
    badgeBg: 'bg-fuchsia-500/15 dark:bg-fuchsia-950/40',
    badgeBorder: 'border-fuchsia-400/40 dark:border-fuchsia-800',
    textColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    barColor: '#c026d3'
  },
  {
    level: 10,
    title: "Sensibilità all'insulina",
    minHours: 56,
    maxHours: 72,
    rangeLabel: '56h - 72h',
    description: "L'insulina raggiunge il livello più basso del digiuno. Questo aumenta la sensibilità all'insulina, attiva l'autofagia e riduce l'infiammazione.",
    badgeBg: 'bg-pink-500/15 dark:bg-pink-950/40',
    badgeBorder: 'border-pink-400/40 dark:border-pink-800',
    textColor: 'text-pink-600 dark:text-pink-400',
    barColor: '#db2777'
  },
  {
    level: 11,
    title: 'Rigenerazione del sistema immunitario',
    minHours: 72,
    maxHours: 9999,
    rangeLabel: '≥ 72h',
    description: "Le cellule immunitarie danneggiate vengono distrutte e sostituite con nuove staminali. Si innesca una rigenerazione cellulare profonda e il sistema immunitario si rinnova.",
    badgeBg: 'bg-rose-500/15 dark:bg-rose-950/40',
    badgeBorder: 'border-rose-400/40 dark:border-rose-800',
    textColor: 'text-rose-600 dark:text-rose-400',
    barColor: '#e11d48'
  }
];

export const FASTING_PROTOCOLS = [
  { id: '14:10', label: '14:10', hours: 14 },
  { id: '16:8', label: '16:8', hours: 16 },
  { id: '18:6', label: '18:6', hours: 18 },
  { id: '20:4', label: '20:4', hours: 20 },
  { id: 'OMAD (23:1)', label: 'OMAD (23:1)', hours: 23 },
  { id: '24h', label: '24h', hours: 24 },
  { id: '36h', label: '36h', hours: 36 },
  { id: '48h', label: '48h', hours: 48 },
  { id: '72h', label: '72h', hours: 72 }
];

export const FASTING_PLANS = FASTING_PROTOCOLS;

/**
 * Calculates end date (YYYY-MM-DD) and end time (HH:mm) from start date, start time, and target hours (piano).
 */
export function calculateFastingEndDateTime(
  startDateStr: string,
  startTimeStr: string,
  targetHours: number
): { endDate: string; endTime: string } {
  const startObj = parseEntryDateTime(startDateStr, startTimeStr) || new Date();
  const endMs = startObj.getTime() + (Number(targetHours) || 16) * 3600 * 1000;
  const endObj = new Date(endMs);

  const y = endObj.getFullYear();
  const m = String(endObj.getMonth() + 1).padStart(2, '0');
  const d = String(endObj.getDate()).padStart(2, '0');
  const hh = String(endObj.getHours()).padStart(2, '0');
  const mm = String(endObj.getMinutes()).padStart(2, '0');

  return {
    endDate: `${y}-${m}-${d}`,
    endTime: `${hh}:${mm}`
  };
}

/**
 * Extracts local date as 'YYYY-MM-DD' from a Date object or ISO / string.
 */
export function getLocalDateString(d: Date | string | number): string {
  if (!d) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  let dateObj: Date;
  if (typeof d === 'number') {
    dateObj = new Date(d);
  } else if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
      return d.trim();
    }
    dateObj = parseEntryDateTime(d, '12:00') || new Date(d);
  } else {
    dateObj = d;
  }
  if (isNaN(dateObj.getTime())) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Extracts local time as 'HH:mm' in 24h format from a Date object or ISO / string.
 */
export function getLocalTimeString(d: Date | string | number): string {
  if (!d) return '20:00';
  let dateObj: Date;
  if (typeof d === 'number') {
    dateObj = new Date(d);
  } else if (typeof d === 'string') {
    const trimmed = d.trim();
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    dateObj = new Date(trimmed);
  } else {
    dateObj = d;
  }
  if (isNaN(dateObj.getTime())) {
    return '20:00';
  }
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getFastingStageByHours(elapsedHours: number): FastingLevelDefinition {
  const stage = FASTING_METABOLIC_LEVELS.find(
    (lvl) => elapsedHours >= lvl.minHours && elapsedHours < lvl.maxHours
  );
  return stage || FASTING_METABOLIC_LEVELS[FASTING_METABOLIC_LEVELS.length - 1];
}

export function parseProtocolTargetHours(proto: string): number {
  if (proto === '14:10') return 14;
  if (proto === '16:8') return 16;
  if (proto === '18:6') return 18;
  if (proto === '20:4') return 20;
  if (proto === 'OMAD (23:1)' || proto.includes('OMAD')) return 23;
  if (proto === '24h' || proto.includes('24')) return 24;
  if (proto === '36h' || proto.includes('36')) return 36;
  if (proto === '48h' || proto.includes('48')) return 48;
  if (proto === '72h' || proto.includes('72')) return 72;
  return 16;
}

const ITALIAN_MONTHS_MAP: { [key: string]: number } = {
  gen: 1, genn: 1, gennaio: 1,
  feb: 2, febb: 2, febbraio: 2,
  mar: 3, marz: 3, marzo: 3,
  apr: 4, apri: 4, aprile: 4,
  mag: 5, magg: 5, maggio: 5,
  giu: 6, giug: 6, giugno: 6,
  lug: 7, lugl: 7, luglio: 7,
  ago: 8, agos: 8, agosto: 8,
  set: 9, sett: 9, settembre: 9,
  ott: 10, otto: 10, ottobre: 10,
  nov: 11, nove: 11, novembre: 11,
  dic: 12, dice: 12, dicembre: 12
};

/**
 * Parses any date string (ISO 'YYYY-MM-DD', Italian 'DD/MM/YY', 'DD/MM/YYYY', '14 Ago 2026') and time string ('HH:mm') into a Date object.
 */
export function parseEntryDateTime(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  const cleanDate = dateStr.trim();
  const time = timeStr ? timeStr.trim() : '12:00';
  const partsTime = time.split(':');
  const h = partsTime.length > 0 && !isNaN(Number(partsTime[0])) ? Number(partsTime[0]) : 12;
  const m = partsTime.length > 1 && !isNaN(Number(partsTime[1])) ? Number(partsTime[1]) : 0;

  // Pattern YYYY-MM-DD or YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}/.test(cleanDate)) {
    const y = parseInt(cleanDate.slice(0, 4), 10);
    const mo = parseInt(cleanDate.slice(5, 7), 10) - 1;
    const d = parseInt(cleanDate.slice(8, 10), 10);
    return new Date(y, mo, d, h, m, 0);
  }

  // Pattern DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const slashOrDashMatch = cleanDate.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (slashOrDashMatch) {
    const day = parseInt(slashOrDashMatch[1], 10);
    const month = parseInt(slashOrDashMatch[2], 10) - 1;
    let year = parseInt(slashOrDashMatch[3], 10);
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }
    return new Date(year, month, day, h, m, 0);
  }

  // Pattern "14 Ago 2026" or "14 Agosto 2026" or "14-Ago-2026"
  const textMonthMatch = cleanDate.match(/^(\d{1,2})\s*[\s\-\/\.]\s*([a-zA-Zàèéìòù]+)\s*[\s\-\/\.]\s*(\d{2,4})/i);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const mStr = textMonthMatch[2].toLowerCase().trim();
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }
    const mNum = ITALIAN_MONTHS_MAP[mStr] || ITALIAN_MONTHS_MAP[mStr.slice(0, 3)];
    if (mNum !== undefined) {
      return new Date(year, mNum - 1, day, h, m, 0);
    }
  }

  const d = new Date(cleanDate);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/**
 * Converts Italian format DD/MM/YY, DD/MM/YYYY, '14 Ago 2026' or Date to ISO format YYYY-MM-DD
 */
export function formatDateToISO(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString().slice(0, 10);
  }
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(clean)) {
    return clean.slice(0, 10);
  }
  
  const parsed = parseEntryDateTime(clean, '12:00');
  if (parsed && !isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Converts ISO format YYYY-MM-DD or other to Italian format DD/MM/YY
 */
export function formatDateToItalian(dateStr: string, fullYear: boolean = false): string {
  if (!dateStr) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = fullYear ? String(now.getFullYear()) : String(now.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }
  const clean = dateStr.trim();
  
  const parsed = parseEntryDateTime(clean, '12:00');
  if (parsed && !isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = fullYear ? String(parsed.getFullYear()) : String(parsed.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }
  
  return clean;
}

export interface NearbyGlucoseResult {
  value: number;
  diffMinutes: number;
  time: string;
  date: string;
  entry: LogEntryItem;
}

/**
 * Finds a glucose reading on the same day or within maxHoursDiff (default 3h) from fasting start time.
 * If found, returns the value and metadata; otherwise returns null.
 */
export function findNearbyGlucoseForFasting(
  entries: LogEntryItem[],
  fastingDateOrISO: string,
  fastingTime?: string,
  maxHoursDiff: number = 3
): NearbyGlucoseResult | null {
  if (!entries || entries.length === 0 || !fastingDateOrISO) return null;

  let targetDate: Date | null = null;
  if (fastingDateOrISO.includes('T')) {
    targetDate = new Date(fastingDateOrISO);
  } else {
    targetDate = parseEntryDateTime(fastingDateOrISO, fastingTime || '20:00');
  }

  if (!targetDate || isNaN(targetDate.getTime())) return null;
  const targetMs = targetDate.getTime();
  const maxDiffMs = maxHoursDiff * 60 * 60 * 1000; // 3 hours = 10,800,000 ms

  const glucoseEntries = entries.filter((e) => {
    const name = (e.subTypeName || '').toLowerCase();
    const id = (e.subTypeId || '').toLowerCase();
    return (
      name.includes('glucose') ||
      name.includes('glicemia') ||
      id.includes('glucose') ||
      id.includes('glicemia')
    );
  });

  let closestMatch: NearbyGlucoseResult | null = null;
  let minDiffMs = Infinity;

  for (const entry of glucoseEntries) {
    const entryDate = parseEntryDateTime(entry.date, entry.time);
    if (!entryDate || isNaN(entryDate.getTime())) continue;

    const diffMs = Math.abs(entryDate.getTime() - targetMs);
    if (diffMs <= maxDiffMs && diffMs < minDiffMs) {
      const numVal = parseFloat(String(entry.value).replace(',', '.'));
      if (!isNaN(numVal) && numVal > 0) {
        minDiffMs = diffMs;
        closestMatch = {
          value: numVal,
          diffMinutes: Math.round(diffMs / 60000),
          time: entry.time || '',
          date: entry.date || '',
          entry
        };
      }
    }
  }

  return closestMatch;
}

