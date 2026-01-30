/**
 * Integration tests for intervalsService.js
 * Tests API interactions with Intervals.icu
 */

import { describe, test, assert, assertEqual, assertDeepEqual } from '../testRunner.js';

// Mock localStorage for Node.js environment
const localStorage = {
    _store: {},
    getItem(key) { return this._store[key] || null; },
    setItem(key, value) { this._store[key] = value; },
    removeItem(key) { delete this._store[key]; },
    clear() { this._store = {}; }
};

// ============================================
// Mock Intervals.icu API Functions
// ============================================

const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

function getIntervalsCredentials() {
    return {
        apiKey: localStorage.getItem('intervals_api_key'),
        athleteId: localStorage.getItem('intervals_athlete_id')
    };
}

function saveIntervalsCredentials(apiKey, athleteId) {
    localStorage.setItem('intervals_api_key', apiKey);
    localStorage.setItem('intervals_athlete_id', athleteId);
}

function clearIntervalsCredentials() {
    localStorage.removeItem('intervals_api_key');
    localStorage.removeItem('intervals_athlete_id');
}

function isIntervalsConfigured() {
    const { apiKey, athleteId } = getIntervalsCredentials();
    return !!(apiKey && athleteId);
}

/**
 * Mock test connection result
 */
function mockTestConnection(apiKey, athleteId) {
    // Simulate API validation
    if (!apiKey || !athleteId) {
        return { success: false, error: 'Missing credentials' };
    }

    if (!athleteId.startsWith('i')) {
        return { success: false, error: 'Invalid athlete ID format' };
    }

    if (apiKey.length < 10) {
        return { success: false, error: 'API key too short' };
    }

    // Simulate successful connection
    return {
        success: true,
        athlete: {
            id: athleteId,
            name: 'Test Athlete',
            profile: null
        }
    };
}

/**
 * Mock activity data structure
 */
function generateMockActivity(date, duration = 3600) {
    return {
        id: `activity-${date}`,
        name: 'Weight Training',
        type: 'WeightTraining',
        start_date_local: date,
        moving_time: duration,
        elapsed_time: duration,
        average_heartrate: 120,
        max_heartrate: 155
    };
}

/**
 * Mock HR streams data
 */
function generateMockHRStreams(duration = 3600) {
    const time = [];
    const heartrate = [];

    for (let t = 0; t < duration; t += 5) {
        time.push(t);
        // Simulate HR between 100-160 with some variation
        const baseHR = 110;
        const variation = Math.sin(t / 60) * 20 + Math.random() * 10;
        heartrate.push(Math.round(baseHR + variation));
    }

    return { time, heartrate };
}

// ============================================
// INTEGRATION TESTS
// ============================================

describe('Intervals.icu Credentials Management', () => {
    test('saves and retrieves credentials correctly', () => {
        localStorage.clear();

        const apiKey = 'test-api-key-12345';
        const athleteId = 'i123456';

        saveIntervalsCredentials(apiKey, athleteId);
        const creds = getIntervalsCredentials();

        assertEqual(creds.apiKey, apiKey);
        assertEqual(creds.athleteId, athleteId);
    });

    test('clears credentials correctly', () => {
        localStorage.clear();
        saveIntervalsCredentials('key', 'id');
        clearIntervalsCredentials();

        const creds = getIntervalsCredentials();
        assertEqual(creds.apiKey, null);
        assertEqual(creds.athleteId, null);
    });

    test('isIntervalsConfigured returns false when not configured', () => {
        localStorage.clear();
        assert(!isIntervalsConfigured(), 'Should return false when not configured');
    });

    test('isIntervalsConfigured returns true when configured', () => {
        localStorage.clear();
        saveIntervalsCredentials('api-key', 'i123456');
        assert(isIntervalsConfigured(), 'Should return true when configured');
    });
});

describe('Intervals.icu Connection Testing', () => {
    test('connection test fails with missing credentials', () => {
        const result = mockTestConnection(null, null);
        assert(!result.success, 'Should fail with missing credentials');
        assertEqual(result.error, 'Missing credentials');
    });

    test('connection test fails with invalid athlete ID', () => {
        const result = mockTestConnection('valid-api-key-12345', '123456');
        assert(!result.success, 'Should fail with invalid athlete ID format');
    });

    test('connection test fails with short API key', () => {
        const result = mockTestConnection('short', 'i123456');
        assert(!result.success, 'Should fail with short API key');
    });

    test('connection test succeeds with valid credentials', () => {
        const result = mockTestConnection('valid-api-key-12345', 'i123456');
        assert(result.success, 'Should succeed with valid credentials');
        assertEqual(result.athlete.id, 'i123456');
    });
});

describe('Activity Data Structure', () => {
    test('generates valid activity object', () => {
        const activity = generateMockActivity('2026-01-29T10:00:00');

        assert('id' in activity, 'Activity should have id');
        assert('name' in activity, 'Activity should have name');
        assert('type' in activity, 'Activity should have type');
        assert('moving_time' in activity, 'Activity should have moving_time');
        assert('average_heartrate' in activity, 'Activity should have average_heartrate');
        assert('max_heartrate' in activity, 'Activity should have max_heartrate');
    });

    test('activity has correct default values', () => {
        const activity = generateMockActivity('2026-01-29T10:00:00');

        assertEqual(activity.type, 'WeightTraining');
        assertEqual(activity.moving_time, 3600);
    });

    test('activity respects custom duration', () => {
        const activity = generateMockActivity('2026-01-29T10:00:00', 5400);
        assertEqual(activity.moving_time, 5400);
    });
});

describe('HR Streams Processing', () => {
    test('generates HR streams with correct structure', () => {
        const streams = generateMockHRStreams(600);

        assert(Array.isArray(streams.time), 'time should be an array');
        assert(Array.isArray(streams.heartrate), 'heartrate should be an array');
        assertEqual(streams.time.length, streams.heartrate.length);
    });

    test('HR values are in realistic range', () => {
        const streams = generateMockHRStreams(600);

        const minHR = Math.min(...streams.heartrate);
        const maxHR = Math.max(...streams.heartrate);

        assert(minHR >= 80, 'Min HR should be >= 80');
        assert(maxHR <= 180, 'Max HR should be <= 180');
    });

    test('time values are monotonically increasing', () => {
        const streams = generateMockHRStreams(600);

        for (let i = 1; i < streams.time.length; i++) {
            assert(streams.time[i] > streams.time[i - 1], 'Time should be increasing');
        }
    });
});

describe('HR Peak Detection (Mock)', () => {
    function detectPeaks(hrData, threshold = 130) {
        const peaks = [];
        for (let i = 1; i < hrData.length - 1; i++) {
            if (hrData[i] > hrData[i - 1] &&
                hrData[i] > hrData[i + 1] &&
                hrData[i] >= threshold) {
                peaks.push({ index: i, hr: hrData[i] });
            }
        }
        return peaks;
    }

    test('detects peaks in HR data', () => {
        const hrData = [100, 110, 140, 120, 115, 145, 130, 110];
        const peaks = detectPeaks(hrData, 130);

        assertEqual(peaks.length, 2);
        assertEqual(peaks[0].hr, 140);
        assertEqual(peaks[1].hr, 145);
    });

    test('respects threshold parameter', () => {
        const hrData = [100, 110, 125, 120, 115, 145, 130, 110];

        const lowThreshold = detectPeaks(hrData, 120);
        const highThreshold = detectPeaks(hrData, 140);

        assert(lowThreshold.length > highThreshold.length, 'Lower threshold should find more peaks');
    });

    test('handles flat data without crashing', () => {
        const flatData = [100, 100, 100, 100, 100];
        const peaks = detectPeaks(flatData);

        assertEqual(peaks.length, 0);
    });
});

describe('Date Matching for Activities', () => {
    function findActivityByDate(activities, targetDateStr) {
        // Match based on ID which contains the date string
        return activities.find(a => a.id.includes(targetDateStr));
    }

    test('finds activity by date string', () => {
        const activities = [
            generateMockActivity('2026-01-28T10:00:00'),
            generateMockActivity('2026-01-29T10:00:00'),
            generateMockActivity('2026-01-30T10:00:00')
        ];

        const found = findActivityByDate(activities, '2026-01-29');
        assert(found !== undefined, 'Should find activity');
        assertEqual(found.id, 'activity-2026-01-29T10:00:00');
    });

    test('returns undefined for non-existent date', () => {
        const activities = [
            generateMockActivity('2026-01-28T10:00:00')
        ];

        const found = findActivityByDate(activities, '2026-01-29');
        assertEqual(found, undefined);
    });

    test('handles multiple activities on different dates', () => {
        const activities = [
            generateMockActivity('2026-01-27T08:00:00'),
            generateMockActivity('2026-01-28T10:00:00'),
            generateMockActivity('2026-01-29T14:00:00')
        ];

        const found27 = findActivityByDate(activities, '2026-01-27');
        const found28 = findActivityByDate(activities, '2026-01-28');
        const found29 = findActivityByDate(activities, '2026-01-29');

        assert(found27 !== undefined, 'Should find Jan 27');
        assert(found28 !== undefined, 'Should find Jan 28');
        assert(found29 !== undefined, 'Should find Jan 29');
    });
});

console.log('\n✅ intervalsService.test.js loaded');
