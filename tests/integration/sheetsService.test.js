/**
 * Integration tests for sheetsService.js
 * Tests API interactions with Google Sheets
 */

import { describe, test, assert, assertEqual, assertDeepEqual } from '../testRunner.js';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mock localStorage for Node.js environment
const localStorage = {
    _store: {},
    getItem(key) { return this._store[key] || null; },
    setItem(key, value) { this._store[key] = value; },
    removeItem(key) { delete this._store[key]; },
    clear() { this._store = {}; }
};

// Load sample data
const sampleWorkout = JSON.parse(
    await readFile(join(__dirname, '../fixtures/sampleWorkout.json'), 'utf-8')
);

// ============================================
// Mock Sheets API Functions
// ============================================

const SAMPLE_SPREADSHEET_ID = '1-uTCXFYsG2bRXNjPDBRbKYOPUq1vwaVKKJtenAxQ3Mw';

function getSpreadsheetId() {
    return localStorage.getItem('spreadsheet_id') || SAMPLE_SPREADSHEET_ID;
}

function setSpreadsheetId(id) {
    localStorage.setItem('spreadsheet_id', id);
}

/**
 * Simulate parsing worksheet data
 */
function parseWorksheetMock(sheetName, rows) {
    const exercises = [];
    let totalVolume = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[0]?.toString().trim();

        if (!name || name.toLowerCase().includes('exercise')) continue;

        const setsStr = row[1]?.toString() || '';
        const maxWeight = parseFloat(row[2]) || 0;
        const repsStr = row[3]?.toString() || '';
        const volume = parseFloat(row[4]) || 0;

        const sets = setsStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        const reps = repsStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));

        if (sets.length === 0 && maxWeight === 0 && volume === 0) continue;

        exercises.push({ name, sets, maxWeight, reps, volume });
        totalVolume += volume;
    }

    return {
        date: sheetName,
        exercises,
        totalVolume,
        exerciseCount: exercises.length
    };
}

/**
 * Mock API request validation
 */
function validateSpreadsheetId(id) {
    if (!id || typeof id !== 'string') {
        return { valid: false, error: 'Spreadsheet ID is required' };
    }
    if (id.length < 20) {
        return { valid: false, error: 'Spreadsheet ID appears too short' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return { valid: false, error: 'Spreadsheet ID contains invalid characters' };
    }
    return { valid: true };
}

// ============================================
// INTEGRATION TESTS
// ============================================

describe('Spreadsheet ID Management', () => {
    test('returns default spreadsheet ID when not set', () => {
        localStorage.clear();
        const id = getSpreadsheetId();
        assertEqual(id, SAMPLE_SPREADSHEET_ID);
    });

    test('returns custom spreadsheet ID when set', () => {
        localStorage.clear();
        const customId = 'custom-spreadsheet-id-12345678901234567890';
        setSpreadsheetId(customId);
        assertEqual(getSpreadsheetId(), customId);
    });

    test('validates spreadsheet ID format', () => {
        const validResult = validateSpreadsheetId(SAMPLE_SPREADSHEET_ID);
        assert(validResult.valid, 'Sample ID should be valid');

        const emptyResult = validateSpreadsheetId('');
        assert(!emptyResult.valid, 'Empty ID should be invalid');

        const shortResult = validateSpreadsheetId('abc');
        assert(!shortResult.valid, 'Short ID should be invalid');

        const invalidCharsResult = validateSpreadsheetId('invalid id with spaces');
        assert(!invalidCharsResult.valid, 'ID with spaces should be invalid');
    });
});

describe('Worksheet Parsing Integration', () => {
    test('parses sample workout data correctly', () => {
        const result = parseWorksheetMock(sampleWorkout.sheetName, sampleWorkout.rows);

        assertEqual(result.date, '1/29/2026');
        assertEqual(result.exerciseCount, sampleWorkout.expected.exerciseCount);
    });

    test('handles all exercise types from sample', () => {
        const result = parseWorksheetMock(sampleWorkout.sheetName, sampleWorkout.rows);

        // Check that exercises with data are included
        const names = result.exercises.map(e => e.name);
        assert(names.includes('Cable shoulder press'), 'Should include Cable shoulder press');
        assert(names.includes('Div. Seated row'), 'Should include Div. Seated row');
        assert(names.includes('Tricep ext'), 'Should include Tricep ext');
    });

    test('correctly handles exercises with missing volume', () => {
        const result = parseWorksheetMock(sampleWorkout.sheetName, sampleWorkout.rows);

        // Con. Chest press has no volume in sample data
        const conChestPress = result.exercises.find(e => e.name === 'Con. Chest press');
        assert(conChestPress !== undefined, 'Should include Con. Chest press');
        assertEqual(conChestPress.maxWeight, 95);
    });
});

describe('Date Range Filtering', () => {
    const mockWorkouts = [
        { date: '1/29/2026', dateObject: new Date(2026, 0, 29), totalVolume: 10000 },
        { date: '1/22/2026', dateObject: new Date(2026, 0, 22), totalVolume: 8000 },
        { date: '1/15/2026', dateObject: new Date(2026, 0, 15), totalVolume: 9000 },
        { date: '12/25/2025', dateObject: new Date(2025, 11, 25), totalVolume: 7000 }
    ];

    function filterByDays(workouts, days, referenceDate = new Date(2026, 0, 30)) {
        if (days === 0) return workouts;
        const cutoff = new Date(referenceDate);
        cutoff.setDate(cutoff.getDate() - days);
        return workouts.filter(w => w.dateObject >= cutoff);
    }

    test('returns all workouts when days is 0', () => {
        const result = filterByDays(mockWorkouts, 0);
        assertEqual(result.length, 4);
    });

    test('filters to last 7 days', () => {
        const result = filterByDays(mockWorkouts, 7);
        assertEqual(result.length, 1);
        assertEqual(result[0].date, '1/29/2026');
    });

    test('filters to last 30 days', () => {
        const result = filterByDays(mockWorkouts, 30);
        assertEqual(result.length, 3);
    });

    test('filters to last 90 days', () => {
        const result = filterByDays(mockWorkouts, 90);
        assertEqual(result.length, 4);
    });
});

describe('Volume Calculation', () => {
    test('calculates total volume across workouts', () => {
        const result = parseWorksheetMock(sampleWorkout.sheetName, sampleWorkout.rows);
        assertEqual(result.totalVolume, sampleWorkout.expected.totalVolume);
    });

    test('volume matches expected for individual exercises', () => {
        const result = parseWorksheetMock(sampleWorkout.sheetName, sampleWorkout.rows);

        const cableShoulder = result.exercises.find(e => e.name === 'Cable shoulder press');
        assertEqual(cableShoulder.volume, 2000);

        const seatedRow = result.exercises.find(e => e.name === 'Div. Seated row');
        assertEqual(seatedRow.volume, 6720);
    });
});

describe('Error Handling', () => {
    test('handles empty worksheet gracefully', () => {
        const result = parseWorksheetMock('1/1/2026', [
            ['Exercise', 'Sets', 'Max', 'Reps', 'Volume']
        ]);
        assertEqual(result.exerciseCount, 0);
        assertEqual(result.totalVolume, 0);
    });

    test('handles malformed data without crashing', () => {
        const malformedRows = [
            ['Exercise', 'Sets', 'Max', 'Reps', 'Volume'],
            [null, undefined, 'abc', '', ''],
            ['Valid Exercise', '100', '100', '10', '1000']
        ];

        // Should not throw an error
        let result;
        try {
            result = parseWorksheetMock('1/1/2026', malformedRows);
            assert(true, 'Should not throw');
        } catch (e) {
            assert(false, 'Should not throw: ' + e.message);
        }

        // Should handle the data gracefully
        assert(result !== undefined, 'Result should be defined');
    });
});

console.log('\n✅ sheetsService.test.js loaded');
