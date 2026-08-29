import { LogEntryItem, HealthCategory, HealthSubType } from '../types/ontrack';
import { findCategoryForTime } from './timeCategoryMatcher';
import { formatTime24h } from './fastingHelpers';

const ITALIAN_MONTHS: Record<string, string> = {
  gen: '01', gennaio: '01',
  feb: '02', febbraio: '02',
  mar: '03', marzo: '03',
  apr: '04', aprile: '04',
  mag: '05', maggio: '05',
  giu: '06', giugno: '06',
  lug: '07', luglio: '07',
  ago: '08', agosto: '08',
  set: '09', settembre: '09',
  ott: '10', ottobre: '10',
  nov: '11', novembre: '11',
  dic: '12', dicembre: '12',
  // English fallbacks
  jan: '01', january: '01',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  dec: '12', december: '12',
};

export interface ParsedCsvRow {
  id: string;
  rawType: string;
  subTypeId: string;
  subTypeName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  value: string;
  unit: string;
  systolic?: string;
  diastolic?: string;
  pulse?: string;
  calories?: string;
  gda?: string;
  fat?: string;
  protein?: string;
  carbs?: string;
  exerciseCal?: string;
  netCal?: string;
  manual?: boolean;
  mealTiming?: 'pre' | 'post';
  note?: string;
  categoryId: string;
  categoryName: string;
  timestamp: number;
  isValid: boolean;
  error?: string;
}

export interface CsvParseResult {
  totalRows: number;
  validRows: ParsedCsvRow[];
  invalidRows: { rowNumber: number; raw: string; error: string }[];
  dateRange: { start: string; end: string } | null;
  detectedFormat?: 'glucose' | 'pressure' | 'weight' | 'nutrition' | 'generic';
  targetSubTypes: string[];
  categoryLabel: string;
}

/**
 * Split CSV / TSV text into lines and tokens handling quotes
 */
function parseCsvLines(text: string): string[][] {
  const lines: string[][] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n').filter(l => l.trim().length > 0);

  if (rawLines.length === 0) return [];

  // Determine separator: check first line for tabs, semicolons, commas
  const firstLine = rawLines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if ((firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length && firstLine.includes(';')) {
    delimiter = ';';
  }

  for (const line of rawLines) {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    tokens.push(current.trim());
    lines.push(tokens);
  }

  return lines;
}

/**
 * Parse an Italian, ISO, or relative date-time string
 * Supports:
 * - "14 Ago 2026, 00:20", "14 Agosto 2026 08:30", "01 ago 26"
 * - "Dom 2", "Dom 19", "Mar 2", "Sab 9", "Dom 14 Ago 2026 00:20"
 * - "14/08/2026 00:20", "14.08.2026 08:30", "14-08-2026"
 * - "2026-08-14 00:20", "2026/08/14", "2026.08.14"
 * - "14/08/26", "14.08.26", "14-08-26"
 * - AM/PM times e.g. "8:30 PM", "08:30 AM"
 * - Time with seconds e.g. "08:30:00"
 * - Time with dots e.g. "08.30"
 */
export function parseDateTimeString(
  raw: string, 
  defaultTime: string = '12:00',
  referenceYearMonth: { year: string; month: string } = { year: '2026', month: '08' }
): { date: string; time: string; timestamp: number } | null {
  if (!raw) return null;
  let clean = raw.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');

  // Extract trailing time if present (e.g. "00:20", "08:30:15", "8.30", "8:30 PM", "8:30 AM")
  let extractedTime: string | null = null;
  const timeRegex = /(?:^|\s+)(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*(?:am|pm))?)\s*$/i;
  const timeMatch = clean.match(timeRegex);
  if (timeMatch) {
    extractedTime = formatTime24h(timeMatch[1]);
    // Remove the time portion to parse the date cleanly
    clean = clean.slice(0, timeMatch.index).trim();
  }

  const finalTime = extractedTime ? extractedTime : formatTime24h(defaultTime);

  // 1. Pattern: Day-of-week + Day-of-month (e.g. "Dom 2", "Dom 19", "Mar 2", "Sab 9", "Lun 15")
  const dayOfWeekPattern = /^(?:dom|lun|mar|mer|gio|ven|sab|sun|mon|tue|wed|thu|fri|sat)[a-zà-ú]*\.?\s+(\d{1,2})$/i;
  const matchDow = clean.match(dayOfWeekPattern);
  if (matchDow) {
    const day = matchDow[1].padStart(2, '0');
    const dateStr = `${referenceYearMonth.year}-${referenceYearMonth.month}-${day}`;
    const timestamp = new Date(`${dateStr}T${finalTime}:00`).getTime();
    return { date: dateStr, time: finalTime, timestamp: isNaN(timestamp) ? Date.now() : timestamp };
  }

  // Optional Day of week prefix (e.g. "Dom 14 Ago 2026" or "Lun 14/08/2026")
  const dowPrefixPattern = /^(?:dom|lun|mar|mer|gio|ven|sab|sun|mon|tue|wed|thu|fri|sat)[a-zà-ú]*\.?\s+/i;
  if (dowPrefixPattern.test(clean)) {
    clean = clean.replace(dowPrefixPattern, '').trim();
  }

  // 2. Italian Month Pattern with 2 or 4 digit year (e.g. "14 Ago 2026", "01 ago 26", "14-Ago-2026", "14.ago.26", "5 agosto 2026")
  const textMonthRegex = /^(\d{1,2})[\s\-\.\/]+([a-zA-Zà-úÀ-Ú]+)(?:[\s\-\.\/]+(\d{2,4}))?$/;
  const matchText = clean.match(textMonthRegex);
  if (matchText) {
    const day = matchText[1].padStart(2, '0');
    const monthWord = matchText[2].toLowerCase();
    let year = matchText[3] || referenceYearMonth.year;
    if (year.length === 2) {
      const yNum = parseInt(year, 10);
      year = yNum < 50 ? `20${year}` : `19${year}`;
    }

    const monthNum = ITALIAN_MONTHS[monthWord] || ITALIAN_MONTHS[monthWord.slice(0, 3)];
    if (monthNum) {
      const dateStr = `${year}-${monthNum}-${day}`;
      const timestamp = new Date(`${dateStr}T${finalTime}:00`).getTime();
      return { date: dateStr, time: finalTime, timestamp: isNaN(timestamp) ? Date.now() : timestamp };
    }
  }

  // 3. Numeric Date with Slashes, Dashes or Dots (DD/MM/YYYY or YYYY-MM-DD or DD.MM.YYYY or DD/MM/YY)
  const numericDateRegex = /^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/;
  const matchNum = clean.match(numericDateRegex);
  if (matchNum) {
    let p1 = matchNum[1];
    let p2 = matchNum[2];
    let p3 = matchNum[3];

    let year = '';
    let month = '';
    let day = '';

    if (p1.length === 4) {
      // YYYY-MM-DD
      year = p1;
      month = p2.padStart(2, '0');
      day = p3.padStart(2, '0');
    } else if (p3.length === 4) {
      // DD/MM/YYYY or MM/DD/YYYY
      year = p3;
      const n1 = parseInt(p1, 10);
      const n2 = parseInt(p2, 10);
      if (n1 > 12 && n2 <= 12) {
        // DD/MM/YYYY
        day = p1.padStart(2, '0');
        month = p2.padStart(2, '0');
      } else if (n2 > 12 && n1 <= 12) {
        // MM/DD/YYYY
        month = p1.padStart(2, '0');
        day = p2.padStart(2, '0');
      } else {
        // Default Italian: DD/MM/YYYY
        day = p1.padStart(2, '0');
        month = p2.padStart(2, '0');
      }
    } else if (p1.length === 2 && p3.length === 2) {
      // 2-digit year: e.g. 14/08/26 or 26-08-14
      const n1 = parseInt(p1, 10);
      const n3 = parseInt(p3, 10);
      if (n1 > 31 && n3 <= 31) {
        // YY-MM-DD
        year = n1 < 50 ? `20${p1}` : `19${p1}`;
        month = p2.padStart(2, '0');
        day = p3.padStart(2, '0');
      } else {
        // DD-MM-YY
        year = n3 < 50 ? `20${p3}` : `19${p3}`;
        month = p2.padStart(2, '0');
        day = p1.padStart(2, '0');
      }
    } else {
      // Fallback
      day = p1.padStart(2, '0');
      month = p2.padStart(2, '0');
      year = p3.length === 2 ? `20${p3}` : p3;
    }

    const dateStr = `${year}-${month}-${day}`;
    const timestamp = new Date(`${dateStr}T${finalTime}:00`).getTime();
    return { date: dateStr, time: finalTime, timestamp: isNaN(timestamp) ? Date.now() : timestamp };
  }

  // 4. Fallback generic JS Date
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    const hh = String(parsed.getHours()).padStart(2, '0');
    const mm = String(parsed.getMinutes()).padStart(2, '0');
    const finalTimeJs = extractedTime || (raw.includes(':') ? `${hh}:${mm}` : finalTime);
    return {
      date: `${y}-${m}-${d}`,
      time: finalTimeJs,
      timestamp: new Date(`${y}-${m}-${d}T${finalTimeJs}:00`).getTime()
    };
  }

  return null;
}

export const MEAL_NAMES_REGEX = /^(colazione|prima colazione|pranzo|cena|coricarsi|ora di coricarsi|notte|digiuno|spuntino|merenda|breakfast|lunch|dinner|bedtime|fasting)\b[\s:,-]*(.*)$/i;

/**
 * Match meal or category text to a configured HealthCategory, or fallback to time window
 */
export function findMatchingCategory(
  categories: HealthCategory[],
  mealName?: string,
  formattedTime?: string
): HealthCategory {
  if (!categories || categories.length === 0) {
    return { id: 'cat_1', name: 'Digiuno', order: 1 };
  }

  if (mealName && mealName.trim()) {
    const raw = mealName.trim().toLowerCase();

    // 1. Exact match with user categories
    const exact = categories.find(c => c.name.toLowerCase() === raw);
    if (exact) return exact;

    // 2. Partial match with user categories
    const partial = categories.find(c => {
      const cName = c.name.toLowerCase();
      return cName.includes(raw) || raw.includes(cName);
    });
    if (partial) return partial;

    // 3. Semantic keyword mapping to known categories
    if (raw.includes('colazion') || raw.includes('breakfast') || raw.includes('mattin')) {
      const c = categories.find(cat => cat.id === 'cat_breakfast' || cat.name.toLowerCase().includes('colazione'));
      if (c) return c;
    }
    if (raw.includes('pranz') || raw.includes('lunch') || raw.includes('mezzogiorno')) {
      const c = categories.find(cat => cat.id === 'cat_lunch' || cat.name.toLowerCase().includes('pranzo'));
      if (c) return c;
    }
    if (raw.includes('cena') || raw.includes('dinner') || raw.includes('ser')) {
      const c = categories.find(cat => cat.id === 'cat_dinner' || cat.name.toLowerCase().includes('cena'));
      if (c) return c;
    }
    if (raw.includes('coric') || raw.includes('letto') || raw.includes('bedtime') || raw.includes('dormire')) {
      const c = categories.find(cat => cat.id === 'cat_bedtime' || cat.name.toLowerCase().includes('coricarsi'));
      if (c) return c;
    }
    if (raw.includes('nott') || raw.includes('digiun') || raw.includes('fasting') || raw.includes('night')) {
      const c = categories.find(cat => cat.id === 'cat_night' || cat.name.toLowerCase().includes('notte') || cat.name.toLowerCase().includes('digiuno'));
      if (c) return c;
    }
    if (raw.includes('spuntin') || raw.includes('merenda') || raw.includes('snack')) {
      const c = categories.find(cat => cat.name.toLowerCase().includes('spuntino') || cat.name.toLowerCase().includes('merenda'));
      if (c) return c;
    }
  }

  // Fallback to configured time-window calculation
  return findCategoryForTime(categories, formattedTime);
}

/**
 * Main CSV parse function for health log entries
 * Seamlessly handles:
 * - Glicemia & Standard logs
 * - Pressione Arteriosa (3 valori es. "94 106 95" o sistolica/diastolica/battiti)
 * - Peso corporeo (es. "01 ago 26 \t 96,5 kg \t Abbastanza buono" con orario di default 19:27)
 * - Riepilogo Nutrizionale (es. "Data,Alimenti (Cal),% GDA,Grassi (g),Proteine (g),Carboidrati (g),Esercizio (Cal),Netto (Cal)")
 */
export function parseHealthCsv(
  csvContent: string,
  categories: HealthCategory[],
  subTypes: HealthSubType[]
): CsvParseResult {
  const lines = parseCsvLines(csvContent);
  if (lines.length === 0) {
    return { 
      totalRows: 0, 
      validRows: [], 
      invalidRows: [], 
      dateRange: null, 
      detectedFormat: 'generic', 
      targetSubTypes: [], 
      categoryLabel: 'Nessun dato' 
    };
  }

  const validRows: ParsedCsvRow[] = [];
  const invalidRows: { rowNumber: number; raw: string; error: string }[] = [];

  const header = lines[0].map(h => h.toLowerCase().trim());
  const headerLine = lines[0].join(' ').toLowerCase();

  // =========================================================================
  // 1. DETECT NUTRITION SUMMARY TABLE FORMAT
  // Header: Data,Alimenti (Cal),% GDA,Grassi (g),Proteine (g),Carboidrati (g),Esercizio (Cal),Netto (Cal)
  // =========================================================================
  const isNutritionFormat = headerLine.includes('alimenti') || 
                            headerLine.includes('gda') || 
                            (headerLine.includes('grassi') && headerLine.includes('proteine') && headerLine.includes('carboidrati'));

  if (isNutritionFormat) {
    let dateCol = header.findIndex(h => h === 'data' || h.startsWith('data') || h.includes('date') || h.includes('giorno'));
    let timeCol = header.findIndex(h => h === 'ora' || h.startsWith('ora') || h.includes('time'));
    let typeCol = header.findIndex(h => h === 'tipo' || h.startsWith('tipo') || h.includes('type'));
    let calCol = header.findIndex(h => h.includes('alimenti') || h.includes('cal') || h.includes('calorie') || h.includes('energy'));
    let gdaCol = header.findIndex(h => h.includes('gda'));
    let fatCol = header.findIndex(h => h.includes('grassi') || h.includes('fat'));
    let protCol = header.findIndex(h => h.includes('proteine') || h.includes('prot'));
    let carbCol = header.findIndex(h => h.includes('carboidrati') || h.includes('carb'));
    let exerCol = header.findIndex(h => h.includes('esercizio') || h.includes('exercise'));
    let netCol = header.findIndex(h => h.includes('netto') || h.includes('net'));
    let noteCol = header.findIndex(h => h === 'note' || h.startsWith('note') || h.includes('comment'));

    if (dateCol === -1) dateCol = 0;

    const foodSubType = subTypes.find(s => s.id === 'sub_food') || { id: 'sub_food', name: 'Cibo / Carboidrati', unit: 'g' };

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const rawDate = (row[dateCol] || '').trim();
      const rawTime = timeCol >= 0 && row[timeCol] ? row[timeCol].trim() : '12:00';
      const rawType = typeCol >= 0 && row[typeCol] ? row[typeCol].trim() : 'Alimenti';
      const rawCal = calCol >= 0 && row[calCol] ? row[calCol].trim() : '';
      const rawGda = gdaCol >= 0 && row[gdaCol] ? row[gdaCol].trim() : '';
      const rawFat = fatCol >= 0 && row[fatCol] ? row[fatCol].trim() : '';
      const rawProt = protCol >= 0 && row[protCol] ? row[protCol].trim() : '';
      const rawCarb = carbCol >= 0 && row[carbCol] ? row[carbCol].trim() : '';
      const rawExer = exerCol >= 0 && row[exerCol] ? row[exerCol].trim() : '';
      const rawNet = netCol >= 0 && row[netCol] ? row[netCol].trim() : '';
      const rawNote = noteCol >= 0 && row[noteCol] ? row[noteCol].trim() : '';

      const combinedDateTime = rawDate && rawTime && !rawDate.includes(':')
        ? `${rawDate} ${rawTime}`
        : (rawDate || rawTime);

      const dt = parseDateTimeString(combinedDateTime, rawTime || '12:00');
      if (!dt) {
        invalidRows.push({
          rowNumber: i + 1,
          raw: row.join(' | '),
          error: `Data non valida nel riepilogo nutrizionale: "${combinedDateTime}"`
        });
        continue;
      }

      const formattedTime = formatTime24h(dt.time);

      const cleanCal = rawCal.replace(/[^\d.,]/g, '').replace(',', '.');
      const cleanCarb = rawCarb.replace(/[^\d.,]/g, '').replace(',', '.');
      const cleanProt = rawProt.replace(/[^\d.,]/g, '').replace(',', '.');
      const cleanFat = rawFat.replace(/[^\d.,]/g, '').replace(',', '.');
      const cleanGda = rawGda.replace(/[^\d.,]/g, '').replace(',', '.');

      // Value shown in main entry: calories if available, otherwise carbs
      const mainVal = cleanCal && cleanCal !== '-' && cleanCal !== '' ? cleanCal : (cleanCarb && cleanCarb !== '-' ? cleanCarb : '0');
      const unit = cleanCal && cleanCal !== '-' && cleanCal !== '' ? 'Cal' : 'g';

      // Build readable note
      const noteParts: string[] = [];
      if (cleanCal && cleanCal !== '-') noteParts.push(`Calorie: ${cleanCal} Cal`);
      if (cleanGda && cleanGda !== '-') noteParts.push(`% GDA: ${cleanGda}%`);
      if (cleanCarb && cleanCarb !== '-') noteParts.push(`Carboidrati: ${cleanCarb}g`);
      if (cleanProt && cleanProt !== '-') noteParts.push(`Proteine: ${cleanProt}g`);
      if (cleanFat && cleanFat !== '-') noteParts.push(`Grassi: ${cleanFat}g`);
      if (rawExer && rawExer !== '-') noteParts.push(`Esercizio: ${rawExer}`);
      if (rawNet && rawNet !== '-') noteParts.push(`Netto: ${rawNet}`);
      if (rawNote && rawNote !== '-' && rawNote.toLowerCase() !== 'aggiungi nota') {
        noteParts.push(rawNote);
      }

      const matchedCategory = findCategoryForTime(categories, formattedTime);

      validRows.push({
        id: `nutrition_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        rawType: rawType || 'Alimenti',
        subTypeId: foodSubType.id,
        subTypeName: foodSubType.name,
        date: dt.date,
        time: formattedTime,
        value: mainVal,
        unit: unit,
        calories: cleanCal !== '-' && cleanCal !== '' ? cleanCal : undefined,
        gda: cleanGda !== '-' && cleanGda !== '' ? cleanGda : undefined,
        fat: cleanFat !== '-' && cleanFat !== '' ? cleanFat : undefined,
        protein: cleanProt !== '-' && cleanProt !== '' ? cleanProt : undefined,
        carbs: cleanCarb !== '-' && cleanCarb !== '' ? cleanCarb : undefined,
        exerciseCal: rawExer !== '-' && rawExer !== '' ? rawExer : undefined,
        netCal: rawNet !== '-' && rawNet !== '' ? rawNet : undefined,
        note: noteParts.join(' | '),
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        timestamp: dt.timestamp,
        isValid: true
      });
    }

    validRows.sort((a, b) => b.timestamp - a.timestamp);
    const dateRange = validRows.length > 0 ? { start: validRows[validRows.length - 1].date, end: validRows[0].date } : null;
    return {
      totalRows: validRows.length + invalidRows.length,
      validRows,
      invalidRows,
      dateRange,
      detectedFormat: 'nutrition',
      targetSubTypes: ['sub_food'],
      categoryLabel: 'Nutrizione'
    };
  }

  // =========================================================================
  // 2. DETECT WEIGHT 2/3 COLUMN FORMAT
  // Example: "01 ago 26 \t 96,5 kg \t Abbastanza buono"
  // =========================================================================
  const firstRowStr = lines[0].join(' ').toLowerCase();
  const isDirectWeightRow = (/^\d{1,2}\s+[a-zà-ú]+\s+\d{2,4}/i.test(lines[0][0]) && lines[0][1] && lines[0][1].toLowerCase().includes('kg')) ||
                            (firstRowStr.includes('kg') && lines[0].length <= 4 && !firstRowStr.includes('glicemic'));

  // Standard Header Column Indices
  let typeIdx = header.findIndex(h => h === 'tipo' || h.startsWith('tipo') || h.includes('type'));
  let dateIdx = header.findIndex(h => h === 'data' || h.startsWith('data') || h.includes('date'));
  let timeIdx = header.findIndex(h => h === 'ora' || h.startsWith('ora') || h.includes('time'));
  let valIdx = header.findIndex(h => 
    h.includes('sistolica') || h.includes('diastolica') || h.includes('battiti') ||
    h.includes('valore') || h.includes('value') || h.includes('risultato') || 
    h.includes('peso') || h.includes('alimenti')
  );
  let unitIdx = header.findIndex(h => h.includes('unità') || h.includes('unita') || h.includes('unit'));
  let timingIdx = header.findIndex(h => h.includes('fase pasto') || h.includes('timing') || h.includes('aggiuntivo') || h.includes('pasto') || h.includes('meal'));
  let pastoIdx = header.findIndex(h => h === 'pasto' || h.includes('nome pasto'));
  let noteIdx = header.findIndex(h => h.includes('quanto conforme') || h.includes('note') || h.includes('commento') || h.includes('note evento'));

  // Fallbacks if dateIdx wasn't found directly
  if (dateIdx === -1) {
    dateIdx = header.findIndex(h => h.includes('data') || h.includes('date') || h.includes('ora') || h.includes('time'));
  }

  let startRow = 1;

  if (isDirectWeightRow || (dateIdx === -1 && valIdx === -1)) {
    // Treat row 0 as data if it has dates/numbers
    const isData = lines[0].some(t => /\d/.test(t));
    if (isData) {
      startRow = 0;
      if (lines[0].length === 2 || lines[0].length === 3) {
        // Direct Weight table: Col 0 = Date, Col 1 = Weight (kg), Col 2 = Note (optional)
        dateIdx = 0;
        timeIdx = -1;
        valIdx = 1;
        unitIdx = -1;
        timingIdx = -1;
        noteIdx = 2;
        typeIdx = -1;
      } else {
        typeIdx = 0;
        dateIdx = 1;
        timeIdx = -1;
        valIdx = 2;
        unitIdx = 4;
        timingIdx = 6;
        noteIdx = 7;
      }
    }
  }

  const bpSubType = subTypes.find(s => s.id === 'sub_bp') || { id: 'sub_bp', name: 'Pressione', unit: 'mmHg' };
  const weightSubType = subTypes.find(s => s.id === 'sub_weight') || { id: 'sub_weight', name: 'Peso', unit: 'kg' };
  const glucoseSubType = subTypes.find(s => s.id === 'sub_glucose') || { id: 'sub_glucose', name: 'Glicemia', unit: 'mg/dL' };
  const foodSubType = subTypes.find(s => s.id === 'sub_food') || { id: 'sub_food', name: 'Cibo / Carboidrati', unit: 'g' };
  const medSubType = subTypes.find(s => s.id === 'sub_medication') || { id: 'sub_medication', name: 'Farmaco / Insulina', unit: 'unità' };
  const exerciseSubType = subTypes.find(s => s.id === 'sub_exercise') || { id: 'sub_exercise', name: 'Esercizio / Camminata', unit: 'min' };

  for (let i = startRow; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || (row.length === 1 && !row[0])) continue;

    const rawType = typeIdx >= 0 && row[typeIdx] ? row[typeIdx] : '';
    const rawDate = dateIdx >= 0 && row[dateIdx] ? row[dateIdx].trim() : '';
    const rawTime = timeIdx >= 0 && row[timeIdx] ? row[timeIdx].trim() : '';
    const rawVal = valIdx >= 0 && row[valIdx] ? row[valIdx].trim() : '';
    const rawUnit = unitIdx >= 0 && row[unitIdx] ? row[unitIdx].trim() : '';
    const rawTiming = timingIdx >= 0 && row[timingIdx] ? row[timingIdx].trim() : '';
    const rawPasto = pastoIdx >= 0 && row[pastoIdx] ? row[pastoIdx].trim() : '';
    const rawNote = noteIdx >= 0 && row[noteIdx] ? row[noteIdx].trim() : '';

    const combinedDateTime = rawDate && rawTime && !rawDate.includes(':') 
      ? `${rawDate} ${rawTime}` 
      : (rawDate || rawTime);

    // Parse Date and Time (defaulting time to rawTime or 19:27 if not present)
    const dt = parseDateTimeString(combinedDateTime, rawTime || '19:27');
    if (!dt) {
      invalidRows.push({
        rowNumber: i + 1,
        raw: row.join(' | '),
        error: `Data/ora non valida: "${combinedDateTime}"`
      });
      continue;
    }

    const formattedTime = formatTime24h(dt.time);

    const lowerType = rawType.toLowerCase();
    const lowerVal = rawVal.toLowerCase();
    const lowerUnit = rawUnit.toLowerCase();

    // Determine Meal Timing from header timingIdx
    let mealTiming: 'pre' | 'post' | undefined = undefined;
    const lowerTiming = rawTiming.toLowerCase();
    if (/\b(post|dopo)\b/i.test(lowerTiming)) {
      mealTiming = 'post';
    } else if (/\b(pre|prima)\b/i.test(lowerTiming)) {
      mealTiming = 'pre';
    }

    // =======================================================================
    // CASE A: BLOOD PRESSURE (PRESSIONE ARTERIOSA)
    // Supports 1-column ("110/76 - 88", "110/76", "94 106 95"), 2-column, 3-column,
    // plus "Fase Pasto", "Pasto", and "Note" with attached remarks (e.g. "Pranzo  AIStudiomminkius")
    // =======================================================================
    const isPressureType = lowerType.includes('pressione') || 
                           lowerType.includes('pressure') || 
                           lowerUnit.includes('mmhg') || 
                           lowerVal.includes('mmhg') ||
                           headerLine.includes('sistolica') ||
                           headerLine.includes('diastolica') ||
                           /^\d{2,3}[\s\/]+\d{2,3}/.test(rawVal.trim()) ||
                           row.some(cell => /pressione/i.test(cell) || /^\d{2,3}[\s\/]+\d{2,3}(?:[\s\-]+\d{2,3})?/.test(cell.trim()));

    if (isPressureType) {
      let systolic = '';
      let diastolic = '';
      let pulse = '';
      const usedCols = new Set<number>();
      if (dateIdx >= 0) usedCols.add(dateIdx);
      if (timeIdx >= 0) usedCols.add(timeIdx);
      if (typeIdx >= 0) usedCols.add(typeIdx);

      // Track BP values
      let bpFound = false;

      // 1. Check designated valIdx first if valid
      if (valIdx >= 0 && row[valIdx]) {
        const valCell = row[valIdx].trim();
        const nums = valCell.match(/\d+/g);
        if (nums && nums.length >= 2) {
          const n1 = parseInt(nums[0], 10);
          const n2 = parseInt(nums[1], 10);
          if (n1 > n2) {
            systolic = String(n1);
            diastolic = String(n2);
          } else {
            systolic = String(n2);
            diastolic = String(n1);
          }
          if (nums[2]) pulse = nums[2];
          usedCols.add(valIdx);
          bpFound = true;
        } else if (nums && nums.length === 1) {
          const nextCell = (row[valIdx + 1] || '').trim();
          const nextNums = nextCell.match(/\d+/g);
          if (nextNums && nextNums.length >= 1 && !/\b(post|pre|dopo|prima)\b/i.test(nextCell)) {
            systolic = nums[0];
            diastolic = nextNums[0];
            if (nextNums[1]) pulse = nextNums[1];
            usedCols.add(valIdx);
            usedCols.add(valIdx + 1);
            if (!pulse && row[valIdx + 2]) {
              const pNums = row[valIdx + 2].match(/^\d+$/);
              if (pNums && parseInt(pNums[0], 10) >= 35 && parseInt(pNums[0], 10) <= 220) {
                pulse = pNums[0];
                usedCols.add(valIdx + 2);
              }
            }
            bpFound = true;
          }
        }
      }

      // 2. If not found yet from valIdx, scan any cell across the row
      if (!bpFound) {
        for (let col = 0; col < row.length; col++) {
          if (usedCols.has(col)) continue;
          const cell = row[col].trim();
          if (/^(pressione|pressure)$/i.test(cell) || cell.toLowerCase().includes('pressione')) {
            usedCols.add(col);
            continue;
          }

          const nums = cell.match(/\d+/g);
          if (nums && nums.length >= 2) {
            const n1 = parseInt(nums[0], 10);
            const n2 = parseInt(nums[1], 10);
            if (n1 > n2) {
              systolic = String(n1);
              diastolic = String(n2);
            } else {
              systolic = String(n2);
              diastolic = String(n1);
            }
            if (nums[2]) pulse = nums[2];
            usedCols.add(col);
            bpFound = true;
            break;
          } else if (nums && nums.length === 1 && !systolic && parseInt(nums[0], 10) >= 50 && parseInt(nums[0], 10) <= 260) {
            const nextCell = (row[col + 1] || '').trim();
            const nextNums = nextCell.match(/\d+/g);
            if (nextNums && nextNums.length >= 1 && !/\b(post|pre|dopo|prima)\b/i.test(nextCell)) {
              systolic = nums[0];
              diastolic = nextNums[0];
              if (nextNums[1]) pulse = nextNums[1];
              usedCols.add(col);
              usedCols.add(col + 1);
              if (!pulse && row[col + 2]) {
                const pNums = row[col + 2].match(/^\d+$/);
                if (pNums && parseInt(pNums[0], 10) >= 35 && parseInt(pNums[0], 10) <= 220) {
                  pulse = pNums[0];
                  usedCols.add(col + 2);
                }
              }
              bpFound = true;
              break;
            }
          }
        }
      }

      // Check if pulse was in a dedicated pulse column
      const pulseIdx = header.findIndex(h => h.includes('battiti') || h.includes('pulse') || h.includes('bpm'));
      if (!pulse && pulseIdx >= 0 && row[pulseIdx] && !usedCols.has(pulseIdx)) {
        const pMatch = row[pulseIdx].match(/\d+/);
        if (pMatch) {
          pulse = pMatch[0];
          usedCols.add(pulseIdx);
        }
      }

      const formattedVal = systolic && diastolic 
        ? `${systolic}/${diastolic}${pulse ? ` - ${pulse} bpm` : ''}` 
        : (systolic || rawVal);

      // Now extract meal timing, category/meal name, and notes from remaining cells
      let rowMealTiming: 'pre' | 'post' | undefined = undefined;
      let rowMealCategory = '';
      const noteParts: string[] = [];

      // If the row matches the header length, we can optionally use rawTiming and rawPasto
      const isShifted = row.length < header.length;
      if (!isShifted) {
        if (mealTiming) rowMealTiming = mealTiming;
        if (rawPasto) {
          const mealMatch = rawPasto.match(MEAL_NAMES_REGEX);
          if (mealMatch) {
            rowMealCategory = mealMatch[1];
            if (mealMatch[2] && mealMatch[2].trim()) {
              noteParts.push(mealMatch[2].trim());
            }
          } else {
            rowMealCategory = rawPasto;
          }
        }
        if (rawNote) {
          noteParts.push(rawNote);
        }
      }

      for (let col = 0; col < row.length; col++) {
        if (usedCols.has(col)) continue;
        if (!isShifted && (col === timingIdx || col === pastoIdx || col === noteIdx)) continue;
        const cell = row[col].trim();
        if (!cell) continue;

        const lower = cell.toLowerCase();
        if (/^(pressione|pressure|mmhg|bpm)$/i.test(cell) || lower === 'mmhg' || lower === 'bpm' || lower.includes('pressione')) {
          usedCols.add(col);
          continue;
        }

        if (!rowMealTiming && /\b(post|dopo)\b/i.test(lower)) {
          rowMealTiming = 'post';
          usedCols.add(col);
          continue;
        }
        if (!rowMealTiming && /\b(pre|prima)\b/i.test(lower)) {
          rowMealTiming = 'pre';
          usedCols.add(col);
          continue;
        }

        const mealMatch = cell.match(MEAL_NAMES_REGEX);
        if (mealMatch && !rowMealCategory) {
          rowMealCategory = mealMatch[1];
          if (mealMatch[2] && mealMatch[2].trim()) {
            noteParts.push(mealMatch[2].trim());
          }
          usedCols.add(col);
          continue;
        }

        noteParts.push(cell);
        usedCols.add(col);
      }

      const finalNote = noteParts.filter(Boolean).join(' | ');
      const matchedCategory = findMatchingCategory(categories, rowMealCategory, formattedTime);

      validRows.push({
        id: `bp_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        rawType: rawType || 'Pressione',
        subTypeId: bpSubType.id,
        subTypeName: bpSubType.name,
        date: dt.date,
        time: formattedTime,
        value: formattedVal,
        systolic,
        diastolic,
        pulse,
        unit: 'mmHg',
        mealTiming: rowMealTiming,
        note: finalNote,
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        timestamp: dt.timestamp,
        isValid: true
      });
      continue;
    }

    // =======================================================================
    // CASE B: WEIGHT (PESO)
    // Example: "01 ago 26 \t 96,5 kg \t Abbastanza buono"
    // =======================================================================
    const isWeightType = lowerType.includes('peso') || 
                         lowerType.includes('weight') || 
                         lowerUnit.includes('kg') || 
                         lowerVal.includes('kg') ||
                         (rawType === '' && valIdx === 1 && /^\d+([.,]\d+)?\s*(kg)?$/i.test(rawVal.trim()));

    if (isWeightType) {
      const cleanVal = rawVal.replace(/[^\d.,]/g, '').replace(',', '.');
      if (!cleanVal || isNaN(parseFloat(cleanVal))) {
        invalidRows.push({
          rowNumber: i + 1,
          raw: row.join(' | '),
          error: `Valore peso mancante o non valido: "${rawVal}"`
        });
        continue;
      }

      const matchedCategory = findMatchingCategory(categories, rawPasto, formattedTime);

      validRows.push({
        id: `weight_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        rawType: rawType || 'Peso',
        subTypeId: weightSubType.id,
        subTypeName: weightSubType.name,
        date: dt.date,
        time: formattedTime, // Defaults to 19:27 if not present
        value: cleanVal,
        unit: 'kg',
        mealTiming,
        note: rawNote,
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        timestamp: dt.timestamp,
        isValid: true
      });
      continue;
    }

    // =======================================================================
    // CASE C: STANDARD LOGS (GLICEMIA, CIBO, FARMACO, ESERCIZIO)
    // =======================================================================
    const cleanVal = rawVal.replace(/[^\d.,]/g, '').replace(',', '.');
    if (!cleanVal || isNaN(parseFloat(cleanVal))) {
      invalidRows.push({
        rowNumber: i + 1,
        raw: row.join(' | '),
        error: `Valore numerico mancante o non valido: "${rawVal}"`
      });
      continue;
    }

    let subType = glucoseSubType;
    if (lowerType.includes('cibo') || lowerType.includes('carb')) {
      subType = foodSubType;
    } else if (lowerType.includes('farmaco') || lowerType.includes('insulina') || lowerType.includes('med')) {
      subType = medSubType;
    } else if (lowerType.includes('esercizio') || lowerType.includes('attiv') || lowerType.includes('camminata')) {
      subType = exerciseSubType;
    }

    let rowMealTiming: 'pre' | 'post' | undefined = mealTiming;
    let rowMealCategory = '';
    const noteParts: string[] = [];

    if (rawPasto) {
      const mealMatch = rawPasto.match(MEAL_NAMES_REGEX);
      if (mealMatch) {
        rowMealCategory = mealMatch[1];
        if (mealMatch[2] && mealMatch[2].trim()) {
          noteParts.push(mealMatch[2].trim());
        }
      } else {
        rowMealCategory = rawPasto;
      }
    }

    if (rawNote) {
      noteParts.push(rawNote);
    }

    // Scan additional unmapped cells for mealTiming, category name, or note content
    for (let col = 0; col < row.length; col++) {
      if (col === dateIdx || col === timeIdx || col === valIdx || col === typeIdx || col === unitIdx ||
          col === timingIdx || col === pastoIdx || col === noteIdx) continue;
      const cell = row[col].trim();
      if (!cell) continue;

      const lower = cell.toLowerCase();
      if (!rowMealTiming && /\b(post|dopo)\b/i.test(lower)) {
        rowMealTiming = 'post';
        continue;
      }
      if (!rowMealTiming && /\b(pre|prima)\b/i.test(lower)) {
        rowMealTiming = 'pre';
        continue;
      }

      const mealMatch = cell.match(MEAL_NAMES_REGEX);
      if (mealMatch && !rowMealCategory) {
        rowMealCategory = mealMatch[1];
        if (mealMatch[2] && mealMatch[2].trim()) {
          noteParts.push(mealMatch[2].trim());
        }
        continue;
      }

      noteParts.push(cell);
    }

    const finalNote = noteParts.filter(Boolean).join(' | ');
    const matchedCategory = findMatchingCategory(categories, rowMealCategory, formattedTime);

    validRows.push({
      id: `csv_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      rawType: rawType || subType.name,
      subTypeId: subType.id,
      subTypeName: subType.name,
      date: dt.date,
      time: formattedTime,
      value: cleanVal,
      unit: rawUnit || subType.unit,
      mealTiming: rowMealTiming,
      note: finalNote,
      categoryId: matchedCategory.id,
      categoryName: matchedCategory.name,
      timestamp: dt.timestamp,
      isValid: true
    });
  }

  // Sort chronologically descending (newest first)
  validRows.sort((a, b) => b.timestamp - a.timestamp);

  let dateRange: { start: string; end: string } | null = null;
  if (validRows.length > 0) {
    const oldest = validRows[validRows.length - 1].date;
    const newest = validRows[0].date;
    dateRange = { start: oldest, end: newest };
  }

  const uniqueSubTypes = Array.from(new Set(validRows.map(r => r.subTypeId)));
  let detectedFormat: 'glucose' | 'pressure' | 'weight' | 'nutrition' | 'generic' = 'generic';
  let categoryLabel = 'Tutte le Letture';
  let targetSubTypes = uniqueSubTypes;

  if (uniqueSubTypes.length === 1) {
    const single = uniqueSubTypes[0];
    if (single === 'sub_glucose') {
      detectedFormat = 'glucose';
      categoryLabel = 'Glicemia';
    } else if (single === 'sub_bp') {
      detectedFormat = 'pressure';
      categoryLabel = 'Pressione Arteriosa';
    } else if (single === 'sub_weight') {
      detectedFormat = 'weight';
      categoryLabel = 'Peso Corporeo';
    } else if (single === 'sub_food') {
      detectedFormat = 'nutrition';
      categoryLabel = 'Nutrizione';
    } else if (single === 'sub_medication') {
      detectedFormat = 'generic';
      categoryLabel = 'Farmaci / Insulina';
    } else if (single === 'sub_exercise') {
      detectedFormat = 'generic';
      categoryLabel = 'Esercizio Fisico';
    } else {
      const matched = subTypes.find(s => s.id === single);
      categoryLabel = matched?.name || single;
      detectedFormat = 'generic';
    }
  } else if (uniqueSubTypes.length > 1) {
    const names = uniqueSubTypes.map(id => {
      const found = subTypes.find(s => s.id === id);
      return found?.name || id;
    });
    categoryLabel = names.join(', ');
    detectedFormat = 'generic';
  }

  return {
    totalRows: validRows.length + invalidRows.length,
    validRows,
    invalidRows,
    dateRange,
    detectedFormat,
    targetSubTypes,
    categoryLabel
  };
}

/**
 * Convert ParsedCsvRow to full LogEntryItem
 */
export function convertToLogEntryItems(rows: ParsedCsvRow[]): LogEntryItem[] {
  return rows.map(r => ({
    id: r.id,
    subTypeId: r.subTypeId,
    subTypeName: r.subTypeName,
    value: r.value,
    unit: r.unit,
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
    calories: r.calories,
    gda: r.gda,
    fat: r.fat,
    protein: r.protein,
    carbs: r.carbs,
    exerciseCal: r.exerciseCal,
    netCal: r.netCal,
    manual: r.manual,
    date: r.date,
    time: r.time,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    mealTiming: r.mealTiming,
    note: r.note,
    timestamp: r.timestamp,
    reminder: false
  }));
}
