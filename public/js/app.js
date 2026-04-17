/**
 * The Design of Pablo — app.js
 * Camera capture, AI analysis, design system rendering, and Figma prompt generation
 */

// ═══════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════

const state = {
  currentStep: 1,
  imageFile: null,
  imageDataUrl: null,
  designSystem: null,
  themesList: [],
  activeThemeIndex: 0,
};

// Initialize WebSocket
const socket = io();

// ═══════════════════════════════════════════════
// DOM References
// ═══════════════════════════════════════════════

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  // Panels
  stepCapture: $('#step-capture'),
  stepAnalyze: $('#step-analyze'),
  stepResults: $('#step-results'),

  // Step indicators
  stepDots: $$('#step-indicator .step'),
  stepLines: $$('#step-indicator .step-line'),

  // Capture
  cameraInput: $('#camera-input'),
  fileInput: $('#file-input'),
  captureZone: $('#capture-zone'),
  imagePreview: $('#image-preview'),
  previewImg: $('#preview-img'),
  retakeBtn: $('#retake-btn'),
  analyzeBtn: $('#analyze-btn'),

  // Analyze
  analyzeThumb: $('#analyze-thumb'),
  analyzeStatus: $('#analyze-status'),

  // Results
  resultsThumb: $('#results-thumb'),
  styleBadge: $('#style-badge'),
  moodText: $('#mood-text'),
  atmosphereText: $('#atmosphere-text'),
  colorGrid: $('#color-grid'),
  themeGrid: $('#theme-grid'),
  typographyCard: $('#typography-card'),
  designNotes: $('#design-notes'),
  connectionStatus: $('#connection-status'),
  pushFigmaBtn: $('#push-figma-btn'),
  copyJsonBtn: $('#copy-json-btn'),
  restartBtn: $('#restart-btn'),

  // Toast
  toast: $('#toast'),
  toastMessage: $('#toast-message'),
};

// ═══════════════════════════════════════════════
// Event Listeners
// ═══════════════════════════════════════════════

function init() {
  // Camera and file inputs
  els.cameraInput.addEventListener('change', handleImageSelect);
  els.fileInput.addEventListener('change', handleImageSelect);

  // Buttons
  els.retakeBtn.addEventListener('click', handleRetake);
  els.analyzeBtn.addEventListener('click', handleAnalyze);
  els.pushFigmaBtn.addEventListener('click', handlePushToFigma);
  els.copyJsonBtn.addEventListener('click', handleCopyJson);
  els.restartBtn.addEventListener('click', handleRestart);

  // Socket Connection Status UI
  socket.on('connect', () => {
    // Just updates the client that it has connected to the Node server
    // Not necessarily confirming Figma is listening, but sets base state.
  });

  socket.on('apply_design_system', () => {
    els.connectionStatus.textContent = '🟢 Success! Figma was updated.';
    els.connectionStatus.style.color = '#2ecc71';
    
    setTimeout(() => {
      els.connectionStatus.textContent = '🟢 Ready to send.';
    }, 4000);
  });

  // Check server health
  checkHealth();
}

// ═══════════════════════════════════════════════
// Image Handling
// ═══════════════════════════════════════════════

function handleImageSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  state.imageFile = file;

  // Create preview
  const reader = new FileReader();
  reader.onload = (e) => {
    state.imageDataUrl = e.target.result;
    els.previewImg.src = state.imageDataUrl;
    els.captureZone.classList.add('hidden');
    els.imagePreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function handleRetake() {
  state.imageFile = null;
  state.imageDataUrl = null;
  els.cameraInput.value = '';
  els.fileInput.value = '';
  els.previewImg.src = '';
  els.captureZone.classList.remove('hidden');
  els.imagePreview.classList.add('hidden');
}

// ═══════════════════════════════════════════════
// Analysis
// ═══════════════════════════════════════════════

async function handleAnalyze() {
  if (!state.imageFile) return;

  // Move to step 2
  goToStep(2);
  els.analyzeThumb.src = state.imageDataUrl;

  const statusMessages = [
    'Scanning visual elements…',
    'Extracting color harmonies…',
    'Analyzing mood and style…',
    'Building typography profile…',
    'Generating design system…',
  ];

  let msgIndex = 0;
  const statusInterval = setInterval(() => {
    msgIndex = (msgIndex + 1) % statusMessages.length;
    els.analyzeStatus.textContent = statusMessages[msgIndex];
  }, 2500);

  try {
    const formData = new FormData();
    formData.append('image', state.imageFile);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    clearInterval(statusInterval);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.details || err.error || 'Analysis failed');
    }

    const data = await response.json();
    state.designSystem = data.designSystem;

    // Move to step 3
    renderResults();
    goToStep(3);

  } catch (error) {
    clearInterval(statusInterval);
    console.error('Analysis error:', error);
    showToast(`Error: ${error.message}`, 'error');
    goToStep(1);
  }
}

// ═══════════════════════════════════════════════
// Render Results
// ═══════════════════════════════════════════════

function renderResults() {
  const ds = state.designSystem;
  if (!ds) return;

  // Header
  els.resultsThumb.src = state.imageDataUrl;
  els.styleBadge.textContent = ds.style || 'Extracted Style';
  els.moodText.textContent = ds.mood || '';
  els.atmosphereText.textContent = ds.atmosphere || '';

  // Colors
  renderColorPalette(ds);

  // Themes
  generateThemes(ds);
  renderThemes();

  // Typography
  renderTypography(ds);

  // Design Notes
  els.designNotes.textContent = ds.designNotes || '';

  // Load suggested fonts
  loadGoogleFonts(ds.typography?.suggestedFonts);
  
  els.connectionStatus.textContent = '🟢 Ready to send.';
  els.connectionStatus.style.color = '#2ecc71';
}

function renderColorPalette(ds) {
  const colors = ds.colors || {};
  const names = ds.colorNames || {};
  const grid = els.colorGrid;
  grid.innerHTML = '';

  const colorEntries = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'text', label: 'Text', fullWidth: true },
    { key: 'textSecondary', label: 'Text Secondary', fullWidth: true },
  ];

  colorEntries.forEach(({ key, label, fullWidth }) => {
    const hex = colors[key];
    if (!hex) return;

    const card = document.createElement('div');
    card.className = `color-card${fullWidth ? ' full-width' : ''}`;
    card.innerHTML = `
      <div class="color-swatch" style="background: ${hex}"></div>
      <div class="color-info">
        <div class="color-name">${label}</div>
        <div class="color-hex">${hex}</div>
        ${names[key] ? `<div class="color-evocative">${names[key]}</div>` : ''}
      </div>
    `;

    // Copy hex on click
    card.addEventListener('click', () => {
      navigator.clipboard.writeText(hex).then(() => {
        showToast(`Copied ${hex}`);
      });
    });

    grid.appendChild(card);
  });
}

function generateThemes(ds) {
  const c = ds.colors || {};
  
  // Theme 1: Original
  const t1 = JSON.parse(JSON.stringify(ds));
  
  // Theme 2: Bold Primary
  const t2 = JSON.parse(JSON.stringify(ds));
  t2.colors.background = c.primary;
  t2.colors.surface = c.secondary;
  t2.colors.text = c.surface || '#ffffff';
  t2.colors.primary = c.accent || c.text;
  t2.colors.accent = c.background;
  
  // Theme 3: High Contrast (Dark)
  const t3 = JSON.parse(JSON.stringify(ds));
  t3.colors.background = c.text;
  t3.colors.surface = c.textSecondary;
  t3.colors.text = c.background;
  t3.colors.primary = c.accent;
  t3.colors.accent = c.primary;
  
  // Theme 4: Subtle Accent
  const t4 = JSON.parse(JSON.stringify(ds));
  t4.colors.background = c.accent;
  t4.colors.surface = c.primary;
  t4.colors.text = c.text;
  t4.colors.primary = c.background;
  t4.colors.accent = c.secondary;

  state.themesList = [
    { name: 'Original', data: t1 },
    { name: 'Bold Primary', data: t2 },
    { name: 'High Contrast', data: t3 },
    { name: 'Subtle Accent', data: t4 }
  ];
  state.activeThemeIndex = 0;
}

function renderThemes() {
  const grid = els.themeGrid;
  grid.innerHTML = '';
  
  state.themesList.forEach((theme, index) => {
    const card = document.createElement('div');
    card.className = `theme-card ${index === state.activeThemeIndex ? 'active' : ''}`;
    
    // Preview uses the theme's colors
    const c = theme.data.colors;
    
    card.innerHTML = `
      <div class="theme-preview" style="background: ${c.background}; color: ${c.text};">
        <div>
          <div class="theme-preview-title" style="color: ${c.primary}; font-family: '${theme.data.typography.suggestedFonts.heading}'">Heading</div>
          <div class="theme-preview-text" style="color: ${c.textSecondary}; font-family: '${theme.data.typography.suggestedFonts.body}'">Body typography example</div>
        </div>
        <div class="theme-preview-btn" style="background: ${c.accent}; color: ${c.background || '#fff'}">Button</div>
      </div>
      <div class="theme-info">${theme.name}</div>
    `;
    
    card.addEventListener('click', () => {
      state.activeThemeIndex = index;
      // Re-render to update 'active' class
      renderThemes();
    });
    
    grid.appendChild(card);
  });
}

function renderTypography(ds) {
  const typo = ds.typography || {};
  const fonts = typo.suggestedFonts || {};
  const card = els.typographyCard;

  card.innerHTML = `
    <div class="type-specimen">
      <span class="type-label">Heading — ${fonts.heading || 'Serif'}</span>
      <div class="type-sample heading" style="font-family: '${fonts.heading}', serif">
        The quick brown fox
      </div>
      <span class="type-meta">${typo.headingStyle || ''}</span>
    </div>
    <div class="type-divider"></div>
    <div class="type-specimen">
      <span class="type-label">Body — ${fonts.body || 'Sans-serif'}</span>
      <div class="type-sample body" style="font-family: '${fonts.body}', sans-serif">
        Typography is the art of arranging type to make written language legible, readable, and appealing when displayed.
      </div>
      <span class="type-meta">${typo.bodyStyle || ''}</span>
    </div>
  `;
}

function loadGoogleFonts(fonts) {
  if (!fonts) return;

  const families = [];
  if (fonts.heading) families.push(fonts.heading.replace(/ /g, '+') + ':wght@400;700');
  if (fonts.body) families.push(fonts.body.replace(/ /g, '+') + ':wght@300;400;500');

  if (families.length === 0) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

// ═══════════════════════════════════════════════
// WebSocket Push
// ═══════════════════════════════════════════════

function handlePushToFigma() {
  if (!state.themesList || state.themesList.length === 0) return;
  const ds = state.themesList[state.activeThemeIndex].data;

  const btn = els.pushFigmaBtn;
  const originalText = btn.innerHTML;
  
  btn.innerHTML = '<span class="btn-icon">⏳</span> Pushing...';
  btn.disabled = true;

  // Emit the design system via WebSocket
  socket.emit('push_design_system', ds);

  showToast('Push sent to Figma Plugin!');

  setTimeout(() => {
    btn.innerHTML = '<span class="btn-icon">✅</span> Pushed!';
    btn.classList.add('copied');
    
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
      btn.classList.remove('copied');
    }, 2000);
  }, 500);
}

async function handleCopyJson() {
  if (!state.designSystem) return;

  try {
    const json = JSON.stringify(state.designSystem, null, 2);
    await navigator.clipboard.writeText(json);
    const btn = els.copyJsonBtn;
    btn.classList.add('copied');
    btn.textContent = '✅ JSON Copied!';
    showToast('Design system JSON copied');

    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = 'Copy Raw Design System JSON';
    }, 2000);
  } catch {
    showToast('Failed to copy', 'error');
  }
}

// ═══════════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════════

function goToStep(step) {
  state.currentStep = step;

  // Update panels
  [els.stepCapture, els.stepAnalyze, els.stepResults].forEach((panel, i) => {
    panel.classList.toggle('active', i + 1 === step);
  });

  // Update step indicators
  els.stepDots.forEach((dot, i) => {
    const stepNum = i + 1;
    dot.classList.toggle('active', stepNum === step);
    dot.classList.toggle('completed', stepNum < step);
  });

  // Update step lines
  els.stepLines.forEach((line, i) => {
    line.classList.toggle('active', i + 1 < step);
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleRestart() {
  state.imageFile = null;
  state.imageDataUrl = null;
  state.designSystem = null;
  state.themesList = [];
  state.activeThemeIndex = 0;

  els.cameraInput.value = '';
  els.fileInput.value = '';
  els.previewImg.src = '';
  els.captureZone.classList.remove('hidden');
  els.imagePreview.classList.add('hidden');
  els.colorGrid.innerHTML = '';
  els.themeGrid.innerHTML = '';
  els.connectionStatus.textContent = '🟡 Waiting for connection...';
  els.connectionStatus.style.color = '#f39c12';

  goToStep(1);
}

// ═══════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════

function showToast(message, type = 'success') {
  const toast = els.toast;
  els.toastMessage.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.className = 'toast hidden';
  }, 3000);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (!data.geminiConfigured) {
      showToast('⚠️ Gemini API key not configured. Add it to .env', 'error');
    }
  } catch {
    // Server might not be running in dev
  }
}

// ═══════════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', init);
