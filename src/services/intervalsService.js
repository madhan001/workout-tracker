/**
 * intervals.icu API Service
 * Handles authentication and data fetching from intervals.icu
 */

const INTERVALS_BASE_URL = 'https://intervals.icu/api/v1';

/**
 * Get stored intervals.icu credentials
 */
export function getIntervalsCredentials() {
    return {
        apiKey: localStorage.getItem('intervals_api_key'),
        athleteId: localStorage.getItem('intervals_athlete_id')
    };
}

/**
 * Save intervals.icu credentials
 */
export function saveIntervalsCredentials(apiKey, athleteId) {
    localStorage.setItem('intervals_api_key', apiKey);
    localStorage.setItem('intervals_athlete_id', athleteId);
}

/**
 * Clear intervals.icu credentials
 */
export function clearIntervalsCredentials() {
    localStorage.removeItem('intervals_api_key');
    localStorage.removeItem('intervals_athlete_id');
}

/**
 * Check if intervals.icu is configured
 */
export function isIntervalsConfigured() {
    const { apiKey, athleteId } = getIntervalsCredentials();
    return !!(apiKey && athleteId);
}

/**
 * Create authorization header for intervals.icu API
 * Uses Basic auth with API_KEY as username and the key as password
 */
function getAuthHeader() {
    const { apiKey } = getIntervalsCredentials();
    if (!apiKey) throw new Error('intervals.icu API key not configured');

    // Basic auth: username is "API_KEY", password is the actual API key
    const credentials = btoa(`API_KEY:${apiKey}`);
    return `Basic ${credentials}`;
}

/**
 * Make authenticated request to intervals.icu API
 */
async function intervalsRequest(endpoint, options = {}) {
    const { athleteId } = getIntervalsCredentials();

    // Replace {id} placeholder with athlete ID
    const url = `${INTERVALS_BASE_URL}${endpoint.replace('{id}', athleteId)}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': getAuthHeader(),
            'Accept': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Invalid intervals.icu API key');
        }
        throw new Error(`intervals.icu API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Test connection to intervals.icu
 * Returns athlete info if successful
 */
export async function testConnection() {
    try {
        const athlete = await intervalsRequest('/athlete/{id}');
        return {
            success: true,
            athlete: {
                id: athlete.id,
                name: athlete.name || athlete.firstname,
                profile: athlete.profile_medium
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Fetch activities for a specific date
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {string} type - Activity type filter (default: WeightTraining)
 */
export async function fetchActivitiesForDate(date, type = 'WeightTraining') {
    const activities = await intervalsRequest(
        `/athlete/{id}/activities?oldest=${date}&newest=${date}`
    );

    // Filter by type if specified
    if (type) {
        return activities.filter(a => a.type === type);
    }
    return activities;
}

/**
 * Fetch all weight training activities in a date range
 */
export async function fetchWeightTrainingActivities(oldestDate, newestDate) {
    const activities = await intervalsRequest(
        `/athlete/{id}/activities?oldest=${oldestDate}&newest=${newestDate}`
    );

    return activities.filter(a => a.type === 'WeightTraining');
}

/**
 * Fetch heart rate stream for an activity
 * @param {string} activityId - The activity ID
 * @returns {Object} Object with time and heartrate arrays
 */
export async function fetchHRStream(activityId) {
    const streams = await intervalsRequest(
        `/activity/${activityId}/streams?types=time,heartrate`
    );

    // Parse the streams response
    const timeStream = streams.find(s => s.type === 'time');
    const hrStream = streams.find(s => s.type === 'heartrate');

    if (!timeStream || !hrStream) {
        throw new Error('HR data not available for this activity');
    }

    return {
        time: timeStream.data,      // Array of seconds from start
        heartrate: hrStream.data,   // Array of bpm values
        activityId
    };
}

/**
 * Fetch activity details including intervals
 */
export async function fetchActivityDetails(activityId) {
    return intervalsRequest(`/activity/${activityId}?intervals=true`);
}

/**
 * Match a workout date to an intervals.icu activity
 * @param {Date} workoutDate - The date of the workout
 * @returns {Object|null} The matching activity or null
 */
export async function matchWorkoutToActivity(workoutDate) {
    const dateStr = workoutDate.toISOString().split('T')[0];
    const activities = await fetchActivitiesForDate(dateStr);

    if (activities.length === 0) {
        return null;
    }

    // If multiple weight training sessions on same day, return the first one
    // (could be enhanced to match by time of day)
    return activities[0];
}

/**
 * Get complete HR data for a workout
 * Matches workout date to activity and fetches HR stream
 */
export async function getWorkoutHRData(workoutDate) {
    if (!isIntervalsConfigured()) {
        return null;
    }

    try {
        const activity = await matchWorkoutToActivity(workoutDate);
        if (!activity) {
            return { error: 'No matching activity found', available: false };
        }

        const hrData = await fetchHRStream(activity.id);

        return {
            available: true,
            activity: {
                id: activity.id,
                name: activity.name,
                startTime: activity.start_date_local,
                duration: activity.moving_time,
                avgHR: activity.average_heartrate,
                maxHR: activity.max_heartrate
            },
            streams: hrData
        };
    } catch (error) {
        console.error('Error fetching HR data:', error);
        return { error: error.message, available: false };
    }
}

// Demo HR data for testing without real API
export function generateDemoHRData(durationMinutes = 60, numSets = 12) {
    const data = {
        time: [],
        heartrate: []
    };

    const totalSeconds = durationMinutes * 60;
    const restHR = 85;
    const peakHR = 155;
    const setDuration = 45;  // seconds per set
    const restDuration = 90; // seconds between sets

    let currentTime = 0;
    let setIndex = 0;

    // Warmup period (5 minutes)
    for (let i = 0; i < 300; i++) {
        data.time.push(currentTime);
        data.heartrate.push(restHR + Math.random() * 10 + (i / 300) * 15);
        currentTime++;
    }

    // Main workout with sets
    while (setIndex < numSets && currentTime < totalSeconds - 300) {
        // Set execution - HR ramps up
        for (let i = 0; i < setDuration; i++) {
            data.time.push(currentTime);
            const progress = i / setDuration;
            const hr = restHR + 20 + progress * (peakHR - restHR - 20) + Math.random() * 8;
            data.heartrate.push(Math.min(peakHR + 10, hr));
            currentTime++;
        }

        // Peak moment
        for (let i = 0; i < 10; i++) {
            data.time.push(currentTime);
            data.heartrate.push(peakHR + Math.random() * 15 - 5);
            currentTime++;
        }

        // Recovery - HR drops
        for (let i = 0; i < restDuration && currentTime < totalSeconds - 300; i++) {
            data.time.push(currentTime);
            const decay = Math.exp(-i / 30);
            const hr = restHR + 15 + decay * (peakHR - restHR - 15) + Math.random() * 5;
            data.heartrate.push(hr);
            currentTime++;
        }

        setIndex++;
    }

    // Cooldown
    while (currentTime < totalSeconds) {
        data.time.push(currentTime);
        const remaining = totalSeconds - currentTime;
        const hr = restHR + 10 * (remaining / 300) + Math.random() * 5;
        data.heartrate.push(Math.max(restHR - 5, hr));
        currentTime++;
    }

    return {
        available: true,
        isDemo: true,
        activity: {
            id: 'demo',
            name: 'Demo Weight Training',
            duration: totalSeconds,
            avgHR: 115,
            maxHR: Math.max(...data.heartrate)
        },
        streams: data
    };
}
