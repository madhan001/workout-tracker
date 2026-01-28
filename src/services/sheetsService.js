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
