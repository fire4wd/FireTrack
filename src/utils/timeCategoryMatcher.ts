import { HealthCategory } from '../types/ontrack';

/**
 * Finds the matching category based on the current time (HH:mm)
 * or returns the default category if set, or the first available category.
 */
export const findCategoryForTime = (categories: HealthCategory[], currentTimeStr?: string): HealthCategory => {
  if (!categories || categories.length === 0) {
    return { id: 'cat_1', name: 'Digiuno', order: 1 };
  }

  const nowStr = currentTimeStr || new Date().toTimeString().slice(0, 5); // "17:37"
  const nowMinutes = timeStrToMinutes(nowStr);

  // 1. Check if any category matches time window
  for (const cat of categories) {
    if (cat.startTimeEnabled && cat.endTimeEnabled && cat.startTime && cat.endTime) {
      const startMin = timeStrToMinutes(cat.startTime);
      const endMin = timeStrToMinutes(cat.endTime);

      if (startMin <= endMin) {
        // Normal range e.g. 07:30 to 09:00
        if (nowMinutes >= startMin && nowMinutes <= endMin) {
          return cat;
        }
      } else {
        // Overnight range e.g. 23:00 to 06:00
        if (nowMinutes >= startMin || nowMinutes <= endMin) {
          return cat;
        }
      }
    }
  }

  // 2. Fallback to category marked as default
  const defaultCat = categories.find(c => c.isDefault);
  if (defaultCat) return defaultCat;

  // 3. Fallback to first category
  return categories[0];
};

const timeStrToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
