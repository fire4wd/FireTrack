import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { HealthCategory, HealthSubType, LogEntryItem, BloodTestParameter, BloodTestRecord, DailyNote, MedicationItem, SavedFastingRecord } from '../types/ontrack';
import { defaultCategories, defaultSubTypes, defaultSampleEntries, defaultBloodTestParameters, defaultBloodTestRecords, defaultMedications } from '../data/ontrackDefaults';
import { 
  loadEntries, 
  saveEntries, 
  loadCategories, 
  saveCategories, 
  loadSubTypes, 
  saveSubTypes,
  loadBloodTestParams,
  saveBloodTestParams,
  loadBloodTestRecords,
  saveBloodTestRecords,
  loadDailyNotes,
  saveDailyNotes,
  loadMedications,
  saveMedications,
  loadSavedFastings,
  saveSavedFastings,
  downloadBackupJSON,
  shareBackupJSON
} from './ontrackStorage';
import { saveOrShareFile, shareFileNative } from './fileDownloader';
import { saveSqliteBinaryToIDB, loadSqliteBinaryFromIDB, clearSqliteBinaryFromIDB } from './indexedDbStorage';

let dbInstance: Database | null = null;
let isInitializingSqlite = false;
let initPromise: Promise<Database | null> | null = null;
const STORAGE_KEY_SQLITE_BINARY = 'fire4wd_ontrack_sqlite_db_bin';

/**
 * Initializes the SQLite Database (WebAssembly SQLite Engine)
 * Automatically loads existing database from IndexedDB (or LocalStorage fallback).
 */
export async function getSqliteDb(): Promise<Database | null> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const initFn = typeof initSqlJs === 'function' 
        ? initSqlJs 
        : (initSqlJs as any)?.default || (window as any)?.initSqlJs;

      if (!initFn) {
        console.warn('initSqlJs function not found');
        return null;
      }

      let SQL: any = null;

      // 1. Try bundled sqlWasmUrl via Vite asset resolution
      try {
        SQL = await initFn({
          locateFile: (file: string) => {
            if (file.endsWith('.wasm')) {
              return sqlWasmUrl || '/sql-wasm.wasm';
            }
            return `/${file}`;
          }
        });
      } catch (bundleWasmErr) {
        console.warn('Bundled sqlWasmUrl load failed, trying local /sql-wasm.wasm...', bundleWasmErr);
      }

      // 2. Try local /sql-wasm.wasm in public folder
      if (!SQL) {
        try {
          SQL = await initFn({
            locateFile: (file: string) => {
              if (file.endsWith('.wasm')) {
                return '/sql-wasm.wasm';
              }
              return `/${file}`;
            }
          });
        } catch (localWasmErr) {
          console.warn('Local /sql-wasm.wasm load failed, trying CDN fallback...', localWasmErr);
        }
      }

      // 3. If local fails, try CDN fallback (ensures works on Android WebView, PWA, nested paths)
      if (!SQL) {
        try {
          SQL = await initFn({
            locateFile: (file: string) => {
              if (file.endsWith('.wasm')) {
                return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.1/sql-wasm.wasm';
              }
              return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.1/${file}`;
            }
          });
        } catch (cdnErr) {
          console.warn('CDN sql-wasm.wasm load failed, trying jsdelivr CDN...', cdnErr);
        }
      }

      // 4. Fourth attempt with jsdelivr
      if (!SQL) {
        try {
          SQL = await initFn({
            locateFile: (file: string) => {
              if (file.endsWith('.wasm')) {
                return 'https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/sql-wasm.wasm';
              }
              return `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`;
            }
          });
        } catch (jsdelivrErr) {
          console.warn('jsdelivr sql-wasm.wasm load failed:', jsdelivrErr);
        }
      }

      if (!SQL) {
        console.warn('WebAssembly SQLite engine could not be initialized in this environment.');
        return null;
      }

      // STEP 1: Try loading existing raw .sqlite binary from IndexedDB (High capacity, fast, reliable)
      try {
        const idbBytes = await loadSqliteBinaryFromIDB();
        if (idbBytes && idbBytes.byteLength > 100) {
          console.log(`📦 Loaded SQLite database from IndexedDB (${idbBytes.byteLength} bytes)`);
          dbInstance = new SQL.Database(idbBytes);
          initTablesAndSeed(dbInstance, false);
          syncSqliteToLocalCaches(dbInstance);
          persistDbToStorage(dbInstance);
          return dbInstance;
        }
      } catch (idbLoadErr) {
        console.warn('Failed to load SQLite from IndexedDB, checking LocalStorage...', idbLoadErr);
      }

      // STEP 2: Fallback to LocalStorage if IndexedDB was empty or unavailable
      const savedDbBase64 = localStorage.getItem(STORAGE_KEY_SQLITE_BINARY);
      if (savedDbBase64) {
        try {
          const binaryString = atob(savedDbBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          console.log(`📦 Restored SQLite database from LocalStorage (${bytes.byteLength} bytes)`);
          dbInstance = new SQL.Database(bytes);
          initTablesAndSeed(dbInstance, false);
          syncSqliteToLocalCaches(dbInstance);
          // Promote to IndexedDB immediately
          persistDbToStorage(dbInstance);
          return dbInstance;
        } catch (err) {
          console.warn('Corrupt SQLite binary in localStorage, resetting...', err);
          localStorage.removeItem(STORAGE_KEY_SQLITE_BINARY);
        }
      }

      // STEP 3: Create a brand new SQLite database file and seed with initial default/storage data
      console.log('🌱 Creating new SQLite database and seeding default data...');
      dbInstance = new SQL.Database();
      initTablesAndSeed(dbInstance, true);
      syncAllDataToSqlite(dbInstance);
      persistDbToStorage(dbInstance);

      return dbInstance;
    } catch (err) {
      console.warn('SQLite WebAssembly failed to initialize, using storage store:', err);
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Synchronizes all data from SQLite database to local caches in ontrackStorage
 */
export function syncSqliteToLocalCaches(db: Database) {
  try {
    // 1. Log Entries
    try {
      const res = db.exec('SELECT * FROM log_entries ORDER BY timestamp DESC');
      if (res && res.length > 0 && res[0].values) {
        const columns = res[0].columns;
        const values = res[0].values;
        const entries: LogEntryItem[] = values.map(row => {
          const obj: any = {};
          columns.forEach((col, idx) => { obj[col] = row[idx]; });
          return {
            id: obj.id,
            subTypeId: obj.subtype_id,
            subTypeName: translateSubTypeName(obj.subtype_name),
            value: obj.value,
            systolic: obj.systolic || undefined,
            diastolic: obj.diastolic || undefined,
            pulse: obj.pulse || undefined,
            distance: obj.distance || undefined,
            duration: obj.duration || undefined,
            speed: obj.speed || undefined,
            unit: obj.unit,
            date: obj.entry_date,
            time: obj.entry_time,
            categoryId: obj.category_id,
            categoryName: obj.category_name,
            mealTiming: obj.meal_timing as any || undefined,
            eventNoteIcon: obj.event_note_icon || undefined,
            reminder: Boolean(obj.reminder),
            note: obj.note || '',
            timestamp: Number(obj.timestamp)
          };
        });
        saveEntries(entries);
      }
    } catch (e) {
      console.warn('Could not sync log_entries from SQLite to cache:', e);
    }

    // 2. Categories
    try {
      const res = db.exec('SELECT * FROM categories ORDER BY cat_order ASC');
      if (res && res.length > 0 && res[0].values) {
        const columns = res[0].columns;
        const values = res[0].values;
        const cats: HealthCategory[] = values.map(row => {
          const obj: any = {};
          columns.forEach((col, idx) => { obj[col] = row[idx]; });
          return {
            id: obj.id,
            name: obj.name,
            order: Number(obj.cat_order),
            isDefault: Boolean(obj.is_default),
            startTimeEnabled: Boolean(obj.start_enabled),
            startTime: obj.start_time || '08:00',
            endTimeEnabled: Boolean(obj.end_enabled),
            endTime: obj.end_time || '09:30'
          };
        });
        saveCategories(cats);
      }
    } catch (e) {
      console.warn('Could not sync categories from SQLite to cache:', e);
    }

    // 3. Subtypes
    try {
      const res = db.exec('SELECT * FROM subtypes');
      if (res && res.length > 0 && res[0].values) {
        const columns = res[0].columns;
        const values = res[0].values;
        const subs: HealthSubType[] = values.map(row => {
          const obj: any = {};
          columns.forEach((col, idx) => { obj[col] = row[idx]; });
          return {
            id: obj.id,
            name: translateSubTypeName(obj.name),
            unit: obj.unit,
            isCustom: Boolean(obj.is_custom)
          };
        });
        saveSubTypes(subs);
      }
    } catch (e) {
      console.warn('Could not sync subtypes from SQLite to cache:', e);
    }

    // 4. Blood Test Parameters
    try {
      const res = db.exec('SELECT * FROM blood_test_parameters ORDER BY param_order ASC');
      if (res && res.length > 0 && res[0].values) {
        const columns = res[0].columns;
        const values = res[0].values;
        const params: BloodTestParameter[] = values.map(row => {
          const obj: any = {};
          columns.forEach((col, idx) => { obj[col] = row[idx]; });
          return {
            id: obj.id,
            name: obj.name,
            unit: obj.unit,
            conditionType: obj.condition_type as any,
            min: obj.min_val !== null && obj.min_val !== undefined ? Number(obj.min_val) : undefined,
            max: obj.max_val !== null && obj.max_val !== undefined ? Number(obj.max_val) : undefined,
            order: Number(obj.param_order || 0),
            description: obj.description || undefined
          };
        });
        saveBloodTestParams(params);
      }
    } catch (e) {
      console.warn('Could not sync blood params from SQLite to cache:', e);
    }

    // 5. Blood Test Records
    try {
      const res = db.exec('SELECT * FROM blood_test_records ORDER BY timestamp DESC');
      if (res && res.length > 0 && res[0].values) {
        const columns = res[0].columns;
        const values = res[0].values;
        const records: BloodTestRecord[] = values.map(row => {
          const obj: any = {};
          columns.forEach((col, idx) => { obj[col] = row[idx]; });
          let parsedVals = {};
          try { parsedVals = JSON.parse(obj.values_json || '{}'); } catch (_) {}
          return {
            id: obj.id,
            date: obj.record_date,
            timestamp: Number(obj.timestamp),
            values: parsedVals,
            notes: obj.notes || ''
          };
        });
        saveBloodTestRecords(records);
      }
    } catch (e) {
      console.warn('Could not sync blood test records from SQLite to cache:', e);
    }

    // 6. Daily Notes
    try {
      const res = db.exec('SELECT id, note_date, content, tags, timestamp, updated_at FROM daily_notes ORDER BY timestamp DESC');
      if (res && res.length > 0 && res[0].values) {
        const notes: DailyNote[] = res[0].values.map((row: any[]) => {
          let parsedTags: string[] = [];
          try { parsedTags = row[3] ? JSON.parse(row[3]) : []; } catch (_) {}
          return {
            id: String(row[0]),
            date: String(row[1]),
            content: String(row[2] || ''),
            tags: parsedTags,
            timestamp: Number(row[4]),
            updatedAt: row[5] ? Number(row[5]) : undefined
          };
        });
        saveDailyNotes(notes);
      }
    } catch (e) {
      console.warn('Could not sync daily notes from SQLite to cache:', e);
    }

    // 7. Medications
    try {
      const res = db.exec('SELECT * FROM medications');
      if (res && res.length > 0 && res[0].values) {
        const columns = res[0].columns;
        const values = res[0].values;
        const meds: MedicationItem[] = values.map(row => {
          const obj: any = {};
          columns.forEach((col, idx) => { obj[col] = row[idx]; });
          return {
            id: obj.id,
            name: obj.name,
            dosage: obj.dosage || '',
            schedule: obj.schedule || '',
            instructions: obj.instructions || '',
            active: obj.active !== 0,
            notes: obj.notes || ''
          };
        });
        saveMedications(meds);
      }
    } catch (_) {}

    // 8. Saved Fastings
    try {
      const res = db.exec('SELECT * FROM saved_fastings ORDER BY timestamp DESC');
      if (res && res.length > 0 && res[0].values) {
        const columns = res[0].columns;
        const values = res[0].values;
        const fastings: SavedFastingRecord[] = values.map(row => {
          const obj: any = {};
          columns.forEach((col, idx) => { obj[col] = row[idx]; });
          return {
            id: obj.id,
            protocol: obj.protocol || '16:8',
            targetHours: Number(obj.target_hours || 16),
            durationHours: obj.actual_hours !== null && obj.actual_hours !== undefined ? Number(obj.actual_hours) : undefined,
            startDate: obj.start_date || '',
            startTime: obj.start_time || '',
            endDate: obj.end_date || undefined,
            endTime: obj.end_time || undefined,
            startingGlucose: obj.start_glucose ? Number(obj.start_glucose) : undefined,
            endingGlucose: obj.end_glucose ? Number(obj.end_glucose) : undefined,
            isCompleted: obj.completed !== 0,
            note: obj.note || ''
          };
        });
        saveSavedFastings(fastings);
      }
    } catch (_) {}
  } catch (err) {
    console.warn('Error during syncSqliteToLocalCaches:', err);
  }
}

/**
 * Synchronizes all current data from memory/localStorage into SQLite tables
 */
export function syncAllDataToSqlite(db: Database) {
  try {
    const currentEntries = loadEntries();
    if (currentEntries && currentEntries.length > 0) {
      db.run('DELETE FROM log_entries');
      const stmt = db.prepare(`
        INSERT INTO log_entries (id, subtype_id, subtype_name, value, systolic, diastolic, pulse, distance, duration, speed, unit, entry_date, entry_time, category_id, category_name, meal_timing, event_note_icon, reminder, note, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      currentEntries.forEach(e => {
        stmt.run([
          e.id,
          e.subTypeId,
          e.subTypeName,
          e.value,
          e.systolic || null,
          e.diastolic || null,
          e.pulse || null,
          e.distance || null,
          e.duration || null,
          e.speed || null,
          e.unit,
          e.date,
          e.time,
          e.categoryId,
          e.categoryName,
          e.mealTiming || null,
          e.eventNoteIcon || null,
          e.reminder ? 1 : 0,
          e.note || '',
          e.timestamp
        ]);
      });
      stmt.free();
    }

    const currentCats = loadCategories();
    if (currentCats && currentCats.length > 0) {
      db.run('DELETE FROM categories');
      const catStmt = db.prepare(`
        INSERT INTO categories (id, name, cat_order, is_default, start_enabled, start_time, end_enabled, end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      currentCats.forEach(c => {
        catStmt.run([
          c.id,
          c.name,
          c.order || 0,
          c.isDefault ? 1 : 0,
          c.startTimeEnabled ? 1 : 0,
          c.startTime || '08:00',
          c.endTimeEnabled ? 1 : 0,
          c.endTime || '09:30'
        ]);
      });
      catStmt.free();
    }

    const currentSubs = loadSubTypes();
    if (currentSubs && currentSubs.length > 0) {
      db.run('DELETE FROM subtypes');
      const subStmt = db.prepare(`
        INSERT INTO subtypes (id, name, unit, is_custom)
        VALUES (?, ?, ?, ?)
      `);
      currentSubs.forEach(s => {
        subStmt.run([s.id, s.name, s.unit, s.isCustom ? 1 : 0]);
      });
      subStmt.free();
    }

    const currentBloodParams = loadBloodTestParams();
    if (currentBloodParams && currentBloodParams.length > 0) {
      db.run('DELETE FROM blood_test_parameters');
      const bpStmt = db.prepare(`
        INSERT INTO blood_test_parameters (id, name, unit, condition_type, min_val, max_val, param_order, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      currentBloodParams.forEach(p => {
        bpStmt.run([
          p.id,
          p.name,
          p.unit,
          p.conditionType,
          p.min ?? null,
          p.max ?? null,
          p.order || 0,
          p.description || ''
        ]);
      });
      bpStmt.free();
    }

    const currentBloodRecords = loadBloodTestRecords();
    if (currentBloodRecords && currentBloodRecords.length > 0) {
      db.run('DELETE FROM blood_test_records');
      const brStmt = db.prepare(`
        INSERT INTO blood_test_records (id, record_date, timestamp, values_json, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      currentBloodRecords.forEach(r => {
        brStmt.run([
          r.id,
          r.date,
          r.timestamp,
          JSON.stringify(r.values),
          r.notes || ''
        ]);
      });
      brStmt.free();
    }

    const currentNotes = loadDailyNotes();
    if (currentNotes && currentNotes.length > 0) {
      db.run('DELETE FROM daily_notes');
      const dnStmt = db.prepare(`
        INSERT INTO daily_notes (id, note_date, content, tags, timestamp, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      currentNotes.forEach(n => {
        dnStmt.run([
          n.id,
          n.date,
          n.content,
          JSON.stringify(n.tags || []),
          n.timestamp,
          n.updatedAt || null
        ]);
      });
      dnStmt.free();
    }

    const currentMeds = loadMedications();
    if (currentMeds && currentMeds.length > 0) {
      db.run('DELETE FROM medications');
      const medStmt = db.prepare(`
        INSERT INTO medications (id, name, dosage, schedule, instructions, active, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      currentMeds.forEach(m => {
        medStmt.run([
          m.id,
          m.name,
          m.dosage || '',
          m.schedule || '',
          m.instructions || '',
          m.active !== false ? 1 : 0,
          m.notes || ''
        ]);
      });
      medStmt.free();
    }

    const currentFastings = loadSavedFastings();
    if (currentFastings && currentFastings.length > 0) {
      db.run('DELETE FROM saved_fastings');
      const fStmt = db.prepare(`
        INSERT INTO saved_fastings (id, protocol, target_hours, actual_hours, start_date, start_time, end_date, end_time, start_glucose, end_glucose, completed, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      currentFastings.forEach(f => {
        fStmt.run([
          f.id,
          f.protocol,
          f.targetHours,
          f.durationHours ?? 0,
          f.startDate,
          f.startTime,
          f.endDate || '',
          f.endTime || '',
          f.startingGlucose ?? null,
          f.endingGlucose ?? null,
          f.isCompleted ? 1 : 0,
          f.note || ''
        ]);
      });
      fStmt.free();
    }
  } catch (err) {
    console.warn('Error during syncAllDataToSqlite:', err);
  }
}

/**
 * Clears all persistent SQLite caches in IndexedDB and LocalStorage, then reloads
 */
export async function clearSqliteCacheAndReload() {
  try {
    await clearSqliteBinaryFromIDB();
    localStorage.removeItem(STORAGE_KEY_SQLITE_BINARY);
  } catch (e) {
    console.warn('Error clearing SQLite caches:', e);
  }
  window.location.reload();
}

function initTablesAndSeed(db: Database, isNewDb = false) {
  try {
    // Execute SQL DDL statements
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cat_order INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        start_enabled INTEGER DEFAULT 0,
        start_time TEXT,
        end_enabled INTEGER DEFAULT 0,
        end_time TEXT
      );

      CREATE TABLE IF NOT EXISTS subtypes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        is_custom INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS log_entries (
        id TEXT PRIMARY KEY,
        subtype_id TEXT NOT NULL,
        subtype_name TEXT NOT NULL,
        value TEXT NOT NULL,
        systolic TEXT,
        diastolic TEXT,
        pulse TEXT,
        distance TEXT,
        duration TEXT,
        speed TEXT,
        unit TEXT NOT NULL,
        entry_date TEXT NOT NULL,
        entry_time TEXT NOT NULL,
        category_id TEXT NOT NULL,
        category_name TEXT NOT NULL,
        meal_timing TEXT,
        event_note_icon TEXT,
        reminder INTEGER DEFAULT 0,
        note TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blood_test_parameters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        condition_type TEXT NOT NULL,
        min_val REAL,
        max_val REAL,
        param_order INTEGER DEFAULT 0,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS blood_test_records (
        id TEXT PRIMARY KEY,
        record_date TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        values_json TEXT NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS daily_notes (
        id TEXT PRIMARY KEY,
        note_date TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        timestamp INTEGER NOT NULL,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS medications (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dosage TEXT,
        schedule TEXT,
        instructions TEXT,
        active INTEGER DEFAULT 1,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS saved_fastings (
        id TEXT PRIMARY KEY,
        protocol TEXT NOT NULL,
        target_hours REAL NOT NULL,
        actual_hours REAL NOT NULL,
        start_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_date TEXT,
        end_time TEXT,
        start_glucose REAL,
        end_glucose REAL,
        completed INTEGER DEFAULT 1,
        note TEXT
      );
    `);

    // Migrate columns if needed
    try { db.run('ALTER TABLE log_entries ADD COLUMN meal_timing TEXT;'); } catch (_) {}
    try { db.run('ALTER TABLE log_entries ADD COLUMN event_note_icon TEXT;'); } catch (_) {}
    try { db.run('ALTER TABLE log_entries ADD COLUMN pulse TEXT;'); } catch (_) {}

    // Only seed initial default data if this is a newly created database
    if (isNewDb) {
      // Seed Categories if empty
      const catCount = db.exec('SELECT COUNT(*) FROM categories')[0]?.values[0][0] as number || 0;
      if (catCount === 0) {
        const catStmt = db.prepare(`
          INSERT INTO categories (id, name, cat_order, is_default, start_enabled, start_time, end_enabled, end_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        defaultCategories.forEach(c => {
          catStmt.run([
            c.id,
            c.name,
            c.order || 0,
            c.isDefault ? 1 : 0,
            c.startTimeEnabled ? 1 : 0,
            c.startTime || '',
            c.endTimeEnabled ? 1 : 0,
            c.endTime || ''
          ]);
        });
        catStmt.free();
      }

      // Seed SubTypes if empty
      const subCount = db.exec('SELECT COUNT(*) FROM subtypes')[0]?.values[0][0] as number || 0;
      if (subCount === 0) {
        const subStmt = db.prepare(`
          INSERT INTO subtypes (id, name, unit, is_custom)
          VALUES (?, ?, ?, ?)
        `);
        defaultSubTypes.forEach(s => {
          subStmt.run([s.id, s.name, s.unit, s.isCustom ? 1 : 0]);
        });
        subStmt.free();
      }

      // Seed Entries if empty
      const entryCount = db.exec('SELECT COUNT(*) FROM log_entries')[0]?.values[0][0] as number || 0;
      if (entryCount === 0) {
        const entryStmt = db.prepare(`
          INSERT INTO log_entries (id, subtype_id, subtype_name, value, systolic, diastolic, pulse, distance, duration, speed, unit, entry_date, entry_time, category_id, category_name, reminder, note, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        defaultSampleEntries.forEach(e => {
          entryStmt.run([
            e.id,
            e.subTypeId,
            e.subTypeName,
            e.value,
            e.systolic || null,
            e.diastolic || null,
            e.pulse || null,
            e.distance || null,
            e.duration || null,
            e.speed || null,
            e.unit,
            e.date,
            e.time,
            e.categoryId,
            e.categoryName,
            e.reminder ? 1 : 0,
            e.note || '',
            e.timestamp
          ]);
        });
        entryStmt.free();
      }

      // Seed Blood Test Parameters if empty
      const bloodParamCount = db.exec('SELECT COUNT(*) FROM blood_test_parameters')[0]?.values[0][0] as number || 0;
      if (bloodParamCount === 0) {
        const bpStmt = db.prepare(`
          INSERT INTO blood_test_parameters (id, name, unit, condition_type, min_val, max_val, param_order, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        defaultBloodTestParameters.forEach(p => {
          bpStmt.run([
            p.id,
            p.name,
            p.unit,
            p.conditionType,
            p.min ?? null,
            p.max ?? null,
            p.order || 0,
            p.description || ''
          ]);
        });
        bpStmt.free();
      }

      // Seed Blood Test Records if empty
      const bloodRecordCount = db.exec('SELECT COUNT(*) FROM blood_test_records')[0]?.values[0][0] as number || 0;
      if (bloodRecordCount === 0) {
        const brStmt = db.prepare(`
          INSERT INTO blood_test_records (id, record_date, timestamp, values_json, notes)
          VALUES (?, ?, ?, ?, ?)
        `);
        defaultBloodTestRecords.forEach(r => {
          brStmt.run([
            r.id,
            r.date,
            r.timestamp,
            JSON.stringify(r.values),
            r.notes || ''
          ]);
        });
        brStmt.free();
      }

      // Seed Medications if empty
      const medCount = db.exec('SELECT COUNT(*) FROM medications')[0]?.values[0][0] as number || 0;
      if (medCount === 0) {
        const medStmt = db.prepare(`
          INSERT INTO medications (id, name, dosage, schedule, instructions, active, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        defaultMedications.forEach(m => {
          medStmt.run([
            m.id,
            m.name,
            m.dosage || '',
            m.schedule || '',
            m.instructions || '',
            m.active !== false ? 1 : 0,
            m.notes || ''
          ]);
        });
        medStmt.free();
      }
    }
  } catch (err) {
    console.error('Error during initTablesAndSeed:', err);
  }
}

/**
 * Persists SQLite binary buffer to IndexedDB (and LocalStorage as fallback)
 * Automatically ensures all data is saved safely in browser storage.
 */
export function persistDbToStorage(db?: Database) {
  const targetDb = db || dbInstance;
  if (!targetDb) return;

  try {
    const data = targetDb.export(); // Uint8Array containing raw .sqlite binary
    
    // 1. Primary: Save to IndexedDB (high capacity, non-blocking, reliable)
    saveSqliteBinaryToIDB(data).catch(err => {
      console.warn('Asynchronous IndexedDB save issue:', err);
    });

    // 2. Secondary Fallback: Save to LocalStorage if size permits (< 4.5MB)
    if (data.byteLength < 4 * 1024 * 1024) {
      try {
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binary);
        localStorage.setItem(STORAGE_KEY_SQLITE_BINARY, base64);
      } catch (lsErr) {
        // LocalStorage quota reached, safely rely on IndexedDB
        console.info('LocalStorage quota reached for SQLite binary, persisted in IndexedDB.', lsErr);
      }
    }
  } catch (err) {
    console.error('Failed to export SQLite DB to storage', err);
  }
}

// Auto-flush SQLite database to IndexedDB on tab close, page hide, or visibility change
if (typeof window !== 'undefined') {
  const handleAutoFlush = () => {
    if (dbInstance) {
      persistDbToStorage(dbInstance);
    }
  };
  window.addEventListener('beforeunload', handleAutoFlush);
  window.addEventListener('pagehide', handleAutoFlush);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleAutoFlush();
      }
    });
  }
}

const translateSubTypeName = (name: string): string => {
  if (!name) return name;
  const lower = name.toLowerCase();
  if (lower === 'glucose') return 'Glicemia';
  if (lower === 'food') return 'Cibo / Carboidrati';
  if (lower === 'exercise') return 'Esercizio / Camminata';
  if (lower === 'medication') return 'Farmaco / Insulina';
  if (lower === 'weight') return 'Peso';
  if (lower === 'blood pressure' || lower === 'pressione arteriosa' || lower === 'pressione') return 'Pressione';
  if (lower === 'pulse' || lower === 'pulsazioni' || lower === 'pulsazioni / frequenza') return 'Pressione';
  if (lower === 'body fat') return 'Grasso Corporeo';
  return name;
};

/**
 * SQL Query Helper: Fetch all Log Entries
 */
export async function fetchEntriesFromSqlite(): Promise<LogEntryItem[]> {
  try {
    const db = await getSqliteDb();
    if (!db) {
      return loadEntries();
    }

    const res = db.exec('SELECT * FROM log_entries ORDER BY timestamp DESC');
    if (!res || res.length === 0) {
      const fallback = loadEntries();
      if (fallback && fallback.length > 0) {
        await saveEntriesToSqlite(fallback);
        return fallback;
      }
      return [];
    }

    const columns = res[0].columns;
    const values = res[0].values;

    const entries = values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });

      return {
        id: obj.id,
        subTypeId: obj.subtype_id,
        subTypeName: translateSubTypeName(obj.subtype_name),
        value: obj.value,
        systolic: obj.systolic || undefined,
        diastolic: obj.diastolic || undefined,
        pulse: obj.pulse || undefined,
        distance: obj.distance || undefined,
        duration: obj.duration || undefined,
        speed: obj.speed || undefined,
        unit: obj.unit,
        date: obj.entry_date,
        time: obj.entry_time,
        categoryId: obj.category_id,
        categoryName: obj.category_name,
        mealTiming: obj.meal_timing as any || undefined,
        eventNoteIcon: obj.event_note_icon || undefined,
        reminder: Boolean(obj.reminder),
        note: obj.note || '',
        timestamp: Number(obj.timestamp)
      };
    });

    saveEntries(entries);
    return entries;
  } catch (err) {
    console.warn('Error querying SQLite entries, using LocalStorage:', err);
    return loadEntries();
  }
}

/**
 * SQL Query Helper: Save/Replace Log Entries into SQLite
 */
export async function saveEntriesToSqlite(entries: LogEntryItem[]): Promise<void> {
  // Always update LocalStorage backup
  saveEntries(entries);

  try {
    const db = await getSqliteDb();
    if (!db) return;

    db.run('DELETE FROM log_entries');

    const stmt = db.prepare(`
      INSERT INTO log_entries (id, subtype_id, subtype_name, value, systolic, diastolic, pulse, distance, duration, speed, unit, entry_date, entry_time, category_id, category_name, meal_timing, event_note_icon, reminder, note, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    entries.forEach(e => {
      stmt.run([
        e.id,
        e.subTypeId,
        e.subTypeName,
        e.value,
        e.systolic || null,
        e.diastolic || null,
        e.pulse || null,
        e.distance || null,
        e.duration || null,
        e.speed || null,
        e.unit,
        e.date,
        e.time,
        e.categoryId,
        e.categoryName,
        e.mealTiming || null,
        e.eventNoteIcon || null,
        e.reminder ? 1 : 0,
        e.note || '',
        e.timestamp
      ]);
    });
    stmt.free();

    persistDbToStorage(db);
  } catch (err) {
    console.warn('Failed to save to SQLite database:', err);
  }
}

/**
 * SQL Query Helper: Clear all entries from SQLite
 */
export async function clearAllEntriesFromSqlite(): Promise<void> {
  saveEntries([]);
  try {
    const db = await getSqliteDb();
    if (db) {
      db.run('DELETE FROM log_entries');
      persistDbToStorage(db);
    }
  } catch (err) {
    console.warn('Failed to clear SQLite entries:', err);
  }
}

/**
 * SQL Query Helper: Fetch Categories from SQLite
 */
export async function fetchCategoriesFromSqlite(): Promise<HealthCategory[]> {
  try {
    const db = await getSqliteDb();
    if (!db) return loadCategories();

    const res = db.exec('SELECT * FROM categories ORDER BY cat_order ASC');
    if (!res || res.length === 0) {
      const fallback = loadCategories();
      if (fallback.length > 0) {
        await saveCategoriesToSqlite(fallback);
        return fallback;
      }
      return defaultCategories;
    }

    const columns = res[0].columns;
    const values = res[0].values;

    const cats = values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });

      return {
        id: obj.id,
        name: obj.name,
        order: Number(obj.cat_order),
        isDefault: Boolean(obj.is_default),
        startTimeEnabled: Boolean(obj.start_enabled),
        startTime: obj.start_time || '08:00',
        endTimeEnabled: Boolean(obj.end_enabled),
        endTime: obj.end_time || '09:30'
      };
    });

    saveCategories(cats);
    return cats;
  } catch (err) {
    console.warn('Error fetching categories from SQLite:', err);
    return loadCategories();
  }
}

/**
 * SQL Query Helper: Save/Replace Categories into SQLite
 */
export async function saveCategoriesToSqlite(categories: HealthCategory[]): Promise<void> {
  saveCategories(categories);
  try {
    const db = await getSqliteDb();
    if (!db) return;

    db.run('DELETE FROM categories');

    const stmt = db.prepare(`
      INSERT INTO categories (id, name, cat_order, is_default, start_enabled, start_time, end_enabled, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    categories.forEach(c => {
      stmt.run([
        c.id,
        c.name,
        c.order || 0,
        c.isDefault ? 1 : 0,
        c.startTimeEnabled ? 1 : 0,
        c.startTime || '08:00',
        c.endTimeEnabled ? 1 : 0,
        c.endTime || '09:30'
      ]);
    });
    stmt.free();

    persistDbToStorage(db);
  } catch (err) {
    console.warn('Failed to save categories to SQLite:', err);
  }
}

/**
 * SQL Query Helper: Fetch SubTypes from SQLite
 */
export async function fetchSubTypesFromSqlite(): Promise<HealthSubType[]> {
  try {
    const db = await getSqliteDb();
    if (!db) return loadSubTypes();

    const res = db.exec('SELECT * FROM subtypes');
    if (!res || res.length === 0) {
      const fallback = loadSubTypes();
      if (fallback.length > 0) {
        await saveSubTypesToSqlite(fallback);
        return fallback;
      }
      return defaultSubTypes;
    }

    const columns = res[0].columns;
    const values = res[0].values;

    const subs = values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });

      return {
        id: obj.id,
        name: translateSubTypeName(obj.name),
        unit: obj.unit,
        isCustom: Boolean(obj.is_custom)
      };
    });

    saveSubTypes(subs);
    return subs;
  } catch (err) {
    console.warn('Error fetching subTypes from SQLite:', err);
    return loadSubTypes();
  }
}

/**
 * SQL Query Helper: Save/Replace SubTypes into SQLite
 */
export async function saveSubTypesToSqlite(subTypes: HealthSubType[]): Promise<void> {
  saveSubTypes(subTypes);
  try {
    const db = await getSqliteDb();
    if (!db) return;

    db.run('DELETE FROM subtypes');

    const stmt = db.prepare(`
      INSERT INTO subtypes (id, name, unit, is_custom)
      VALUES (?, ?, ?, ?)
    `);

    subTypes.forEach(s => {
      stmt.run([s.id, s.name, s.unit, s.isCustom ? 1 : 0]);
    });
    stmt.free();

    persistDbToStorage(db);
  } catch (err) {
    console.warn('Failed to save subTypes to SQLite:', err);
  }
}

/**
 * SQL Query Helper: Fetch Blood Test Parameters from SQLite
 */
export async function fetchBloodParamsFromSqlite(): Promise<BloodTestParameter[]> {
  try {
    const db = await getSqliteDb();
    if (!db) return loadBloodTestParams();

    const res = db.exec('SELECT * FROM blood_test_parameters ORDER BY param_order ASC');
    if (!res || res.length === 0) {
      return loadBloodTestParams();
    }

    const columns = res[0].columns;
    const values = res[0].values;

    const params: BloodTestParameter[] = values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });

      let paramId = obj.id;
      let paramName = obj.name;
      let paramUnit = obj.unit;
      let condType = obj.condition_type as 'range' | 'max_only' | 'min_only';
      let maxVal = obj.max_val !== null && obj.max_val !== undefined ? Number(obj.max_val) : undefined;

      if (paramId === 'microalbuminuria' || String(paramName).toLowerCase() === 'microalbuminuria') {
        paramId = 'acr';
        paramName = 'ACR';
        paramUnit = 'mg/g';
        condType = 'max_only';
        maxVal = 20;
      }

      return {
        id: paramId,
        name: paramName,
        unit: paramUnit,
        conditionType: condType,
        min: obj.min_val !== null && obj.min_val !== undefined ? Number(obj.min_val) : undefined,
        max: maxVal,
        order: Number(obj.param_order || 0),
        description: obj.description || undefined
      };
    });

    // Ensure RAC exists
    if (!params.some(p => p.id === 'rac' || p.name.toLowerCase() === 'rac')) {
      params.splice(11, 0, { id: 'rac', name: 'RAC', unit: 'g/g', conditionType: 'max_only', max: 0.030, order: 12 });
      params.forEach((p, idx) => { p.order = idx + 1; });
    }

    saveBloodTestParams(params);
    return params;
  } catch (err) {
    console.warn('Error fetching blood parameters from SQLite:', err);
    return loadBloodTestParams();
  }
}

/**
 * SQL Query Helper: Save/Replace Blood Test Parameters in SQLite
 */
export async function saveBloodParamsToSqlite(params: BloodTestParameter[]): Promise<void> {
  saveBloodTestParams(params);
  try {
    const db = await getSqliteDb();
    if (!db) return;

    db.run('DELETE FROM blood_test_parameters');

    const stmt = db.prepare(`
      INSERT INTO blood_test_parameters (id, name, unit, condition_type, min_val, max_val, param_order, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    params.forEach(p => {
      stmt.run([
        p.id,
        p.name,
        p.unit,
        p.conditionType,
        p.min ?? null,
        p.max ?? null,
        p.order || 0,
        p.description || ''
      ]);
    });
    stmt.free();

    persistDbToStorage(db);
  } catch (err) {
    console.warn('Failed to save blood parameters to SQLite:', err);
  }
}

/**
 * SQL Query Helper: Fetch Blood Test Records from SQLite
 */
export async function fetchBloodRecordsFromSqlite(): Promise<BloodTestRecord[]> {
  try {
    const db = await getSqliteDb();
    if (!db) return loadBloodTestRecords();

    const res = db.exec('SELECT * FROM blood_test_records ORDER BY timestamp DESC');
    if (!res || res.length === 0) {
      saveBloodTestRecords([]);
      return [];
    }

    const columns = res[0].columns;
    const values = res[0].values;

    const records: BloodTestRecord[] = values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });

      let parsedVals: Record<string, number | null> = {};
      try {
        parsedVals = JSON.parse(obj.values_json || '{}');
        if (parsedVals && ('microalbuminuria' in parsedVals) && !('acr' in parsedVals)) {
          parsedVals.acr = parsedVals.microalbuminuria;
          delete (parsedVals as any).microalbuminuria;
        }
      } catch (_) {
        parsedVals = {};
      }

      return {
        id: obj.id,
        date: obj.record_date,
        timestamp: Number(obj.timestamp),
        values: parsedVals,
        notes: obj.notes || ''
      };
    });

    saveBloodTestRecords(records);
    return records;
  } catch (err) {
    console.warn('Error fetching blood test records from SQLite:', err);
    return loadBloodTestRecords();
  }
}

/**
 * SQL Query Helper: Save/Replace Blood Test Records in SQLite
 */
export async function saveBloodRecordsToSqlite(records: BloodTestRecord[]): Promise<void> {
  saveBloodTestRecords(records);
  try {
    const db = await getSqliteDb();
    if (!db) return;

    db.run('DELETE FROM blood_test_records');

    const stmt = db.prepare(`
      INSERT INTO blood_test_records (id, record_date, timestamp, values_json, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    records.forEach(r => {
      stmt.run([
        r.id,
        r.date,
        r.timestamp,
        JSON.stringify(r.values),
        r.notes || ''
      ]);
    });
    stmt.free();

    persistDbToStorage(db);
  } catch (err) {
    console.warn('Failed to save blood test records to SQLite:', err);
  }
}

/**
 * SQL Query Helper: Clear all Blood Test Records from SQLite
 */
export async function clearAllBloodRecordsFromSqlite(): Promise<void> {
  saveBloodTestRecords([]);
  try {
    const db = await getSqliteDb();
    if (!db) return;

    db.run('DELETE FROM blood_test_records');
    persistDbToStorage(db);
  } catch (err) {
    console.warn('Failed to clear blood test records from SQLite:', err);
  }
}

/**
 * SQL Query Helper: Get all Daily Notes from SQLite
 */
export async function getDailyNotesFromSqlite(): Promise<DailyNote[]> {
  try {
    const db = await getSqliteDb();
    if (!db) return loadDailyNotes();

    const res = db.exec('SELECT id, note_date, content, tags, timestamp, updated_at FROM daily_notes ORDER BY timestamp DESC');
    if (!res || res.length === 0 || !res[0].values) {
      return loadDailyNotes();
    }

    const notes: DailyNote[] = res[0].values.map((row: any[]) => {
      let parsedTags: string[] = [];
      try {
        parsedTags = row[3] ? JSON.parse(row[3]) : [];
      } catch (_) {
        parsedTags = [];
      }
      return {
        id: String(row[0]),
        date: String(row[1]),
        content: String(row[2] || ''),
        tags: parsedTags,
        timestamp: Number(row[4]),
        updatedAt: row[5] ? Number(row[5]) : undefined
      };
    });

    saveDailyNotes(notes);
    return notes;
  } catch (err) {
    console.warn('Error querying daily_notes from SQLite, falling back:', err);
    return loadDailyNotes();
  }
}

/**
 * SQL Query Helper: Save/Update a Daily Note in SQLite
 */
export async function saveDailyNoteToSqlite(note: DailyNote): Promise<void> {
  try {
    const currentNotes = loadDailyNotes();
    const existingIndex = currentNotes.findIndex(n => n.id === note.id || n.date === note.date);
    let updatedNotes: DailyNote[];
    if (existingIndex >= 0) {
      updatedNotes = [...currentNotes];
      updatedNotes[existingIndex] = note;
    } else {
      updatedNotes = [note, ...currentNotes];
    }
    saveDailyNotes(updatedNotes);

    const db = await getSqliteDb();
    if (!db) return;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO daily_notes (id, note_date, content, tags, timestamp, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      note.id,
      note.date,
      note.content,
      JSON.stringify(note.tags || []),
      note.timestamp,
      note.updatedAt || Date.now()
    ]);
    stmt.free();

    persistDbToStorage(db);
  } catch (err) {
    console.warn('Failed to save daily note to SQLite:', err);
  }
}

/**
 * SQL Query Helper: Delete a Daily Note from SQLite
 */
export async function deleteDailyNoteFromSqlite(id: string): Promise<void> {
  try {
    const currentNotes = loadDailyNotes().filter(n => n.id !== id);
    saveDailyNotes(currentNotes);

    const db = await getSqliteDb();
    if (!db) return;

    db.run('DELETE FROM daily_notes WHERE id = ?', [id]);
    persistDbToStorage(db);
  } catch (err) {
    console.warn('Failed to delete daily note from SQLite:', err);
  }
}

/**
 * Export actual .sqlite binary database file
 */
export async function downloadRawSqliteDbFile(filename = 'firetrack_database.sqlite'): Promise<{ success: boolean; message: string }> {
  try {
    let db = await getSqliteDb();
    if (!db) {
      // If WebAssembly SQLite is unavailable in this environment, seamlessly provide complete JSON backup
      const fallbackResult = await downloadBackupJSON(
        loadEntries(),
        loadCategories(),
        loadSubTypes(),
        loadBloodTestParams(),
        loadBloodTestRecords()
      );
      return {
        success: fallbackResult.success,
        message: fallbackResult.success 
          ? 'Backup completo salvato in formato JSON nei Download.'
          : fallbackResult.message
      };
    }
    
    // Ensure all tables are synced before exporting
    syncAllDataToSqlite(db);
    persistDbToStorage(db);
    
    const binaryArray = db.export(); // Uint8Array
    // Use the Uint8Array slice to ensure proper buffer boundaries
    const safeBuffer = binaryArray.buffer.slice(binaryArray.byteOffset, binaryArray.byteOffset + binaryArray.byteLength);
    const blob = new Blob([safeBuffer], { type: 'application/x-sqlite3' });
    
    const res = await saveOrShareFile({
      filename,
      blob,
      mimeType: 'application/x-sqlite3',
      dialogTitle: `Salva o Condividi Database SQLite (${filename})`
    });

    return {
      success: res.success,
      message: res.message || 'Database SQLite salvato con successo nei Download.'
    };
  } catch (err: any) {
    console.error('Error downloading .sqlite file:', err);
    return {
      success: false,
      message: `Errore durante il salvataggio: ${err?.message || 'operazione non riuscita'}`
    };
  }
}

/**
 * Share actual .sqlite binary database file directly via Android Share / iOS Share
 */
export async function shareRawSqliteDbFile(filename = 'firetrack_database.sqlite'): Promise<{ success: boolean; message: string }> {
  try {
    let db = await getSqliteDb();
    if (!db) {
      return await shareBackupJSON(
        loadEntries(),
        loadCategories(),
        loadSubTypes(),
        loadBloodTestParams(),
        loadBloodTestRecords()
      );
    }
    
    syncAllDataToSqlite(db);
    persistDbToStorage(db);
    
    const binaryArray = db.export();
    const safeBuffer = binaryArray.buffer.slice(binaryArray.byteOffset, binaryArray.byteOffset + binaryArray.byteLength);
    const blob = new Blob([safeBuffer], { type: 'application/x-sqlite3' });
    
    return await shareFileNative({
      filename,
      blob,
      mimeType: 'application/x-sqlite3',
      dialogTitle: `Condividi Database SQLite (${filename})`
    });
  } catch (err: any) {
    console.error('Error sharing .sqlite file:', err);
    return {
      success: false,
      message: `Errore condivisione SQLite: ${err?.message || 'operazione fallita'}`
    };
  }
}

/**
 * Import actual .sqlite binary database file
 */
export async function loadRawSqliteDbFile(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const uInt8Array = new Uint8Array(arrayBuffer);

        const initFn = typeof initSqlJs === 'function' 
          ? initSqlJs 
          : (initSqlJs as any)?.default || (window as any)?.initSqlJs;

        let SQL: any = null;
        try {
          SQL = await initFn({
            locateFile: (f: string) => f.endsWith('.wasm') ? (sqlWasmUrl || '/sql-wasm.wasm') : `/${f}`
          });
        } catch (_) {
          try {
            SQL = await initFn({
              locateFile: (f: string) => f.endsWith('.wasm') ? '/sql-wasm.wasm' : `/${f}`
            });
          } catch (__) {
            SQL = await initFn({
              locateFile: (f: string) => f.endsWith('.wasm') ? 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.1/sql-wasm.wasm' : `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.1/${f}`
            });
          }
        }

        dbInstance = new SQL.Database(uInt8Array);
        initTablesAndSeed(dbInstance, false);
        syncSqliteToLocalCaches(dbInstance);
        persistDbToStorage(dbInstance);
        resolve(true);
      } catch (err) {
        console.error('Failed to parse loaded .sqlite file', err);
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Returns raw SQLite database binary as Uint8Array
 */
export async function getRawSqliteDbBytes(): Promise<Uint8Array | null> {
  try {
    let db = await getSqliteDb();
    if (!db) return null;
    syncAllDataToSqlite(db);
    persistDbToStorage(db);
    return db.export();
  } catch (err) {
    console.error('Error exporting SQLite bytes:', err);
    return null;
  }
}

/**
 * Loads SQLite database directly from Uint8Array bytes
 */
export async function loadRawSqliteDbBytes(uInt8Array: Uint8Array): Promise<boolean> {
  try {
    const initFn = typeof initSqlJs === 'function' 
      ? initSqlJs 
      : (initSqlJs as any)?.default || (window as any)?.initSqlJs;

    let SQL: any = null;
    try {
      SQL = await initFn({
        locateFile: (f: string) => f.endsWith('.wasm') ? (sqlWasmUrl || '/sql-wasm.wasm') : `/${f}`
      });
    } catch (_) {
      try {
        SQL = await initFn({
          locateFile: (f: string) => f.endsWith('.wasm') ? '/sql-wasm.wasm' : `/${f}`
        });
      } catch (__) {
        SQL = await initFn({
          locateFile: (f: string) => f.endsWith('.wasm') ? 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.1/sql-wasm.wasm' : `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.1/${f}`
        });
      }
    }

    dbInstance = new SQL.Database(uInt8Array);
    initTablesAndSeed(dbInstance, false);
    syncSqliteToLocalCaches(dbInstance);
    persistDbToStorage(dbInstance);
    return true;
  } catch (err) {
    console.error('Error loading SQLite from bytes:', err);
    throw err;
  }
}


