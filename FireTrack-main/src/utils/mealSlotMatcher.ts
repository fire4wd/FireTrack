import { LogEntryItem, MealSlotConfig } from '../types/ontrack';

export const parseTimeToMinutes = (timeStr: string, isEnd = false): number => {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  let mins = h * 60 + m;
  if (isEnd && (clean === '24:00' || clean === '23:59' || clean === '0:00' || clean === '00:00' || mins === 0 || mins >= 1439)) {
    mins = 1440;
  }
  return mins;
};

export const getMealSlotForEntry = (entry: LogEntryItem, mealSlots: MealSlotConfig[]): MealSlotConfig => {
  if (!mealSlots || mealSlots.length === 0) {
    return { id: 'other', name: 'Altro', startTime: '00:00', endTime: '23:59', color: '#64748b' };
  }

  // 1. Direct match by categoryId if standard
  if (entry.categoryId === 'cat_night') {
    const s = mealSlots.find(slot => slot.id === 'night' || slot.name.toLowerCase().includes('notte'));
    if (s) return s;
  }
  if (entry.categoryId === 'cat_breakfast') {
    const s = mealSlots.find(slot => slot.id === 'bf' || slot.name.toLowerCase().includes('colaz'));
    if (s) return s;
  }
  if (entry.categoryId === 'cat_lunch') {
    const s = mealSlots.find(slot => slot.id === 'lunch' || slot.name.toLowerCase().includes('pranz'));
    if (s) return s;
  }
  if (entry.categoryId === 'cat_dinner') {
    const s = mealSlots.find(slot => slot.id === 'dinner' || slot.name.toLowerCase().includes('cena'));
    if (s) return s;
  }
  if (entry.categoryId === 'cat_bedtime') {
    const s = mealSlots.find(slot => slot.id === 'bed' || slot.name.toLowerCase().includes('coric'));
    if (s) return s;
  }

  // 2. Match by categoryName keywords
  const catName = (entry.categoryName || '').toLowerCase();
  if (catName.includes('notte') || catName.includes('digiuno')) {
    const s = mealSlots.find(slot => slot.id === 'night' || slot.name.toLowerCase().includes('notte'));
    if (s) return s;
  }
  if (catName.includes('colaz')) {
    const s = mealSlots.find(slot => slot.id === 'bf' || slot.name.toLowerCase().includes('colaz'));
    if (s) return s;
  }
  if (catName.includes('pranz')) {
    const s = mealSlots.find(slot => slot.id === 'lunch' || slot.name.toLowerCase().includes('pranz'));
    if (s) return s;
  }
  if (catName.includes('cena')) {
    const s = mealSlots.find(slot => slot.id === 'dinner' || slot.name.toLowerCase().includes('cena'));
    if (s) return s;
  }
  if (catName.includes('coric') || catName.includes('dormire') || catName.includes('bedtime')) {
    const s = mealSlots.find(slot => slot.id === 'bed' || slot.name.toLowerCase().includes('coric'));
    if (s) return s;
  }

  // 3. Match by entry.time against slot intervals
  if (entry.time) {
    const entryMin = parseTimeToMinutes(entry.time, false);

    for (const slot of mealSlots) {
      const sMin = parseTimeToMinutes(slot.startTime, false);
      const eMin = parseTimeToMinutes(slot.endTime, true);

      if (eMin > sMin) {
        if (entryMin >= sMin && entryMin < eMin) {
          return slot;
        }
      } else {
        // Overnight interval crossing midnight
        if (entryMin >= sMin || entryMin < eMin) {
          return slot;
        }
      }
    }
  }

  // Fallback to closest or default
  return mealSlots[0];
};

export interface MealSlotAnalysis {
  slot: MealSlotConfig;
  entries: LogEntryItem[];
  values: number[];
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  stdDev: number | null;
  inTargetCount: number;
  inTargetPct: number;
  aboveTargetCount: number;
  aboveTargetPct: number;
  belowTargetCount: number;
  belowTargetPct: number;
  preCount: number;
  preAvg: number | null;
  postCount: number;
  postAvg: number | null;
}

export const analyzeEntriesByMealSlot = (
  entries: LogEntryItem[],
  mealSlots: MealSlotConfig[],
  targetMin = 70,
  targetMax = 150,
  parseValueFn?: (val: string | number | undefined) => number
): MealSlotAnalysis[] => {
  const parseVal = parseValueFn || ((val: string | number | undefined): number => {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    if (str.includes('/')) {
      const parts = str.split('/');
      const num = parseFloat(parts[0].replace(',', '.'));
      return isNaN(num) ? 0 : num;
    }
    const num = parseFloat(str.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  });

  return mealSlots.map(slot => {
    const slotEntries = entries.filter(e => {
      const matched = getMealSlotForEntry(e, mealSlots);
      return matched.id === slot.id;
    });

    const values = slotEntries
      .map(e => parseVal(e.value))
      .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v) && v > 0);

    const count = values.length;
    let avg: number | null = null;
    let min: number | null = null;
    let max: number | null = null;
    let stdDev: number | null = null;

    if (count > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      avg = Math.round(sum / count);
      min = Math.min(...values);
      max = Math.max(...values);

      if (count > 1) {
        const variance = values.reduce((acc, val) => acc + Math.pow(val - (avg || 0), 2), 0) / count;
        stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
      } else {
        stdDev = 0;
      }
    }

    // Target distribution
    let inTargetCount = 0;
    let aboveTargetCount = 0;
    let belowTargetCount = 0;

    values.forEach(v => {
      if (v < targetMin) belowTargetCount++;
      else if (v > targetMax) aboveTargetCount++;
      else inTargetCount++;
    });

    const inTargetPct = count > 0 ? Math.round((inTargetCount / count) * 100) : 0;
    const aboveTargetPct = count > 0 ? Math.round((aboveTargetCount / count) * 100) : 0;
    const belowTargetPct = count > 0 ? Math.round((belowTargetCount / count) * 100) : 0;

    // Pre vs Post
    const preEntries = slotEntries.filter(e => e.mealTiming === 'pre' || (e.categoryName && e.categoryName.toLowerCase().includes('prima')));
    const postEntries = slotEntries.filter(e => e.mealTiming === 'post' || (e.categoryName && e.categoryName.toLowerCase().includes('dopo')));

    const preValues = preEntries.map(e => parseVal(e.value)).filter(v => v > 0);
    const postValues = postEntries.map(e => parseVal(e.value)).filter(v => v > 0);

    const preCount = preValues.length;
    const postCount = postValues.length;
    const preAvg = preCount > 0 ? Math.round(preValues.reduce((a, b) => a + b, 0) / preCount) : null;
    const postAvg = postCount > 0 ? Math.round(postValues.reduce((a, b) => a + b, 0) / postCount) : null;

    return {
      slot,
      entries: slotEntries,
      values,
      count,
      avg,
      min,
      max,
      stdDev,
      inTargetCount,
      inTargetPct,
      aboveTargetCount,
      aboveTargetPct,
      belowTargetCount,
      belowTargetPct,
      preCount,
      preAvg,
      postCount,
      postAvg,
    };
  });
};
