import { getMuscleGroups } from './muscleMapping.js';

/**
 * Parse comma-separated values into an array of numbers
 * @param {string} value - Comma-separated string (e.g., "95, 95, 95, 95")
 * @returns {number[]} - Array of parsed numbers
 */
function parseCommaSeparated(value) {
    if (!value || typeof value !== 'string') return [];

    return value
        .split(',')
        .map(v => parseFloat(v.trim()))
        .filter(v => !isNaN(v));
}

/**
 * Parse a single worksheet row into an exercise object
 * @param {Array} row - Row data from Google Sheets
 * @param {Object} customMappings - Custom muscle mappings
 * @returns {Object|null} - Parsed exercise or null if invalid
 */
function parseExerciseRow(row, customMappings = {}) {
    // Row format: [Exercise Name, Sets (weights), Max, Reps, Volume]
    const name = row[0]?.toString().trim();

    // Skip empty rows or header rows
    if (!name || name.toLowerCase().includes('exercise') || name.toLowerCase().includes('s1')) {
        return null;
    }

    const setsStr = row[1]?.toString() || '';
    const maxWeight = parseFloat(row[2]) || 0;
    const repsStr = row[3]?.toString() || '';
    const volume = parseFloat(row[4]) || 0;

    const sets = parseCommaSeparated(setsStr);
    const reps = parseCommaSeparated(repsStr);

    // Skip if no sets data (empty exercise)
    if (sets.length === 0 && maxWeight === 0 && volume === 0) {
        return null;
    }

    // Calculate volume if not provided
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
        muscleGroups: getMuscleGroups(name, customMappings)
    };
}

/**
 * Parse a full worksheet into a workout object
 * @param {string} sheetName - Sheet name (date in MM/DD/YYYY format)
 * @param {Array} rows - Array of row data
 * @param {Object} customMappings - Custom muscle mappings
 * @returns {Object} - Parsed workout object
 */
export function parseWorksheet(sheetName, rows, customMappings = {}) {
    const exercises = [];
    let totalVolume = 0;

    // Skip header row(s) - usually first row
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
 * Parse a date string in MM/DD/YYYY format
 * @param {string} dateStr - Date string
 * @returns {Date|null} - Parsed Date object or null
 */
export function parseDateString(dateStr) {
    if (!dateStr) return null;

    // Handle MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1; // JS months are 0-indexed
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        // Handle 2-digit years
        const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;

        const date = new Date(fullYear, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}

/**
 * Format a date object for display
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
    if (!date) return '';

    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Format a number with commas
 * @param {number} num - Number to format
 * @returns {string} - Formatted number string
 */
export function formatNumber(num) {
    return num.toLocaleString('en-US');
}

/**
 * Sort workouts by date (newest first)
 * @param {Array} workouts - Array of workout objects
 * @returns {Array} - Sorted workouts
 */
export function sortWorkoutsByDate(workouts) {
    return [...workouts].sort((a, b) => {
        if (!a.dateObject) return 1;
        if (!b.dateObject) return -1;
        return b.dateObject - a.dateObject;
    });
}

/**
 * Filter workouts by date range
 * @param {Array} workouts - Array of workout objects
 * @param {number} days - Number of days to include (0 for all)
 * @returns {Array} - Filtered workouts
 */
export function filterWorkoutsByDateRange(workouts, days) {
    if (days === 0 || days === 'all') return workouts;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return workouts.filter(w => w.dateObject && w.dateObject >= cutoffDate);
}

/**
 * Calculate aggregate statistics from workouts
 * @param {Array} workouts - Array of workout objects
 * @returns {Object} - Aggregate statistics
 */
export function calculateStats(workouts) {
    const totalVolume = workouts.reduce((sum, w) => sum + w.totalVolume, 0);
    const totalExercises = workouts.reduce((sum, w) => sum + w.exerciseCount, 0);

    // Calculate personal records
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

/**
 * Calculate volume by muscle group
 * @param {Array} workouts - Array of workout objects
 * @returns {Object} - Volume breakdown by muscle group
 */
export function calculateMuscleVolume(workouts) {
    const muscleVolume = {};

    for (const workout of workouts) {
        for (const exercise of workout.exercises) {
            const volumePerMuscle = exercise.volume / Math.max(exercise.muscleGroups.length, 1);

            for (const muscle of exercise.muscleGroups) {
                if (!muscleVolume[muscle]) {
                    muscleVolume[muscle] = {
                        volume: 0,
                        exercises: new Set(),
                        workouts: 0
                    };
                }
                muscleVolume[muscle].volume += volumePerMuscle;
                muscleVolume[muscle].exercises.add(exercise.name);
            }
        }
    }

    // Convert Sets to arrays and calculate workout counts
    return Object.fromEntries(
        Object.entries(muscleVolume).map(([muscle, data]) => [
            muscle,
            {
                volume: Math.round(data.volume),
                exercises: Array.from(data.exercises)
            }
        ])
    );
}

/**
 * Calculate exercise history with averages for comparison
 * @param {string} exerciseName - Name of the exercise
 * @param {Date} currentDate - Date of the current workout
 * @param {Array} allWorkouts - All workout data (sorted newest first)
 * @returns {Object} - Historical averages and previous session data
 */
export function calculateExerciseHistory(exerciseName, currentDate, allWorkouts) {
    const normalizedName = exerciseName.toLowerCase().trim();

    // Filter workouts before the current date that include this exercise
    const historicalData = [];

    for (const workout of allWorkouts) {
        // Skip current or future workouts
        if (!workout.dateObject || (currentDate && workout.dateObject >= currentDate)) {
            continue;
        }

        // Find this exercise in the workout
        const exercise = workout.exercises.find(
            e => e.name.toLowerCase().trim() === normalizedName
        );

        if (exercise) {
            historicalData.push({
                date: workout.dateObject,
                volume: exercise.volume,
                maxWeight: exercise.maxWeight,
                sets: exercise.sets,
                reps: exercise.reps
            });
        }
    }

    // Sort by date, newest first
    historicalData.sort((a, b) => b.date - a.date);

    // Calculate time-based cutoffs
    const now = currentDate || new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    // Filter by time periods
    const lastWeek = historicalData.filter(h => h.date >= oneWeekAgo);
    const lastTwoWeeks = historicalData.filter(h => h.date >= twoWeeksAgo);
    const lastFourWeeks = historicalData.filter(h => h.date >= fourWeeksAgo);

    // Calculate averages
    const calcAvg = (data) => {
        if (data.length === 0) return null;
        const sum = data.reduce((acc, d) => acc + d.volume, 0);
        return Math.round(sum / data.length);
    };

    const calcMaxAvg = (data) => {
        if (data.length === 0) return null;
        const sum = data.reduce((acc, d) => acc + d.maxWeight, 0);
        return Math.round(sum / data.length);
    };

    return {
        previousSession: historicalData.length > 0 ? {
            volume: historicalData[0].volume,
            maxWeight: historicalData[0].maxWeight,
            date: historicalData[0].date,
            sets: historicalData[0].sets,
            reps: historicalData[0].reps
        } : null,
        oneWeekAvg: {
            volume: calcAvg(lastWeek),
            maxWeight: calcMaxAvg(lastWeek),
            sessions: lastWeek.length
        },
        twoWeekAvg: {
            volume: calcAvg(lastTwoWeeks),
            maxWeight: calcMaxAvg(lastTwoWeeks),
            sessions: lastTwoWeeks.length
        },
        fourWeekAvg: {
            volume: calcAvg(lastFourWeeks),
            maxWeight: calcMaxAvg(lastFourWeeks),
            sessions: lastFourWeeks.length
        },
        allTimeAvg: {
            volume: calcAvg(historicalData),
            maxWeight: calcMaxAvg(historicalData),
            sessions: historicalData.length
        }
    };
}

/**
 * Calculate percentage change between two values
 * @param {number} current - Current value
 * @param {number} previous - Previous/average value
 * @returns {Object} - Change info with percentage and direction
 */
export function calculateChange(current, previous) {
    if (previous === null || previous === 0) {
        return { percentage: null, direction: 'neutral', display: 'N/A' };
    }

    const change = ((current - previous) / previous) * 100;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    const display = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;

    return { percentage: change, direction, display };
}

// ============================================
// Heart Rate Analysis Utilities
// ============================================

/**
 * Detect peaks in heart rate data
 * Uses a sliding window approach to find local maxima
 * @param {number[]} hrData - Array of heart rate values
 * @param {number[]} timeData - Array of timestamps (seconds from start)
 * @param {Object} options - Detection parameters
 * @returns {Array} - Array of peak objects with index, time, and hr value
 */
export function detectHRPeaks(hrData, timeData, options = {}) {
    const {
        windowSize = 30,        // Seconds to look around for local max
        minPeakDistance = 45,   // Minimum seconds between peaks
        thresholdAboveAvg = 15  // BPM above rolling average to qualify
    } = options;

    if (!hrData || hrData.length === 0) return [];

    const peaks = [];
    const avgHR = hrData.reduce((a, b) => a + b, 0) / hrData.length;

    // Calculate rolling average for each point
    const rollingAvg = hrData.map((_, i) => {
        const start = Math.max(0, i - 30);
        const end = Math.min(hrData.length, i + 30);
        const window = hrData.slice(start, end);
        return window.reduce((a, b) => a + b, 0) / window.length;
    });

    // Find peaks
    for (let i = windowSize; i < hrData.length - windowSize; i++) {
        const hr = hrData[i];
        const time = timeData[i];

        // Check if this is a local maximum within window
        const windowStart = Math.max(0, i - windowSize);
        const windowEnd = Math.min(hrData.length, i + windowSize);
        const isLocalMax = hrData.slice(windowStart, windowEnd).every(v => v <= hr);

        // Check if above threshold
        const isAboveThreshold = hr > rollingAvg[i] + thresholdAboveAvg;

        // Check minimum distance from last peak
        const lastPeak = peaks[peaks.length - 1];
        const farEnough = !lastPeak || (time - lastPeak.time) >= minPeakDistance;

        if (isLocalMax && isAboveThreshold && farEnough) {
            peaks.push({
                index: i,
                time,
                hr,
                avgHR: rollingAvg[i]
            });
        }
    }

    return peaks;
}

/**
 * Calculate HR statistics for a time window
 * @param {number[]} hrData - Full HR data array
 * @param {number[]} timeData - Full time data array
 * @param {number} startTime - Start of window (seconds)
 * @param {number} endTime - End of window (seconds)
 * @returns {Object} - HR stats for the window
 */
export function calculateWindowHRStats(hrData, timeData, startTime, endTime) {
    const windowData = hrData.filter((_, i) =>
        timeData[i] >= startTime && timeData[i] <= endTime
    );

    if (windowData.length === 0) {
        return { avgHR: null, maxHR: null, minHR: null };
    }

    return {
        avgHR: Math.round(windowData.reduce((a, b) => a + b, 0) / windowData.length),
        maxHR: Math.round(Math.max(...windowData)),
        minHR: Math.round(Math.min(...windowData))
    };
}

/**
 * Correlate detected HR peaks with exercise sets
 * Uses hybrid approach: timestamps if available, otherwise algorithmic matching
 * @param {Array} sets - Exercise sets (can include timestamps)
 * @param {Array} peaks - Detected HR peaks
 * @param {Object} streams - HR streams data {time, heartrate}
 * @param {Object} options - Correlation options
 * @returns {Array} - Sets with correlated HR data
 */
export function correlateSetsToHR(sets, peaks, streams, options = {}) {
    const { workoutDuration } = options;
    const totalSets = sets.length;

    if (!peaks || peaks.length === 0 || totalSets === 0) {
        return sets.map(set => ({ ...set, hrData: null }));
    }

    // Check if we have timestamps in the sets
    const hasTimestamps = sets.some(set => set.timestamp);

    if (hasTimestamps) {
        // Use precise timestamp matching
        return correlateByTimestamp(sets, peaks, streams);
    } else {
        // Use algorithmic matching based on position
        return correlateByPosition(sets, peaks, streams, workoutDuration);
    }
}

/**
 * Correlate using set timestamps (precise method)
 */
function correlateByTimestamp(sets, peaks, streams) {
    return sets.map(set => {
        if (!set.timestamp) {
            return { ...set, hrData: null };
        }

        const setTime = set.timestamp; // seconds from workout start

        // Find nearest peak within ±60 seconds of set timestamp
        const nearestPeak = peaks.reduce((best, peak) => {
            const distance = Math.abs(peak.time - setTime);
            if (distance < 60 && (!best || distance < Math.abs(best.time - setTime))) {
                return peak;
            }
            return best;
        }, null);

        if (!nearestPeak) {
            return { ...set, hrData: null };
        }

        // Calculate stats around the peak (±20 seconds)
        const stats = calculateWindowHRStats(
            streams.heartrate,
            streams.time,
            nearestPeak.time - 20,
            nearestPeak.time + 20
        );

        return {
            ...set,
            hrData: {
                peakHR: nearestPeak.hr,
                peakTime: nearestPeak.time,
                ...stats,
                matchedBy: 'timestamp'
            }
        };
    });
}

/**
 * Correlate using position-based algorithmic matching
 */
function correlateByPosition(sets, peaks, streams, workoutDuration) {
    const totalSets = sets.length;

    // If we have roughly the same number of peaks as sets, match 1:1
    if (peaks.length >= totalSets * 0.7 && peaks.length <= totalSets * 1.5) {
        // Match peaks to sets by order
        return sets.map((set, i) => {
            // Find the peak that best matches this set's position
            const expectedPeakIndex = Math.floor((i / totalSets) * peaks.length);
            const peak = peaks[Math.min(expectedPeakIndex, peaks.length - 1)];

            if (!peak) {
                return { ...set, hrData: null };
            }

            const stats = calculateWindowHRStats(
                streams.heartrate,
                streams.time,
                peak.time - 20,
                peak.time + 20
            );

            return {
                ...set,
                hrData: {
                    peakHR: peak.hr,
                    peakTime: peak.time,
                    ...stats,
                    matchedBy: 'position'
                }
            };
        });
    }

    // Otherwise, divide workout into segments and find highest peak per segment
    const segmentDuration = workoutDuration / totalSets;

    return sets.map((set, i) => {
        const segmentStart = i * segmentDuration;
        const segmentEnd = (i + 1) * segmentDuration;

        // Find peaks in this segment
        const segmentPeaks = peaks.filter(p =>
            p.time >= segmentStart && p.time < segmentEnd
        );

        // Take the highest peak in the segment
        const highestPeak = segmentPeaks.reduce((best, peak) =>
            (!best || peak.hr > best.hr) ? peak : best
            , null);

        if (!highestPeak) {
            // No peak found, calculate stats for the segment anyway
            const stats = calculateWindowHRStats(
                streams.heartrate,
                streams.time,
                segmentStart,
                segmentEnd
            );
            return {
                ...set,
                hrData: stats ? { ...stats, matchedBy: 'segment' } : null
            };
        }

        const stats = calculateWindowHRStats(
            streams.heartrate,
            streams.time,
            highestPeak.time - 20,
            highestPeak.time + 20
        );

        return {
            ...set,
            hrData: {
                peakHR: highestPeak.hr,
                peakTime: highestPeak.time,
                ...stats,
                matchedBy: 'segment'
            }
        };
    });
}

/**
 * Analyze complete workout HR data
 * @param {Object} workout - Workout object with exercises
 * @param {Object} hrData - HR data from intervals.icu
 * @returns {Object} - Workout with HR analysis
 */
export function analyzeWorkoutHR(workout, hrData) {
    if (!hrData || !hrData.available || !hrData.streams) {
        return { ...workout, hrAnalysis: null };
    }

    const { time, heartrate } = hrData.streams;
    const duration = time[time.length - 1];

    // Detect peaks
    const peaks = detectHRPeaks(heartrate, time);

    // Calculate total sets across all exercises
    const allSets = [];
    workout.exercises.forEach((ex, exIndex) => {
        ex.sets.forEach((weight, setIndex) => {
            allSets.push({
                exerciseName: ex.name,
                exerciseIndex: exIndex,
                setIndex,
                weight,
                reps: ex.reps[setIndex] || ex.reps[0],
                timestamp: ex.timestamps?.[setIndex] // if available
            });
        });
    });

    // Correlate sets to HR
    const correlatedSets = correlateSetsToHR(allSets, peaks, hrData.streams, {
        workoutDuration: duration
    });

    // Calculate overall stats
    const overallStats = {
        avgHR: Math.round(heartrate.reduce((a, b) => a + b, 0) / heartrate.length),
        maxHR: Math.round(Math.max(...heartrate)),
        minHR: Math.round(Math.min(...heartrate)),
        duration,
        peaksDetected: peaks.length,
        totalSets: allSets.length
    };

    return {
        ...workout,
        hrAnalysis: {
            available: true,
            activity: hrData.activity,
            peaks,
            correlatedSets,
            overallStats,
            streams: hrData.streams
        }
    };
}
