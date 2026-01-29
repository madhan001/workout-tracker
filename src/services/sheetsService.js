/**
 * Google Sheets API Service
 * Handles fetching and parsing workout data from Google Sheets
 */

import { getAccessToken } from './googleAuth.js';
import { parseWorksheet } from '../utils/dataParser.js';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Get the spreadsheet ID from localStorage or default
 * @returns {string}
 */
export function getSpreadsheetId() {
    return localStorage.getItem('spreadsheet_id') || '1LuJKii-khZsUoqXkOQusGeE8s2vbLB5PiifAt5ybPFk';
}

/**
 * Set the spreadsheet ID
 * @param {string} id
 */
export function setSpreadsheetId(id) {
    localStorage.setItem('spreadsheet_id', id);
}

/**
 * Make an authenticated request to the Sheets API
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object>}
 */
async function apiRequest(endpoint) {
    const token = getAccessToken();

    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${SHEETS_API_BASE}/${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Get spreadsheet metadata (sheet names, etc.)
 * @param {string} spreadsheetId
 * @returns {Promise<Object>}
 */
export async function getSpreadsheetMetadata(spreadsheetId = null) {
    const id = spreadsheetId || getSpreadsheetId();
    return apiRequest(`${id}?fields=properties,sheets.properties`);
}

/**
 * Get all sheet names from the spreadsheet
 * @param {string} spreadsheetId
 * @returns {Promise<string[]>}
 */
export async function getSheetNames(spreadsheetId = null) {
    const metadata = await getSpreadsheetMetadata(spreadsheetId);
    return metadata.sheets.map(sheet => sheet.properties.title);
}

/**
 * Get data from a specific sheet
 * @param {string} sheetName - Name of the sheet
 * @param {string} spreadsheetId - Optional spreadsheet ID
 * @returns {Promise<Array>}
 */
export async function getSheetData(sheetName, spreadsheetId = null) {
    const id = spreadsheetId || getSpreadsheetId();
    const encodedName = encodeURIComponent(sheetName);

    const response = await apiRequest(`${id}/values/${encodedName}!A:E`);
    return response.values || [];
}

/**
 * Fetch all workouts from the spreadsheet
 * @param {string} spreadsheetId - Optional spreadsheet ID
 * @param {Object} customMappings - Custom muscle mappings
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>}
 */
export async function fetchAllWorkouts(spreadsheetId = null, customMappings = {}, onProgress = null) {
    const id = spreadsheetId || getSpreadsheetId();

    // Get all sheet names
    const sheetNames = await getSheetNames(id);

    // Filter to only date-formatted sheet names (MM/DD/YYYY)
    const dateSheets = sheetNames.filter(name => {
        const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
        return dateRegex.test(name);
    });

    const workouts = [];
    let completed = 0;

    // Fetch data from each sheet
    for (const sheetName of dateSheets) {
        try {
            const data = await getSheetData(sheetName, id);
            const workout = parseWorksheet(sheetName, data, customMappings);

            // Only include workouts with actual exercises
            if (workout.exercises.length > 0) {
                workouts.push(workout);
            }

            completed++;
            if (onProgress) {
                onProgress({
                    current: completed,
                    total: dateSheets.length,
                    currentSheet: sheetName
                });
            }
        } catch (error) {
            console.error(`Error fetching sheet ${sheetName}:`, error);
        }
    }

    return workouts;
}

/**
 * Batch fetch multiple sheets at once (more efficient)
 * @param {string[]} sheetNames - Array of sheet names
 * @param {string} spreadsheetId
 * @returns {Promise<Object>}
 */
export async function batchGetSheets(sheetNames, spreadsheetId = null) {
    const id = spreadsheetId || getSpreadsheetId();
    const ranges = sheetNames.map(name => `${name}!A:E`).join('&ranges=');

    const response = await apiRequest(`${id}/values:batchGet?ranges=${ranges}`);
    return response.valueRanges || [];
}

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Make an authenticated POST/PUT request to the Sheets API
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @param {string} method - HTTP method
 * @returns {Promise<Object>}
 */
async function apiWriteRequest(endpoint, body, method = 'POST') {
    const token = getAccessToken();

    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${SHEETS_API_BASE}/${endpoint}`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Create a new sheet (tab) for a workout date
 * @param {string} date - Date string (MM/DD/YYYY format)
 * @param {string} spreadsheetId
 * @returns {Promise<Object>}
 */
export async function createWorkoutSheet(date, spreadsheetId = null) {
    const id = spreadsheetId || getSpreadsheetId();

    const request = {
        requests: [{
            addSheet: {
                properties: {
                    title: date
                }
            }
        }]
    };

    return apiWriteRequest(`${id}:batchUpdate`, request);
}

/**
 * Check if a sheet exists
 * @param {string} sheetName
 * @param {string} spreadsheetId
 * @returns {Promise<boolean>}
 */
export async function sheetExists(sheetName, spreadsheetId = null) {
    const names = await getSheetNames(spreadsheetId);
    return names.includes(sheetName);
}

/**
 * Append rows to a sheet
 * @param {string} sheetName - Name of the sheet
 * @param {Array<Array>} values - 2D array of values to append
 * @param {string} spreadsheetId
 * @returns {Promise<Object>}
 */
export async function appendRows(sheetName, values, spreadsheetId = null) {
    const id = spreadsheetId || getSpreadsheetId();
    const encodedName = encodeURIComponent(sheetName);

    const body = {
        values: values
    };

    const endpoint = `${id}/values/${encodedName}!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    return apiWriteRequest(endpoint, body);
}

/**
 * Save a complete workout to Google Sheets
 * @param {string} date - Date string (MM/DD/YYYY format)
 * @param {Array} exercises - Array of exercise objects
 * @param {string} spreadsheetId
 * @returns {Promise<Object>}
 */
export async function saveWorkout(date, exercises, spreadsheetId = null) {
    const id = spreadsheetId || getSpreadsheetId();

    // Check if sheet exists, create if not
    const exists = await sheetExists(date, id);
    if (!exists) {
        await createWorkoutSheet(date, id);
    }

    // Convert exercises to sheet rows
    // Format: [Exercise Name, Weight, Sets, Reps, RPE]
    const rows = [];

    for (const exercise of exercises) {
        const weights = exercise.sets.map(s => s.weight).join(', ');
        const reps = exercise.sets.map(s => s.reps).join(', ');
        const rpes = exercise.sets.map(s => s.rpe || '').join(', ');

        rows.push([
            exercise.name,
            weights,
            exercise.sets.length.toString(),
            reps,
            rpes
        ]);
    }

    // Append all rows at once
    return appendRows(date, rows, id);
}

/**
 * Initialize a new spreadsheet with instructions/header
 * @param {string} spreadsheetId
 * @returns {Promise<Object>}
 */
export async function initializeSpreadsheet(spreadsheetId = null) {
    const id = spreadsheetId || getSpreadsheetId();

    // Get existing sheet names
    const names = await getSheetNames(id);

    // If there's a default "Sheet1", rename it to "Instructions"
    if (names.includes('Sheet1')) {
        // Get sheet ID for Sheet1
        const metadata = await getSpreadsheetMetadata(id);
        const sheet1 = metadata.sheets.find(s => s.properties.title === 'Sheet1');

        if (sheet1) {
            const request = {
                requests: [{
                    updateSheetProperties: {
                        properties: {
                            sheetId: sheet1.properties.sheetId,
                            title: 'Instructions'
                        },
                        fields: 'title'
                    }
                }]
            };
            await apiWriteRequest(`${id}:batchUpdate`, request);
        }
    }

    // Add instructions to the Instructions sheet
    const instructions = [
        ['Workout Tracker - Data Format'],
        [''],
        ['Each worksheet tab represents a workout date (format: MM/DD/YYYY)'],
        [''],
        ['Column A: Exercise Name'],
        ['Column B: Weight (can be comma-separated for multiple sets)'],
        ['Column C: Number of Sets'],
        ['Column D: Reps (can be comma-separated for multiple sets)'],
        ['Column E: RPE/Effort (easy, moderate, hard)'],
        [''],
        ['Example:'],
        ['Bench Press', '135, 155, 175', '3', '10, 8, 6', 'easy, moderate, hard']
    ];

    const sheetName = names.includes('Sheet1') ? 'Instructions' : (names.includes('Instructions') ? 'Instructions' : names[0]);

    try {
        await appendRows(sheetName, instructions, id);
    } catch (e) {
        console.warn('Could not add instructions:', e);
    }

    return { success: true };
}

/**
 * Create a brand new Google Spreadsheet
 * Note: This requires the user to use Google Drive API which needs additional scope
 * For now, we'll just initialize an existing spreadsheet
 * @returns {Promise<string>} spreadsheet ID
 */
export async function createNewSpreadsheet() {
    // This would require drive.file scope
    // For now, prompt user to create manually and paste ID
    throw new Error('Please create a new Google Sheet manually and paste its ID in Settings');
}

