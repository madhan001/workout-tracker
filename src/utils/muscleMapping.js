/**
 * Default exercise to muscle group mappings
 * Uses specific muscle targeting (front_delt, middle_delt, rear_delt, etc.)
 */
export const DEFAULT_MUSCLE_MAPPINGS = {
    // Shoulder exercises
    'cable shoulder press': ['front_delt', 'middle_delt', 'triceps'],
    'shoulder press': ['front_delt', 'middle_delt', 'triceps'],
    'military press': ['front_delt', 'middle_delt', 'triceps'],
    'lateral raise': ['middle_delt'],
    'front raise': ['front_delt'],
    'rear delt': ['rear_delt'],
    'rear delt fly': ['rear_delt'],
    'face pull': ['rear_delt', 'traps', 'rhomboids'],

    // Leg exercises
    'leg press': ['quads', 'glutes', 'hamstrings'],
    'squat': ['quads', 'glutes', 'hamstrings', 'lower_back'],
    'leg curl': ['hamstrings'],
    'leg extension': ['quads'],
    'calf raise': ['calves'],
    'leg raise': ['hip_flexors', 'abs'],
    'romanian deadlift': ['hamstrings', 'glutes', 'lower_back'],
    'hip thrust': ['glutes', 'hamstrings'],
    'lunge': ['quads', 'glutes', 'hamstrings'],

    // Chest exercises
    'pec fly': ['mid_chest'],
    'pec deck': ['mid_chest'],
    'chest fly': ['mid_chest'],
    'con. chest press': ['mid_chest', 'triceps'],
    'chest press': ['mid_chest', 'front_delt', 'triceps'],
    'barbell chest press': ['mid_chest', 'front_delt', 'triceps'],
    'bench press': ['mid_chest', 'front_delt', 'triceps'],
    'incline bench press': ['upper_chest', 'front_delt', 'triceps'],
    'incline press': ['upper_chest', 'front_delt', 'triceps'],
    'decline press': ['lower_chest', 'triceps'],
    'dips': ['lower_chest', 'triceps', 'front_delt'],

    // Back exercises
    'div. seated row': ['lats', 'rhomboids', 'biceps'],
    'seated row': ['lats', 'rhomboids', 'biceps', 'rear_delt'],
    'cable row': ['lats', 'rhomboids', 'biceps'],
    'lat pull down': ['lats', 'biceps'],
    'lat pull down (dual handle)': ['lats', 'biceps', 'rhomboids'],
    'lat pulldown': ['lats', 'biceps'],
    'pull up': ['lats', 'biceps', 'rhomboids'],
    'chin up': ['lats', 'biceps'],
    'barbell row': ['lats', 'rhomboids', 'rear_delt', 'biceps'],
    't-bar row': ['lats', 'rhomboids', 'rear_delt'],
    'back extension': ['lower_back', 'glutes'],
    'deadlift': ['lower_back', 'glutes', 'hamstrings', 'traps'],
    'shrug': ['traps'],

    // Arm exercises
    'bicep curl': ['biceps'],
    'hammer curl': ['biceps', 'forearms'],
    'preacher curl': ['biceps'],
    'concentration curl': ['biceps'],
    'tricep ext': ['triceps_long', 'triceps_lateral'],
    'tricep extension': ['triceps_long', 'triceps_lateral'],
    'tricep pushdown': ['triceps_lateral'],
    'skull crusher': ['triceps_long', 'triceps_medial'],
    'close grip bench': ['triceps', 'mid_chest'],
    'wrist curl': ['forearms'],

    // Core exercises
    'plank': ['abs', 'obliques'],
    'crunch': ['abs'],
    'sit up': ['abs', 'hip_flexors'],
    'russian twist': ['obliques'],
    'cable crunch': ['abs'],
    'hanging leg raise': ['abs', 'hip_flexors'],
    'ab wheel': ['abs', 'obliques']
};

/**
 * All available muscle groups with display names
 */
export const MUSCLE_GROUPS = {
    // Shoulders
    'front_delt': { name: 'Front Deltoid', category: 'Shoulders', color: '#6366f1' },
    'middle_delt': { name: 'Middle Deltoid', category: 'Shoulders', color: '#818cf8' },
    'rear_delt': { name: 'Rear Deltoid', category: 'Shoulders', color: '#a5b4fc' },

    // Chest
    'upper_chest': { name: 'Upper Chest', category: 'Chest', color: '#ec4899' },
    'mid_chest': { name: 'Mid Chest', category: 'Chest', color: '#f472b6' },
    'lower_chest': { name: 'Lower Chest', category: 'Chest', color: '#f9a8d4' },

    // Back
    'lats': { name: 'Latissimus Dorsi', category: 'Back', color: '#3b82f6' },
    'upper_back': { name: 'Upper Back', category: 'Back', color: '#60a5fa' },
    'lower_back': { name: 'Lower Back', category: 'Back', color: '#93c5fd' },
    'rhomboids': { name: 'Rhomboids', category: 'Back', color: '#bfdbfe' },
    'traps': { name: 'Trapezius', category: 'Back', color: '#2563eb' },

    // Arms
    'biceps': { name: 'Biceps', category: 'Arms', color: '#22c55e' },
    'triceps': { name: 'Triceps', category: 'Arms', color: '#4ade80' },
    'triceps_long': { name: 'Triceps (Long Head)', category: 'Arms', color: '#86efac' },
    'triceps_lateral': { name: 'Triceps (Lateral Head)', category: 'Arms', color: '#bbf7d0' },
    'triceps_medial': { name: 'Triceps (Medial Head)', category: 'Arms', color: '#dcfce7' },
    'forearms': { name: 'Forearms', category: 'Arms', color: '#16a34a' },

    // Legs
    'quads': { name: 'Quadriceps', category: 'Legs', color: '#f97316' },
    'hamstrings': { name: 'Hamstrings', category: 'Legs', color: '#fb923c' },
    'glutes': { name: 'Glutes', category: 'Legs', color: '#fdba74' },
    'calves': { name: 'Calves', category: 'Legs', color: '#fed7aa' },
    'hip_flexors': { name: 'Hip Flexors', category: 'Legs', color: '#ea580c' },

    // Core
    'abs': { name: 'Abdominals', category: 'Core', color: '#06b6d4' },
    'obliques': { name: 'Obliques', category: 'Core', color: '#22d3ee' }
};

/**
 * Get muscle groups for an exercise name
 * @param {string} exerciseName - The exercise name to look up
 * @param {Object} customMappings - Custom user mappings
 * @returns {string[]} - Array of muscle group IDs
 */
export function getMuscleGroups(exerciseName, customMappings = {}) {
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

    // Return empty array if no match found
    return [];
}

/**
 * Get display name for a muscle group
 * @param {string} muscleId - Muscle group ID
 * @returns {string} - Display name
 */
export function getMuscleDisplayName(muscleId) {
    return MUSCLE_GROUPS[muscleId]?.name || muscleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get color for a muscle group
 * @param {string} muscleId - Muscle group ID
 * @returns {string} - Color hex code
 */
export function getMuscleColor(muscleId) {
    return MUSCLE_GROUPS[muscleId]?.color || '#6366f1';
}

/**
 * Get all muscle groups organized by category
 * @returns {Object} - Muscle groups organized by category
 */
export function getMusclesByCategory() {
    const categories = {};

    for (const [id, info] of Object.entries(MUSCLE_GROUPS)) {
        if (!categories[info.category]) {
            categories[info.category] = [];
        }
        categories[info.category].push({ id, ...info });
    }

    return categories;
}
