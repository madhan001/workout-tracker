/**
 * Unit tests for muscleMapping.js
 */

import { describe, test, assert, assertEqual, assertDeepEqual } from './testRunner.js';

// Import functions from muscleMapping.js (copied for Node.js testing)
const DEFAULT_MUSCLE_MAPPINGS = {
    'cable shoulder press': ['front_delt', 'middle_delt', 'triceps'],
    'shoulder press': ['front_delt', 'middle_delt', 'triceps'],
    'rear delt': ['rear_delt'],
    'leg press': ['quads', 'glutes', 'hamstrings'],
    'leg curl': ['hamstrings'],
    'pec fly': ['mid_chest'],
    'div. seated row': ['lats', 'rhomboids', 'biceps'],
    'lat pull down': ['lats', 'biceps'],
    'lat pull down (dual handle)': ['lats', 'biceps', 'rhomboids'],
    'bicep curl': ['biceps'],
    'tricep ext': ['triceps_long', 'triceps_lateral'],
    'bench press': ['mid_chest', 'front_delt', 'triceps'],
    'barbell chest press': ['mid_chest', 'front_delt', 'triceps'],
    'con. chest press': ['mid_chest', 'triceps'],
    'back extension': ['lower_back', 'glutes'],
    'leg extension': ['quads']
};

const MUSCLE_GROUPS = {
    'front_delt': { name: 'Front Deltoid', category: 'Shoulders', color: '#6366f1' },
    'middle_delt': { name: 'Middle Deltoid', category: 'Shoulders', color: '#818cf8' },
    'rear_delt': { name: 'Rear Deltoid', category: 'Shoulders', color: '#a5b4fc' },
    'mid_chest': { name: 'Mid Chest', category: 'Chest', color: '#f472b6' },
    'lats': { name: 'Latissimus Dorsi', category: 'Back', color: '#3b82f6' },
    'rhomboids': { name: 'Rhomboids', category: 'Back', color: '#bfdbfe' },
    'biceps': { name: 'Biceps', category: 'Arms', color: '#22c55e' },
    'triceps': { name: 'Triceps', category: 'Arms', color: '#4ade80' },
    'triceps_long': { name: 'Triceps (Long Head)', category: 'Arms', color: '#86efac' },
    'triceps_lateral': { name: 'Triceps (Lateral Head)', category: 'Arms', color: '#bbf7d0' },
    'quads': { name: 'Quadriceps', category: 'Legs', color: '#f97316' },
    'hamstrings': { name: 'Hamstrings', category: 'Legs', color: '#fb923c' },
    'glutes': { name: 'Glutes', category: 'Legs', color: '#fdba74' },
    'lower_back': { name: 'Lower Back', category: 'Back', color: '#93c5fd' }
};

function getMuscleGroups(exerciseName, customMappings = {}) {
    const normalizedName = exerciseName.toLowerCase().trim();

    // Check custom mappings first
    if (customMappings[normalizedName]) {
        return customMappings[normalizedName];
    }

    // Check default mappings
    if (DEFAULT_MUSCLE_MAPPINGS[normalizedName]) {
        return DEFAULT_MUSCLE_MAPPINGS[normalizedName];
    }

    // Try to find a partial match
    for (const [key, muscles] of Object.entries(DEFAULT_MUSCLE_MAPPINGS)) {
        if (normalizedName.includes(key) || key.includes(normalizedName)) {
            return muscles;
        }
    }

    // Check custom mappings for partial matches
    for (const [key, muscles] of Object.entries(customMappings)) {
        if (normalizedName.includes(key) || key.includes(normalizedName)) {
            return muscles;
        }
    }

    return [];
}

function getMuscleDisplayName(muscleId) {
    return MUSCLE_GROUPS[muscleId]?.name || muscleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getMuscleColor(muscleId) {
    return MUSCLE_GROUPS[muscleId]?.color || '#6366f1';
}

function getMusclesByCategory() {
    const categories = {};
    for (const [id, info] of Object.entries(MUSCLE_GROUPS)) {
        if (!categories[info.category]) {
            categories[info.category] = [];
        }
        categories[info.category].push({ id, ...info });
    }
    return categories;
}

// ============================================
// TESTS
// ============================================

describe('getMuscleGroups - Exact Matching', () => {
    test('matches exact exercise name', () => {
        const result = getMuscleGroups('cable shoulder press');
        assertDeepEqual(result, ['front_delt', 'middle_delt', 'triceps']);
    });

    test('is case-insensitive', () => {
        const result = getMuscleGroups('Cable Shoulder Press');
        assertDeepEqual(result, ['front_delt', 'middle_delt', 'triceps']);
    });

    test('trims whitespace', () => {
        const result = getMuscleGroups('  leg curl  ');
        assertDeepEqual(result, ['hamstrings']);
    });

    test('matches exercises from user sample data', () => {
        assertDeepEqual(getMuscleGroups('Div. Seated row'), ['lats', 'rhomboids', 'biceps']);
        assertDeepEqual(getMuscleGroups('Lat pull down (dual handle)'), ['lats', 'biceps', 'rhomboids']);
        assertDeepEqual(getMuscleGroups('Bicep curl'), ['biceps']);
        assertDeepEqual(getMuscleGroups('Tricep ext'), ['triceps_long', 'triceps_lateral']);
        assertDeepEqual(getMuscleGroups('Con. Chest press'), ['mid_chest', 'triceps']);
    });
});

describe('getMuscleGroups - Partial Matching', () => {
    test('matches partial exercise name when exact not found', () => {
        // "shoulder press" should match via partial
        const result = getMuscleGroups('dumbbell shoulder press');
        assertDeepEqual(result, ['front_delt', 'middle_delt', 'triceps']);
    });

    test('returns empty array for unknown exercise', () => {
        const result = getMuscleGroups('totally unknown exercise xyz');
        assertDeepEqual(result, []);
    });
});

describe('getMuscleGroups - Custom Mappings', () => {
    test('custom mapping takes precedence over default', () => {
        const customMappings = {
            'bicep curl': ['biceps', 'forearms']  // Override default
        };
        const result = getMuscleGroups('bicep curl', customMappings);
        assertDeepEqual(result, ['biceps', 'forearms']);
    });

    test('falls back to default when custom not present', () => {
        const customMappings = {
            'some other exercise': ['abs']
        };
        const result = getMuscleGroups('leg curl', customMappings);
        assertDeepEqual(result, ['hamstrings']);
    });

    test('custom mapping partial match works', () => {
        const customMappings = {
            'hammer curl': ['biceps', 'forearms']
        };
        const result = getMuscleGroups('dumbbell hammer curl', customMappings);
        assertDeepEqual(result, ['biceps', 'forearms']);
    });
});

describe('getMuscleDisplayName', () => {
    test('returns display name for known muscle', () => {
        assertEqual(getMuscleDisplayName('front_delt'), 'Front Deltoid');
        assertEqual(getMuscleDisplayName('lats'), 'Latissimus Dorsi');
        assertEqual(getMuscleDisplayName('mid_chest'), 'Mid Chest');
    });

    test('formats unknown muscle ID nicely', () => {
        const result = getMuscleDisplayName('some_unknown_muscle');
        assertEqual(result, 'Some Unknown Muscle');
    });
});

describe('getMuscleColor', () => {
    test('returns color for known muscle', () => {
        assertEqual(getMuscleColor('front_delt'), '#6366f1');
        assertEqual(getMuscleColor('biceps'), '#22c55e');
    });

    test('returns default color for unknown muscle', () => {
        assertEqual(getMuscleColor('unknown_muscle'), '#6366f1');
    });
});

describe('getMusclesByCategory', () => {
    test('groups muscles by category', () => {
        const result = getMusclesByCategory();

        assert('Shoulders' in result, 'Should have Shoulders category');
        assert('Back' in result, 'Should have Back category');
        assert('Arms' in result, 'Should have Arms category');
        assert('Legs' in result, 'Should have Legs category');
        assert('Chest' in result, 'Should have Chest category');
    });

    test('Shoulders category contains deltoids', () => {
        const result = getMusclesByCategory();
        const shoulderIds = result.Shoulders.map(m => m.id);

        assert(shoulderIds.includes('front_delt'), 'Should include front_delt');
        assert(shoulderIds.includes('middle_delt'), 'Should include middle_delt');
        assert(shoulderIds.includes('rear_delt'), 'Should include rear_delt');
    });

    test('each muscle has id, name, color, and category', () => {
        const result = getMusclesByCategory();
        const firstMuscle = result.Shoulders[0];

        assert('id' in firstMuscle, 'Muscle should have id');
        assert('name' in firstMuscle, 'Muscle should have name');
        assert('color' in firstMuscle, 'Muscle should have color');
        assert('category' in firstMuscle, 'Muscle should have category');
    });
});

console.log('\n✅ muscleMapping.test.js loaded');
