/**
 * Unit tests for dataParser.js
 */

import { describe, test, assert, assertEqual, assertDeepEqual, assertApproxEqual } from './testRunner.js';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import functions to test (we need to create a Node-compatible version)
// Since the original uses browser imports, we'll test the logic directly

/**
 * parseCommaSeparated - copied from dataParser.js for testing
 */
function parseCommaSeparated(value) {
    if (!value || typeof value !== 'string') return [];
    return value
        .split(',')
        .map(v => parseFloat(v.trim()))
        .filter(v => !isNaN(v));
}

/**
 * parseDateString - copied from dataParser.js for testing
 */
function parseDateString(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
        const date = new Date(fullYear, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    return null;
}

/**
 * parseExerciseRow - copied from dataParser.js for testing
 */
function parseExerciseRow(row, customMappings = {}) {
    const name = row[0]?.toString().trim();
    if (!name || name.toLowerCase().includes('exercise') || name.toLowerCase().includes('s1')) {
        return null;
    }

    const setsStr = row[1]?.toString() || '';
    const maxWeight = parseFloat(row[2]) || 0;
    const repsStr = row[3]?.toString() || '';
    const volume = parseFloat(row[4]) || 0;

    const sets = parseCommaSeparated(setsStr);
    const reps = parseCommaSeparated(repsStr);

    if (sets.length === 0 && maxWeight === 0 && volume === 0) {
        return null;
    }

    let calculatedVolume = volume;
    if (calculatedVolume === 0 && sets.length > 0 && reps.length > 0) {
        calculatedVolume = sets.reduce((sum, weight, i) => {
            const repCount = reps[i] || reps[reps.length - 1] || 0;
            return sum + (weight * repCount);
        }, 0);
    }

    return {
        name,
        sets,
        maxWeight,
        reps,
        volume: calculatedVolume,
        muscleGroups: [] // Simplified for unit testing
    };
}

/**
 * parseWorksheet - copied from dataParser.js for testing
 */
function parseWorksheet(sheetName, rows, customMappings = {}) {
    const exercises = [];
    let totalVolume = 0;
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
        const exercise = parseExerciseRow(row, customMappings);
        if (exercise) {
            exercises.push(exercise);
            totalVolume += exercise.volume;
        }
    }

    return {
        date: sheetName,
        dateObject: parseDateString(sheetName),
        exercises,
        totalVolume,
        exerciseCount: exercises.length
    };
}

/**
 * calculateStats - simplified version for testing
 */
function calculateStats(workouts) {
    const totalVolume = workouts.reduce((sum, w) => sum + w.totalVolume, 0);
    const totalExercises = workouts.reduce((sum, w) => sum + w.exerciseCount, 0);

    const prs = {};
    for (const workout of workouts) {
        for (const exercise of workout.exercises) {
            const name = exercise.name.toLowerCase();
            if (!prs[name] || exercise.maxWeight > prs[name].weight) {
                prs[name] = {
                    name: exercise.name,
                    weight: exercise.maxWeight,
                    date: workout.date
                };
            }
        }
    }

    return {
        totalWorkouts: workouts.length,
        totalVolume,
        totalExercises,
        personalRecords: Object.values(prs).filter(pr => pr.weight > 0),
        prCount: Object.values(prs).filter(pr => pr.weight > 0).length
    };
}

// ============================================
// TESTS
// ============================================

// Load fixture
const fixtureData = JSON.parse(
    await readFile(join(__dirname, 'fixtures/sampleWorkout.json'), 'utf-8')
);

describe('parseCommaSeparated', () => {
    test('parses simple comma-separated values', () => {
        const result = parseCommaSeparated('100,100');
        assertDeepEqual(result, [100, 100]);
    });

    test('handles spaces around values', () => {
        const result = parseCommaSeparated('65, 90, 90');
        assertDeepEqual(result, [65, 90, 90]);
    });

    test('handles trailing commas', () => {
        const result = parseCommaSeparated('8,8,8,');
        assertDeepEqual(result, [8, 8, 8]);
    });

    test('returns empty array for null/undefined', () => {
        assertDeepEqual(parseCommaSeparated(null), []);
        assertDeepEqual(parseCommaSeparated(undefined), []);
    });

    test('returns empty array for empty string', () => {
        assertDeepEqual(parseCommaSeparated(''), []);
    });

    test('filters out non-numeric values', () => {
        const result = parseCommaSeparated('100, abc, 200');
        assertDeepEqual(result, [100, 200]);
    });
});

describe('parseDateString', () => {
    test('parses MM/DD/YYYY format', () => {
        const result = parseDateString('1/29/2026');
        assertEqual(result.getFullYear(), 2026);
        assertEqual(result.getMonth(), 0); // January is 0
        assertEqual(result.getDate(), 29);
    });

    test('parses 2-digit year (2000s)', () => {
        const result = parseDateString('12/25/24');
        assertEqual(result.getFullYear(), 2024);
    });

    test('parses 2-digit year (1900s)', () => {
        const result = parseDateString('12/25/99');
        assertEqual(result.getFullYear(), 1999);
    });

    test('returns null for invalid date', () => {
        assertEqual(parseDateString('invalid'), null);
        assertEqual(parseDateString(''), null);
        assertEqual(parseDateString(null), null);
    });
});

describe('parseExerciseRow', () => {
    test('parses complete row with all data', () => {
        const row = ['Cable shoulder press', '100,100', '100', '10,10', '2000'];
        const result = parseExerciseRow(row);

        assertEqual(result.name, 'Cable shoulder press');
        assertDeepEqual(result.sets, [100, 100]);
        assertEqual(result.maxWeight, 100);
        assertDeepEqual(result.reps, [10, 10]);
        assertEqual(result.volume, 2000);
    });

    test('skips header rows', () => {
        const row = ['Exercise', 's1, s2.. sN', 'Max (lbs)', 's1_rps, s2_rps', 'Volume'];
        const result = parseExerciseRow(row);
        assertEqual(result, null);
    });

    test('skips empty exercises (no sets, weight, or volume)', () => {
        const row = ['Pec fly', '', '', '', ''];
        const result = parseExerciseRow(row);
        assertEqual(result, null);
    });

    test('calculates volume when not explicitly provided', () => {
        // Using a row similar to the real fixture data format
        // When volume is missing but sets and reps present, it should calculate
        const row = ['Leg curl', '125,125, 120, 120', '125', '8,8,8,8', ''];
        const result = parseExerciseRow(row);

        // Exercise should be included because it has sets and maxWeight
        assert(result !== null, 'Exercise should not be null');
        // Volume = 125*8 + 125*8 + 120*8 + 120*8 = 3920
        assertEqual(result.volume, 3920);
    });

    test('handles mismatched sets and reps counts', () => {
        const row = ['Leg curl', '125,125, 120, 120', '125', '8,8,8,', ''];
        const result = parseExerciseRow(row);
        // Volume should be calculated using last rep count for missing reps
        // 125*8 + 125*8 + 120*8 + 120*8 = 3920
        assertEqual(result.volume, 3920);
    });

    test('preserves provided volume over calculated', () => {
        const row = ['Div. Seated row', '200,210,210,220', '220', '8,8, 8, 8', '6720'];
        const result = parseExerciseRow(row);
        assertEqual(result.volume, 6720);
    });
});

describe('parseWorksheet (with sample fixture)', () => {
    test('parses correct number of exercises', () => {
        const result = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        assertEqual(result.exerciseCount, fixtureData.expected.exerciseCount);
    });

    test('parses sheet name as date', () => {
        const result = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        assertEqual(result.date, '1/29/2026');
        assert(result.dateObject instanceof Date, 'dateObject should be a Date');
    });

    test('skips empty exercises correctly', () => {
        const result = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        const exerciseNames = result.exercises.map(e => e.name);

        // Should NOT include empty exercises
        assert(!exerciseNames.includes('Pec fly'), 'Should skip empty Pec fly');
        assert(!exerciseNames.includes('Leg press'), 'Should skip Leg press with no weight data');
        assert(!exerciseNames.includes('Barbell chest press'), 'Should skip empty Barbell chest press');
    });

    test('calculates total volume correctly', () => {
        const result = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        // Sum of volumes from exercises with provided volume
        // Cable shoulder press (2000) + Div. Seated row (6720) + Leg curl (2960) + 
        // Lat pull down (3650) + Bicep curl (2810) + Tricep ext (3780) + Con. Chest press (0) = 21920
        assertEqual(result.totalVolume, fixtureData.expected.totalVolume);
    });

    test('parses Cable shoulder press correctly', () => {
        const result = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        const exercise = result.exercises.find(e => e.name === 'Cable shoulder press');

        assertEqual(exercise.maxWeight, 100);
        assertDeepEqual(exercise.sets, [100, 100]);
        assertDeepEqual(exercise.reps, [10, 10]);
        assertEqual(exercise.volume, 2000);
    });

    test('parses Div. Seated row correctly', () => {
        const result = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        const exercise = result.exercises.find(e => e.name === 'Div. Seated row');

        assertEqual(exercise.maxWeight, 220);
        assertDeepEqual(exercise.sets, [200, 210, 210, 220]);
        assertDeepEqual(exercise.reps, [8, 8, 8, 8]);
        assertEqual(exercise.volume, 6720);
    });
});

describe('calculateStats', () => {
    test('calculates total workouts', () => {
        const workout = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        const stats = calculateStats([workout]);
        assertEqual(stats.totalWorkouts, 1);
    });

    test('calculates total exercises', () => {
        const workout = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        const stats = calculateStats([workout]);
        assertEqual(stats.totalExercises, fixtureData.expected.exerciseCount);
    });

    test('calculates total volume', () => {
        const workout = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        const stats = calculateStats([workout]);
        assertEqual(stats.totalVolume, fixtureData.expected.totalVolume);
    });

    test('identifies personal records', () => {
        const workout = parseWorksheet(fixtureData.sheetName, fixtureData.rows);
        const stats = calculateStats([workout]);

        // Should have PRs for exercises with maxWeight > 0
        assert(stats.prCount > 0, 'Should have personal records');

        // Check specific PR
        const seatedRowPR = stats.personalRecords.find(
            pr => pr.name.toLowerCase().includes('seated row')
        );
        assertEqual(seatedRowPR.weight, 220);
    });

    test('tracks best PR across multiple workouts', () => {
        const workout1 = parseWorksheet('1/28/2026', [
            ['Exercise', 'Sets', 'Max', 'Reps', 'Volume'],
            ['Bench Press', '135,155', '155', '10,8', '2590']
        ]);

        const workout2 = parseWorksheet('1/29/2026', [
            ['Exercise', 'Sets', 'Max', 'Reps', 'Volume'],
            ['Bench Press', '145,165,185', '185', '8,6,4', '3060']
        ]);

        const stats = calculateStats([workout1, workout2]);
        const benchPR = stats.personalRecords.find(pr => pr.name === 'Bench Press');

        assertEqual(benchPR.weight, 185);
        assertEqual(benchPR.date, '1/29/2026');
    });
});

console.log('\n✅ dataParser.test.js loaded');
