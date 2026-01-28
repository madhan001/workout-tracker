/**
 * Google OAuth 2.0 Authentication Service
 * Handles sign-in, sign-out, and token management
 */

// Configuration - User needs to replace with their own credentials
const CONFIG = {
    // Replace with your Google Cloud project client ID
    CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
    // Google Sheets API scope (read-only)
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    // Discovery doc for Sheets API
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4'
};

let tokenClient = null;
let accessToken = null;

/**
 * Initialize the Google Identity Services library
 * @returns {Promise<void>}
 */
export async function initializeGoogleAuth() {
    return new Promise((resolve, reject) => {
        // Load the Google Identity Services script
        if (window.google?.accounts) {
            setupTokenClient();
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            setupTokenClient();
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(script);
    });
}

/**
 * Set up the token client for OAuth
 */
function setupTokenClient() {
    const clientId = getClientId();

    if (!clientId || clientId === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
        console.warn('Google OAuth Client ID not configured. Please set up credentials.');
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CONFIG.SCOPES,
        callback: handleTokenResponse,
    });
}

/**
 * Get client ID from localStorage or config
 * @returns {string}
 */
function getClientId() {
    return localStorage.getItem('google_client_id') || CONFIG.CLIENT_ID;
}

/**
 * Set client ID
 * @param {string} clientId
 */
export function setClientId(clientId) {
    localStorage.setItem('google_client_id', clientId);
    setupTokenClient();
}

/**
 * Handle the token response from Google
 * @param {Object} response
 */
function handleTokenResponse(response) {
    if (response.error) {
        console.error('Token error:', response.error);
        window.dispatchEvent(new CustomEvent('auth-error', { detail: response.error }));
        return;
    }

    accessToken = response.access_token;

    // Store token expiry
    const expiresIn = response.expires_in || 3600;
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem('token_expiry', expiryTime.toString());

    // Fetch user info
    fetchUserInfo().then(userInfo => {
        window.dispatchEvent(new CustomEvent('auth-success', { detail: userInfo }));
    });
}

/**
 * Prompt user to sign in with Google
 * @returns {Promise<void>}
 */
export function signIn() {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject(new Error('OAuth not initialized. Please configure your Google Client ID.'));
            return;
        }

        // Set up one-time event listeners
        const handleSuccess = (e) => {
            window.removeEventListener('auth-success', handleSuccess);
            window.removeEventListener('auth-error', handleError);
            resolve(e.detail);
        };

        const handleError = (e) => {
            window.removeEventListener('auth-success', handleSuccess);
            window.removeEventListener('auth-error', handleError);
            reject(new Error(e.detail));
        };

        window.addEventListener('auth-success', handleSuccess);
        window.addEventListener('auth-error', handleError);

        // Request access token (opens Google popup)
        tokenClient.requestAccessToken();
    });
}

/**
 * Sign out the user
 */
export function signOut() {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken);
    }

    accessToken = null;
    localStorage.removeItem('token_expiry');

    window.dispatchEvent(new CustomEvent('auth-signout'));
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
    if (!accessToken) return false;

    const expiry = localStorage.getItem('token_expiry');
    if (expiry && Date.now() > parseInt(expiry)) {
        accessToken = null;
        return false;
    }

    return true;
}

/**
 * Get the current access token
 * @returns {string|null}
 */
export function getAccessToken() {
    return accessToken;
}

/**
 * Fetch user information from Google
 * @returns {Promise<Object>}
 */
async function fetchUserInfo() {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user info');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching user info:', error);
        return { name: 'User', picture: '' };
    }
}

/**
 * Check if OAuth is properly configured
 * @returns {boolean}
 */
export function isOAuthConfigured() {
    const clientId = getClientId();
    return clientId && clientId !== 'YOUR_CLIENT_ID.apps.googleusercontent.com';
}
