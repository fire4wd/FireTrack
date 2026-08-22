import { HealthCategory, HealthSubType, LogEntryItem, BloodTestParameter, BloodTestRecord, MedicationItem } from '../types/ontrack';

export const defaultCategories: HealthCategory[] = [
  { id: 'cat_night', name: 'Notte (Digiuno)', order: 1, startTimeEnabled: true, startTime: '00:00', endTimeEnabled: true, endTime: '05:00' },
  { id: 'cat_breakfast', name: 'Colazione', order: 2, isDefault: true, startTimeEnabled: true, startTime: '05:00', endTimeEnabled: true, endTime: '11:00' },
  { id: 'cat_lunch', name: 'Pranzo', order: 3, startTimeEnabled: true, startTime: '11:00', endTimeEnabled: true, endTime: '14:30' },
  { id: 'cat_dinner', name: 'Cena', order: 4, startTimeEnabled: true, startTime: '17:00', endTimeEnabled: true, endTime: '20:00' },
  { id: 'cat_bedtime', name: 'Coricarsi', order: 5, startTimeEnabled: true, startTime: '22:00', endTimeEnabled: true, endTime: '23:59' },
];

export const defaultSubTypes: HealthSubType[] = [
  { id: 'sub_glucose', name: 'Glicemia', unit: 'mg/dL' },
  { id: 'sub_bp', name: 'Pressione', unit: 'mmHg' },
  { id: 'sub_fasting', name: 'Digiuno', unit: 'ore' },
  { id: 'sub_medication', name: 'Farmaco', unit: 'dose' },
  { id: 'sub_food', name: 'Cibo / Carboidrati', unit: 'g' },
  { id: 'sub_exercise', name: 'Esercizio', unit: 'min' },
  { id: 'sub_weight', name: 'Peso', unit: 'kg' },
  { id: 'sub_bodyfat', name: 'Grasso Corporeo', unit: '%' },
];

export const defaultMedications: MedicationItem[] = [
  { id: 'med_1', name: 'Metformina', dosage: '500 mg', schedule: 'Pranzo e Cena', instructions: 'Durante i pasti', active: true },
  { id: 'med_2', name: 'Cardioaspirina', dosage: '100 mg', schedule: 'Pranzo', instructions: 'A stomaco pieno', active: true },
  { id: 'med_3', name: 'Omega 3', dosage: '1000 mg', schedule: 'Colazione', instructions: 'Con abbondante acqua', active: true },
];

const now = new Date();
const formatDate = (d: Date) => d.toISOString().split('T')[0];
const dayMs = 86400000;

export const defaultSampleEntries: LogEntryItem[] = [
  // Oggi (e.g. 13/8)
  {
    id: 'log_today_dinner',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '159',
    unit: 'mg/dL',
    date: formatDate(now),
    time: '20:22',
    categoryId: 'cat_5',
    categoryName: 'Pre Cena',
    mealTiming: 'pre',
    reminder: false,
    note: 'Cena in famiglia',
    timestamp: Date.now() - 3600000 * 0.5
  },
  {
    id: 'log_today_carbs',
    subTypeId: 'sub_food',
    subTypeName: 'Cibo / Carboidrati',
    value: '45',
    unit: 'g',
    date: formatDate(now),
    time: '20:30',
    categoryId: 'cat_5',
    categoryName: 'Pre Cena',
    reminder: false,
    timestamp: Date.now() - 3600000 * 0.4
  },
  {
    id: 'log_today_lunch',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '135',
    unit: 'mg/dL',
    date: formatDate(now),
    time: '14:30',
    categoryId: 'cat_4',
    categoryName: 'Dopo Pranzo',
    mealTiming: 'post',
    reminder: false,
    timestamp: Date.now() - 3600000 * 6
  },
  {
    id: 'log_today_breakfast',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '98',
    unit: 'mg/dL',
    date: formatDate(now),
    time: '08:00',
    categoryId: 'cat_1',
    categoryName: 'Digiuno',
    mealTiming: 'pre',
    reminder: false,
    timestamp: Date.now() - 3600000 * 12
  },

  // 1 Giorno fa (12/8)
  {
    id: 'log_d1_breakfast',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '170',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 1)),
    time: '08:15',
    categoryId: 'cat_1',
    categoryName: 'Digiuno',
    mealTiming: 'pre',
    reminder: false,
    note: 'Colazione leggera',
    timestamp: Date.now() - dayMs * 1 - 3600000 * 4
  },
  {
    id: 'log_d1_lunch',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '142',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 1)),
    time: '13:15',
    categoryId: 'cat_3',
    categoryName: 'Pre Pranzo',
    mealTiming: 'pre',
    reminder: false,
    timestamp: Date.now() - dayMs * 1
  },

  // 2 Giorni fa (11/8)
  {
    id: 'log_d2_lunch_post',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '164',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 2)),
    time: '15:00',
    categoryId: 'cat_4',
    categoryName: 'Dopo Pranzo',
    mealTiming: 'post',
    reminder: false,
    timestamp: Date.now() - dayMs * 2 - 3600000 * 3
  },
  {
    id: 'log_d2_dinner_post',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '148',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 2)),
    time: '21:30',
    categoryId: 'cat_5',
    categoryName: 'Pre Cena',
    mealTiming: 'post',
    reminder: false,
    timestamp: Date.now() - dayMs * 2
  },

  // 3 Giorni fa (10/8)
  {
    id: 'log_d3_fasting',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '105',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 3)),
    time: '07:45',
    categoryId: 'cat_1',
    categoryName: 'Digiuno',
    mealTiming: 'pre',
    reminder: false,
    timestamp: Date.now() - dayMs * 3 - 3600000 * 10
  },
  {
    id: 'log_d3_bedtime',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '128',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 3)),
    time: '23:10',
    categoryId: 'cat_6',
    categoryName: 'Prima di Dormire',
    reminder: false,
    timestamp: Date.now() - dayMs * 3
  },

  // 5 Giorni fa (8/8)
  {
    id: 'log_d5_breakfast_pre',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '176',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 5)),
    time: '08:30',
    categoryId: 'cat_1',
    categoryName: 'Digiuno',
    mealTiming: 'pre',
    reminder: false,
    timestamp: Date.now() - dayMs * 5 - 3600000 * 12
  },
  {
    id: 'log_d5_dinner_pre',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '138',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 5)),
    time: '19:40',
    categoryId: 'cat_5',
    categoryName: 'Pre Cena',
    mealTiming: 'pre',
    reminder: false,
    timestamp: Date.now() - dayMs * 5
  },

  // 8 Giorni fa (5/8)
  {
    id: 'log_d8_lunch_pre',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '200',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 8)),
    time: '12:50',
    categoryId: 'cat_3',
    categoryName: 'Pre Pranzo',
    mealTiming: 'pre',
    reminder: false,
    timestamp: Date.now() - dayMs * 8 - 3600000 * 6
  },
  {
    id: 'log_d8_dinner_pre',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '151',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 8)),
    time: '20:10',
    categoryId: 'cat_5',
    categoryName: 'Pre Cena',
    mealTiming: 'pre',
    reminder: false,
    timestamp: Date.now() - dayMs * 8
  },

  // 12 Giorni fa (1/8)
  {
    id: 'log_d12_breakfast',
    subTypeId: 'sub_glucose',
    subTypeName: 'Glicemia',
    value: '112',
    unit: 'mg/dL',
    date: formatDate(new Date(Date.now() - dayMs * 12)),
    time: '08:00',
    categoryId: 'cat_1',
    categoryName: 'Digiuno',
    mealTiming: 'pre',
    reminder: false,
    timestamp: Date.now() - dayMs * 12
  }
];

export const defaultBloodTestParameters: BloodTestParameter[] = [
  { id: 'glucose', name: 'Glicemia', unit: 'mg/dL', conditionType: 'range', min: 74, max: 110, order: 1 },
  { id: 'hba1c', name: 'HbA1c', unit: 'mmol/mol', conditionType: 'range', min: 29, max: 41, order: 2 },
  { id: 'creatinine', name: 'Creatinina', unit: 'mg/dL', conditionType: 'range', min: 0.72, max: 1.189, order: 3 },
  { id: 'uricemia', name: 'Uricemia', unit: 'mg/dL', conditionType: 'range', min: 3.5, max: 7.2, order: 4 },
  { id: 'cpk', name: 'CPK', unit: 'U/L', conditionType: 'max_only', max: 171, order: 5 },
  { id: 'cholesterol', name: 'Colesterolo', unit: 'mg/dL', conditionType: 'max_only', max: 220, order: 6 },
  { id: 'hdl', name: 'HDL', unit: 'mg/dL', conditionType: 'min_only', min: 40, order: 7 },
  { id: 'triglycerides', name: 'Trigliceridi', unit: 'mg/dL', conditionType: 'max_only', max: 200, order: 8 },
  { id: 'dcct', name: 'DCCT', unit: '%', conditionType: 'range', min: 4.0, max: 6.0, order: 9 },
  { id: 'ifcc', name: 'IFCC', unit: 'mmol/mol', conditionType: 'range', min: 20, max: 42, order: 10 },
  { id: 'acr', name: 'ACR', unit: 'mg/g', conditionType: 'max_only', max: 20, order: 11 },
  { id: 'rac', name: 'RAC', unit: 'g/g', conditionType: 'max_only', max: 0.030, order: 12 },
  { id: 'potassium', name: 'Potassio', unit: 'mEq/L', conditionType: 'range', min: 3.5, max: 5.1, order: 13 },
  { id: 'psa', name: 'PSA', unit: 'ng/mL', conditionType: 'max_only', max: 2.5, order: 14 },
];

export const defaultBloodTestRecords: BloodTestRecord[] = [
  {
    id: 'btest_201810',
    date: '201810',
    timestamp: new Date('2018-10-15').getTime(),
    values: {
      glucose: 138,
      creatinine: 0.76,
      cholesterol: 179,
      hdl: 36,
      triglycerides: 235,
      dcct: 6.9,
      ifcc: 52,
      acr: 74,
    }
  },
  {
    id: 'btest_201901',
    date: '201901',
    timestamp: new Date('2019-01-15').getTime(),
    values: {
      glucose: 243,
      creatinine: 0.72,
      cholesterol: 181,
      hdl: 35,
      triglycerides: 224,
      dcct: 9.2,
      ifcc: 77,
      acr: 102,
    }
  },
  {
    id: 'btest_201902',
    date: '201902',
    timestamp: new Date('2019-02-15').getTime(),
    values: {
      cpk: 181,
    }
  },
  {
    id: 'btest_201905',
    date: '201905',
    timestamp: new Date('2019-05-15').getTime(),
    values: {
      glucose: 95,
      creatinine: 0.56,
      uricemia: 5,
      cpk: 83,
      cholesterol: 126,
      hdl: 32,
      triglycerides: 139,
      dcct: 7.2,
      ifcc: 55,
      acr: 108,
    }
  },
  {
    id: 'btest_201908',
    date: '201908',
    timestamp: new Date('2019-08-15').getTime(),
    values: {
      glucose: 111,
      dcct: 6.6,
      ifcc: 49,
      acr: 37,
    }
  },
  {
    id: 'btest_202001',
    date: '202001',
    timestamp: new Date('2020-01-15').getTime(),
    values: {
      glucose: 132,
      creatinine: 0.64,
      uricemia: 5.8,
      cpk: 104,
      cholesterol: 146,
      hdl: 37,
      triglycerides: 225,
      dcct: 6.2,
      ifcc: 44,
      acr: 199,
    }
  },
  {
    id: 'btest_202101',
    date: '202101',
    timestamp: new Date('2021-01-15').getTime(),
    values: {
      glucose: 180,
      creatinine: 0.76,
      uricemia: 4.9,
      cholesterol: 121,
      hdl: 30,
      triglycerides: 146,
      dcct: 10.2,
      ifcc: 88,
      acr: 107,
    }
  },
  {
    id: 'btest_202109',
    date: '202109',
    timestamp: new Date('2021-09-15').getTime(),
    values: {
      glucose: 105,
      creatinine: 0.74,
      uricemia: 6,
      cpk: 100,
      cholesterol: 139,
      hdl: 41,
      triglycerides: 125,
      dcct: 5.5,
      ifcc: 37,
      acr: 64,
    }
  },
  {
    id: 'btest_202203',
    date: '202203',
    timestamp: new Date('2022-03-15').getTime(),
    values: {
      glucose: 102,
      creatinine: 0.71,
      uricemia: 5.8,
      cholesterol: 172,
      hdl: 42,
      triglycerides: 137,
      dcct: 5.2,
      ifcc: 34,
      acr: 113,
    }
  },
  {
    id: 'btest_202211',
    date: '202211',
    timestamp: new Date('2022-11-15').getTime(),
    values: {
      glucose: 110,
      creatinine: 0.79,
      cpk: 94,
      cholesterol: 166,
      hdl: 36,
      triglycerides: 143,
    }
  },
  {
    id: 'btest_202309',
    date: '202309',
    timestamp: new Date('2023-09-15').getTime(),
    values: {
      glucose: 111,
      creatinine: 0.69,
      uricemia: 6,
      cpk: 102,
      cholesterol: 76,
      hdl: 35,
      triglycerides: 142,
      dcct: 7.1,
      ifcc: 54,
      acr: 69.5,
    }
  },
  {
    id: 'btest_202507',
    date: '202507',
    timestamp: new Date('2025-07-15').getTime(),
    values: {
      glucose: 151,
      hba1c: 81,
      creatinine: 0.63,
      uricemia: 3.9,
      cpk: 136,
      cholesterol: 75,
      hdl: 36,
      triglycerides: 111,
      acr: 20,
      potassium: 4.8,
      psa: 0.77,
    }
  },
  {
    id: 'btest_202607',
    date: '202607',
    timestamp: new Date('2026-07-15').getTime(),
    values: {
      glucose: 192,
      creatinine: 0.71,
      uricemia: 4.1,
      cpk: 142,
      cholesterol: 81,
      hdl: 35,
      triglycerides: 180,
      dcct: 11.1,
      ifcc: 97,
      rac: 0.064,
      potassium: 5.3,
    }
  }
];
