import { LogEntryItem, HealthCategory, HealthSubType } from '../types/ontrack';
import { findCategoryForTime } from './timeCategoryMatcher';

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
  // Fasting fields
  fastingStartDate?: string;
  fastingStartTime?: string;
  fastingEndDate?: string;
  fastingEndTime?: string;
  fastingProtocol?: string;
  fastingTargetHours?: number;
  fastingStartGlucose?: string | number;
  fastingEndGlucose?: string | number;
  fastingIsInProgress?: boolean;
  // Medication fields
  medicationName?: string;
  medicationDosage?: string;
  medicationSchedule?: string;
  medicationInstructions?: string;
  medicationActive?: boolean;
  isValid: boolean;
  error?: string;
}

export interface CsvParseResult {
  totalRows: number;
  validRows: ParsedCsvRow[];
  invalidRows: { rowNumber: number; raw: string; error: string }[];
  dateRange: { start: string; end: string } | null;
  detectedFormat?: 'glucose' | 'pressure' | 'weight' | 'nutrition' | 'fasting' | 'medication' | 'generic';
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
 * Examples:
 * - "14 Ago 2026, 00:20"
 * - "01 ago 26" -> (defaults time to 19:27)
 * - "Dom 2", "Dom 19", "Mar 2", "Sab 9"
 * - "14/08/2026 00:20"
 * - "2026-08-14 00:20"
 */
export function parseDateTimeString(
  raw: string, 
  defaultTime: string = '19:27',
  referenceYearMonth: { year: string; month: string } = { year: '2026', month: '08' }
): { date: string; time: string; timestamp: number } | null {
  if (!raw) return null;
  const clean = raw.trim().replace(/,/g, ' ');

  // 1. Pattern: Day-of-week + Day-of-month (e.g. "Dom 2", "Dom 19", "Mar 2", "Sab 9", "Lun 15")
  const dayOfWeekPattern = /^(?:dom|lun|mar|mer|gio|ven|sab|sun|mon|tue|wed|thu|fri|sat)[a-zà-ú]*\.?\s+(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/i;
  const matchDow = clean.match(dayOfWeekPattern);
  if (matchDow) {
    const day = matchDow[1].padStart(2, '0');
    const hour = (matchDow[2] || defaultTime.split(':')[0] || '19').padStart(2, '0');
    const minute = (matchDow[3] || defaultTime.split(':')[1] || '27').padStart(2, '0');
    const dateStr = `${referenceYearMonth.year}-${referenceYearMonth.month}-${day}`;
    const timeStr = `${hour}:${minute}`;
    const timestamp = new Date(`${dateStr}T${timeStr}:00`).getTime();
    return { date: dateStr, time: timeStr, timestamp: isNaN(timestamp) ? Date.now() : timestamp };
  }

  // 2. Italian Month Pattern with 2 or 4 digit year: "14 Ago 2026 00:20" or "01 ago 26" or "5 ago 2026"
  const textMonthRegex = /^(\d{1,2})\s+([a-zA-Zà-úÀ-Ú]+)\s+(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/;
  const matchText = clean.match(textMonthRegex);
  if (matchText) {
    const day = matchText[1].padStart(2, '0');
    const monthWord = matchText[2].toLowerCase();
    let year = matchText[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    const hour = (matchText[4] || defaultTime.split(':')[0] || '19').padStart(2, '0');
    const minute = (matchText[5] || defaultTime.split(':')[1] || '27').padStart(2, '0');

    const monthNum = ITALIAN_MONTHS[monthWord] || ITALIAN_MONTHS[monthWord.slice(0, 3)];
    if (monthNum) {
      const dateStr = `${year}-${monthNum}-${day}`;
      const timeStr = `${hour}:${minute}`;
      const timestamp = new Date(`${dateStr}T${timeStr}:00`).getTime();
      return { date: dateStr, time: timeStr, timestamp: isNaN(timestamp) ? Date.now() : timestamp };
    }
  }

  // 3. Standard Date with Slashes or Dashes (DD/MM/YYYY or YYYY-MM-DD or DD/MM/YY)
  const slashRegex = /^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})(?:\s+(\d{1,2}):(\d{2}))?/;
  const matchSlash = clean.match(slashRegex);
  if (matchSlash) {
    let year = matchSlash[1];
    let month = matchSlash[2].padStart(2, '0');
    let day = matchSlash[3];
    const hour = (matchSlash[4] || defaultTime.split(':')[0] || '19').padStart(2, '0');
    const minute = (matchSlash[5] || defaultTime.split(':')[1] || '27').padStart(2, '0');

    if (year.length === 2 || year.length === 1) {
      // DD/MM/YYYY format
      const tempDay = year.padStart(2, '0');
      const tempYear = day.length === 2 ? `20${day}` : day;
      day = tempDay;
      year = tempYear;
    } else if (year.length === 4) {
      // YYYY/MM/DD
      day = day.padStart(2, '0');
    }

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}`;
    const timestamp = new Date(`${dateStr}T${timeStr}:00`).getTime();
    return { date: dateStr, time: timeStr, timestamp: isNaN(timestamp) ? Date.now() : timestamp };
  }

  // 4. Fallback generic JS Date
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    const hh = String(parsed.getHours()).padStart(2, '0');
    const mm = String(parsed.getMinutes()).padStart(2, '0');
    return {
      date: `${y}-${m}-${d}`,
      time: `${hh}:${mm}`,
      timestamp: parsed.getTime()
    };
  }

  return null;
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
  // 1. DETECT FASTING / DIGIUNO FORMAT
  // Header: Data, Inizio, Fine (Rottura), Durata (Ore), Protocollo, Stadio Metabolico, Glicemia Inizio, Glicemia Fine, Note / Dettagli
  // or Data Inizio, Ora Inizio, Data Fine, Ora Fine, Protocollo, Target, Glicemia...
  // =========================================================================
  const isFastingFormat = headerLine.includes('rottura') || 
                          (headerLine.includes('digiuno') && (headerLine.includes('durata') || headerLine.includes('inizio') || headerLine.includes('protocollo') || headerLine.includes('piano'))) ||
                          ((headerLine.includes('protocollo') || headerLine.includes('piano')) && headerLine.includes('durata')) ||
                          (headerLine.includes('glicemia inizio') || headerLine.includes('glicemia fine')) ||
                          (headerLine.includes('fasting') && (headerLine.includes('duration') || headerLine.includes('plan') || headerLine.includes('protocol')));

  if (isFastingFormat) {
    const fastingSubType = subTypes.find(s => s.id === 'sub_fasting') || { id: 'sub_fasting', name: 'Digiuno', unit: 'ore' };
    
    let dateCol = header.findIndex(h => h === 'data' || h.startsWith('data') || h.includes('date') || h.includes('giorno'));
    let startCol = header.findIndex(h => h === 'inizio' || h.startsWith('inizio') || h.includes('start') || h.includes('ora inizio'));
    let endCol = header.findIndex(h => h.includes('fine') || h.includes('rottura') || h.includes('end') || h.includes('ora fine'));
    let durCol = header.findIndex(h => h.includes('durata') || h.includes('duration') || h.includes('ore'));
    let protoCol = header.findIndex(h => h.includes('protocollo') || h.includes('protocol') || h.includes('piano') || h.includes('plan'));
    let stageCol = header.findIndex(h => h.includes('stadio') || h.includes('stage') || h.includes('metabolic'));
    let gluStartCol = header.findIndex(h => (h.includes('glicemia') || h.includes('glucose')) && h.includes('inizio'));
    let gluEndCol = header.findIndex(h => (h.includes('glicemia') || h.includes('glucose')) && (h.includes('fine') || h.includes('rottura')));
    let noteCol = header.findIndex(h => h.includes('note') || h.includes('dettagli') || h.includes('comment'));

    if (dateCol === -1) dateCol = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const rawDate = (row[dateCol] || '').trim();
      const rawStart = startCol >= 0 && row[startCol] ? row[startCol].trim() : '20:00';
      const rawEnd = endCol >= 0 && row[endCol] ? row[endCol].trim() : '12:00';
      let rawDur = durCol >= 0 && row[durCol] ? row[durCol].trim() : '';
      let rawProto = protoCol >= 0 && row[protoCol] ? row[protoCol].trim() : '';
      const rawStage = stageCol >= 0 && row[stageCol] ? row[stageCol].trim() : '';
      const rawGluStart = gluStartCol >= 0 && row[gluStartCol] ? row[gluStartCol].trim().replace(/[^\d.,]/g, '').replace(',', '.') : '';
      const rawGluEnd = gluEndCol >= 0 && row[gluEndCol] ? row[gluEndCol].trim().replace(/[^\d.,]/g, '').replace(',', '.') : '';
      const rawNote = noteCol >= 0 && row[noteCol] ? row[noteCol].trim() : '';

      // Date parsing
      let baseDateStr = rawDate;
      const dt = parseDateTimeString(rawDate || rawEnd || new Date().toISOString().slice(0, 10), '12:00');
      if (!dt) {
        invalidRows.push({
          rowNumber: i + 1,
          raw: row.join(' | '),
          error: `Data digiuno non valida: "${rawDate}"`
        });
        continue;
      }
      baseDateStr = dt.date;

      // Extract times
      let startTime = '20:00';
      let startDate = baseDateStr;
      let endTime = '12:00';
      let endDate = baseDateStr;

      if (rawStart.includes(':')) {
        const parts = rawStart.split(' ');
        if (parts.length > 1 && parts[0].includes('-')) {
          startDate = parts[0];
          startTime = parts[1].slice(0, 5);
        } else {
          startTime = rawStart.slice(0, 5);
        }
      }

      if (rawEnd.includes(':')) {
        const parts = rawEnd.split(' ');
        if (parts.length > 1 && parts[0].includes('-')) {
          endDate = parts[0];
          endTime = parts[1].slice(0, 5);
        } else {
          endTime = rawEnd.slice(0, 5);
        }
      }

      // Calculate duration if needed
      let durNum = parseFloat(rawDur.replace(',', '.'));
      if (isNaN(durNum) || durNum <= 0) {
        // Compute from start & end time
        const startTimestamp = new Date(`${startDate}T${startTime}:00`).getTime();
        let endTimestamp = new Date(`${endDate}T${endTime}:00`).getTime();
        if (endTimestamp <= startTimestamp) {
          // Crosses midnight, so end is next day
          endTimestamp += 24 * 3600 * 1000;
        }
        if (!isNaN(startTimestamp) && !isNaN(endTimestamp) && endTimestamp > startTimestamp) {
          durNum = Math.round(((endTimestamp - startTimestamp) / (3600 * 1000)) * 10) / 10;
        } else {
          durNum = 16.0;
        }
      }

      // Protocol deduce
      if (!rawProto || rawProto === '-') {
        if (durNum >= 22) rawProto = 'OMAD (23:1)';
        else if (durNum >= 19.5) rawProto = '20:4';
        else if (durNum >= 17.5) rawProto = '18:6';
        else if (durNum >= 15) rawProto = '16:8';
        else if (durNum >= 13.5) rawProto = '14:10';
        else if (durNum >= 11.5) rawProto = '12:12';
        else rawProto = 'Personalizzato';
      }

      let targetHours = 16;
      if (rawProto.includes('20')) targetHours = 20;
      else if (rawProto.includes('18')) targetHours = 18;
      else if (rawProto.includes('OMAD') || rawProto.includes('23')) targetHours = 23;
      else if (rawProto.includes('14')) targetHours = 14;
      else if (rawProto.includes('12')) targetHours = 12;
      else if (durNum > 0) targetHours = Math.floor(durNum);

      // Build structured note
      const noteDetails: string[] = [];
      if (rawProto) noteDetails.push(`Piano: ${rawProto}`);
      if (rawStage) noteDetails.push(`Stadio: ${rawStage}`);
      if (rawGluStart) noteDetails.push(`Glicemia Inizio: ${rawGluStart} mg/dL`);
      if (rawGluEnd) noteDetails.push(`Glicemia Fine: ${rawGluEnd} mg/dL`);
      if (rawNote) noteDetails.push(rawNote);

      const matchedCategory = findCategoryForTime(categories, endTime);

      validRows.push({
        id: `fasting_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        rawType: 'Digiuno Intermittente',
        subTypeId: fastingSubType.id,
        subTypeName: fastingSubType.name,
        date: endDate,
        time: endTime,
        value: String(durNum).replace(',', '.'),
        unit: 'ore',
        fastingStartDate: startDate,
        fastingStartTime: startTime,
        fastingEndDate: endDate,
        fastingEndTime: endTime,
        fastingProtocol: rawProto,
        fastingTargetHours: targetHours,
        fastingStartGlucose: rawGluStart ? parseFloat(rawGluStart) : undefined,
        fastingEndGlucose: rawGluEnd ? parseFloat(rawGluEnd) : undefined,
        fastingIsInProgress: false,
        note: noteDetails.join(' | '),
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        timestamp: new Date(`${endDate}T${endTime}:00`).getTime() || dt.timestamp,
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
      detectedFormat: 'fasting',
      targetSubTypes: ['sub_fasting'],
      categoryLabel: 'Digiuno Intermittente'
    };
  }

  // =========================================================================
  // 2. DETECT MEDICATIONS / FARMACI FORMAT
  // Header: Nome Farmaco, Dosaggio, Orario / Frequenza, Istruzioni, Attivo (Si/No)
  // or Data, Ora, Tipo, Farmaco, Dose, Note
  // =========================================================================
  const isMedicationFormat = (headerLine.includes('farmaco') || headerLine.includes('farmaci') || headerLine.includes('medication')) &&
                             (headerLine.includes('dosaggio') || headerLine.includes('dosage') || headerLine.includes('orario') || headerLine.includes('istruzioni') || headerLine.includes('schedule') || headerLine.includes('attivo'));

  if (isMedicationFormat) {
    const medSubType = subTypes.find(s => s.id === 'sub_medication') || { id: 'sub_medication', name: 'Farmaco', unit: 'dose' };
    
    let nameCol = header.findIndex(h => h.includes('nome') || h.includes('farmaco') || h.includes('medication'));
    let doseCol = header.findIndex(h => h.includes('dosaggio') || h.includes('dosage') || h.includes('dose'));
    let schedCol = header.findIndex(h => h.includes('orario') || h.includes('frequenza') || h.includes('schedule') || h.includes('fascia'));
    let instCol = header.findIndex(h => h.includes('istruzioni') || h.includes('instruction') || h.includes('indicazioni'));
    let actCol = header.findIndex(h => h.includes('attivo') || h.includes('active') || h.includes('stato'));
    let dateCol = header.findIndex(h => h === 'data' || h.startsWith('data') || h.includes('date'));
    let timeCol = header.findIndex(h => h === 'ora' || h.startsWith('ora') || h.includes('time'));
    let noteCol = header.findIndex(h => h.includes('note') || h.includes('comment'));

    if (nameCol === -1) nameCol = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const rawName = (row[nameCol] || '').trim();
      if (!rawName) continue;

      const rawDose = doseCol >= 0 && row[doseCol] ? row[doseCol].trim() : '1 compressa';
      const rawSched = schedCol >= 0 && row[schedCol] ? row[schedCol].trim() : 'Mattina';
      const rawInst = instCol >= 0 && row[instCol] ? row[instCol].trim() : '';
      const rawAct = actCol >= 0 && row[actCol] ? row[actCol].trim().toLowerCase() : 'sì';
      const isActive = rawAct.startsWith('s') || rawAct.startsWith('y') || rawAct.includes('attivo') || rawAct === '1' || rawAct === 'true';

      const rawDate = dateCol >= 0 && row[dateCol] ? row[dateCol].trim() : '';
      const rawTime = timeCol >= 0 && row[timeCol] ? row[timeCol].trim() : '';
      const rawNote = noteCol >= 0 && row[noteCol] ? row[noteCol].trim() : '';

      // Infer time from schedule if time not provided
      let defaultTime = '08:00';
      const ls = rawSched.toLowerCase();
      if (ls.includes('colazione') || ls.includes('mattina') || ls.includes('risveglio')) defaultTime = '08:00';
      else if (ls.includes('pranzo') || ls.includes('mezzogiorno')) defaultTime = '13:00';
      else if (ls.includes('cena') || ls.includes('sera')) defaultTime = '20:00';
      else if (ls.includes('notte') || ls.includes('coricarsi') || ls.includes('letto')) defaultTime = '22:30';

      const dt = parseDateTimeString(rawDate || new Date().toISOString().slice(0, 10), rawTime || defaultTime);
      const rowDate = dt ? dt.date : new Date().toISOString().slice(0, 10);
      const rowTime = dt ? dt.time : defaultTime;
      const rowTs = dt ? dt.timestamp : Date.now() - i * 60000;

      const matchedCategory = findCategoryForTime(categories, rowTime);

      const notePieces: string[] = [];
      notePieces.push(`Farmaco: ${rawName}`);
      if (rawDose) notePieces.push(`Dose: ${rawDose}`);
      if (rawSched) notePieces.push(`Orario: ${rawSched}`);
      if (rawInst) notePieces.push(`Istruzioni: ${rawInst}`);
      if (rawNote) notePieces.push(rawNote);

      validRows.push({
        id: `med_import_${rowTs}_${Math.random().toString(36).slice(2, 7)}`,
        rawType: 'Farmaci / Terapia',
        subTypeId: medSubType.id,
        subTypeName: medSubType.name,
        date: rowDate,
        time: rowTime,
        value: rawDose || '1 dose',
        unit: 'dose',
        medicationName: rawName,
        medicationDosage: rawDose,
        medicationSchedule: rawSched,
        medicationInstructions: rawInst,
        medicationActive: isActive,
        note: notePieces.join(' | '),
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        timestamp: rowTs,
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
      detectedFormat: 'medication',
      targetSubTypes: ['sub_medication'],
      categoryLabel: 'Farmaci / Terapie'
    };
  }

  // =========================================================================
  // 3. DETECT NUTRITION SUMMARY TABLE FORMAT
  // Header: Data,Alimenti (Cal),% GDA,Grassi (g),Proteine (g),Carboidrati (g),Esercizio (Cal),Netto (Cal)
  // =========================================================================
  const isNutritionFormat = headerLine.includes('alimenti') || 
                            headerLine.includes('gda') || 
                            (headerLine.includes('grassi') && headerLine.includes('proteine') && headerLine.includes('carboidrati'));

  if (isNutritionFormat) {
    let dateCol = header.findIndex(h => h === 'data' || h.startsWith('data') || h.includes('date') || h.includes('giorno'));
    let timeCol = header.findIndex(h => h === 'ora' || h.startsWith('ora') || h.includes('time'));
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

      const cleanCal = rawCal.replace(/[^\d.,]/g, '').replace(',', '.');
      const cleanCarb = rawCarb.replace(/[^\d.,]/g, '').replace(',', '.');
      const cleanProt = rawProt.replace(/[^\d.,]/g, '').replace(',', '.');
      const cleanFat = rawFat.replace(/[^\d.,]/g, '').replace(',', '.');
      const cleanGda = rawGda.replace(/[^\d.,]/g, '').replace(',', '.');

      // Value shown in main entry: carbs if available, otherwise calories
      const mainVal = cleanCarb && cleanCarb !== '-' && cleanCarb !== '' ? cleanCarb : (cleanCal && cleanCal !== '-' ? cleanCal : '0');
      const unit = cleanCarb && cleanCarb !== '-' && cleanCarb !== '' ? 'g' : 'Cal';

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

      const matchedCategory = findCategoryForTime(categories, dt.time);

      validRows.push({
        id: `nutrition_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        rawType: 'Riepilogo nutrizionale',
        subTypeId: foodSubType.id,
        subTypeName: foodSubType.name,
        date: dt.date,
        time: dt.time,
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

    const lowerType = rawType.toLowerCase();
    const lowerVal = rawVal.toLowerCase();
    const lowerUnit = rawUnit.toLowerCase();

    // Determine Meal Timing
    let mealTiming: 'pre' | 'post' | undefined = undefined;
    const lowerTiming = rawTiming.toLowerCase();
    if (lowerTiming.includes('post') || lowerTiming.includes('dopo')) {
      mealTiming = 'post';
    } else if (lowerTiming.includes('pre') || lowerTiming.includes('prima')) {
      mealTiming = 'pre';
    }

    // =======================================================================
    // CASE A: BLOOD PRESSURE (PRESSIONE ARTERIOSA)
    // Example: "pressione \t 14 Ago 2026, 00:20 \t 94 106 95 mmHg bpm \t Sì \t Post-pasto \t Dolce compleanno"
    // =======================================================================
    const isPressureType = lowerType.includes('pressione') || 
                           lowerType.includes('pressure') || 
                           lowerUnit.includes('mmhg') || 
                           lowerVal.includes('mmhg') ||
                           /^\d{2,3}[\s\/]+\d{2,3}(?:[\s\-]+\d{2,3})?/.test(rawVal.trim());

    if (isPressureType) {
      // Extract numeric components (e.g. 94 106 95 or 120/80 - 75 or 120 80)
      const numMatches = rawVal.match(/\d+/g);
      let systolic = '';
      let diastolic = '';
      let pulse = '';

      if (numMatches && numMatches.length >= 2) {
        const n1 = parseInt(numMatches[0], 10);
        const n2 = parseInt(numMatches[1], 10);
        const n3 = numMatches[2] ? parseInt(numMatches[2], 10) : undefined;

        // Determine Systolic (higher) vs Diastolic (lower)
        if (n1 > n2) {
          systolic = String(n1);
          diastolic = String(n2);
        } else {
          systolic = String(n2);
          diastolic = String(n1);
        }

        if (n3 !== undefined) {
          pulse = String(n3);
        }
      } else if (numMatches && numMatches.length === 1) {
        systolic = numMatches[0];
      }

      const formattedVal = systolic && diastolic 
        ? `${systolic}/${diastolic}${pulse ? ` - ${pulse} bpm` : ''}` 
        : (systolic || rawVal);

      const matchedCategory = findCategoryForTime(categories, dt.time);

      validRows.push({
        id: `bp_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        rawType: rawType || 'Pressione',
        subTypeId: bpSubType.id,
        subTypeName: bpSubType.name,
        date: dt.date,
        time: dt.time,
        value: formattedVal,
        systolic,
        diastolic,
        pulse,
        unit: 'mmHg',
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

      const matchedCategory = findCategoryForTime(categories, dt.time);

      validRows.push({
        id: `weight_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
        rawType: rawType || 'Peso',
        subTypeId: weightSubType.id,
        subTypeName: weightSubType.name,
        date: dt.date,
        time: dt.time, // Defaults to 19:27 if not present
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

    const matchedCategory = findCategoryForTime(categories, dt.time);

    validRows.push({
      id: `csv_import_${dt.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      rawType: rawType || subType.name,
      subTypeId: subType.id,
      subTypeName: subType.name,
      date: dt.date,
      time: dt.time,
      value: cleanVal,
      unit: rawUnit || subType.unit,
      mealTiming,
      note: rawNote,
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
  let detectedFormat: 'glucose' | 'pressure' | 'weight' | 'nutrition' | 'fasting' | 'medication' | 'generic' = 'generic';
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
    } else if (single === 'sub_fasting') {
      detectedFormat = 'fasting';
      categoryLabel = 'Digiuno Intermittente';
    } else if (single === 'sub_medication') {
      detectedFormat = 'medication';
      categoryLabel = 'Farmaci / Terapie';
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
    reminder: false,
    // Fasting fields
    fastingStartDate: r.fastingStartDate,
    fastingStartTime: r.fastingStartTime,
    fastingEndDate: r.fastingEndDate,
    fastingEndTime: r.fastingEndTime,
    fastingProtocol: r.fastingProtocol,
    fastingTargetHours: r.fastingTargetHours,
    fastingStartGlucose: r.fastingStartGlucose !== undefined ? Number(r.fastingStartGlucose) : undefined,
    fastingEndGlucose: r.fastingEndGlucose !== undefined ? Number(r.fastingEndGlucose) : undefined,
    fastingIsInProgress: r.fastingIsInProgress
  }));
}
