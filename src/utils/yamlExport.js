/**
 * YAML Export Utility
 * Converts workout data to YAML format for LLM analysis
 */

/**
 * Convert a JavaScript object to YAML string
 * @param {any} obj - Object to convert
 * @param {number} indent - Current indentation level
 * @returns {string} YAML string
 */
export function toYAML(obj, indent = 0) {
    const spaces = '  '.repeat(indent);

    if (obj === null || obj === undefined) {
        return 'null';
    }

    if (typeof obj === 'string') {
        // Escape strings that might cause issues
        if (obj.includes('\n') || obj.includes(':') || obj.includes('#') ||
            obj.startsWith(' ') || obj.endsWith(' ') || obj === '') {
            return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
        }
        return obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj);
    }

    if (obj instanceof Date) {
        return obj.toISOString();
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';

        return obj.map(item => {
            if (typeof item === 'object' && item !== null) {
                const yaml = toYAML(item, indent + 1);
                const lines = yaml.split('\n');
                return `${spaces}- ${lines[0]}\n${lines.slice(1).map(l => `${spaces}  ${l}`).join('\n')}`.trimEnd();
            }
            return `${spaces}- ${toYAML(item, indent + 1)}`;
        }).join('\n');
    }

    if (typeof obj === 'object') {
        const entries = Object.entries(obj);
        if (entries.length === 0) return '{}';

        return entries.map(([key, value]) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                return `${spaces}${key}:\n${toYAML(value, indent + 1)}`;
            }
            if (Array.isArray(value)) {
                if (value.length === 0) return `${spaces}${key}: []`;
                return `${spaces}${key}:\n${toYAML(value, indent + 1)}`;
            }
            return `${spaces}${key}: ${toYAML(value, indent)}`;
        }).join('\n');
    }

    return String(obj);
}

/**
 * Export workouts data to YAML format optimized for LLM analysis
 * @param {Object} data - The workout data to export
 * @returns {string} YAML formatted string
 */
export function exportToYAML(data) {
    const { workouts, personalRecords, muscleGroups, summary } = data;

    const exportData = {
        metadata: {
            exportDate: new Date().toISOString(),
            totalWorkouts: workouts?.length || 0,
            dateRange: workouts?.length > 0 ? {
                earliest: workouts[workouts.length - 1]?.date,
                latest: workouts[0]?.date
            } : null,
            purpose: 'Workout data export for LLM analysis'
        },
        summary: summary || {},
        personalRecords: personalRecords?.map(pr => ({
            exercise: pr.exercise,
            maxWeight: pr.maxWeight,
            maxVolume: pr.maxVolume,
            date: pr.date
        })) || [],
        muscleGroupAnalysis: muscleGroups || {},
        workouts: workouts?.map(w => ({
            date: w.date,
            totalVolume: w.totalVolume,
            exerciseCount: w.exercises?.length || 0,
            exercises: w.exercises?.map(ex => ({
                name: ex.name,
                muscleGroups: ex.muscleGroups || [],
                volume: ex.volume,
                sets: ex.sets?.map(s => ({
                    weight: s.weight,
                    reps: s.reps,
                    volume: s.weight * s.reps
                })) || []
            })) || []
        })) || []
    };

    const header = `# Workout Tracker Data Export
# Generated: ${new Date().toISOString()}
# Format: YAML (optimized for LLM analysis)
# 
# This export contains:
# - Summary statistics
# - Personal records by exercise
# - Muscle group volume distribution
# - Detailed workout history with sets/reps/weights
#
# Use this data to ask an LLM questions like:
# - "What's my progression on bench press over time?"
# - "Which muscle groups am I neglecting?"
# - "Suggest a workout plan based on my history"
# - "Identify any imbalances in my training"

`;

    return header + toYAML(exportData);
}

/**
 * Download data as a YAML file
 * @param {string} yamlContent - YAML string to download
 * @param {string} filename - Name of the file
 */
export function downloadYAML(yamlContent, filename = 'workout-data.yaml') {
    const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
