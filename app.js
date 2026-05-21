/**
 * Hausmeister Zeiterfassung - Core JavaScript Logic
 */

// --- Constants & Categories Definition ---
const CATEGORIES = {
  garten: { label: 'Gartenarbeit', emoji: '🌿', colorVar: '--color-garten' },
  reparatur: { label: 'Reparaturen', emoji: '🛠️', colorVar: '--color-reparatur' },
  wartung: { label: 'Wartung & Inspektion', emoji: '🔧', colorVar: '--color-wartung' },
  reinigung: { label: 'Reinigung & Pflege', emoji: '🧹', colorVar: '--color-reinigung' },
  muell: { label: 'Mülltonnen-Dienst', emoji: '🗑️', colorVar: '--color-muell' },
  winter: { label: 'Winterdienst', emoji: '❄️', colorVar: '--color-winter' },
  sonstiges: { label: 'Sonstiges', emoji: '📝', colorVar: '--color-sonstiges' }
};

// --- App State ---
let state = {
  entries: [],
  activeTimer: null, // { startTime: timestamp, category: string }
  currentTab: 'dashboard',
  filters: {
    month: 'all', // 'YYYY-MM' or 'all'
    category: 'all'
  }
};

// --- DOM Elements ---
const DOM = {
  tabs: document.querySelectorAll('.nav-tab'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  
  // Timer Elements
  timerHours: document.getElementById('timer-hours'),
  timerMinutes: document.getElementById('timer-minutes'),
  timerSeconds: document.getElementById('timer-seconds'),
  timerCategory: document.getElementById('timer-category'),
  btnTimerToggle: document.getElementById('btn-timer-toggle'),
  timerStateLabel: document.getElementById('timer-state-label'),
  quickStatusBadge: document.getElementById('quick-status-badge'),
  
  // Quick Add & Manual Add
  quickAddButtons: document.querySelectorAll('.quick-add-btn'),
  btnOpenManualDialog: document.getElementById('btn-open-manual-dialog'),
  
  // Dialog / Modal
  dialogLogEntry: document.getElementById('dialog-log-entry'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnCancelModal: document.getElementById('btn-cancel-modal'),
  formLogEntry: document.getElementById('form-log-entry'),
  modalTitle: document.getElementById('modal-title'),
  entryIdField: document.getElementById('entry-id'),
  formCategory: document.getElementById('form-category'),
  formDate: document.getElementById('form-date'),
  formStart: document.getElementById('form-start'),
  formEnd: document.getElementById('form-end'),
  formPause: document.getElementById('form-pause'),
  formNotes: document.getElementById('form-notes'),
  
  // History Elements
  filterMonth: document.getElementById('filter-month'),
  filterCategory: document.getElementById('filter-category'),
  statTotalHours: document.getElementById('stat-total-hours'),
  statTotalCount: document.getElementById('stat-total-count'),
  entriesContainer: document.getElementById('entries-container'),
  btnPrintReport: document.getElementById('btn-print-report'),
  
  // Settings Elements
  btnExportCsv: document.getElementById('btn-export-csv'),
  importFileInput: document.getElementById('import-file'),
  btnToggleTheme: document.getElementById('btn-toggle-theme'),
  btnClearData: document.getElementById('btn-clear-data'),
  pwaOfflineStatus: document.getElementById('pwa-offline-status'),
  
  // Print container
  printContainer: document.getElementById('print-container'),
  printReportPeriod: document.getElementById('print-report-period'),
  printReportDate: document.getElementById('print-report-date'),
  printTotalHours: document.getElementById('print-total-hours'),
  printTableBody: document.getElementById('print-table-body')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupEventListeners();
  initAppTheme();
  registerServiceWorker();
  
  // Set default values for manual form
  resetFormToDefaults();
  
  // Initialize View
  renderAll();
});

// --- Service Worker Registration ---
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.log('Service Worker erfolgreich registriert:', reg.scope);
        DOM.pwaOfflineStatus.textContent = 'Bereit (Offline-Modus)';
        DOM.pwaOfflineStatus.className = 'pwa-status online';
      })
      .catch(err => {
        console.warn('Service Worker Registrierung fehlgeschlagen:', err);
        DOM.pwaOfflineStatus.textContent = 'Nicht bereit';
        DOM.pwaOfflineStatus.className = 'pwa-status offline';
      });
  } else {
    DOM.pwaOfflineStatus.textContent = 'Nicht unterstützt';
    DOM.pwaOfflineStatus.className = 'pwa-status offline';
  }
}

// --- Theme Management ---
function initAppTheme() {
  const currentTheme = localStorage.getItem('color-scheme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('color-scheme', newTheme);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Navigation Tabs Switcher
  DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
  
  // Timer Events
  DOM.btnTimerToggle.addEventListener('click', handleTimerToggle);
  
  // Quick Add Buttons
  DOM.quickAddButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category');
      openManualLogWithCategory(category);
    });
  });
  
  // Dialog Trigger & Actions
  DOM.btnOpenManualDialog.addEventListener('click', () => openModal(false));
  DOM.btnCloseModal.addEventListener('click', closeModal);
  DOM.btnCancelModal.addEventListener('click', closeModal);
  DOM.formLogEntry.addEventListener('submit', handleFormSubmit);
  
  // Filter Updates
  DOM.filterMonth.addEventListener('change', (e) => {
    state.filters.month = e.target.value;
    renderHistory();
  });
  DOM.filterCategory.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    renderHistory();
  });
  
  // Action Buttons
  DOM.btnPrintReport.addEventListener('click', handlePrintReport);
  DOM.btnExportCsv.addEventListener('click', exportToCSV);
  DOM.importFileInput.addEventListener('change', handleImportFile);
  DOM.btnToggleTheme.addEventListener('click', toggleTheme);
  DOM.btnClearData.addEventListener('click', clearAllData);
  
  // Handle click outside modal card to close
  DOM.dialogLogEntry.addEventListener('click', (e) => {
    if (e.target === DOM.dialogLogEntry) {
      closeModal();
    }
  });
}

// --- Data Layer (LocalStorage) ---
function loadData() {
  const storedEntries = localStorage.getItem('zeitkonto_entries');
  if (storedEntries) {
    try {
      state.entries = JSON.parse(storedEntries);
      // Sort entries by date descending, then start time descending
      sortEntries();
    } catch (e) {
      console.error('Fehler beim Laden der Einträge:', e);
      state.entries = [];
    }
  }
  
  const storedActiveTimer = localStorage.getItem('zeitkonto_active_timer');
  if (storedActiveTimer) {
    try {
      state.activeTimer = JSON.parse(storedActiveTimer);
      startTimerInterval();
    } catch (e) {
      console.error('Fehler beim Laden des aktiven Timers:', e);
      state.activeTimer = null;
    }
  }
}

function saveData() {
  localStorage.setItem('zeitkonto_entries', JSON.stringify(state.entries));
}

function sortEntries() {
  state.entries.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.start.localeCompare(a.start);
  });
}

// --- Navigation Controller ---
function switchTab(tabId) {
  state.currentTab = tabId;
  
  // Update nav buttons
  DOM.tabs.forEach(tab => {
    if (tab.getAttribute('data-tab') === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update view panes
  DOM.tabPanes.forEach(pane => {
    if (pane.id === `tab-${tabId}`) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
  
  // Special rendering updates on navigation
  if (tabId === 'history') {
    populateFilterDropdowns();
    renderHistory();
  }
}

// --- Timer Controller ---
let timerIntervalId = null;

function handleTimerToggle() {
  if (state.activeTimer) {
    // Stop active timer
    stopTimer();
  } else {
    // Start new timer
    startTimer();
  }
}

function startTimer() {
  const category = DOM.timerCategory.value;
  state.activeTimer = {
    startTime: Date.now(),
    category: category
  };
  localStorage.setItem('zeitkonto_active_timer', JSON.stringify(state.activeTimer));
  
  startTimerInterval();
  renderTimerUI();
}

function startTimerInterval() {
  if (timerIntervalId) clearInterval(timerIntervalId);
  
  timerIntervalId = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay(); // Initial tick
}

function stopTimer() {
  if (!state.activeTimer) return;
  
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  
  const startTime = new Date(state.activeTimer.startTime);
  const endTime = new Date();
  
  // Get formatted strings
  const yyyy = startTime.getFullYear();
  const mm = String(startTime.getMonth() + 1).padStart(2, '0');
  const dd = String(startTime.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  
  const startStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
  const endStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
  
  // Calculate total seconds elapsed to default pause or round duration
  const diffMs = endTime - startTime;
  const diffSec = Math.floor(diffMs / 1000);
  
  // Capture Category
  const category = state.activeTimer.category;
  
  // Clear state
  state.activeTimer = null;
  localStorage.removeItem('zeitkonto_active_timer');
  
  renderTimerUI();
  
  // Pre-fill manual form with timer results and open dialog
  openModal(false);
  
  DOM.entryIdField.value = '';
  DOM.formCategory.value = category;
  DOM.formDate.value = dateStr;
  DOM.formStart.value = startStr;
  DOM.formEnd.value = endStr;
  DOM.formPause.value = '0';
  DOM.formNotes.value = '';
}

function updateTimerDisplay() {
  if (!state.activeTimer) {
    DOM.timerHours.textContent = '00';
    DOM.timerMinutes.textContent = '00';
    DOM.timerSeconds.textContent = '00';
    return;
  }
  
  const elapsedMs = Date.now() - state.activeTimer.startTime;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  DOM.timerHours.textContent = String(hours).padStart(2, '0');
  DOM.timerMinutes.textContent = String(minutes).padStart(2, '0');
  DOM.timerSeconds.textContent = String(seconds).padStart(2, '0');
}

function renderTimerUI() {
  const isRunning = !!state.activeTimer;
  
  if (isRunning) {
    document.querySelector('.timer-card').classList.add('running');
    DOM.btnTimerToggle.className = 'btn btn-primary btn-timer-stop btn-full';
    DOM.btnTimerToggle.innerHTML = '<span class="btn-icon">⏹</span><span class="btn-text">Timer Stoppen</span>';
    
    // Disable category selector while running
    DOM.timerCategory.disabled = true;
    
    const cat = CATEGORIES[state.activeTimer.category];
    DOM.timerStateLabel.textContent = `LÄUFT: ${cat.emoji} ${cat.label}`;
    
    DOM.quickStatusBadge.className = 'status-badge active-tracking';
    DOM.quickStatusBadge.querySelector('.badge-text').textContent = 'Zeiterfassung läuft';
  } else {
    document.querySelector('.timer-card').classList.remove('running');
    DOM.btnTimerToggle.className = 'btn btn-primary btn-timer-start btn-full';
    DOM.btnTimerToggle.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">Timer Starten</span>';
    
    DOM.timerCategory.disabled = false;
    DOM.timerStateLabel.textContent = 'Bereit';
    
    DOM.quickStatusBadge.className = 'status-badge idle';
    DOM.quickStatusBadge.querySelector('.badge-text').textContent = 'Bereit';
    
    updateTimerDisplay();
  }
}

// --- Quick Add & Form Controller ---
function resetFormToDefaults() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  DOM.entryIdField.value = '';
  DOM.formDate.value = `${yyyy}-${mm}-${dd}`;
  DOM.formCategory.value = 'garten';
  
  // Set default hours
  const hours = today.getHours();
  DOM.formStart.value = `${String(hours - 1).padStart(2, '0')}:00`;
  DOM.formEnd.value = `${String(hours).padStart(2, '0')}:00`;
  DOM.formPause.value = '0';
  DOM.formNotes.value = '';
}

function openManualLogWithCategory(category) {
  resetFormToDefaults();
  DOM.formCategory.value = category;
  openModal(false);
}

function openModal(isEdit = false) {
  if (isEdit) {
    DOM.modalTitle.textContent = 'Zeiteintrag bearbeiten';
  } else {
    DOM.modalTitle.textContent = 'Zeiteintrag erfassen';
  }
  DOM.dialogLogEntry.classList.add('open');
}

function closeModal() {
  DOM.dialogLogEntry.classList.remove('open');
}

function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = DOM.entryIdField.value;
  const category = DOM.formCategory.value;
  const date = DOM.formDate.value;
  const start = DOM.formStart.value;
  const end = DOM.formEnd.value;
  const pause = parseInt(DOM.formPause.value) || 0;
  const notes = DOM.formNotes.value.trim();
  
  // Calculate Duration in Decimal Hours
  const duration = calculateDecimalHours(start, end, pause);
  
  if (duration < 0) {
    alert('Die berechnete Arbeitsdauer ist negativ! Bitte überprüfe Start-/Endzeit und Pause.');
    return;
  }
  
  const entryData = {
    id: id || generateUniqueId(),
    category,
    date,
    start,
    end,
    pause,
    notes,
    duration
  };
  
  if (id) {
    // Edit Mode
    const index = state.entries.findIndex(entry => entry.id === id);
    if (index !== -1) {
      state.entries[index] = entryData;
    }
  } else {
    // New Entry Mode
    state.entries.push(entryData);
  }
  
  saveData();
  sortEntries();
  closeModal();
  
  // Reset Form
  resetFormToDefaults();
  
  // Switch to history tab to show the recorded time
  switchTab('history');
}

function calculateDecimalHours(startTimeStr, endTimeStr, pauseMinutes) {
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);
  
  let startMinutesTotal = startH * 60 + startM;
  let endMinutesTotal = endH * 60 + endM;
  
  // Handle night shifts (if end time is earlier than start time, assume it spans midnight)
  if (endMinutesTotal < startMinutesTotal) {
    endMinutesTotal += 24 * 60;
  }
  
  const totalWorkMinutes = endMinutesTotal - startMinutesTotal - pauseMinutes;
  return Number((totalWorkMinutes / 60).toFixed(2));
}

function generateUniqueId() {
  return 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// --- History Controller & Views ---
function populateFilterDropdowns() {
  // Extract unique Year-Month combinations from entries
  const months = new Set();
  state.entries.forEach(entry => {
    if (entry.date) {
      months.add(entry.date.substring(0, 7)); // Takes 'YYYY-MM'
    }
  });
  
  // Sort months descending
  const sortedMonths = Array.from(months).sort().reverse();
  
  // Backup current value
  const currentValue = DOM.filterMonth.value || 'all';
  
  // Re-build options
  DOM.filterMonth.innerHTML = '<option value="all">Alle Monate</option>';
  sortedMonths.forEach(m => {
    const formatted = formatYearMonth(m);
    DOM.filterMonth.innerHTML += `<option value="${m}">${formatted}</option>`;
  });
  
  // Restore value if still valid
  if (Array.from(months).includes(currentValue) || currentValue === 'all') {
    DOM.filterMonth.value = currentValue;
  } else {
    DOM.filterMonth.value = 'all';
    state.filters.month = 'all';
  }
}

function formatYearMonth(yearMonthStr) {
  const [year, month] = yearMonthStr.split('-');
  const dateObj = new Date(year, month - 1, 1);
  return dateObj.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function formatDateGerman(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

function renderHistory() {
  const container = DOM.entriesContainer;
  container.innerHTML = '';
  
  // Apply filtering
  const filtered = state.entries.filter(entry => {
    const matchCat = state.filters.category === 'all' || entry.category === state.filters.category;
    const matchMonth = state.filters.month === 'all' || entry.date.startsWith(state.filters.month);
    return matchCat && matchMonth;
  });
  
  // Compute Stats
  let totalHours = 0;
  filtered.forEach(e => totalHours += e.duration);
  
  DOM.statTotalHours.textContent = totalHours.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' Std.';
  DOM.statTotalCount.textContent = filtered.length;
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">🏜️</div>
        <p>Keine Einträge für diese Auswahl gefunden.</p>
      </div>`;
    return;
  }
  
  // Group entries by date
  const grouped = {};
  filtered.forEach(entry => {
    if (!grouped[entry.date]) {
      grouped[entry.date] = [];
    }
    grouped[entry.date].push(entry);
  });
  
  // Render Grouped List
  Object.keys(grouped).forEach(date => {
    const dayEntries = grouped[date];
    
    // Daily Header
    const formattedDate = formatDateGerman(date);
    const weekday = new Date(date).toLocaleDateString('de-DE', { weekday: 'short' });
    
    const dayHeader = document.createElement('div');
    dayHeader.className = 'section-title-wrap';
    dayHeader.style.marginTop = '15px';
    dayHeader.style.marginBottom = '8px';
    dayHeader.innerHTML = `<h3 style="font-size: 0.95rem; color: var(--text-secondary);">${weekday}, ${formattedDate}</h3>`;
    container.appendChild(dayHeader);
    
    dayEntries.forEach(entry => {
      const cat = CATEGORIES[entry.category] || CATEGORIES.sonstiges;
      
      const item = document.createElement('div');
      item.className = `entry-item cat-${entry.category}`;
      item.innerHTML = `
        <div class="entry-indicator themed"></div>
        <div class="entry-main">
          <div class="entry-row-top">
            <span class="entry-cat-badge">${cat.emoji} ${cat.label}</span>
            <span class="entry-duration">${entry.duration.toLocaleString('de-DE')} Std.</span>
          </div>
          <div class="entry-details">
            <span>🕐 ${entry.start} – ${entry.end} Uhr</span>
            ${entry.pause > 0 ? `<span>⏸️ ${entry.pause} Min. Pause</span>` : ''}
          </div>
          ${entry.notes ? `<div class="entry-note">${entry.notes}</div>` : ''}
        </div>
        <div class="entry-actions">
          <button class="btn-icon-only btn-edit" title="Bearbeiten">✏️</button>
          <button class="btn-icon-only btn-delete" title="Löschen">🗑️</button>
        </div>
      `;
      
      // Wire Actions
      item.querySelector('.btn-edit').addEventListener('click', () => editEntry(entry.id));
      item.querySelector('.btn-delete').addEventListener('click', () => deleteEntry(entry.id));
      
      container.appendChild(item);
    });
  });
}

function editEntry(id) {
  const entry = state.entries.find(e => e.id === id);
  if (!entry) return;
  
  DOM.entryIdField.value = entry.id;
  DOM.formCategory.value = entry.category;
  DOM.formDate.value = entry.date;
  DOM.formStart.value = entry.start;
  DOM.formEnd.value = entry.end;
  DOM.formPause.value = entry.pause;
  DOM.formNotes.value = entry.notes || '';
  
  openModal(true);
}

function deleteEntry(id) {
  if (confirm('Möchtest du diesen Zeiteintrag wirklich unwiderruflich löschen?')) {
    state.entries = state.entries.filter(e => e.id !== id);
    saveData();
    populateFilterDropdowns();
    renderHistory();
  }
}

// --- PDF Print Report Generator ---
function handlePrintReport() {
  // Only print the currently filtered entries in history
  const filtered = state.entries.filter(entry => {
    const matchCat = state.filters.category === 'all' || entry.category === state.filters.category;
    const matchMonth = state.filters.month === 'all' || entry.date.startsWith(state.filters.month);
    return matchCat && matchMonth;
  });
  
  if (filtered.length === 0) {
    alert('Keine Einträge für den aktuellen Filter vorhanden. Bitte passe deinen Filter an.');
    return;
  }
  
  // Format Month Title
  let periodTitle = "Alle Aufzeichnungen";
  if (state.filters.month !== 'all') {
    periodTitle = formatYearMonth(state.filters.month);
  }
  
  // Calculate total hours
  let totalHours = 0;
  filtered.forEach(e => totalHours += e.duration);
  
  // Set Print Container Details
  DOM.printReportPeriod.innerHTML = `<strong>Berichtszeitraum:</strong> ${periodTitle}`;
  DOM.printReportDate.textContent = new Date().toLocaleDateString('de-DE');
  DOM.printTotalHours.textContent = totalHours.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  
  // Populate Table rows
  DOM.printTableBody.innerHTML = '';
  // Sort reverse (oldest first for official lists)
  const sortedForPrint = [...filtered].sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.start.localeCompare(b.start);
  });
  
  sortedForPrint.forEach(entry => {
    const cat = CATEGORIES[entry.category] || CATEGORIES.sonstiges;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDateGerman(entry.date)}</td>
      <td>${cat.emoji} ${cat.label}</td>
      <td>${entry.start} - ${entry.end}</td>
      <td>${entry.pause > 0 ? entry.pause + ' Min.' : '-'}</td>
      <td>${entry.duration.toLocaleString('de-DE')} Std.</td>
      <td>${entry.notes || '-'}</td>
    `;
    DOM.printTableBody.appendChild(row);
  });
  
  // Launch Print Window (Safari/iOS triggers share sheet to save PDF directly)
  window.print();
}

// --- Backup & Settings Controller ---
function exportToCSV() {
  if (state.entries.length === 0) {
    alert('Es gibt keine Daten zum Exportieren.');
    return;
  }
  
  // Header
  let csvContent = 'Datum;Kategorie;Startzeit;Endzeit;Pause (Minuten);Dauer (Stunden);Notiz/Bemerkung\r\n';
  
  // Rows
  state.entries.forEach(entry => {
    const cat = CATEGORIES[entry.category]?.label || entry.category;
    const row = [
      formatDateGerman(entry.date),
      cat,
      entry.start,
      entry.end,
      entry.pause,
      entry.duration.toString().replace('.', ','), // Decimal comma for german Excel
      `"${(entry.notes || '').replace(/"/g, '""')}"` // Escape double quotes
    ];
    csvContent += row.join(';') + '\r\n';
  });
  
  // Generate download
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // UTF-8 BOM
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().substring(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `Hausmeister_Zeiterfassung_${dateStr}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  if (file.name.endsWith('.json')) {
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          if (confirm(`Möchtest du ${imported.length} Einträge importieren? Bestehende Einträge werden beibehalten.`)) {
            state.entries = [...state.entries, ...imported];
            // Deduplicate by ID just in case
            const ids = new Set();
            state.entries = state.entries.filter(e => {
              if (ids.has(e.id)) return false;
              ids.add(e.id);
              return true;
            });
            saveData();
            sortEntries();
            populateFilterDropdowns();
            renderHistory();
            alert('JSON-Daten erfolgreich importiert!');
          }
        } else {
          alert('Ungültiges Format. Die JSON-Datei muss ein Array von Zeiteinträgen sein.');
        }
      } catch (err) {
        alert('Fehler beim Lesen der JSON-Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
  } else if (file.name.endsWith('.csv')) {
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        const importedEntries = [];
        
        // Skip header line
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Parse semicolon separated values
          // Format: Datum;Kategorie;Startzeit;Endzeit;Pause;Dauer;Notiz
          // Simple CSV parser
          const parts = [];
          let currentPart = '';
          let insideQuotes = false;
          
          for (let c = 0; c < line.length; c++) {
            const char = line[c];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ';' && !insideQuotes) {
              parts.push(currentPart.trim());
              currentPart = '';
            } else {
              currentPart += char;
            }
          }
          parts.push(currentPart.trim());
          
          if (parts.length >= 6) {
            // Reconstruct Date from German dd.mm.yyyy to yyyy-mm-dd
            const dPart = parts[0].split('.');
            if (dPart.length !== 3) continue;
            const dateStr = `${dPart[2]}-${dPart[1]}-${dPart[0]}`;
            
            // Map category label back to key
            let categoryKey = 'sonstiges';
            const catLabel = parts[1];
            for (const [key, val] of Object.entries(CATEGORIES)) {
              if (val.label.toLowerCase() === catLabel.toLowerCase()) {
                categoryKey = key;
                break;
              }
            }
            
            const start = parts[2];
            const end = parts[3];
            const pause = parseInt(parts[4]) || 0;
            const duration = parseFloat(parts[5].replace(',', '.')) || 0;
            const notes = parts[6] ? parts[6].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
            
            importedEntries.push({
              id: generateUniqueId(),
              category: categoryKey,
              date: dateStr,
              start,
              end,
              pause,
              notes,
              duration
            });
          }
        }
        
        if (importedEntries.length > 0) {
          if (confirm(`Möchtest du ${importedEntries.length} Einträge aus der CSV-Datei importieren?`)) {
            state.entries = [...state.entries, ...importedEntries];
            saveData();
            sortEntries();
            populateFilterDropdowns();
            renderHistory();
            alert('CSV-Daten erfolgreich importiert!');
          }
        } else {
          alert('Keine gültigen Einträge in der CSV gefunden.');
        }
      } catch (err) {
        alert('Fehler beim Importieren der CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
  
  // Reset file input so same file can be imported again
  DOM.importFileInput.value = '';
}

function clearAllData() {
  if (confirm('Möchtest du wirklich ALLE deine Zeiteinträge unwiderruflich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.')) {
    if (confirm('Bist du absolut sicher? Alle Daten gehen verloren!')) {
      state.entries = [];
      saveData();
      populateFilterDropdowns();
      renderHistory();
      alert('Alle Daten wurden gelöscht.');
    }
  }
}

// --- Main Render coordinator ---
function renderAll() {
  renderTimerUI();
  populateFilterDropdowns();
  renderHistory();
}
