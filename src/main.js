/**
 * Workout Tracker - Main Application Entry Point
 */

import { initializeGoogleAuth, signIn, signOut, isAuthenticated, isOAuthConfigured } from './services/googleAuth.js';
import { fetchAllWorkouts, getSpreadsheetId, setSpreadsheetId } from './services/sheetsService.js';
import {
    sortWorkoutsByDate,
    filterWorkoutsByDateRange,
    calculateStats,
    calculateMuscleVolume,
    formatDate,
    formatNumber,
    calculateExerciseHistory,
    calculateChange
} from './utils/dataParser.js';
import {
    MUSCLE_GROUPS,
    getMuscleDisplayName,
    getMuscleColor,
    getMusclesByCategory,
    getMuscleGroups
} from './utils/muscleMapping.js';
import {
    getIntervalsCredentials,
    saveIntervalsCredentials,
    isIntervalsConfigured,
    testConnection,
    getWorkoutHRData,
    generateDemoHRData
} from './services/intervalsService.js';
import {
    detectHRPeaks,
    analyzeWorkoutHR
} from './utils/dataParser.js';

// Application State
const state = {
    workouts: [],
    filteredWorkouts: [],
    dateRange: 30,
    currentView: 'overview',
    selectedWorkout: null,
    comparisonBasis: 'previous', // 'previous', 'oneWeek', 'twoWeek', 'fourWeek'
    customMappings: {},
    customMuscleGroups: [],
    charts: {},
    userInfo: null,
    intervalsConfigured: false,
    currentHRData: null
};

// DOM Elements
const elements = {
    authScreen: document.getElementById('auth-screen'),
    dashboard: document.getElementById('dashboard'),
    loadingOverlay: document.getElementById('loading-overlay'),
    signinBtn: document.getElementById('google-signin-btn'),
    signoutBtn: document.getElementById('signout-btn'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    dateRangeSelect: document.getElementById('date-range-select'),
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),
    // Stats
    statWorkouts: document.getElementById('stat-workouts'),
    statVolume: document.getElementById('stat-volume'),
    statExercises: document.getElementById('stat-exercises'),
    statPRs: document.getElementById('stat-prs'),
    // Charts
    volumeChart: document.getElementById('volume-chart'),
    muscleChart: document.getElementById('muscle-chart'),
    // Lists
    recentWorkouts: document.getElementById('recent-workouts'),
    workoutCalendar: document.getElementById('workout-calendar'),
    workoutDetails: document.getElementById('workout-details'),
    muscleGrid: document.getElementById('muscle-grid'),
    recordsTbody: document.getElementById('records-tbody'),
    // Settings
    spreadsheetIdInput: document.getElementById('spreadsheet-id'),
    saveSpreadsheetBtn: document.getElementById('save-spreadsheet'),
    mappingList: document.getElementById('mapping-list'),
    addExerciseBtn: document.getElementById('add-exercise'),
    muscleGroupsList: document.getElementById('muscle-groups-list'),
    addMuscleGroupBtn: document.getElementById('add-muscle-group'),
    // Modal
    mappingModal: document.getElementById('mapping-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalExerciseName: document.getElementById('modal-exercise-name'),
    muscleCheckboxes: document.getElementById('muscle-checkboxes'),
    modalClose: document.getElementById('modal-close'),
    modalCancel: document.getElementById('modal-cancel'),
    modalSave: document.getElementById('modal-save'),
    // intervals.icu
    intervalsApiKey: document.getElementById('intervals-api-key'),
    intervalsAthleteId: document.getElementById('intervals-athlete-id'),
    testIntervalsBtn: document.getElementById('test-intervals'),
    saveIntervalsBtn: document.getElementById('save-intervals'),
    intervalsStatus: document.getElementById('intervals-status'),
    // HR Chart
    hrChartContainer: document.getElementById('hr-chart-container'),
    hrStatsSummary: document.getElementById('hr-stats-summary'),
    hrChart: document.getElementById('hr-chart'),
    hrPeaksLegend: document.getElementById('hr-peaks-legend')
};

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing Workout Tracker...');

    // Load saved settings
    loadSettings();

    // Set up event listeners
    setupEventListeners();

    // Initialize Google Auth
    try {
        await initializeGoogleAuth();

        // Check for demo mode or real auth
        if (!isOAuthConfigured()) {
            console.log('OAuth not configured - running in demo mode');
            showDemoModeNotice();
        }
    } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
    }
}

/**
 * Load saved settings from localStorage
 */
function loadSettings() {
    // Load custom mappings
    const savedMappings = localStorage.getItem('custom_mappings');
    if (savedMappings) {
        state.customMappings = JSON.parse(savedMappings);
    }

    // Load custom muscle groups
    const savedMuscles = localStorage.getItem('custom_muscle_groups');
    if (savedMuscles) {
        state.customMuscleGroups = JSON.parse(savedMuscles);
    }

    // Load spreadsheet ID
    if (elements.spreadsheetIdInput) {
        elements.spreadsheetIdInput.value = getSpreadsheetId();
    }

    // Load intervals.icu credentials
    const { apiKey, athleteId } = getIntervalsCredentials();
    state.intervalsConfigured = isIntervalsConfigured();
    if (elements.intervalsApiKey && apiKey) {
        elements.intervalsApiKey.value = apiKey;
    }
    if (elements.intervalsAthleteId && athleteId) {
        elements.intervalsAthleteId.value = athleteId;
    }
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
    localStorage.setItem('custom_mappings', JSON.stringify(state.customMappings));
    localStorage.setItem('custom_muscle_groups', JSON.stringify(state.customMuscleGroups));
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Sign in button
    elements.signinBtn?.addEventListener('click', handleSignIn);

    // Sign out button
    elements.signoutBtn?.addEventListener('click', handleSignOut);

    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => handleNavigation(item.dataset.view));
    });

    // Date range filter
    elements.dateRangeSelect?.addEventListener('change', handleDateRangeChange);

    // Settings
    elements.saveSpreadsheetBtn?.addEventListener('click', handleSaveSpreadsheet);
    elements.addExerciseBtn?.addEventListener('click', () => openMappingModal());
    elements.addMuscleGroupBtn?.addEventListener('click', handleAddMuscleGroup);

    // Modal
    elements.modalClose?.addEventListener('click', closeMappingModal);
    elements.modalCancel?.addEventListener('click', closeMappingModal);
    elements.modalSave?.addEventListener('click', handleSaveMapping);

    // Close modal on outside click
    elements.mappingModal?.addEventListener('click', (e) => {
        if (e.target === elements.mappingModal) {
            closeMappingModal();
        }
    });

    // intervals.icu settings
    elements.testIntervalsBtn?.addEventListener('click', handleTestIntervalsConnection);
    elements.saveIntervalsBtn?.addEventListener('click', handleSaveIntervalsSettings);

    // Auth events
    window.addEventListener('auth-success', handleAuthSuccess);
    window.addEventListener('auth-signout', handleAuthSignout);
}

/**
 * Handle sign in
 */
async function handleSignIn() {
    // Check if OAuth is configured
    if (!isOAuthConfigured()) {
        // Run in demo mode with sample data
        loadDemoData();
        return;
    }

    try {
        await signIn();
    } catch (error) {
        console.error('Sign in failed:', error);
        alert('Sign in failed. Please try again.');
    }
}

/**
 * Handle sign out
 */
function handleSignOut() {
    signOut();
}

/**
 * Handle successful authentication
 */
async function handleAuthSuccess(event) {
    const userInfo = event.detail;
    state.userInfo = userInfo;

    // Update UI
    elements.userAvatar.src = userInfo.picture || '';
    elements.userName.textContent = userInfo.name || 'User';

    // Switch to dashboard
    showDashboard();

    // Load workout data
    await loadWorkoutData();
}

/**
 * Handle sign out
 */
function handleAuthSignout() {
    state.userInfo = null;
    state.workouts = [];
    state.filteredWorkouts = [];

    // Switch to auth screen
    showAuthScreen();
}

/**
 * Show the auth screen
 */
function showAuthScreen() {
    elements.authScreen.classList.remove('hidden');
    elements.dashboard.classList.add('hidden');
}

/**
 * Show the dashboard
 */
function showDashboard() {
    elements.authScreen.classList.add('hidden');
    elements.dashboard.classList.remove('hidden');
}

/**
 * Show loading overlay
 */
function showLoading() {
    elements.loadingOverlay.classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

/**
 * Load workout data from Google Sheets
 */
async function loadWorkoutData() {
    showLoading();

    try {
        const workouts = await fetchAllWorkouts(null, state.customMappings, (progress) => {
            console.log(`Loading: ${progress.current}/${progress.total} - ${progress.currentSheet}`);
        });

        state.workouts = sortWorkoutsByDate(workouts);
        handleDateRangeChange();

        console.log(`Loaded ${state.workouts.length} workouts`);
    } catch (error) {
        console.error('Error loading workout data:', error);
        alert('Failed to load workout data. Please check your spreadsheet ID and try again.');
    } finally {
        hideLoading();
    }
}

/**
 * Handle date range change
 */
function handleDateRangeChange() {
    const value = elements.dateRangeSelect?.value || '30';
    state.dateRange = value === 'all' ? 0 : parseInt(value);
    state.filteredWorkouts = filterWorkoutsByDateRange(state.workouts, state.dateRange);

    updateDashboard();
}

/**
 * Handle navigation between views
 */
function handleNavigation(view) {
    state.currentView = view;

    // Update nav items
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    // Update views
    elements.views.forEach(v => {
        v.classList.toggle('active', v.id === `view-${view}`);
    });

    // Refresh current view
    switch (view) {
        case 'overview':
            updateOverview();
            break;
        case 'workouts':
            updateWorkoutsView();
            break;
        case 'muscles':
            updateMusclesView();
            break;
        case 'records':
            updateRecordsView();
            break;
        case 'settings':
            updateSettingsView();
            break;
    }
}

/**
 * Update entire dashboard
 */
function updateDashboard() {
    updateOverview();

    if (state.currentView === 'workouts') {
        updateWorkoutsView();
    } else if (state.currentView === 'muscles') {
        updateMusclesView();
    } else if (state.currentView === 'records') {
        updateRecordsView();
    }
}

/**
 * Update overview stats and charts
 */
function updateOverview() {
    const workouts = state.filteredWorkouts;
    const stats = calculateStats(workouts);

    // Update stat cards
    elements.statWorkouts.textContent = formatNumber(stats.totalWorkouts);
    elements.statVolume.textContent = formatNumber(stats.totalVolume);
    elements.statExercises.textContent = formatNumber(stats.totalExercises);
    elements.statPRs.textContent = formatNumber(stats.prCount);

    // Update charts
    updateVolumeChart(workouts);
    updateMuscleChart(workouts);

    // Update recent workouts
    updateRecentWorkouts(workouts.slice(0, 5));
}

/**
 * Update volume chart
 */
function updateVolumeChart(workouts) {
    const ctx = elements.volumeChart?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (state.charts.volume) {
        state.charts.volume.destroy();
    }

    // Prepare data (oldest first for chart)
    const chartWorkouts = [...workouts].reverse().slice(-14);

    const labels = chartWorkouts.map(w => {
        const date = w.dateObject;
        return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : w.date;
    });

    const data = chartWorkouts.map(w => w.totalVolume);

    state.charts.volume = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Volume (lbs)',
                data,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#a1a1aa',
                        callback: (value) => formatNumber(value)
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#a1a1aa'
                    }
                }
            }
        }
    });
}

/**
 * Update muscle chart
 */
function updateMuscleChart(workouts) {
    const ctx = elements.muscleChart?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (state.charts.muscle) {
        state.charts.muscle.destroy();
    }

    const muscleVolume = calculateMuscleVolume(workouts);

    // Get top 8 muscle groups by volume
    const sortedMuscles = Object.entries(muscleVolume)
        .sort((a, b) => b[1].volume - a[1].volume)
        .slice(0, 8);

    const labels = sortedMuscles.map(([id]) => getMuscleDisplayName(id));
    const data = sortedMuscles.map(([, info]) => info.volume);
    const colors = sortedMuscles.map(([id]) => getMuscleColor(id));

    state.charts.muscle = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: '#16161a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#a1a1aa',
                        padding: 12,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update recent workouts list
 */
function updateRecentWorkouts(workouts) {
    if (!elements.recentWorkouts) return;

    if (workouts.length === 0) {
        elements.recentWorkouts.innerHTML = '<p class="empty-state">No workouts found</p>';
        return;
    }

    elements.recentWorkouts.innerHTML = workouts.map(workout => `
        <div class="workout-card" data-date="${workout.date}">
            <div class="workout-card-header">
                <span class="workout-date">${formatDate(workout.dateObject) || workout.date}</span>
                <span class="workout-volume">${formatNumber(workout.totalVolume)} lbs</span>
            </div>
            <p class="workout-exercises">${workout.exercises.map(e => e.name).join(', ')}</p>
        </div>
    `).join('');

    // Add click handlers
    elements.recentWorkouts.querySelectorAll('.workout-card').forEach(card => {
        card.addEventListener('click', () => {
            handleNavigation('workouts');
            selectWorkout(card.dataset.date);
        });
    });
}

/**
 * Update workouts view
 */
function updateWorkoutsView() {
    if (!elements.workoutCalendar) return;

    const workouts = state.filteredWorkouts;

    elements.workoutCalendar.innerHTML = workouts.map(workout => `
        <div class="calendar-date" data-date="${workout.date}">
            <div class="date">${workout.dateObject ? workout.dateObject.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : workout.date}</div>
            <div class="volume">${formatNumber(workout.totalVolume)} lbs</div>
        </div>
    `).join('');

    // Add click handlers
    elements.workoutCalendar.querySelectorAll('.calendar-date').forEach(card => {
        card.addEventListener('click', () => selectWorkout(card.dataset.date));
    });
}

/**
 * Select and display a workout
 */
function selectWorkout(date) {
    state.selectedWorkout = date;

    // Update selected state
    elements.workoutCalendar?.querySelectorAll('.calendar-date').forEach(card => {
        card.classList.toggle('selected', card.dataset.date === date);
    });

    // Find workout
    const workout = state.workouts.find(w => w.date === date);
    if (!workout) return;

    // Calculate historical data for each exercise
    const exerciseComparisons = workout.exercises.map(ex => {
        const history = calculateExerciseHistory(ex.name, workout.dateObject, state.workouts);
        return { exercise: ex, history };
    });

    // Display workout details (no dropdown - percentages shown in each comparison box)
    elements.workoutDetails.innerHTML = `
        <h3>${formatDate(workout.dateObject) || workout.date}</h3>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-md);">
            Total Volume: ${formatNumber(workout.totalVolume)} lbs • ${workout.exercises.length} exercises
        </p>
        
        ${exerciseComparisons.map(({ exercise, history }) => renderExerciseWithComparison(exercise, history)).join('')}
    `;

    // Render HR chart for this workout
    renderHRChart(workout);
}

/**
 * Render exercise with historical comparison
 */
function renderExerciseWithComparison(exercise, history) {
    // Calculate change for each comparison period
    const prevChange = history.previousSession
        ? calculateChange(exercise.volume, history.previousSession.volume)
        : null;
    const oneWeekChange = history.oneWeekAvg.volume
        ? calculateChange(exercise.volume, history.oneWeekAvg.volume)
        : null;
    const twoWeekChange = history.twoWeekAvg.volume
        ? calculateChange(exercise.volume, history.twoWeekAvg.volume)
        : null;
    const fourWeekChange = history.fourWeekAvg.volume
        ? calculateChange(exercise.volume, history.fourWeekAvg.volume)
        : null;

    const getChangeIndicator = (change) => {
        if (!change) return '';
        if (change.direction === 'up') {
            return `<span class="change-indicator-inline up">↑${change.display}</span>`;
        } else if (change.direction === 'down') {
            return `<span class="change-indicator-inline down">↓${change.display}</span>`;
        }
        return `<span class="change-indicator-inline neutral">→ 0%</span>`;
    };

    return `
        <div class="exercise-comparison-card">
            <div class="exercise-header">
                <span class="exercise-name">${exercise.name}</span>
                <span class="exercise-volume-current">${formatNumber(exercise.volume)} lbs</span>
            </div>
            <div class="exercise-details">
                <div class="exercise-sets-row">
                    <span class="label">Sets:</span> ${exercise.sets.join(', ') || '-'}
                    <span class="sep">|</span>
                    <span class="label">Reps:</span> ${exercise.reps.join(', ') || '-'}
                    <span class="sep">|</span>
                    <span class="label">Max:</span> ${exercise.maxWeight || '-'} lbs
                </div>
            </div>
            <div class="comparison-grid">
                <div class="comparison-item">
                    <span class="comparison-label">Previous</span>
                    ${history.previousSession
            ? `<span class="comparison-value">${formatNumber(history.previousSession.volume)}</span>
                           ${getChangeIndicator(prevChange)}
                           <span class="comparison-date">${history.previousSession.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`
            : '<span class="comparison-value na">—</span>'
        }
                </div>
                <div class="comparison-item">
                    <span class="comparison-label">1 Week Avg</span>
                    ${history.oneWeekAvg.volume !== null
            ? `<span class="comparison-value">${formatNumber(history.oneWeekAvg.volume)}</span>
                           ${getChangeIndicator(oneWeekChange)}
                           <span class="comparison-sessions">${history.oneWeekAvg.sessions} sessions</span>`
            : '<span class="comparison-value na">—</span><span class="comparison-sessions">0 sessions</span>'
        }
                </div>
                <div class="comparison-item">
                    <span class="comparison-label">2 Week Avg</span>
                    ${history.twoWeekAvg.volume !== null
            ? `<span class="comparison-value">${formatNumber(history.twoWeekAvg.volume)}</span>
                           ${getChangeIndicator(twoWeekChange)}
                           <span class="comparison-sessions">${history.twoWeekAvg.sessions} sessions</span>`
            : '<span class="comparison-value na">—</span><span class="comparison-sessions">0 sessions</span>'
        }
                </div>
                <div class="comparison-item">
                    <span class="comparison-label">4 Week Avg</span>
                    ${history.fourWeekAvg.volume !== null
            ? `<span class="comparison-value">${formatNumber(history.fourWeekAvg.volume)}</span>
                           ${getChangeIndicator(fourWeekChange)}
                           <span class="comparison-sessions">${history.fourWeekAvg.sessions} sessions</span>`
            : '<span class="comparison-value na">—</span><span class="comparison-sessions">0 sessions</span>'
        }
                </div>
            </div>
        </div>
    `;
}

/**
 * Update muscles view
 */
function updateMusclesView() {
    if (!elements.muscleGrid) return;

    const muscleVolume = calculateMuscleVolume(state.filteredWorkouts);
    const maxVolume = Math.max(...Object.values(muscleVolume).map(m => m.volume), 1);

    const sortedMuscles = Object.entries(muscleVolume)
        .sort((a, b) => b[1].volume - a[1].volume);

    elements.muscleGrid.innerHTML = sortedMuscles.map(([id, info]) => {
        const percentage = (info.volume / maxVolume) * 100;
        const color = getMuscleColor(id);

        return `
        < div class="muscle-card" >
                <div class="muscle-card-header">
                    <span class="muscle-name">${getMuscleDisplayName(id)}</span>
                    <span class="muscle-volume">${formatNumber(info.volume)} lbs</span>
                </div>
                <div class="muscle-bar">
                    <div class="muscle-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
                </div>
                <p class="muscle-exercises">${info.exercises.slice(0, 3).join(', ')}${info.exercises.length > 3 ? '...' : ''}</p>
            </div >
        `;
    }).join('');
}

/**
 * Update records view
 */
function updateRecordsView() {
    if (!elements.recordsTbody) return;

    const stats = calculateStats(state.workouts);
    const records = stats.personalRecords.sort((a, b) => b.weight - a.weight);

    elements.recordsTbody.innerHTML = records.map(pr => `
        < tr >
            <td>${pr.name}</td>
            <td><strong>${formatNumber(pr.weight)} lbs</strong></td>
            <td>${pr.date}</td>
        </tr >
        `).join('');
}

/**
 * Update settings view
 */
function updateSettingsView() {
    updateMappingsList();
    updateMuscleGroupsList();
}

/**
 * Update the exercise mappings list
 */
function updateMappingsList() {
    if (!elements.mappingList) return;

    // Combine default and custom mappings, with custom taking precedence
    const allMappings = { ...getMergedMappings() };

    const mappingEntries = Object.entries(allMappings)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(0, 50); // Limit to 50 for performance

    elements.mappingList.innerHTML = mappingEntries.map(([exercise, muscles]) => `
        <div class="mapping-item" data-exercise="${exercise}">
            <div>
                <span class="mapping-exercise">${exercise}</span>
                <div class="mapping-muscles">
                    ${muscles.map(m => `<span class="muscle-tag">${getMuscleDisplayName(m)}</span>`).join('')}
                </div>
            </div>
            <div class="mapping-actions">
                <button class="mapping-btn edit" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="mapping-btn delete" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
        `).join('');

    // Add event listeners
    elements.mappingList.querySelectorAll('.mapping-btn.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const exercise = e.target.closest('.mapping-item').dataset.exercise;
            openMappingModal(exercise);
        });
    });

    elements.mappingList.querySelectorAll('.mapping-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const exercise = e.target.closest('.mapping-item').dataset.exercise;
            delete state.customMappings[exercise];
            saveSettings();
            updateMappingsList();
        });
    });
}

/**
 * Get merged mappings (default + custom)
 */
function getMergedMappings() {
    // Import the default mappings dynamically
    const defaultMappings = {};

    // Build from exercises we've seen in the workouts
    state.workouts.forEach(workout => {
        workout.exercises.forEach(ex => {
            const name = ex.name.toLowerCase().trim();
            if (!defaultMappings[name] && ex.muscleGroups.length > 0) {
                defaultMappings[name] = ex.muscleGroups;
            }
        });
    });

    // Add custom mappings
    return { ...defaultMappings, ...state.customMappings };
}

/**
 * Update custom muscle groups list
 */
function updateMuscleGroupsList() {
    if (!elements.muscleGroupsList) return;

    const allMuscles = { ...MUSCLE_GROUPS };

    // Add custom muscle groups
    state.customMuscleGroups.forEach(m => {
        allMuscles[m.id] = m;
    });

    const categories = {};
    Object.entries(allMuscles).forEach(([id, info]) => {
        const cat = info.category || 'Custom';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({ id, ...info });
    });

    elements.muscleGroupsList.innerHTML = Object.entries(categories).map(([category, muscles]) => `
        < div style = "margin-bottom: var(--spacing-md);" >
            <strong style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">${category}</strong>
            <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-xs); margin-top: var(--spacing-xs);">
                ${muscles.map(m => `
                    <span class="muscle-group-tag" style="background: ${m.color}20; border: 1px solid ${m.color}40;">
                        ${m.name}
                    </span>
                `).join('')}
            </div>
        </div >
        `).join('');
}

/**
 * Open the mapping modal
 */
function openMappingModal(exerciseName = null) {
    state.editingExercise = exerciseName;

    elements.modalTitle.textContent = exerciseName ? 'Edit Exercise Mapping' : 'Add New Exercise';
    elements.modalExerciseName.value = exerciseName || '';

    // Populate muscle checkboxes
    const categories = getMusclesByCategory();
    let currentMuscles = [];

    if (exerciseName) {
        currentMuscles = getMuscleGroups(exerciseName, state.customMappings);
    }

    elements.muscleCheckboxes.innerHTML = Object.entries(categories).map(([category, muscles]) => `
        < div style = "grid-column: span 2; margin-top: var(--spacing-sm);" >
            <strong style="color: var(--color-text-secondary); font-size: var(--font-size-xs);">${category}</strong>
        </div >
        ${muscles.map(m => `
            <label class="muscle-checkbox">
                <input type="checkbox" name="muscle" value="${m.id}" ${currentMuscles.includes(m.id) ? 'checked' : ''}>
                <span>${m.name}</span>
            </label>
        `).join('')
        }
    `).join('');

    elements.mappingModal.classList.remove('hidden');
}

/**
 * Close the mapping modal
 */
function closeMappingModal() {
    elements.mappingModal.classList.add('hidden');
    state.editingExercise = null;
}

/**
 * Handle saving a mapping
 */
function handleSaveMapping() {
    const exerciseName = elements.modalExerciseName.value.trim().toLowerCase();
    if (!exerciseName) {
        alert('Please enter an exercise name');
        return;
    }

    const selectedMuscles = Array.from(
        elements.muscleCheckboxes.querySelectorAll('input[name="muscle"]:checked')
    ).map(cb => cb.value);

    if (selectedMuscles.length === 0) {
        alert('Please select at least one muscle group');
        return;
    }

    // If editing and name changed, remove old mapping
    if (state.editingExercise && state.editingExercise !== exerciseName) {
        delete state.customMappings[state.editingExercise];
    }

    state.customMappings[exerciseName] = selectedMuscles;
    saveSettings();

    closeMappingModal();
    updateMappingsList();
}

/**
 * Handle adding a custom muscle group
 */
function handleAddMuscleGroup() {
    const name = prompt('Enter muscle group name:');
    if (!name) return;

    const id = name.toLowerCase().replace(/\s+/g, '_');
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

    state.customMuscleGroups.push({
        id,
        name,
        category: 'Custom',
        color
    });

    saveSettings();
    updateMuscleGroupsList();
}

/**
 * Handle saving spreadsheet ID
 */
async function handleSaveSpreadsheet() {
    const id = elements.spreadsheetIdInput?.value.trim();
    if (!id) {
        alert('Please enter a spreadsheet ID');
        return;
    }

    setSpreadsheetId(id);
    await loadWorkoutData();
}

/**
 * Show demo mode notice
 */
function showDemoModeNotice() {
    const notice = document.createElement('p');
    notice.style.cssText = 'margin-top: var(--spacing-md); padding: var(--spacing-md); background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--color-accent-orange);';
    notice.innerHTML = '<strong>Demo Mode:</strong> Google OAuth not configured. Click Sign In to load sample data.';
    elements.signinBtn.parentElement.insertBefore(notice, elements.signinBtn.nextSibling);
}

/**
 * Load demo data (for testing without OAuth)
 */
function loadDemoData() {
    // Sample workout data with repeating exercises for comparison demo
    state.workouts = [
        {
            date: '01/28/2026',
            dateObject: new Date(2026, 0, 28),
            exercises: [
                { name: 'Bench press', sets: [195, 205, 215, 195], maxWeight: 215, reps: [8, 6, 5, 8], volume: 5670, muscleGroups: ['mid_chest', 'front_delt', 'triceps'] },
                { name: 'Leg press', sets: [320, 360, 400, 380], maxWeight: 400, reps: [12, 10, 8, 10], volume: 14600, muscleGroups: ['quads', 'glutes', 'hamstrings'] },
                { name: 'Squat', sets: [235, 255, 275, 235], maxWeight: 275, reps: [8, 6, 5, 10], volume: 7250, muscleGroups: ['quads', 'glutes', 'hamstrings', 'lower_back'] },
                { name: 'Div. Seated row', sets: [210, 210, 210, 210], maxWeight: 210, reps: [8, 8, 8, 8], volume: 6720, muscleGroups: ['lats', 'rhomboids', 'biceps'] },
                { name: 'Bicep curl', sets: [35, 40, 40, 35], maxWeight: 40, reps: [12, 10, 10, 12], volume: 1650, muscleGroups: ['biceps'] }
            ],
            totalVolume: 35890,
            exerciseCount: 5
        },
        {
            date: '01/25/2026',
            dateObject: new Date(2026, 0, 25),
            exercises: [
                { name: 'Bench press', sets: [185, 195, 205, 185], maxWeight: 205, reps: [8, 6, 5, 8], volume: 5130, muscleGroups: ['mid_chest', 'front_delt', 'triceps'] },
                { name: 'Incline press', sets: [135, 145, 145, 135], maxWeight: 145, reps: [10, 8, 8, 10], volume: 5040, muscleGroups: ['upper_chest', 'front_delt', 'triceps'] },
                { name: 'Squat', sets: [225, 245, 255, 225], maxWeight: 255, reps: [8, 6, 5, 10], volume: 6850, muscleGroups: ['quads', 'glutes', 'hamstrings', 'lower_back'] },
                { name: 'Pec fly', sets: [40, 45, 45, 40], maxWeight: 45, reps: [12, 12, 12, 12], volume: 2040, muscleGroups: ['mid_chest'] },
                { name: 'Bicep curl', sets: [30, 35, 35, 30], maxWeight: 35, reps: [12, 10, 10, 12], volume: 1430, muscleGroups: ['biceps'] }
            ],
            totalVolume: 20490,
            exerciseCount: 5
        },
        {
            date: '01/22/2026',
            dateObject: new Date(2026, 0, 22),
            exercises: [
                { name: 'Squat', sets: [225, 245, 265, 225], maxWeight: 265, reps: [8, 6, 5, 10], volume: 6920, muscleGroups: ['quads', 'glutes', 'hamstrings', 'lower_back'] },
                { name: 'Leg press', sets: [300, 340, 360, 340], maxWeight: 360, reps: [12, 12, 10, 10], volume: 14800, muscleGroups: ['quads', 'glutes', 'hamstrings'] },
                { name: 'Bench press', sets: [175, 185, 195, 175], maxWeight: 195, reps: [8, 8, 6, 8], volume: 4560, muscleGroups: ['mid_chest', 'front_delt', 'triceps'] },
                { name: 'Leg curl', sets: [80, 90, 90, 80], maxWeight: 90, reps: [12, 12, 12, 12], volume: 4080, muscleGroups: ['hamstrings'] },
                { name: 'Calf raise', sets: [200, 220, 220, 200], maxWeight: 220, reps: [15, 15, 15, 15], volume: 12600, muscleGroups: ['calves'] }
            ],
            totalVolume: 42960,
            exerciseCount: 5
        }
    ];

    state.userInfo = { name: 'Demo User', picture: '' };
    elements.userAvatar.src = '';
    elements.userName.textContent = 'Demo User';

    showDashboard();
    handleDateRangeChange();
}

// ============================================
// intervals.icu Integration Functions
// ============================================

/**
 * Handle test connection button
 */
async function handleTestIntervalsConnection() {
    const statusEl = elements.intervalsStatus;
    if (!statusEl) return;

    const apiKey = elements.intervalsApiKey?.value.trim();
    const athleteId = elements.intervalsAthleteId?.value.trim();

    if (!apiKey || !athleteId) {
        statusEl.className = 'connection-status error';
        statusEl.textContent = 'Please enter both API Key and Athlete ID';
        statusEl.classList.remove('hidden');
        return;
    }

    // Temporarily save credentials for test
    saveIntervalsCredentials(apiKey, athleteId);

    statusEl.className = 'connection-status loading';
    statusEl.textContent = 'Testing connection...';
    statusEl.classList.remove('hidden');

    const result = await testConnection();

    if (result.success) {
        statusEl.className = 'connection-status success';
        statusEl.textContent = `✓ Connected as ${result.athlete.name}`;
        state.intervalsConfigured = true;
    } else {
        statusEl.className = 'connection-status error';
        statusEl.textContent = `✗ ${result.error}`;
    }
}

/**
 * Handle save intervals.icu settings
 */
function handleSaveIntervalsSettings() {
    const apiKey = elements.intervalsApiKey?.value.trim();
    const athleteId = elements.intervalsAthleteId?.value.trim();

    saveIntervalsCredentials(apiKey, athleteId);
    state.intervalsConfigured = isIntervalsConfigured();

    const statusEl = elements.intervalsStatus;
    if (statusEl) {
        statusEl.className = 'connection-status success';
        statusEl.textContent = '✓ Settings saved';
        statusEl.classList.remove('hidden');
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

/**
 * Render HR chart for a workout
 */
async function renderHRChart(workout) {
    const container = elements.hrChartContainer;
    if (!container) return;

    // Get HR data (real or demo)
    let hrData;
    const workoutDate = new Date(workout.date);

    if (state.intervalsConfigured) {
        hrData = await getWorkoutHRData(workoutDate);
    } else {
        // Use demo data if not configured
        const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        hrData = generateDemoHRData(60, totalSets);
    }

    if (!hrData || !hrData.available) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    state.currentHRData = hrData;

    // Render stats summary
    const { streams, isDemo } = hrData;
    const avgHR = Math.round(streams.heartrate.reduce((a, b) => a + b, 0) / streams.heartrate.length);
    const maxHR = Math.round(Math.max(...streams.heartrate));
    const peaks = detectHRPeaks(streams.heartrate, streams.time);

    elements.hrStatsSummary.innerHTML = `
        <div class="hr-stat">
            <span class="hr-stat-label">Average HR</span>
            <span class="hr-stat-value avg">${avgHR} bpm</span>
        </div>
        <div class="hr-stat">
            <span class="hr-stat-label">Max HR</span>
            <span class="hr-stat-value max">${maxHR} bpm</span>
        </div>
        <div class="hr-stat">
            <span class="hr-stat-label">Peaks Detected</span>
            <span class="hr-stat-value peaks">${peaks.length}</span>
        </div>
        ${isDemo ? '<span class="hr-demo-badge">Demo Data</span>' : ''}
    `;

    // Destroy existing chart if any
    if (state.charts.hrChart) {
        state.charts.hrChart.destroy();
    }

    // Prepare chart data - downsample for performance
    const step = Math.max(1, Math.floor(streams.time.length / 300));
    const labels = [];
    const data = [];

    for (let i = 0; i < streams.time.length; i += step) {
        const mins = Math.floor(streams.time[i] / 60);
        const secs = streams.time[i] % 60;
        labels.push(`${mins}:${secs.toString().padStart(2, '0')}`);
        data.push(streams.heartrate[i]);
    }

    // Create peak annotations
    const peakAnnotations = peaks.map((peak, i) => ({
        type: 'point',
        xValue: Math.floor(peak.time / 60) + ':' + (peak.time % 60).toString().padStart(2, '0'),
        yValue: peak.hr,
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        radius: 6,
        borderWidth: 2,
        borderColor: '#fff'
    }));

    // Create chart
    const ctx = elements.hrChart.getContext('2d');

    // Create peak data points for overlay
    const peakLabels = peaks.map(peak => {
        const mins = Math.floor(peak.time / 60);
        const secs = peak.time % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    });

    // Map peaks to the downsampled data indices
    const peakDataPoints = new Array(data.length).fill(null);
    peaks.forEach(peak => {
        // Find the closest index in our downsampled data
        const peakTimeLabel = `${Math.floor(peak.time / 60)}:${(peak.time % 60).toString().padStart(2, '0')}`;
        const idx = labels.findIndex(label => label === peakTimeLabel);
        if (idx !== -1) {
            peakDataPoints[idx] = peak.hr;
        }
    });

    state.charts.hrChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Heart Rate',
                    data,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2,
                    order: 1
                },
                {
                    label: 'HR Peaks',
                    data: peakDataPoints,
                    borderColor: 'transparent',
                    backgroundColor: '#8b5cf6',
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    pointStyle: 'circle',
                    showLine: false,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#9ca3af',
                        usePointStyle: true,
                        filter: (item) => item.text !== 'Heart Rate' || item.datasetIndex === 1
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            if (context.datasetIndex === 1 && context.raw !== null) {
                                return `Peak: ${Math.round(context.raw)} bpm`;
                            }
                            return `${Math.round(context.raw)} bpm`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Time (mm:ss)', color: '#9ca3af' },
                    ticks: { color: '#9ca3af', maxTicksLimit: 10 },
                    grid: { color: 'rgba(75, 85, 99, 0.2)' }
                },
                y: {
                    title: { display: true, text: 'BPM', color: '#9ca3af' },
                    ticks: { color: '#9ca3af' },
                    grid: { color: 'rgba(75, 85, 99, 0.2)' },
                    min: Math.max(50, Math.min(...data) - 10)
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // Render peaks legend with correlation info
    const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    elements.hrPeaksLegend.innerHTML = peaks.length > 0
        ? `<span class="hr-peak-marker">${peaks.length} HR peaks detected</span>
           <span style="color: var(--color-text-muted);">|</span>
           <span>${totalSets} total sets in workout</span>
           <span style="color: var(--color-text-muted);">|</span>
           <span style="color: ${Math.abs(peaks.length - totalSets) <= 3 ? '#22c55e' : '#fbbf24'};">
               ${Math.abs(peaks.length - totalSets) <= 3 ? '✓ Good correlation' : '⚠ Approximate match'}
           </span>`
        : '<span>No significant HR peaks detected</span>';
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
