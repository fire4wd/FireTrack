export type SubTypeKind = 'Glucose' | 'Food' | 'Exercise' | 'Medication' | 'Weight' | 'Blood Pressure' | 'Pulse' | 'HbA1c' | 'Body Fat' | string;

export interface HealthSubType {
  id: string;
  name: SubTypeKind;
  unit: string;
  isCustom?: boolean;
}

export interface HealthCategory {
  id: string;
  name: string;
  order: number;
  isDefault?: boolean;
  startTimeEnabled?: boolean;
  startTime?: string;
  endTimeEnabled?: boolean;
  endTime?: string;
}

export interface LogEntryItem {
  id: string;
  subTypeId: string;
  subTypeName: string;
  value: string; // e.g. "170.0" or "120/80"
  systolic?: string;
  diastolic?: string;
  pulse?: string;
  distance?: string; // in km
  duration?: string; // in min
  speed?: string;    // in km/h (calculated automatically)
  unit: string;
  date: string; // YYYY-MM-DD or DD/MM/YY
  time: string; // HH:mm
  categoryId: string;
  categoryName: string;
  reminder?: boolean;
  note?: string;
  mealTiming?: 'pre' | 'post'; // 'pre' = Pre pasto (mela intera 🍎), 'post' = Post pasto (torsolo mela 🍏)
  eventNoteIcon?: string; // ID of event note icon selected (e.g., 'carbs', 'exercise', 'meds', 'bottle', 'meter', 'sick', 'stress', 'sad')
  // Nutrition & Extra Import Fields
  calories?: string;
  gda?: string;
  fat?: string;
  protein?: string;
  carbs?: string;
  exerciseCal?: string;
  netCal?: string;
  manual?: boolean;
  // Fasting Specific Fields
  fastingStartDate?: string;
  fastingStartTime?: string;
  fastingEndDate?: string;
  fastingEndTime?: string;
  fastingProtocol?: string;
  fastingTargetHours?: number;
  fastingStartGlucose?: string | number;
  fastingEndGlucose?: string | number;
  fastingIsInProgress?: boolean;
  timestamp: number;
}

export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  schedule?: string;
  instructions?: string;
  active?: boolean;
  notes?: string;
}

export interface EventNoteConfig {
  id: string; // 'carbs' | 'exercise' | 'meds' | 'bottle' | 'meter' | 'sick' | 'stress' | 'sad'
  label: string;
  bgColor: string;
  order: number;
  enabledOnGlucometer?: boolean;
}

export interface MealSlotConfig {
  id: string;
  name: string; // Notte, Prima colazione, Pranzo, Cena, Ora di coricarsi
  startTime: string; // e.g. "0:00"
  endTime: string;   // e.g. "5:00"
  color: string;
  emoji?: string;
}

export interface FastingLevelDefinition {
  level: number;
  title: string;
  minHours: number;
  maxHours: number;
  rangeLabel: string;
  description: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  barColor: string;
}

export interface ActiveFastingSession {
  isActive: boolean;
  startTime: string; // ISO string e.g. "2026-08-15T00:00:00"
  protocol: string; // e.g. "16:8", "18:6", "20:4", "OMAD (23:1)", "24h", "36h", "48h", "72h"
  targetHours: number; // e.g. 16
  startingGlucose?: number;
  note?: string;
}

export interface SavedFastingRecord {
  id: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;  // YYYY-MM-DD (can be empty if in progress)
  endTime?: string;    // HH:mm (can be empty if in progress)
  protocol: string;
  targetHours: number;
  durationHours?: number;
  startingGlucose?: number;
  endingGlucose?: number;
  note?: string;
  isCompleted?: boolean;
}

export interface ReminderNotificationSettings {
  enabled: boolean;
  time: string; // e.g. "20:00"
  daysOfWeek: number[]; // [0, 1, 2, 3, 4, 5, 6] where 0=Sun, 1=Mon...
  message: string;
  soundEnabled: boolean;
  includeGlucosePrompt?: boolean;
  includeBloodPressurePrompt?: boolean;
}

export interface NextcloudConfig {
  serverUrl: string; // e.g. "https://nc.fire4wd.uk"
  username: string;  // e.g. "fire"
  password?: string; // saved password / app password for seamless sync
  folder: string;    // e.g. "FireTrack"
  autoSyncOnBackup?: boolean;
}

export interface UserSettings {
  patientName: string;
  birthDate: string;
  unit: string;
  targetPreMin: number;
  targetPreMax: number;
  targetPostMin: number;
  targetPostMax: number;
  theme?: 'dark' | 'light';
  reminder?: ReminderNotificationSettings;
  nextcloud?: NextcloudConfig;
}

export interface BloodTestParameter {
  id: string;
  name: string;
  unit: string;
  conditionType: 'range' | 'max_only' | 'min_only';
  min?: number;
  max?: number;
  order: number;
  description?: string;
}

export interface BloodTestRecord {
  id: string;
  date: string; // e.g. "201810", "201901", "2019-05-12"
  timestamp: number;
  values: Record<string, number | null>; // key is param id (or lowercase name)
  notes?: string;
}

export interface DailyNote {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  tags?: string[];
  timestamp: number;
  updatedAt?: number;
}

export interface OnTrackBackupData {
  version: string;
  appName: 'FireTrack' | 'fire4wd OnTrack';
  exportDate: string;
  entries: LogEntryItem[];
  categories: HealthCategory[];
  subTypes: HealthSubType[];
  eventNotes?: EventNoteConfig[];
  mealSlots?: MealSlotConfig[];
  bloodTestParams?: BloodTestParameter[];
  bloodTestRecords?: BloodTestRecord[];
  dailyNotes?: DailyNote[];
  medications?: MedicationItem[];
  savedFastings?: SavedFastingRecord[];
  userSettings?: UserSettings;
}

export type ActiveScreen = 
  | 'home' 
  | 'add' 
  | 'history' 
  | 'graphs' 
  | 'reports' 
  | 'calendar'
  | 'blood-tests'
  | 'tools' 
  | 'customize' 
  | 'customize-categories' 
  | 'customize-subtypes' 
  | 'edit-category'
  | 'system-settings'
  | 'backup' 
  | 'restore' 
  | 'export' 
  | 'purge';
