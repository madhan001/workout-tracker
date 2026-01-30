# Workout Tracker

[![CI](https://github.com/YOUR_USERNAME/workout-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/workout-tracker/actions/workflows/ci.yml)

A web application that connects to your Google Sheets workout log to visualize progress, track volume, analyze muscle groups, and monitor personal records.

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

Tests run automatically on every push and pull request via GitHub Actions.

## Setup Instructions

### 1. Google Cloud Project Setup

To use this app with your own Google Sheets data, you need to set up Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API" and enable it
4. Configure OAuth Consent Screen:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" user type
   - Fill in the required fields (app name, user support email, etc.)
   - Add scope: `https://www.googleapis.com/auth/spreadsheets.readonly`
5. Create OAuth Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add **Authorized JavaScript origins**: `http://localhost:8080` (or your server URL)
   - Copy the Client ID

### 2. Configure the App

1. Open `src/services/googleAuth.js`
2. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID

### 3. Run the App

You can run this app with any static file server. For example:

```bash
# Using Python
cd workout-tracker
python3 -m http.server 8080

# Using Node.js (if you have npx)
npx serve .

# Using PHP
php -S localhost:8080
```

Then open http://localhost:8080 in your browser.

## Demo Mode

If you haven't configured Google OAuth yet, you can still test the app! Click "Sign In" to load sample workout data and explore all features.

## Features

- **Dashboard Overview**: Quick stats, volume chart, and muscle group breakdown
- **Workout History**: Browse all workouts with detailed exercise data
- **Muscle Analysis**: See which muscles you're training and their relative volume
- **Personal Records**: Track your max weights for each exercise
- **Exercise Mapping**: Customize which muscles each exercise targets
- **Specific Muscle Groups**: Fine-grained targeting (front delt, middle delt, rear delt, etc.)

## Your Spreadsheet Format

The app expects your Google Sheet to have:
- Each worksheet named as a date (MM/DD/YYYY format)
- Columns: Exercise Name | Sets (comma-separated) | Max Weight | Reps (comma-separated) | Volume
